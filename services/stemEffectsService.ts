// Stem Effects Service — Per-stem audio processing with Web Audio API

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

function writeWavHeader(sampleRate: number, numChannels: number, dataLength: number) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    return buffer;
}

async function bufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2;
    const header = writeWavHeader(buffer.sampleRate, numChannels, length);
    const wavData = new Uint8Array(header.byteLength + length);
    wavData.set(new Uint8Array(header), 0);
    const view = new DataView(wavData.buffer);
    const channels = [];
    for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const s = Math.max(-1, Math.min(1, channels[ch][i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
    }
    return new Blob([wavData], { type: 'audio/wav' });
}

export interface StemEffectParams {
    gain: number;      // 0 to 2 (1 = unity)
    pan: number;       // -1 (left) to 1 (right)
    mute: boolean;
    solo: boolean;
    eqLow: number;     // -12 to 12 dB
    eqMid: number;     // -12 to 12 dB
    eqHigh: number;    // -12 to 12 dB
    reverbSend: number; // 0 to 1
    delaySend: number;  // 0 to 1
}

export const DEFAULT_STEM_EFFECTS: StemEffectParams = {
    gain: 1, pan: 0, mute: false, solo: false,
    eqLow: 0, eqMid: 0, eqHigh: 0,
    reverbSend: 0, delaySend: 0,
};

export type StemName = 'vocals' | 'drums' | 'bass' | 'other';

export const STEM_COLORS: Record<StemName, string> = {
    vocals: 'from-cyan-500 to-blue-500',
    drums: 'from-amber-500 to-orange-500',
    bass: 'from-violet-500 to-purple-500',
    other: 'from-emerald-500 to-teal-500',
};

export const STEM_ICONS: Record<StemName, string> = {
    vocals: '🎤', drums: '🥁', bass: '🎸', other: '🎹',
};

/**
 * Create a simple convolution reverb impulse response
 */
function createReverbImpulse(ctx: OfflineAudioContext, duration: number = 2, decay: number = 3): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
}

/**
 * Apply effects to multiple stems and bounce to a single stereo WAV
 */
export async function bounceStemMix(
    stemUrls: Record<StemName, string>,
    effects: Record<StemName, StemEffectParams>
): Promise<Blob> {
    // 1. Fetch and decode all stems
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioCtx();
    const buffers: Record<string, AudioBuffer> = {};

    for (const [name, url] of Object.entries(stemUrls)) {
        const res = await fetch(url);
        const ab = await res.arrayBuffer();
        buffers[name] = await tempCtx.decodeAudioData(ab);
    }
    tempCtx.close();

    // 2. Find max length
    const maxLength = Math.max(...Object.values(buffers).map(b => b.length));
    const sampleRate = Object.values(buffers)[0]?.sampleRate || 44100;

    // 3. Check if any stem is soloed
    const hasSolo = Object.values(effects).some(e => e.solo);

    // 4. Create offline context
    const offlineCtx = new OfflineAudioContext(2, maxLength, sampleRate);

    // Create reverb
    const reverbImpulse = createReverbImpulse(offlineCtx);
    const reverbNode = offlineCtx.createConvolver();
    reverbNode.buffer = reverbImpulse;
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = 0.3;
    reverbNode.connect(reverbGain);
    reverbGain.connect(offlineCtx.destination);

    // Create delay
    const delayNode = offlineCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.375; // Dotted eighth
    const delayFeedback = offlineCtx.createGain();
    delayFeedback.gain.value = 0.35;
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = 0.25;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(offlineCtx.destination);

    // 5. Process each stem
    for (const [name, buffer] of Object.entries(buffers)) {
        const stemName = name as StemName;
        const fx = effects[stemName] || DEFAULT_STEM_EFFECTS;

        // Skip muted stems, or non-soloed stems when solo is active
        if (fx.mute) continue;
        if (hasSolo && !fx.solo) continue;

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        // Gain
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = fx.gain;

        // Pan
        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = fx.pan;

        // 3-Band EQ
        const eqLow = offlineCtx.createBiquadFilter();
        eqLow.type = 'lowshelf';
        eqLow.frequency.value = 200;
        eqLow.gain.value = fx.eqLow;

        const eqMid = offlineCtx.createBiquadFilter();
        eqMid.type = 'peaking';
        eqMid.frequency.value = 1000;
        eqMid.Q.value = 0.7;
        eqMid.gain.value = fx.eqMid;

        const eqHigh = offlineCtx.createBiquadFilter();
        eqHigh.type = 'highshelf';
        eqHigh.frequency.value = 5000;
        eqHigh.gain.value = fx.eqHigh;

        // Connect chain
        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(eqLow);
        eqLow.connect(eqMid);
        eqMid.connect(eqHigh);
        eqHigh.connect(offlineCtx.destination);

        // Reverb send
        if (fx.reverbSend > 0) {
            const reverbSend = offlineCtx.createGain();
            reverbSend.gain.value = fx.reverbSend;
            eqHigh.connect(reverbSend);
            reverbSend.connect(reverbNode);
        }

        // Delay send
        if (fx.delaySend > 0) {
            const delaySendGain = offlineCtx.createGain();
            delaySendGain.gain.value = fx.delaySend;
            eqHigh.connect(delaySendGain);
            delaySendGain.connect(delayNode);
        }

        source.start();
    }

    // 6. Render
    const rendered = await offlineCtx.startRendering();
    return bufferToWav(rendered);
}
