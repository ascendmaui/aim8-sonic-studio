
// Helper to write WAV header
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
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
            let s = Math.max(-1, Math.min(1, channels[ch][i]));
            s = s + (Math.random() - 0.5) * 0.00001;
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
    }
    return new Blob([wavData], { type: 'audio/wav' });
}

export type MasteringPreset =
    | 'studio' | 'bass' | 'bright' | 'radio' | 'ai'
    | 'vinyl' | 'lofi' | 'theater' | 'club' | 'podcast';

export interface PresetInfo {
    id: MasteringPreset;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: 'classic' | 'creative' | 'specialized';
}

export const MASTERING_PRESETS: PresetInfo[] = [
    // Classic
    { id: 'studio', name: 'Studio', description: 'Balanced modern sound', icon: '🎛️', color: 'from-cyan-500 to-blue-500', category: 'classic' },
    { id: 'bass', name: 'Bass Boost', description: 'Heavy low-end punch', icon: '🔊', color: 'from-violet-500 to-purple-500', category: 'classic' },
    { id: 'bright', name: 'Bright', description: 'Vocal & treble focus', icon: '✨', color: 'from-amber-400 to-yellow-500', category: 'classic' },
    { id: 'radio', name: 'Radio', description: 'Broadcast-ready compression', icon: '📻', color: 'from-rose-500 to-pink-500', category: 'classic' },
    { id: 'ai', name: 'AI Master', description: 'Intelligent adaptive chain', icon: '🤖', color: 'from-emerald-500 to-teal-500', category: 'classic' },
    // Creative
    { id: 'vinyl', name: 'Vinyl', description: 'Warm analog saturation', icon: '💿', color: 'from-orange-500 to-amber-600', category: 'creative' },
    { id: 'lofi', name: 'Lo-Fi', description: 'Nostalgic filtered warmth', icon: '📼', color: 'from-pink-400 to-rose-400', category: 'creative' },
    { id: 'theater', name: 'Theater', description: 'Cinematic wide stereo', icon: '🎬', color: 'from-indigo-500 to-blue-600', category: 'creative' },
    // Specialized
    { id: 'club', name: 'Club', description: 'Dancefloor-ready bass', icon: '🪩', color: 'from-fuchsia-500 to-purple-600', category: 'specialized' },
    { id: 'podcast', name: 'Podcast', description: 'Speech-optimized clarity', icon: '🎙️', color: 'from-slate-400 to-slate-600', category: 'specialized' },
];

export const masterTrack = async (audioUrl: string, preset: MasteringPreset = 'studio'): Promise<Blob> => {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioContextClass();
    const decoded = await tempCtx.decodeAudioData(arrayBuffer);

    const offlineCtx = new OfflineAudioContext(2, decoded.length, decoded.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;

    // Mastering Chain
    const preGain = offlineCtx.createGain();
    preGain.gain.value = 0.85;

    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 85;

    const midEq = offlineCtx.createBiquadFilter();
    midEq.type = 'peaking';
    midEq.frequency.value = 500;
    midEq.Q.value = 0.5;

    const presence = offlineCtx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3000;
    presence.Q.value = 0.7;

    const highShelf = offlineCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 10000;

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.knee.value = 10;
    compressor.attack.value = 0.03;
    compressor.release.value = 0.25;

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    // Additional nodes for creative presets
    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 20000; // Default: no filtering

    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 20; // Default: no filtering

    switch (preset) {
        case 'studio':
            lowShelf.gain.value = 2.5;
            midEq.gain.value = -1.5;
            presence.gain.value = 2;
            highShelf.gain.value = 3;
            compressor.threshold.value = -20;
            compressor.ratio.value = 2.5;
            break;

        case 'bass':
            lowShelf.frequency.value = 100;
            lowShelf.gain.value = 6;
            midEq.gain.value = -2;
            highShelf.gain.value = 1.5;
            compressor.threshold.value = -24;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.05;
            break;

        case 'bright':
            lowShelf.gain.value = 0;
            midEq.frequency.value = 800;
            midEq.gain.value = -3;
            presence.gain.value = 4;
            highShelf.gain.value = 5;
            compressor.threshold.value = -18;
            compressor.ratio.value = 2;
            break;

        case 'radio':
            preGain.gain.value = 1.2;
            lowShelf.gain.value = 2;
            midEq.gain.value = 1;
            highShelf.gain.value = 2;
            compressor.threshold.value = -30;
            compressor.ratio.value = 6;
            compressor.release.value = 0.1;
            break;

        case 'ai':
            preGain.gain.value = 0.9;
            lowShelf.gain.value = 3;
            lowShelf.frequency.value = 90;
            midEq.gain.value = -1;
            midEq.frequency.value = 600;
            presence.gain.value = 3;
            presence.frequency.value = 3500;
            highShelf.gain.value = 3.5;
            highShelf.frequency.value = 12000;
            compressor.threshold.value = -22;
            compressor.ratio.value = 3;
            compressor.knee.value = 15;
            compressor.attack.value = 0.02;
            compressor.release.value = 0.2;
            limiter.threshold.value = -0.5;
            break;

        // --- New Creative Presets ---

        case 'vinyl':
            // Warm analog saturation with gentle high-end roll-off
            preGain.gain.value = 1.1; // Push into soft saturation
            lowShelf.gain.value = 3;
            lowShelf.frequency.value = 100;
            midEq.gain.value = 1; // Slight mid warmth
            midEq.frequency.value = 700;
            presence.gain.value = -1; // Slightly recessed presence
            highShelf.gain.value = -2; // Roll off highs
            lowpass.frequency.value = 12000; // Vinyl roll-off
            compressor.threshold.value = -18;
            compressor.ratio.value = 3;
            compressor.knee.value = 20; // Very soft knee
            compressor.attack.value = 0.05;
            compressor.release.value = 0.3;
            break;

        case 'lofi':
            // Nostalgic lo-fi with filtered warmth
            preGain.gain.value = 0.75;
            lowShelf.gain.value = 2;
            lowShelf.frequency.value = 120;
            midEq.gain.value = 3; // Boost mids for that lo-fi body
            midEq.frequency.value = 800;
            midEq.Q.value = 1.2;
            presence.gain.value = -3; // Cut presence
            highShelf.gain.value = -6; // Heavy high cut
            lowpass.frequency.value = 8000; // Aggressive LP filter
            highpass.frequency.value = 80; // Remove sub rumble
            compressor.threshold.value = -28;
            compressor.ratio.value = 5;
            compressor.attack.value = 0.08;
            compressor.release.value = 0.15;
            break;

        case 'theater':
            // Cinematic wide stereo with depth
            preGain.gain.value = 0.8;
            lowShelf.gain.value = 4; // Deep foundation
            lowShelf.frequency.value = 60;
            midEq.gain.value = -2; // Scoop mids for width
            midEq.frequency.value = 400;
            midEq.Q.value = 0.3; // Wide Q
            presence.gain.value = 3;
            presence.frequency.value = 4000;
            highShelf.gain.value = 4; // Air and sparkle
            highShelf.frequency.value = 14000;
            compressor.threshold.value = -16;
            compressor.ratio.value = 2;
            compressor.knee.value = 15;
            compressor.attack.value = 0.01;
            compressor.release.value = 0.4; // Slow release for cinematic feel
            limiter.threshold.value = -2; // More headroom
            break;

        case 'club':
            // Dancefloor-ready with sub boost and punch
            preGain.gain.value = 1.15;
            lowShelf.gain.value = 7; // Heavy sub boost
            lowShelf.frequency.value = 80;
            midEq.gain.value = -3; // Cut muddiness
            midEq.frequency.value = 300;
            presence.gain.value = 2;
            presence.frequency.value = 5000;
            highShelf.gain.value = 2;
            compressor.threshold.value = -26;
            compressor.ratio.value = 5;
            compressor.attack.value = 0.002; // Ultra-fast for punch
            compressor.release.value = 0.08; // Fast release
            limiter.threshold.value = -0.3; // Tight ceiling
            break;

        case 'podcast':
            // Speech-optimized with clarity and warmth
            preGain.gain.value = 0.9;
            lowShelf.gain.value = -2; // Reduce rumble
            lowShelf.frequency.value = 120;
            midEq.gain.value = 2; // Warm body
            midEq.frequency.value = 250;
            midEq.Q.value = 0.8;
            presence.gain.value = 5; // Strong vocal clarity
            presence.frequency.value = 3000;
            presence.Q.value = 1.0;
            highShelf.gain.value = 2; // Gentle air
            highShelf.frequency.value = 8000;
            highpass.frequency.value = 80; // Cut rumble
            compressor.threshold.value = -24;
            compressor.ratio.value = 4;
            compressor.knee.value = 8;
            compressor.attack.value = 0.01;
            compressor.release.value = 0.15;
            break;
    }

    // Connect Graph (with LP/HP filters)
    source.connect(preGain);
    preGain.connect(highpass);
    highpass.connect(lowShelf);
    lowShelf.connect(midEq);
    midEq.connect(presence);
    presence.connect(highShelf);
    highShelf.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(offlineCtx.destination);

    source.start();
    const renderedBuffer = await offlineCtx.startRendering();
    return bufferToWav(renderedBuffer);
};
