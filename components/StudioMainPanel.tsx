import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Sparkles, Music2, Zap, Loader2, Send,
    Sliders, ChevronDown, Lightbulb, Flame,
    AlignLeft, X, Wand2, Play, Trash2,
    Settings, Edit2, Volume2, Clock,
    Mic, MicOff, ChevronUp,
    Gauge, Timer, Heart, Layers
} from './icons';
import { analyzeMusicIntent, generateCreativePrompt, getMusicSuggestions, suggestLyrics, generateCompleteLyrics } from '../services/geminiService';
import { soundManager } from '../services/soundService';
import { checkViralTrendsAndGenerateChorus } from '../services/viralService';
import SonicTiles from './SonicTiles';
import type {
    Message,
    SunoGenerationParams,
    SunoTrack,
    GenerationStatus,
    SunoPersona,
    MusicSuggestion,
} from '../types';

// Extended mood tiles beyond SonicTiles
const MOOD_TILES = [
    { id: 'happy', label: '😊 Happy', color: 'from-yellow-400 to-amber-500', prompt: 'An uplifting happy song with positive energy, bright melodies, and feel-good vibes' },
    { id: 'sad', label: '😢 Sad', color: 'from-blue-400 to-indigo-600', prompt: 'A melancholic sad song with emotional depth, minor keys, and heartfelt lyrics' },
    { id: 'aggressive', label: '🔥 Aggressive', color: 'from-red-500 to-rose-700', prompt: 'An aggressive high-energy track with powerful beats, distorted bass, and intense delivery' },
    { id: 'romantic', label: '💕 Romantic', color: 'from-pink-400 to-rose-500', prompt: 'A romantic love song with smooth vocals, warm harmonies, and intimate atmosphere' },
    { id: 'mysterious', label: '🌙 Mysterious', color: 'from-purple-500 to-violet-700', prompt: 'A mysterious atmospheric track with dark textures, haunting melodies, and suspenseful build-ups' },
    { id: 'party', label: '🎉 Party', color: 'from-orange-400 to-pink-500', prompt: 'A high-energy party anthem with infectious rhythm, crowd chants, and festival-ready drops' },
];

const EXTRA_GENRE_TILES = [
    { id: 'reggaeton', label: 'Reggaeton', prompt: 'A groovy Reggaeton track with dembow rhythm, tropical percussion, and catchy vocal hooks' },
    { id: 'drill', label: 'Drill', prompt: 'A hard-hitting UK/NY Drill beat with sliding 808s, eerie melodies, and aggressive bounce' },
    { id: 'phonk', label: 'Phonk', prompt: 'A dark Phonk track with Memphis-style vocal samples, cowbell patterns, and heavy distorted bass' },
    { id: 'futurebass', label: 'Future Bass', prompt: 'A vibrant Future Bass track with wobbly supersaws, uplifting chords, and euphoric drops' },
    { id: 'kpop', label: 'K-Pop', prompt: 'A polished K-Pop track with dynamic beat switches, catchy hooks, and energetic choreography-ready rhythm' },
    { id: 'gospel', label: 'Gospel', prompt: 'An uplifting Gospel track with powerful choir harmonies, soulful piano, and spiritual energy' },
    { id: 'bollywood', label: 'Bollywood', prompt: 'A vibrant Bollywood track with traditional Indian instruments, modern production, and theatrical flair' },
    { id: 'country', label: 'Country', prompt: 'A heartfelt Country song with acoustic guitar, steel pedal, and storytelling lyrics' },
];

interface StudioMainPanelProps {
    onGenerate: (params: SunoGenerationParams) => void;
    onSwitchToLive: () => void;
    voiceStyle: string;
    onVoiceStyleChange: (val: string) => void;
    musicQuality: string;
    onMusicQualityChange: (val: string) => void;
    voicePitch: number;
    personas: SunoPersona[];
    // Settings passthrough
    inputText: string;
    setInputText: (val: string | ((prev: string) => string)) => void;
    songTitle: string;
    setSongTitle: (val: string) => void;
    // Track display
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
    onShowSavedPrompts?: () => void;
    onShowPlaylists?: () => void;
    onShowShortcuts?: () => void;
    onCreatePersona?: () => void;
    GenerationTimelineComponent: React.ComponentType<any>;
    TrackCardComponent: React.ComponentType<any>;
}

const StudioMainPanel: React.FC<StudioMainPanelProps> = ({
    onGenerate,
    onSwitchToLive,
    voiceStyle,
    onVoiceStyleChange,
    musicQuality,
    onMusicQualityChange,
    voicePitch,
    personas,
    inputText,
    setInputText,
    songTitle,
    setSongTitle,
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
    onShowSavedPrompts,
    onShowPlaylists,
    onShowShortcuts,
    onCreatePersona,
    GenerationTimelineComponent,
    TrackCardComponent,
}) => {
    // AI Suggestions
    const [aiIdeas, setAiIdeas] = useState<MusicSuggestion[]>([]);
    const [isThinkingIdeas, setIsThinkingIdeas] = useState(false);
    const [isGeneratingViral, setIsGeneratingViral] = useState(false);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string>('');
    const [selectedScale, setSelectedScale] = useState<string>('');
    const [musicStyle, setMusicStyle] = useState<string>('auto');
    const [bpm, setBpm] = useState<number>(120);
    const [duration, setDuration] = useState<string>('auto');
    const [isInstrumental, setIsInstrumental] = useState(false);
    const [moodIntensity, setMoodIntensity] = useState<number>(5);
    const [showMoods, setShowMoods] = useState(false);
    const [showExtraGenres, setShowExtraGenres] = useState(false);

    // Lyrics Editor
    const [lyrics, setLyrics] = useState('');
    const [showLyrics, setShowLyrics] = useState(false);
    const [isSuggestingLyrics, setIsSuggestingLyrics] = useState(false);
    const [isGeneratingFullLyrics, setIsGeneratingFullLyrics] = useState(false);
    const [lyricsSuggestions, setLyricsSuggestions] = useState<string[]>([]);
    const [editorGenre, setEditorGenre] = useState('Pop');
    const [editorStyle, setEditorStyle] = useState('Catchy');
    const [editorVoice, setEditorVoice] = useState('Auto');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const tracksRef = useRef<HTMLDivElement>(null);

    const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const SCALES = ['Major', 'Minor', 'Pentatonic', 'Blues', 'Dorian', 'Lydian', 'Phrygian', 'Mixolydian'];
    const GENRES = ["Pop", "EDM", "Rock", "Hip-Hop", "Lo-Fi", "Jazz", "R&B", "Country", "Classical", "Metal"];
    const STYLES = ["Catchy", "Chill", "Energetic", "Dark", "Melancholic", "Aggressive", "Smooth", "Cinematic", "Experimental"];
    const VOICES = ["Auto", "Male", "Female", "Child", "Robot", "Deep", "Soft", "Vocaloid"];

    const voiceOptions = [
        { value: 'Auto', label: 'Auto Voice' },
        { value: 'Male', label: 'Male' },
        { value: 'Female', label: 'Female' },
        { value: 'Child', label: 'Child' },
        { value: 'Robot', label: 'Robot' },
        { value: 'Choir', label: 'Choir' },
        { value: 'Duet', label: 'Duet' }
    ];
    personas.forEach(p => {
        voiceOptions.push({ value: `Persona:${p.personaId}`, label: `🎤 ${p.name}` });
    });

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [inputText]);

    // Scroll to tracks when new ones appear
    useEffect(() => {
        const hasCompleteTracks = sessionTaskQueue.some(g => g.tracks && g.tracks.length > 0);
        if (hasCompleteTracks && tracksRef.current) {
            tracksRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [sessionTaskQueue]);

    const handleGenerate = () => {
        if (!inputText.trim() && !lyrics.trim()) return;

        let prompt = inputText.trim();

        // Enrich prompt with settings
        const enrichments: string[] = [];
        if (musicStyle !== 'auto') enrichments.push(`Genre: ${musicStyle}`);
        if (selectedKey) enrichments.push(`Key: ${selectedKey}`);
        if (selectedScale) enrichments.push(`Scale: ${selectedScale}`);
        if (bpm !== 120) enrichments.push(`BPM: ${bpm}`);
        if (duration !== 'auto') enrichments.push(`Duration: ${duration}`);
        if (isInstrumental) enrichments.push('Instrumental only, no vocals');

        const settingsPrefix = enrichments.length > 0 ? `[${enrichments.join(' | ')}]\n` : '';

        if (lyrics.trim() && !prompt) {
            prompt = `Generate a ${editorGenre} song in ${editorStyle} style with these lyrics:\n\n${lyrics}`;
        } else if (lyrics.trim()) {
            prompt += `\n\nLyrics:\n${lyrics}`;
        }

        const params: SunoGenerationParams = {
            prompt: settingsPrefix + prompt,
            title: songTitle || undefined,
            instrumental: isInstrumental,
            model: musicQuality as any,
            voicePitch,
        };

        if (voiceStyle !== 'Auto') {
            if (voiceStyle.startsWith('Persona:')) {
                const personaId = voiceStyle.split('Persona:')[1];
                const persona = personas.find(p => p.personaId === personaId);
                if (persona) {
                    params.personaId = persona.personaId;
                }
            } else {
                params.voiceType = voiceStyle;
            }
        }

        if (selectedKey) params.musicalKey = selectedKey;
        if (selectedScale) params.musicalScale = selectedScale;

        onGenerate(params);
        soundManager.playClick();
    };

    const handleBrainstorm = async () => {
        setIsThinkingIdeas(true);
        soundManager.playClick();
        try {
            const suggestions = await getMusicSuggestions([]);
            setAiIdeas(suggestions);
            soundManager.playSuccess();
        } catch (e) { console.error(e); soundManager.playError(); }
        finally { setIsThinkingIdeas(false); }
    };

    const handleViralGen = async () => {
        setIsGeneratingViral(true);
        soundManager.playClick();
        try {
            const chorus = await checkViralTrendsAndGenerateChorus();
            setInputText(`Generate a song with these lyrics:\n\n${chorus}`);
            soundManager.playSuccess();
        } catch (e) { console.error(e); soundManager.playError(); }
        finally { setIsGeneratingViral(false); }
    };

    const handleInspire = async () => {
        soundManager.playClick();
        try {
            const suggestions = await getMusicSuggestions([]);
            if (suggestions.length > 0) {
                const pick = suggestions[0];
                setInputText(pick.prompt);
                setSongTitle(pick.title);
                soundManager.playSuccess();
            }
        } catch (e) { console.error(e); soundManager.playError(); }
    };

    const handleFetchLyricsSuggestions = async () => {
        setIsSuggestingLyrics(true);
        soundManager.playClick();
        try {
            const suggestions = await suggestLyrics(lyrics, []);
            setLyricsSuggestions(suggestions);
        } catch (e) { console.error(e); }
        finally { setIsSuggestingLyrics(false); }
    };

    const handleGenerateFullSongLyrics = async () => {
        setIsGeneratingFullLyrics(true);
        soundManager.playClick();
        try {
            const fullLyrics = await generateCompleteLyrics([], lyrics);
            setLyrics(fullLyrics);
            setLyricsSuggestions([]);
            soundManager.playSuccess();
        } catch (e) { console.error(e); soundManager.playError(); }
        finally { setIsGeneratingFullLyrics(false); }
    };

    const hasActiveTracks = sessionTaskQueue.some(g => g.status !== 'idle');

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* ── Lyrics Editor Slide-out ── */}
            <div className={`absolute top-0 right-0 w-full md:w-[28rem] h-full border-l border-white/10 z-50 transition-transform duration-300 ease-in-out shadow-2xl flex flex-col glass ${showLyrics ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <div className="flex items-center gap-3">
                        <AlignLeft className="w-5 h-5 text-cyan-400" />
                        <h3 className="font-black text-white text-base font-outfit">Lyrics Editor</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleGenerateFullSongLyrics} disabled={isGeneratingFullLyrics}
                            className="p-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg text-purple-400 transition-all" title="Generate Full Lyrics">
                            {isGeneratingFullLyrics ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                        </button>
                        <button onClick={handleFetchLyricsSuggestions} disabled={isSuggestingLyrics}
                            className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg text-cyan-400 transition-all" title="AI Suggestions">
                            {isSuggestingLyrics ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        </button>
                        <button onClick={() => setShowLyrics(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Editor Bar */}
                <div className="px-5 py-3 border-b border-white/5 bg-slate-900/40 grid grid-cols-3 gap-2">
                    {[{ label: 'Genre', value: editorGenre, setter: setEditorGenre, options: GENRES },
                    { label: 'Style', value: editorStyle, setter: setEditorStyle, options: STYLES },
                    { label: 'Voice', value: editorVoice, setter: setEditorVoice, options: VOICES }].map(ctrl => (
                        <div key={ctrl.label} className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-500 ml-1">{ctrl.label}</label>
                            <div className="relative">
                                <select value={ctrl.value} onChange={e => ctrl.setter(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-2 py-2 text-[11px] font-bold text-white focus:outline-none focus:border-cyan-500/50 appearance-none transition-colors">
                                    {ctrl.options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Lyrics Textarea */}
                <div className="flex-1 p-5 relative flex flex-col gap-3 overflow-hidden bg-slate-900/40">
                    {lyricsSuggestions.length > 0 && (
                        <div className="bg-slate-800/90 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl flex-shrink-0 z-10">
                            <div className="flex justify-between items-center px-1 mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                                    <Zap className="w-3 h-3" /> Continuations
                                </span>
                                <button onClick={() => setLyricsSuggestions([])} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="grid gap-2">
                                {lyricsSuggestions.map((s, idx) => (
                                    <button key={idx} onClick={() => { setLyrics(prev => prev + (prev.endsWith('\n') || prev === '' ? '' : '\n') + s + '\n'); setLyricsSuggestions([]); soundManager.playSuccess(); }}
                                        className="w-full text-left p-3 bg-white/5 hover:bg-cyan-500/10 rounded-xl text-xs text-slate-300 hover:text-cyan-100 transition-all border border-transparent hover:border-cyan-500/30">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
                        placeholder="Type your lyrics here..."
                        className="flex-1 w-full bg-white/[0.02] rounded-2xl border border-white/5 p-4 text-sm font-mono text-slate-300 focus:outline-none resize-none placeholder-slate-600 leading-relaxed custom-scrollbar"
                        spellCheck={false} />
                </div>

                <div className="p-5 border-t border-white/10 bg-black/20 flex gap-3">
                    <button onClick={() => { setLyrics(''); setLyricsSuggestions([]); }} className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Clear">
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => { handleGenerate(); setShowLyrics(false); }}
                        className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 relative overflow-hidden group">
                        <Sparkles className="w-5 h-5" /> Generate Song
                    </button>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-8 scroll-smooth">
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center mb-10 animate-in fade-in duration-500">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/20 mb-5">
                        <Music2 className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 font-outfit">
                        Sonic Studio
                    </h2>
                    <p className="text-slate-400 text-base md:text-lg font-medium max-w-xl leading-relaxed">
                        Describe any vibe, pick a genre, or let AI inspire you.
                    </p>
                </div>

                {/* ── Prompt Input ── */}
                <div className="w-full max-w-4xl mx-auto mb-8">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-purple-500/15 rounded-2xl blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
                        <div className="relative bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4 focus-within:border-cyan-500/30 transition-all shadow-xl">
                            <textarea
                                ref={textareaRef}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                                placeholder="Describe your track — e.g. 'Epic cinematic orchestral score with heavy brass'..."
                                className="w-full bg-transparent text-sm md:text-base text-white placeholder-slate-600 focus:outline-none resize-none min-h-[60px] max-h-[200px] custom-scrollbar leading-relaxed"
                            />

                            {/* Song Title (inline) */}
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                                <div className="flex-1 relative">
                                    <input
                                        value={songTitle}
                                        onChange={e => setSongTitle(e.target.value)}
                                        placeholder="Song title (optional)"
                                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/30 transition-colors"
                                    />
                                </div>

                                {/* Quick Settings Dropdowns */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="relative group/sel">
                                        <select value={voiceStyle} onChange={e => onVoiceStyleChange(e.target.value)}
                                            className="appearance-none bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold py-1.5 pl-2 pr-5 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/30 hover:bg-white/[0.08] transition-all cursor-pointer max-w-[85px]">
                                            {voiceOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>)}
                                        </select>
                                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                                    </div>
                                    <div className="relative group/sel">
                                        <select value={musicQuality} onChange={e => onMusicQualityChange(e.target.value)}
                                            className="appearance-none bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold py-1.5 pl-2 pr-5 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/30 hover:bg-white/[0.08] transition-all cursor-pointer max-w-[80px]">
                                            <option value="V3" className="bg-slate-900">V3 Draft</option>
                                            <option value="V3_5" className="bg-slate-900">V3.5</option>
                                            <option value="V4_5" className="bg-slate-900">V4.5 HQ</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                                    </div>
                                </div>

                                <button onClick={handleGenerate} disabled={!inputText.trim() && !lyrics.trim()}
                                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-white shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-2 shrink-0">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="text-sm hidden md:inline">Create</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── AI Assist Row ── */}
                <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2 mb-8">
                    <button onClick={handleBrainstorm} disabled={isThinkingIdeas}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-slate-400 hover:text-amber-300 hover:bg-amber-500/[0.06] hover:border-amber-500/20 transition-all">
                        {isThinkingIdeas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                        Brainstorm Ideas
                    </button>
                    <button onClick={handleViralGen} disabled={isGeneratingViral}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-slate-400 hover:text-orange-300 hover:bg-orange-500/[0.06] hover:border-orange-500/20 transition-all">
                        {isGeneratingViral ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                        Viral Hook
                    </button>
                    <button onClick={handleInspire}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-slate-400 hover:text-purple-300 hover:bg-purple-500/[0.06] hover:border-purple-500/20 transition-all">
                        <Sparkles className="w-4 h-4" />
                        Inspire Me
                    </button>
                    <button onClick={() => setShowLyrics(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-bold text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/[0.06] hover:border-cyan-500/20 transition-all">
                        <AlignLeft className="w-4 h-4" />
                        Lyrics Editor
                    </button>
                    <button onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs font-bold transition-all ${showSettings
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>
                        <Sliders className="w-4 h-4" />
                        Settings
                    </button>
                </div>

                {/* ── AI Ideas Grid ── */}
                {aiIdeas.length > 0 && (
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 animate-in zoom-in fade-in duration-500">
                        {aiIdeas.map((idea, idx) => (
                            <button key={idx} onClick={() => { setInputText(idea.prompt); setSongTitle(idea.title); soundManager.playSuccess(); }}
                                className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-left hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all hover:scale-[1.02] shadow-lg group/idea">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-400/80">Idea {idx + 1}</span>
                                    <Zap className="w-3 h-3 text-cyan-500 opacity-0 group-hover/idea:opacity-100 transition-opacity" />
                                </div>
                                <h4 className="text-white font-bold text-sm mb-1 truncate">{idea.title}</h4>
                                <p className="text-slate-500 text-[10px] font-medium mb-1">{idea.genre} • {idea.mood}</p>
                                <p className="text-slate-400 text-[10px] leading-relaxed line-clamp-2 italic">"{idea.theme}"</p>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Extended Settings Panel ── */}
                {showSettings && (
                    <div className="max-w-4xl mx-auto mb-8 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400/80 flex items-center gap-2">
                                    <Sliders className="w-3.5 h-3.5" /> Production Settings
                                </span>
                                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/[0.06] rounded-lg text-slate-500 hover:text-white transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Key */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Music2 className="w-2.5 h-2.5" /> Key
                                    </label>
                                    <div className="relative">
                                        <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
                                            className="w-full bg-slate-800/60 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-500/30 appearance-none transition-colors">
                                            <option value="">Auto</option>
                                            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Scale */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Settings className="w-2.5 h-2.5" /> Scale
                                    </label>
                                    <div className="relative">
                                        <select value={selectedScale} onChange={e => setSelectedScale(e.target.value)}
                                            className="w-full bg-slate-800/60 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-500/30 appearance-none transition-colors">
                                            <option value="">Auto</option>
                                            {SCALES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* BPM */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Gauge className="w-2.5 h-2.5" /> BPM: {bpm}
                                    </label>
                                    <input type="range" min="60" max="200" value={bpm} onChange={e => setBpm(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-800/60 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                                </div>

                                {/* Duration */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Timer className="w-2.5 h-2.5" /> Duration
                                    </label>
                                    <div className="relative">
                                        <select value={duration} onChange={e => setDuration(e.target.value)}
                                            className="w-full bg-slate-800/60 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-500/30 appearance-none transition-colors">
                                            <option value="auto">Auto</option>
                                            <option value="30s">30 sec</option>
                                            <option value="1m">1 min</option>
                                            <option value="2m">2 min</option>
                                            <option value="3m">3 min</option>
                                            <option value="4m">4 min</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Style/Genre */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Edit2 className="w-2.5 h-2.5" /> Genre
                                    </label>
                                    <div className="relative">
                                        <select value={musicStyle} onChange={e => setMusicStyle(e.target.value)}
                                            className="w-full bg-slate-800/60 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-500/30 appearance-none transition-colors">
                                            <option value="auto">Auto</option>
                                            {["Pop", "Hip-Hop", "Electronic", "R&B", "Rock", "Lo-Fi", "Cinematic", "Jazz", "Latin", "Ambient", "Country", "Metal"].map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Mood Intensity */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Heart className="w-2.5 h-2.5" /> Mood: {moodIntensity}/10
                                    </label>
                                    <input type="range" min="1" max="10" value={moodIntensity} onChange={e => setMoodIntensity(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-800/60 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                </div>

                                {/* Instrumental Toggle */}
                                <div className="space-y-1.5 col-span-2 md:col-span-2">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                                        <Volume2 className="w-2.5 h-2.5" /> Vocal Mode
                                    </label>
                                    <button onClick={() => setIsInstrumental(!isInstrumental)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${isInstrumental
                                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                                            : 'bg-slate-800/60 border-white/[0.06] text-slate-300'}`}>
                                        <span className="text-[11px] font-semibold">{isInstrumental ? 'Instrumental Only' : 'With Vocals'}</span>
                                        {isInstrumental ? <span className="text-purple-400 text-lg">●</span> : <span className="text-slate-500 text-lg">○</span>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Popular Vibes (SonicTiles) ── */}
                <div className="max-w-5xl mx-auto mb-6">
                    <div className="flex items-center gap-4 mb-4 px-1">
                        <div className="h-px bg-white/[0.06] flex-1" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Popular Vibes</span>
                        <div className="h-px bg-white/[0.06] flex-1" />
                    </div>
                    <SonicTiles setInputText={setInputText} />
                </div>

                {/* ── Mood Tiles ── */}
                <div className="max-w-5xl mx-auto mb-6">
                    <button onClick={() => setShowMoods(!showMoods)} className="flex items-center gap-2 mb-3 px-1 group">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] group-hover:text-slate-300 transition-colors">Moods</span>
                        <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform ${showMoods ? 'rotate-180' : ''}`} />
                    </button>
                    {showMoods && (
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            {MOOD_TILES.map(tile => (
                                <button key={tile.id} onClick={() => setInputText(tile.prompt)}
                                    className="group relative overflow-hidden rounded-xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center gap-2 h-[3.5rem]">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${tile.color} opacity-0 group-hover:opacity-[0.12] transition-opacity duration-500`} />
                                    <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{tile.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Extra Genres ── */}
                <div className="max-w-5xl mx-auto mb-8">
                    <button onClick={() => setShowExtraGenres(!showExtraGenres)} className="flex items-center gap-2 mb-3 px-1 group">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] group-hover:text-slate-300 transition-colors">More Genres</span>
                        <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform ${showExtraGenres ? 'rotate-180' : ''}`} />
                    </button>
                    {showExtraGenres && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            {EXTRA_GENRE_TILES.map(tile => (
                                <button key={tile.id} onClick={() => setInputText(tile.prompt)}
                                    className="group relative overflow-hidden rounded-xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center h-[3.5rem]">
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors uppercase tracking-wider">{tile.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Generated Tracks ── */}
                {hasActiveTracks && (
                    <div ref={tracksRef} className="max-w-5xl mx-auto">
                        <div className="flex items-center gap-4 mb-6 px-1">
                            <div className="h-px bg-white/[0.06] flex-1" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Generated Tracks</span>
                            <div className="h-px bg-white/[0.06] flex-1" />
                        </div>

                        {sessionTaskQueue.map((genStatus) => genStatus.status !== 'idle' && (
                            <div key={genStatus.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8">
                                <GenerationTimelineComponent
                                    genStatus={genStatus}
                                    onRegenerate={genStatus.retryParams ? () => onGenerate(genStatus.retryParams!) : undefined}
                                    onStop={() => {
                                        setSessionTaskQueue((prev: any[]) => prev.map((g: any) => g.id === genStatus.id ? { ...g, status: 'error' as const, error: 'Stopped by user' } : g));
                                        soundManager.playClick();
                                    }}
                                />

                                {genStatus.tracks && (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudioMainPanel;
