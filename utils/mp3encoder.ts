/**
 * MP3 Encoding utility — wraps lamejs with proper error handling
 * and fallback to WAV if MP3 encoding is unavailable.
 */

let Mp3EncoderClass: any = null;
let initAttempted = false;

async function ensureEncoder(): Promise<boolean> {
    if (Mp3EncoderClass) return true;
    if (initAttempted) return false;
    initAttempted = true;

    try {
        // Dynamic import to isolate lamejs initialization errors
        const mod = await import('lamejs');
        const lamejs = mod.default || mod;
        if (lamejs?.Mp3Encoder) {
            Mp3EncoderClass = lamejs.Mp3Encoder;
            return true;
        }
        // Try accessing it as a named export
        if ((mod as any).Mp3Encoder) {
            Mp3EncoderClass = (mod as any).Mp3Encoder;
            return true;
        }
    } catch (e) {
        console.warn('lamejs MP3 encoder unavailable, falling back to WAV:', e);
    }
    return false;
}

/**
 * Encode an AudioBuffer to MP3.
 * Returns null if MP3 encoding is unavailable (caller should fall back to WAV).
 */
export async function encodeToMp3(buffer: AudioBuffer): Promise<Blob | null> {
    const available = await ensureEncoder();
    if (!available || !Mp3EncoderClass) return null;

    try {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const mp3encoder = new Mp3EncoderClass(numChannels, sampleRate, 320);

        const samplesL = buffer.getChannelData(0);
        const samplesR = numChannels > 1 ? buffer.getChannelData(1) : samplesL;

        const sampleBlockSize = 1152;
        const int16Left = new Int16Array(samplesL.length);
        const int16Right = new Int16Array(samplesR.length);
        for (let i = 0; i < samplesL.length; i++) {
            int16Left[i] = samplesL[i] < 0 ? samplesL[i] * 32768 : samplesL[i] * 32767;
            int16Right[i] = samplesR[i] < 0 ? samplesR[i] * 32768 : samplesR[i] * 32767;
        }

        const mp3Data: Int8Array[] = [];
        for (let i = 0; i < samplesL.length; i += sampleBlockSize) {
            const leftChunk = int16Left.subarray(i, i + sampleBlockSize);
            const rightChunk = int16Right.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
        }
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));

        return new Blob(mp3Data as any, { type: 'audio/mp3' });
    } catch (e) {
        console.error('MP3 encoding failed:', e);
        return null;
    }
}

/** Check if MP3 encoding is available */
export async function isMp3Available(): Promise<boolean> {
    return ensureEncoder();
}
