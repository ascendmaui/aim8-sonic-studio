import React, { useState, useEffect, useRef } from 'react';
import {
    Mic, MicOff, Send, Sparkles, Music2, X,
    Radio, User, MessageCircle, Headphones,
    ChevronLeft, ChevronRight, ChevronDown, Loader2, Bolt, Zap, Wand2
} from './icons';
import { LiveClient } from '../services/liveService';
import { analyzeMusicIntent } from '../services/geminiService';
import { soundManager } from '../services/soundService';
import type {
    Message,
    SunoGenerationParams,
    SunoTrack,
    GenerationStatus,
    SunoPersona,
} from '../types';

interface StudioChatPanelProps {
    onGenerate: (params: SunoGenerationParams) => void;
    onSwitchToLive: () => void;
    voiceStyle: string;
    voicePitch: number;
    musicQuality: string;
    personas: SunoPersona[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    // Track display in chat
    sessionTaskQueue: (GenerationStatus & { id: string; retryParams?: any; tracks?: SunoTrack[] })[];
    setSessionTaskQueue: React.Dispatch<React.SetStateAction<any[]>>;
    playTrack: (track: SunoTrack) => void;
    activeTrackUrl: string;
    isPlaying: boolean;
    setShareModal: (val: any) => void;
    setRemixTrack: (track: SunoTrack) => void;
    openPersonaModal: (track: SunoTrack, taskId?: string) => void;
    videoLoadingState: Record<string, boolean>;
    masteringLoadingState: Record<string, boolean>;
    handleVideoGeneration: (track: SunoTrack) => void;
    onSelectMastering: (track: SunoTrack) => void;
    onVideoWatch?: (url: string, title: string) => void;
    liveTrigger?: number;
    GenerationTimelineComponent: React.ComponentType<any>;
    TrackCardComponent: React.ComponentType<any>;
}

const StudioChatPanel: React.FC<StudioChatPanelProps> = ({
    onGenerate,
    onSwitchToLive,
    voiceStyle,
    voicePitch,
    musicQuality,
    personas,
    isCollapsed,
    onToggleCollapse,
    sessionTaskQueue,
    setSessionTaskQueue,
    playTrack,
    activeTrackUrl,
    isPlaying,
    setShareModal,
    setRemixTrack,
    openPersonaModal,
    videoLoadingState,
    masteringLoadingState,
    handleVideoGeneration,
    onSelectMastering,
    onVideoWatch,
    liveTrigger = 0,
    GenerationTimelineComponent,
    TrackCardComponent,
}) => {
    const SHOW_USER_MESSAGES = false;
    const [conversation, setConversation] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const conversationRef = useRef<Message[]>([]);
    const hasConnectedOnceRef = useRef(false);
    const pendingResumeRef = useRef(false);
    const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(new Set());

    const isThinkingMessage = (text: string) => {
        const t = text.toLowerCase();
        return t.includes('crafting initial response') ||
            t.includes('processed the initial connection') ||
            t.includes('my response is formulated') ||
            t.includes('per my instructions');
    };

    const summarizeThinking = (text: string) => {
        if (text.toLowerCase().includes('initial connection')) {
            return 'Thinking: establishing the live session and preparing the first reply.';
        }
        return 'Thinking: preparing a concise response and next-step question.';
    };

    // --- Live Mode State ---
    const [isLive, setIsLive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [liveVolume, setLiveVolume] = useState(0);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const liveClientRef = useRef<LiveClient | null>(null);
    const aiSpeakingTimer = useRef<any>(null);

    const isLiveRef = useRef(false);
    const isConnectingRef = useRef(false);

    const toggleLiveMode = async () => {
        if (isLiveRef.current) {
            liveClientRef.current?.disconnect();
            isLiveRef.current = false;
            isConnectingRef.current = false;
            setIsLive(false);
            setLiveVolume(0);
            setAiSpeaking(false);
            soundManager.playMicOff();
            return;
        }

        // Guard against double-trigger (StrictMode / rapid clicks)
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;

        setIsConnecting(true);
        soundManager.playClick();

        // Disconnect any previous client before creating a new one
        if (liveClientRef.current) {
            liveClientRef.current.disconnect();
        }
        liveClientRef.current = new LiveClient();

        try {
            await liveClientRef.current.connect(
                // onAudioData
                (vol) => setLiveVolume(vol),
                // onMusicGeneration
                (args) => {
                    const params: SunoGenerationParams = {
                        prompt: args.prompt,
                        instrumental: args.instrumental,
                        style: args.style,
                        title: args.title,
                        model: 'V3_5'
                    };
                    onGenerate(params);
                    setConversation(prev => [...prev, {
                        role: 'assistant',
                        content: `🎵 Creating "${args.title}"...`,
                        timestamp: Date.now(),
                    }]);
                },
                // onTranscript
                (text, role) => {
                    const mappedRole = role === 'model' ? 'assistant' : 'user';
                    setConversation(prev => [...prev, { role: mappedRole, content: text, timestamp: Date.now() }]);
                    if (role === 'model') {
                        setAiSpeaking(true);
                        if (aiSpeakingTimer.current) clearTimeout(aiSpeakingTimer.current);
                        aiSpeakingTimer.current = setTimeout(() => setAiSpeaking(false), 2000);
                    }
                },
                voicePitch,
                undefined,
                () => { // onDisconnect
                    isLiveRef.current = false;
                    isConnectingRef.current = false;
                    setIsLive(false);
                    setIsConnecting(false);
                },
                (state) => { // onConnectionState
                    if (state === 'connected') {
                        isLiveRef.current = true;
                        isConnectingRef.current = false;
                        setIsLive(true);
                        setIsConnecting(false);
                        soundManager.playMicOn();
                        if (pendingResumeRef.current && liveClientRef.current) {
                            const transcript = conversationRef.current
                                .filter(m => m.role === 'user' || m.role === 'assistant')
                                .slice(-8)
                                .map(m => ({
                                    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
                                    text: m.content
                                }));
                            liveClientRef.current.sendContext(transcript);
                            pendingResumeRef.current = false;
                        }
                        hasConnectedOnceRef.current = true;
                    } else if (state === 'disconnected') {
                        isLiveRef.current = false;
                        isConnectingRef.current = false;
                        setIsLive(false);
                        setIsConnecting(false);
                    } else if (state === 'reconnecting') {
                        pendingResumeRef.current = hasConnectedOnceRef.current;
                    }
                }
            );
        } catch (err: any) {
            console.error("Failed to connect to Gemini Live", err);
            isConnectingRef.current = false;
            setIsConnecting(false);
            // Show user-facing error message
            const isPermissionDenied = err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied');
            const errorMsg = isPermissionDenied
                ? 'Microphone access denied. Please allow microphone permissions in your browser settings and try again.'
                : 'Could not connect to Live Voice. Please check your connection and try again.';
            setConversation(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        }
    };

    // Keep refs in sync with state to avoid stale closures in effects
    useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
    useEffect(() => { isConnectingRef.current = isConnecting; }, [isConnecting]);

    useEffect(() => {
        if (liveTrigger && liveTrigger > 0) {
            if (!isLiveRef.current && !isConnectingRef.current) {
                toggleLiveMode();
            }
        }
    }, [liveTrigger]);

    useEffect(() => {
        conversationRef.current = conversation;
    }, [conversation]);

    useEffect(() => {
        return () => {
            liveClientRef.current?.disconnect();
        };
    }, []);

    useEffect(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [conversation, sessionTaskQueue]);

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
        }
    }, []);

    // Update Speech Recognition Handlers — run only once after initialization
    useEffect(() => {
        if (!recognitionRef.current) return;

        recognitionRef.current.onresult = (e: any) => {
            if (!e.results || !e.results[0] || !e.results[0][0]) return;
            const text = e.results[0][0].transcript;
            if (!text?.trim()) return;
            handleMessage(text, { fromSpeech: true });
            setIsListening(false);
            soundManager.playMicOff();
        };

        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onerror = (e: any) => {
            setIsListening(false);
            soundManager.playError();
            if (e.error === 'not-allowed') {
                setConversation(prev => [...prev, {
                    role: 'assistant',
                    content: 'Microphone access denied. Please allow microphone permissions in your browser settings.',
                    timestamp: Date.now(),
                }]);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const polishTranscript = (raw: string) => {
        let t = raw.replace(/\s+/g, ' ').trim();
        if (!t) return t;
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (!/[.!?]$/.test(t)) t += '.';
        return t;
    };

    const handleMessage = async (text: string, options?: { fromSpeech?: boolean }) => {
        if (!text.trim()) return;
        const cleaned = options?.fromSpeech ? polishTranscript(text) : text.trim();

        setConversation(prev => [...prev, { role: 'user', content: cleaned, timestamp: Date.now() }]);
        setInputText('');
        soundManager.playClick();

        const intent = await analyzeMusicIntent([...conversation, { role: 'user', content: cleaned }]);

        setConversation(prev => [...prev, { role: 'assistant', content: intent.reply, timestamp: Date.now() }]);

        if (intent.action === 'generate' && intent.params) {
            if (voiceStyle !== 'Auto') {
                if (voiceStyle.startsWith('Persona:')) {
                    const personaId = voiceStyle.split('Persona:')[1];
                    const persona = personas.find(p => p.personaId === personaId);
                    if (persona) {
                        intent.params.personaId = persona.personaId;
                        intent.params.voiceType = undefined;
                    }
                } else {
                    intent.params.voiceType = voiceStyle;
                }
            }

            intent.params.voicePitch = voicePitch;
            intent.params.model = musicQuality as any;

            onGenerate(intent.params);
        }
    };

    const toggleMic = () => {
        if (!recognitionRef.current) {
            setConversation(prev => [...prev, {
                role: 'assistant',
                content: 'Speech recognition is not supported in this browser. Please try Chrome or Edge.',
                timestamp: Date.now(),
            }]);
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            soundManager.playMicOff();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                soundManager.playMicOn();
                setIsListening(true);
            } catch (e: any) {
                console.error(e);
            }
        }
    };

    // Collapsed state — just show a floating toggle
    if (isCollapsed) {
        return (
            <button
                onClick={onToggleCollapse}
                className="fixed right-4 bottom-24 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 shadow-2xl shadow-cyan-500/30 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all border border-white/20 md:relative md:right-auto md:bottom-auto md:w-12 md:h-12 md:rounded-xl md:shadow-lg"
                title="Open Chat"
            >
                <MessageCircle className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className="w-full md:w-[380px] lg:w-[420px] h-full flex flex-col border-l border-white/[0.06] bg-slate-950/50 backdrop-blur-sm relative shrink-0">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-slate-900/40 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <Bolt className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">AI Co-Producer</h3>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Online</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { soundManager.playClick(); onSwitchToLive(); }}
                        className="p-2 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/[0.08] transition-all"
                        title="Live Voice Mode"
                    >
                        <Radio className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all hidden md:flex"
                        title="Collapse Chat"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all md:hidden"
                        title="Close Chat"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                {conversation.length === 0 && sessionTaskQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in duration-700">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                            <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2 tracking-tight">Studio Assistant</h3>
                        <p className="text-slate-400 text-sm max-w-[240px] leading-relaxed mb-8">
                            Describe a track, ask for lyrics, or try real-time voice production.
                        </p>

                        <button
                            onClick={toggleLiveMode}
                            disabled={isConnecting}
                            className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 p-[1px] rounded-2xl group transition-all duration-500 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                        >
                            <div className="bg-slate-900 rounded-[15px] px-8 py-4 flex items-center gap-3 transition-all duration-500 group-hover:bg-slate-900/60">
                                {isConnecting ? (
                                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                                ) : (
                                    <Zap className="w-5 h-5 text-emerald-400 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                )}
                                <span className="text-sm font-black text-white uppercase tracking-widest whitespace-nowrap">
                                    Try Gemini Live Voice
                                </span>
                            </div>
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Welcome Message */}
                        {conversation.length === 0 && sessionTaskQueue.length === 0 && (
                            <div className="flex flex-col items-center text-center px-4 py-10 animate-in fade-in duration-700">
                                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center mb-5 border border-cyan-500/20">
                                    <Headphones className="w-8 h-8 text-cyan-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Hey! 👋</h3>
                                <p className="text-sm text-slate-400 leading-relaxed max-w-[280px] mb-6">
                                    I'm your <span className="text-cyan-400 font-semibold">AI co-producer</span>. Tell me what kind of music you want to create, or click the mic to chat live!
                                </p>
                            </div>
                        )}

                        {/* Quick Starters */}
                        <div className="w-full space-y-2">
                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-2">Try saying...</p>
                            {[
                                "Make me a chill lo-fi beat for studying",
                                "Create an energetic pop anthem",
                                "I want a dark trap beat with heavy 808s",
                                "Something cinematic and epic"
                            ].map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleMessage(prompt)}
                                    className="w-full text-left p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/[0.05] hover:border-cyan-500/20 transition-all group"
                                >
                                    <span className="text-cyan-500/50 mr-2 group-hover:text-cyan-400">→</span>
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                            <div className="h-px bg-white/[0.06] flex-1" />
                            <button
                                onClick={toggleMic}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/20 rounded-full text-cyan-400 hover:border-cyan-500/40 transition-all group"
                            >
                                <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Voice Chat</span>
                            </button>
                            <div className="h-px bg-white/[0.06] flex-1" />
                        </div>
                    </>
                )}

                {/* Conversation Messages */}
                {conversation
                    .filter(msg => SHOW_USER_MESSAGES || msg.role !== 'user')
                    .map((msg, i) => (
                    <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                        {msg.role !== 'user' && (
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.06] flex items-center justify-center shrink-0 shadow-sm">
                                <Sparkles className="w-3 h-3 text-cyan-400" />
                            </div>
                        )}

                        <div className="max-w-[85%]">
                            <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-sm font-medium'
                                : 'bg-slate-800/60 backdrop-blur-sm text-slate-200 border-l-2 border-cyan-500/30 rounded-bl-sm'
                                }`}>
                                {msg.role !== 'user' && isThinkingMessage(msg.content) ? (
                                    <div className="space-y-2">
                                        <div className="text-[12px] font-semibold text-cyan-300">{summarizeThinking(msg.content)}</div>
                                        <button
                                            onClick={() => {
                                                const next = new Set(expandedThoughts);
                                                if (next.has(i)) next.delete(i); else next.add(i);
                                                setExpandedThoughts(next);
                                            }}
                                            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                                        >
                                            <ChevronDown className={`w-3 h-3 transition-transform ${expandedThoughts.has(i) ? 'rotate-180' : ''}`} />
                                            Details
                                        </button>
                                        {expandedThoughts.has(i) && (
                                            <div className="text-[11px] text-slate-500">
                                                Detailed internal reasoning is hidden. You’ll only see the concise summary.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                )}
                            </div>
                            <span className={`text-[8px] text-slate-600 mt-0.5 block ${msg.role === 'user' ? 'text-right mr-1' : 'ml-1'}`}>
                                {new Date(msg.timestamp ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                                <User className="w-3 h-3 text-slate-300" />
                            </div>
                        )}
                    </div>
                ))}

                {/* Generation Timelines from chat */}
                {sessionTaskQueue.map((genStatus) => genStatus.status !== 'idle' && (
                    <div key={genStatus.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <GenerationTimelineComponent
                            genStatus={genStatus}
                            onRegenerate={genStatus.retryParams ? () => onGenerate(genStatus.retryParams!) : undefined}
                            onStop={() => {
                                setSessionTaskQueue((prev: any[]) => prev.map((g: any) => g.id === genStatus.id ? { ...g, status: 'error' as const, error: 'Generation stopped by user' } : g));
                                soundManager.playClick();
                            }}
                        />

                        {genStatus.tracks && (
                            <div className="space-y-3 mt-3">
                                {genStatus.tracks.map((track: SunoTrack) => (
                                    <TrackCardComponent
                                        key={track.id}
                                        track={track}
                                        playTrack={playTrack}
                                        activeTrackUrl={activeTrackUrl}
                                        isPlaying={isPlaying}
                                        onShare={() => setShareModal({ open: true, track })}
                                        onRemix={() => setRemixTrack(track)}
                                        onVideo={() => handleVideoGeneration(track)}
                                        onPersona={() => track.taskId ? openPersonaModal(track, track.taskId) : null}
                                        onMaster={() => onSelectMastering(track)}
                                        videoLoading={videoLoadingState[track.id]}
                                        masteringLoading={masteringLoadingState[track.id]}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* ── Input Bar ── */}
            <div className="shrink-0 border-t border-white/[0.06] p-3 bg-slate-900/60">
                <div className="relative group">
                    {/* Live Mode Orb */}
                    {(isLive || isConnecting) && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-all duration-500 animate-in zoom-in slide-in-from-left-4">
                            <button
                                onClick={toggleLiveMode}
                                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isLive
                                    ? aiSpeaking
                                        ? 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-600 shadow-[0_0_20px_rgba(139,92,246,0.5)]'
                                        : 'bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-600 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                                    : 'bg-slate-800 border border-white/10'
                                    }`}
                                style={{ transform: isLive ? `scale(${1 + Math.min(liveVolume * 0.5, 0.4)})` : 'scale(1)' }}
                            >
                                {isConnecting ? (
                                    <Loader2 className="w-4 h-4 text-white/80 animate-spin" />
                                ) : (
                                    <Zap className={`w-4 h-4 text-white ${aiSpeaking ? 'animate-pulse' : ''}`} />
                                )}
                                {isLive && (
                                    <div className="absolute inset-[-4px] rounded-full border border-white/10 animate-ping" />
                                )}
                            </button>
                        </div>
                    )}

                    <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleMessage(inputText);
                            }
                        }}
                        placeholder={isLive ? "Gemini is listening..." : "Describe a track..."}
                        className={`w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-4 pr-14 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none min-h-[56px] ${isLive || isConnecting ? 'pl-16' : 'pl-5'}`}
                        rows={1}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                            onClick={toggleLiveMode}
                            className={`p-2 rounded-xl transition-all duration-300 ${isLive ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            title="Live Voice AI"
                        >
                            <Mic className={`w-5 h-5 ${isLive ? 'animate-pulse' : ''}`} />
                        </button>
                        <button
                            onClick={() => handleMessage(inputText)}
                            disabled={!inputText.trim()}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all disabled:opacity-20 disabled:hover:bg-transparent"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-1.5 px-1">
                    <span className="text-[8px] text-slate-600 flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-slate-800/60 rounded text-[7px] font-mono border border-white/[0.06]">⏎</kbd> Send
                    </span>
                    <div className="text-[8px] text-slate-600 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-green-500/60 animate-pulse" />
                        <span>Ready</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudioChatPanel;
