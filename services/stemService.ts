import JSZip from 'jszip';
import { SunoTrack } from '../types';

// Helper to write WAV header
function writeWavHeader(sampleRate: number, numChannels: number, dataLength: number) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true); // PCM
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sampleRate * blockAlign)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataLength, true);

    return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

// Digital Signal Processing Separation Engine
export const separateStems = async (track: SunoTrack): Promise<Blob> => {
    // 1. Fetch and Decode Audio
    const response = await fetch(track.audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // 2. Create Offline Context for Fast Rendering
    const offlineCtx = new OfflineAudioContext(2, audioBuffer.length, audioBuffer.sampleRate);

    // 3. Define Stems and Filter Chains
    // We simulate demixing using specialized EQ bands to isolate specific instruments.
    const stemDefinitions = [
        {
            name: 'vocals',
            filters: [
                { type: 'highpass', freq: 300, Q: 0.5 }, // Remove bass/kick
                { type: 'peaking', freq: 3000, Q: 1, gain: 4 } // Boost vocal presence
            ]
        },
        {
            name: 'kick',
            filters: [
                { type: 'lowpass', freq: 100, Q: 1 }, // Isolate sub
                { type: 'peaking', freq: 60, Q: 2, gain: 3 } // Punch
            ]
        },
        {
            name: 'bass',
            filters: [
                { type: 'lowpass', freq: 250, Q: 0.8 }, // Low end
                { type: 'highpass', freq: 60, Q: 1 } // Remove kick overlap
            ]
        },
        {
            name: 'snare',
            filters: [
                { type: 'bandpass', freq: 2000, Q: 1.5 }, // Snap
                { type: 'peaking', freq: 200, Q: 2, gain: 4 } // Body
            ]
        },
        {
            name: 'synth',
            filters: [
                { type: 'highpass', freq: 400, Q: 0.5 }, // Remove mud
                { type: 'lowpass', freq: 4000, Q: 0.5 } // Keep mids
            ]
        },
        {
            name: 'fx',
            filters: [
                { type: 'highpass', freq: 6000, Q: 0.7 }, // Air/Sparkle
                { type: 'peaking', freq: 10000, Q: 1, gain: 2 }
            ]
        }
    ];

    const renderedBuffers: { name: string, buffer: AudioBuffer }[] = [];

    // 4. Render each stem in parallel (simulated by sequential processing for simplicity in offline ctx setup)
    // Actually, we can't reuse offlineCtx easily for multiple different renders in one go unless we connect separate graphs.
    // We will build a graph where we have 6 different destinations? No, OfflineCtx has one destination.
    // We have to run separate renders or use a trick.
    // Better Approach: create 6 separate OfflineAudioContexts (or reuse logic). 
    // Given the memory constraint, let's run them sequentially.

    for (const def of stemDefinitions) {
        const stemCtx = new OfflineAudioContext(2, audioBuffer.length, audioBuffer.sampleRate);
        const source = stemCtx.createBufferSource();
        source.buffer = audioBuffer;

        let lastNode: AudioNode = source;

        // Apply filters
        def.filters.forEach(f => {
            const filter = stemCtx.createBiquadFilter();
            filter.type = f.type as BiquadFilterType;
            filter.frequency.value = f.freq;
            filter.Q.value = f.Q || 1;
            if (f.gain) filter.gain.value = f.gain;

            lastNode.connect(filter);
            lastNode = filter;
        });

        // Compression to normalize stem volume
        const compressor = stemCtx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        lastNode.connect(compressor);
        compressor.connect(stemCtx.destination);

        source.start();
        const rendered = await stemCtx.startRendering();
        renderedBuffers.push({ name: def.name, buffer: rendered });
    }

    // 5. Encode to WAV and Zip
    const zip = new JSZip();
    const folder = zip.folder(`AIM8_Stems_${track.title.replace(/\s+/g, '_')}`);

    for (const item of renderedBuffers) {
        const { buffer, name } = item;
        const numChannels = buffer.numberOfChannels; // Likely 2
        const length = buffer.length * numChannels * 2; // 16-bit
        const header = writeWavHeader(buffer.sampleRate, numChannels, length);

        const wavData = new Uint8Array(header.byteLength + length);
        wavData.set(new Uint8Array(header), 0);

        const view = new DataView(wavData.buffer);
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        // Interleave channels
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const s = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }

        folder?.file(`${name}.wav`, wavData, { binary: true });
    }

    // Clean up
    audioCtx.close();

    const content = await zip.generateAsync({ type: 'blob' });
    return content;
};