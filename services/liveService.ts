import { getGeminiKey, MissingApiKeyError } from './byok';
// @google/genai is lazy-loaded at connect() time to avoid "API Key must be set" crash in production
import { MusicToolArgs } from "../types";

// Audio Utils compliant with @google/genai guidelines
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

export class LiveClient {
    private ai: any = null;
    private audioContext: AudioContext | null = null;
    private inputContext: AudioContext | null = null;
    private inputSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private stream: MediaStream | null = null;
    private nextStartTime: number = 0;
    private isConnected: boolean = false;
    private isMuted: boolean = false;
    private sessionPromise: Promise<any> | null = null;
    private activeSources: AudioBufferSourceNode[] = [];
    private hasGreeted: boolean = false;

    // --- Transcript buffering (prevents per-word messages) ---
    private userTranscriptBuffer: string = '';
    private modelTranscriptBuffer: string = '';
    private userFlushTimer: ReturnType<typeof setTimeout> | null = null;
    private modelFlushTimer: ReturnType<typeof setTimeout> | null = null;
    // Debounce window: emit a turn-complete message after X ms of silence
    private readonly USER_DEBOUNCE_MS = 800;
    private readonly MODEL_DEBOUNCE_MS = 400;

    // --- Reconnection state ---
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private intentionalDisconnect = false;
    private lastConnectArgs: {
        onAudioData: (volume: number) => void;
        onMusicGeneration: (args: MusicToolArgs) => void;
        onTranscript: (text: string, role: 'user' | 'model') => void;
        voicePitch?: number;
        voiceName?: string;
        onDisconnect?: () => void;
        onConnectionState?: (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void;
    } | null = null;

    constructor() {
        // SDK initialized lazily in connect()
    }

    async connect(
        onAudioData: (volume: number) => void,
        onMusicGeneration: (args: MusicToolArgs) => void,
        onTranscript: (text: string, role: 'user' | 'model') => void,
        voicePitch?: number,
        voiceName?: string,
        onDisconnect?: () => void,
        onConnectionState?: (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void
    ) {
        const modelId = 'gemini-2.5-flash-native-audio-latest';
        // Lazy-load @google/genai SDK
        if (!this.ai) {
            const { GoogleGenAI } = await import("@google/genai");
            const apiKey = getGeminiKey();
            if (!apiKey) throw new MissingApiKeyError('gemini');
            this.ai = new GoogleGenAI({ apiKey });
        }
        this.intentionalDisconnect = false;
        this.reconnectAttempts = 0;
        this.lastConnectArgs = { onAudioData, onMusicGeneration, onTranscript, voicePitch, voiceName, onDisconnect, onConnectionState };

        try {
            onConnectionState?.('connecting');
            console.log(`Aim8: Connecting with model ${modelId}...`);
            await this.initSession(modelId, onAudioData, onMusicGeneration, onTranscript, voicePitch, voiceName, onDisconnect);
            console.log(`Aim8: Connected successfully`);
            this.reconnectAttempts = 0;
            onConnectionState?.('connected');
        } catch (error: any) {
            console.warn(`Aim8: Failed to connect`, error);
            onConnectionState?.('disconnected');
            // Clean up resources without marking as intentional (so reconnect isn't blocked)
            this.cleanupResources();
            throw error;
        }
    }

    private async attemptReconnect() {
        if (this.intentionalDisconnect || !this.lastConnectArgs) return;
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.warn('Aim8: Max reconnection attempts reached');
            this.lastConnectArgs.onConnectionState?.('disconnected');
            this.lastConnectArgs.onDisconnect?.();
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);
        console.log(`Aim8: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        this.lastConnectArgs.onConnectionState?.('reconnecting');

        this.reconnectTimer = setTimeout(async () => {
            try {
                const args = this.lastConnectArgs!;
                args.onConnectionState?.('connecting');
                const modelId = 'gemini-2.5-flash-native-audio-latest';
                await this.initSession(modelId, args.onAudioData, args.onMusicGeneration, args.onTranscript, args.voicePitch, args.voiceName, args.onDisconnect);
                console.log('Aim8: Reconnected successfully');
                this.reconnectAttempts = 0;
                args.onConnectionState?.('connected');
            } catch (err: any) {
                console.warn('Aim8: Reconnection attempt failed', err);
                this.attemptReconnect();
            }
        }, delay);
    }

    /** Schedule user transcript emission after debounce. Each new chunk resets the timer. */
    private scheduleUserFlush(text: string, onTranscript: (text: string, role: 'user' | 'model') => void) {
        this.userTranscriptBuffer += (this.userTranscriptBuffer ? ' ' : '') + text.trim();
        if (this.userFlushTimer) clearTimeout(this.userFlushTimer);
        this.userFlushTimer = setTimeout(() => {
            const msg = this.userTranscriptBuffer.trim();
            if (msg) {
                onTranscript(msg, 'user');
                this.userTranscriptBuffer = '';
            }
        }, this.USER_DEBOUNCE_MS);
    }

    /** Schedule model transcript emission. Flushed when model turn ends or after debounce. */
    private scheduleModelFlush(text: string, onTranscript: (text: string, role: 'user' | 'model') => void) {
        this.modelTranscriptBuffer += text;
        if (this.modelFlushTimer) clearTimeout(this.modelFlushTimer);
        this.modelFlushTimer = setTimeout(() => {
            const msg = this.modelTranscriptBuffer.trim();
            if (msg) {
                onTranscript(msg, 'model');
                this.modelTranscriptBuffer = '';
            }
        }, this.MODEL_DEBOUNCE_MS);
    }

    /** Flush model buffer immediately (e.g. when interrupted). */
    private flushModelNow(onTranscript: (text: string, role: 'user' | 'model') => void) {
        if (this.modelFlushTimer) { clearTimeout(this.modelFlushTimer); this.modelFlushTimer = null; }
        const msg = this.modelTranscriptBuffer.trim();
        if (msg) {
            onTranscript(msg, 'model');
            this.modelTranscriptBuffer = '';
        }
    }

    private async initSession(
        modelId: string,
        onAudioData: (volume: number) => void,
        onMusicGeneration: (args: MusicToolArgs) => void,
        onTranscript: (text: string, role: 'user' | 'model') => void,
        voicePitch?: number,
        voiceName?: string,
        onDisconnect?: () => void
    ) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000
            }
        });

        this.inputContext = new AudioContextClass({ sampleRate: 16000 });
        this.inputSource = this.inputContext.createMediaStreamSource(this.stream);
        this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
            if (!this.isConnected || !this.sessionPromise || this.isMuted) return;

            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / inputData.length);
            if (onAudioData) onAudioData(rms);

            const pcmBlob = createBlob(inputData);
            this.sessionPromise.then(session => {
                if (!this.isConnected) return;
                try {
                    session.sendRealtimeInput({ audio: pcmBlob });
                } catch (err: any) {
                    console.debug("LiveClient: Error sending audio frame", err);
                }
            }).catch(() => { });
        };

        this.inputSource.connect(this.processor);
        this.processor.connect(this.inputContext.destination);

        const musicTool: any = {
            name: "generate_music",
            description: "Generates a song based on the parameters gathered from the user. ONLY CALL THIS AFTER EXPLICIT USER CONFIRMATION.",
            parameters: {
                type: "OBJECT",
                properties: {
                    prompt: { type: "STRING", description: "The full song description including LYRICS. CRITICAL: If the user speaks a language other than English, or requests a specific language, you MUST write the lyrics in that language inside this prompt." },
                    instrumental: { type: "BOOLEAN", description: "True if the song has no lyrics (instrumental only), False if it has vocals." },
                    style: { type: "STRING", description: "A highly detailed, comma-separated list of genre, vibe, and instrument tags. (e.g. 'Pop' -> 'Upbeat, Synth-Pop, Catchy Hook, Female Vocals, Radio Hit, 120bpm')." },
                    title: { type: "STRING", description: "A creative title for the song." },
                    voiceType: { type: "STRING", description: "The vocal style if applicable (e.g. 'Male', 'Female', 'Robot')." }
                },
                required: ["prompt", "style", "instrumental", "title"]
            }
        };

        let systemInstructionText = `You are Aim8, a cool AI music producer. Talk like a friend, not a robot.

GREETING: Say something short like "Hey! What are we making today?"

RULES (STRICT):
- Keep EVERY reply to 1-2 SHORT sentences max. Never give paragraphs.
- NEVER narrate your thought process. NEVER say things like "I'm planning...", "I'm thinking...", "I've laid out...", "I'm preparing...", "I'm prioritizing..."
- Just talk naturally like a friend in a studio.
- Reply in the user's language. Write lyrics in the requested language.
- Ask ONE short confirmation question after pitching: "Ready?" or "Let's go?"
- When they say yes/go/do it, IMMEDIATELY call generate_music. Don't explain what you're about to do.
- If the user is being vague (e.g., "Make a song"), ask for a style or vibe first.
- If the user provides a clear title and style (e.g., "Make a techno song called Cyberpunk"), you can call generate_music immediately and just say "Got it, making 'Cyberpunk' now!"
- NEVER call generate_music without a clear instruction or confirmation.

EXAMPLE FLOW 1 (Clear):
User: "Make me a techno track called Cyberpunk"
[Call generate_music immediately]
You: "Cyberpunk techno coming up! Ready to vibe?"

EXAMPLE FLOW 2 (Vague):
User: "Make me a song"
You: "I'm down! What's the vibe? Chill lo-fi, epic orchestral, or maybe some synthwave?"
User: "Lo-fi"
[Call generate_music immediately]
You: "Chill lo-fi it is. Let's get it. Ready?"
`;

        if (voicePitch !== undefined && voicePitch !== 0) {
            const p = voicePitch > 0 ? 'High/Youthful' : 'Deep/Low';
            systemInstructionText += `\n\n[SYSTEM NOTE]: User prefers voice pitch: ${voicePitch} (${p}).`;
        }

        const safeVoiceName = voiceName && voiceName !== 'Auto' ? voiceName : undefined;
        this.sessionPromise = this.ai.live.connect({
            model: modelId,
            config: {
                responseModalities: ["AUDIO"],
                tools: [{ functionDeclarations: [musicTool] }],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: safeVoiceName || 'Puck' } }
                },
                systemInstruction: systemInstructionText,
            },
            callbacks: {
                onopen: () => {
                    console.log("Live session connected");
                    this.isConnected = true;
                    this.nextStartTime = this.audioContext?.currentTime || 0;

                    if (!this.hasGreeted) {
                        // Trigger the initial greeting after a short delay to let the session stabilize
                        setTimeout(() => {
                            this.sessionPromise?.then(session => {
                                try {
                                    session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: "Hello! I am connected." }] }], turnComplete: true });
                                    this.hasGreeted = true;
                                    console.log('Aim8: Initial greeting trigger sent');
                                } catch (e: any) {
                                    console.warn("Failed to send initial greeting trigger", e);
                                }
                            });
                        }, 500);
                    }
                },
                onmessage: async (msg: any) => {
                    // --- Interrupted: flush any pending model text ---
                    if (msg.serverContent?.interrupted) {
                        console.log("Aim8: Interrupted by user");
                        this.flushModelNow(onTranscript);
                        this.stopAllAudio();
                        return;
                    }

                    // --- Input transcription (user speech) — buffer chunks ---
                    if (msg.serverContent?.inputTranscription?.text) {
                        this.scheduleUserFlush(msg.serverContent.inputTranscription.text, onTranscript);
                    }

                    // --- Output transcription (model speech) — buffer chunks ---
                    if (msg.serverContent?.modelTurn?.parts) {
                        const texts = msg.serverContent.modelTurn.parts
                            .map((p: any) => p.text)
                            .filter(Boolean);
                        if (texts.length > 0) {
                            this.scheduleModelFlush(texts.join(''), onTranscript);
                        }
                    }
                    if (msg.serverContent?.outputTranscription?.text) {
                        this.scheduleModelFlush(msg.serverContent.outputTranscription.text, onTranscript);
                    }

                    // --- Turn ended: flush model buffer immediately ---
                    if ((msg.serverContent as any)?.turnComplete) {
                        this.flushModelNow(onTranscript);
                    }

                    // --- Tool call handling ---
                    // Deep search for any function calls in the payload
                    let calls: any[] = [];

                    // Format 1: Top-level toolCall
                    if (msg.toolCall || msg.tool_call) {
                        const toolCall = msg.toolCall || msg.tool_call;
                        const extracted = toolCall.functionCalls || toolCall.function_calls || [];
                        calls = [...calls, ...extracted];
                    }

                    // Format 2: Nested in serverContent.modelTurn.parts
                    if (msg.serverContent?.modelTurn?.parts) {
                        const parts = msg.serverContent.modelTurn.parts;
                        for (const part of parts) {
                            if (part.functionCall || part.function_call) {
                                calls.push(part.functionCall || part.function_call);
                            }
                        }
                    }

                    if (calls.length > 0) {
                        // Deduplicate by ID to avoid double-processing the same request
                        const uniqueCalls = Array.from(new Map(calls.map(c => [c.id || c.name, c])).values());
                        console.log('Aim8 Live: Tool calls discovered (unique):', JSON.stringify(uniqueCalls));
                        for (const fc of uniqueCalls) {
                            if (fc.name === 'generate_music') {
                                const args = (fc.args || {}) as unknown as MusicToolArgs;
                                const safeArgs: MusicToolArgs = {
                                    prompt: args.prompt || 'Create a unique song',
                                    instrumental: args.instrumental === true,
                                    style: args.style || 'Pop',
                                    title: args.title || 'AI Generated Track',
                                    voiceType: args.voiceType,
                                };
                                onMusicGeneration(safeArgs);

                                this.sessionPromise?.then(session => {
                                    try {
                                        session.sendToolResponse({
                                            functionResponses: [{
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: "Generation started successfully. The track is being created in the background." },
                                            }]
                                        });
                                    } catch (respErr) {
                                        console.warn('Aim8 Live: Failed to send tool response:', respErr);
                                    }
                                }).catch(() => { });
                            }
                        }
                    }

                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) {
                        await this.playAudio(audioData);
                    }
                },
                onclose: (e: any) => {
                    console.log("Live session closed", e?.code, e?.reason, e);
                    this.isConnected = false;
                    if (!this.intentionalDisconnect) {
                        // Unexpected close — attempt reconnection
                        this.attemptReconnect();
                    } else {
                        onDisconnect?.();
                    }
                },
                onerror: (err: any) => {
                    console.error("Live session error — full details:", JSON.stringify(err), err?.message, err?.code, err);
                }
            }
        });

        await this.sessionPromise;
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    private async playAudio(base64Data: string) {
        if (!this.audioContext) return;

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        const audioBytes = decode(base64Data);
        const audioBuffer = await decodeAudioData(audioBytes, this.audioContext, 24000, 1);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        source.onended = () => {
            this.activeSources = this.activeSources.filter(s => s !== source);
        };
        this.activeSources.push(source);

        const now = this.audioContext.currentTime;
        this.nextStartTime = Math.max(now, this.nextStartTime);
        source.start(this.nextStartTime);
        this.nextStartTime = this.nextStartTime + audioBuffer.duration;
    }

    private stopAllAudio() {
        this.activeSources.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        this.activeSources = [];
        if (this.audioContext) {
            this.nextStartTime = this.audioContext.currentTime;
        }
    }

    /** Send a text message into the active live session */
    sendText(text: string) {
        if (!this.isConnected || !this.sessionPromise) return;
        this.sessionPromise.then(session => {
            try {
                session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
            } catch (err: any) {
                console.warn('LiveClient: Failed to send text', err);
            }
        }).catch(() => { });
    }

    /** Inject prior conversation context when resuming a paused session */
    sendContext(transcript: { role: 'user' | 'model'; text: string }[]) {
        if (!this.isConnected || !this.sessionPromise || transcript.length === 0) return;
        this.sessionPromise.then(session => {
            try {
                // Send conversation history as context turns
                const turns = transcript.map(t => ({
                    role: t.role,
                    parts: [{ text: t.text }]
                }));
                session.sendClientContent({ turns, turnComplete: true });
                // Send a system-like nudge so the AI knows context was restored
                session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: '[Session resumed — the above is our prior conversation. Please continue from where we left off.]' }] }],
                    turnComplete: true
                });
            } catch (err: any) {
                console.warn('LiveClient: Failed to send context', err);
            }
        }).catch(() => { });
    }

    mute() { this.isMuted = true; }
    unmute() { this.isMuted = false; }
    get muted() { return this.isMuted; }

    /** Release audio/media resources without affecting reconnection or intentional-disconnect flags */
    private cleanupResources() {
        this.isConnected = false;
        this.sessionPromise = null;

        this.stopAllAudio();

        this.processor?.disconnect();
        this.inputSource?.disconnect();
        this.stream?.getTracks().forEach(t => t.stop());

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        if (this.inputContext && this.inputContext.state !== 'closed') {
            this.inputContext.close();
        }

        this.processor = null;
        this.inputSource = null;
        this.stream = null;
        this.audioContext = null;
        this.inputContext = null;
    }

    disconnect() {
        this.intentionalDisconnect = true;
        this.isMuted = false;
        this.lastConnectArgs = null;
        this.hasGreeted = false;

        // Cancel any pending reconnect
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

        // Clear any pending transcript timers
        if (this.userFlushTimer) { clearTimeout(this.userFlushTimer); this.userFlushTimer = null; }
        if (this.modelFlushTimer) { clearTimeout(this.modelFlushTimer); this.modelFlushTimer = null; }
        this.userTranscriptBuffer = '';
        this.modelTranscriptBuffer = '';

        this.cleanupResources();
    }
}
