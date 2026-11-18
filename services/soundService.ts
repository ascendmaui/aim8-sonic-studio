
class SoundService {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;

    private init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.15; // Keep it subtle
            this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private createOscillator(type: OscillatorType, freq: number, startTime: number, duration: number) {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        // Envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(1, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    public playClick() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // High pitch blip
        this.createOscillator('sine', 800, now, 0.1);
    }

    public playMicOn() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Ascending chime
        this.createOscillator('sine', 440, now, 0.15); // A4
        this.createOscillator('sine', 554, now + 0.1, 0.2); // C#5
    }

    public playMicOff() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Descending chime
        this.createOscillator('sine', 554, now, 0.15); // C#5
        this.createOscillator('sine', 440, now + 0.1, 0.2); // A4
    }

    public playSuccess() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Major Chord Arpeggio (C Major 7)
        const notes = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
        notes.forEach((freq, i) => {
            this.createOscillator('triangle', freq, now + (i * 0.05), 0.4);
        });
    }

    public playError() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Low buzz
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);

        osc.connect(gain);
        gain?.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    public playVoiceActivation() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        // Dramatic ascending sweep — sci-fi activation
        const sweep = [
            { freq: 220, time: 0, dur: 0.3 },    // A3 — warm start
            { freq: 330, time: 0.1, dur: 0.25 },  // E4
            { freq: 440, time: 0.2, dur: 0.3 },   // A4
            { freq: 660, time: 0.3, dur: 0.4 },   // E5 — bright peak
        ];
        sweep.forEach(n => {
            this.createOscillator('sine', n.freq, now + n.time, n.dur);
            this.createOscillator('triangle', n.freq * 1.01, now + n.time, n.dur); // slight detune for richness
        });

        // Sub-bass pulse
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(60, now);
        sub.frequency.linearRampToValueAtTime(80, now + 0.5);
        subGain.gain.setValueAtTime(0.08, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now);
        sub.stop(now + 0.6);
    }
}

export const soundManager = new SoundService();
