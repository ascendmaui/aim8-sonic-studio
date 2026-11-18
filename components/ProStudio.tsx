import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Music2, Wand2, FileText, Plus, Upload, Guitar, Mic2, Scissors,
    Video, FileAudio, AlignLeft, Crown, Sparkles, Loader2, Play,
    Pause, Download, ChevronDown, X, Check, Zap, Copy, Menu, MessageSquare, Trash2, CheckCircle2, Info
} from 'lucide-react';
import * as KiePro from '../services/kieProService';
import { classifyError } from '../services/kieProService';
import { showToast } from '../services/notificationService';
import { trackEvent } from '../services/analyticsService';
import ProUploader from './ProUploader';
import { useAuth } from './AuthContext';
import type { SunoTrack } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProTab =
    | 'generate' | 'lyrics' | 'extend' | 'video'
    | 'cover' | 'upload-extend' | 'instrumental' | 'vocals'
    | 'stems' | 'wav' | 'synced-lyrics';

interface ProStudioProps {
    apiKey: string;
    isPro: boolean;
    library: SunoTrack[];
    onOpenPaywall: () => void;
    onTrackGenerated?: (tracks: SunoTrack[]) => void;
    onPlay?: (track: SunoTrack) => void;
}

// ─── Pro Gate Overlay (visible but unusable) ─────────────────────────────────


// ─── Shared status component ─────────────────────────────────────────────────

const TaskProgress: React.FC<{ status: string; error?: string; onDismiss: () => void; onRetry?: () => void }> = ({ status, error, onDismiss, onRetry }) => (
    <div className={`mt-4 rounded-xl p-4 border ${error ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'} flex items-center gap-3`}>
        {error
            ? <X className="w-5 h-5 text-red-400 shrink-0" />
            : <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
        }
        <p className={`text-sm font-medium flex-1 ${error ? 'text-red-300' : 'text-amber-300'}`}>{error || status}</p>
        {error && onRetry && (
            <button onClick={onRetry} className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/30 font-bold transition-all">Retry</button>
        )}
        {error && <button onClick={onDismiss} className="text-xs text-red-400 hover:text-red-300 font-bold">Dismiss</button>}
    </div>
);

// ─── Audio result player ─────────────────────────────────────────────────────

const TrackResult: React.FC<{ tracks: KiePro.KieTrack[]; onPlay?: (t: KiePro.KieTrack) => void; onSave?: (t: KiePro.KieTrack) => void }> = ({ tracks, onPlay, onSave }) => {
    const [playing, setPlaying] = useState<string | null>(null);
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = (track: KiePro.KieTrack) => {
        if (playing === track.audioUrl) {
            audioRef.current?.pause();
            setPlaying(null);
        } else {
            if (audioRef.current) {
                audioRef.current.src = track.audioUrl;
                audioRef.current.load();
                const onCanPlay = () => {
                    audioRef.current?.play();
                    audioRef.current?.removeEventListener('canplay', onCanPlay);
                };
                audioRef.current.addEventListener('canplay', onCanPlay);
            }
            setPlaying(track.audioUrl);
            onPlay?.(track);
        }
    };

    const handleSave = (track: KiePro.KieTrack) => {
        onSave?.(track);
        setSaved(prev => new Set(prev).add(track.id || track.audioUrl));
    };

    return (
        <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-bold text-emerald-400">{tracks.length} track{tracks.length > 1 ? 's' : ''} generated</p>
            </div>
            <audio ref={audioRef} onEnded={() => setPlaying(null)} />
            {tracks.map((t, i) => {
                const isSaved = saved.has(t.id || t.audioUrl);
                return (
                    <div key={t.id || i} className={`group rounded-2xl border p-4 flex items-center gap-4 transition-all duration-300 ${playing === t.audioUrl ? 'bg-amber-500/10 border-amber-500/20 shadow-lg shadow-amber-500/5' : 'bg-slate-800/40 border-white/[0.06] hover:border-white/10 hover:bg-slate-800/60'}`}>
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-md">
                            {t.imageUrl ? <img src={t.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center"><Music2 className="w-6 h-6 text-amber-400" /></div>}
                            <button onClick={() => togglePlay(t)} className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-all">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${playing === t.audioUrl ? 'bg-amber-500 text-white' : 'bg-white/20 backdrop-blur-sm text-white'}`}>
                                    {playing === t.audioUrl ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                                </div>
                            </button>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{t.title || `Track ${i + 1}`}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{t.tags} • {Math.round(t.duration)}s</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => togglePlay(t)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${playing === t.audioUrl ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400'}`}>
                                {playing === t.audioUrl ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                            </button>
                            {onSave && (
                                <button onClick={() => handleSave(t)} disabled={isSaved} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isSaved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400'}`} title={isSaved ? 'Saved!' : 'Save to library'}>
                                    {isSaved ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                </button>
                            )}
                            <a href={t.audioUrl} onClick={() => trackEvent('export_track', { format: 'mp3', source: 'pro_studio' })} download={`${t.title || 'track'}.mp3`} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white" title="Download">
                                <Download className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Shared form input styles ────────────────────────────────────────────────

const inputCls = "w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all";
const labelCls = "text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block";
const btnCls = "flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold transition-all hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:pointer-events-none";
const selectCls = inputCls;

// ─── Model selector ─────────────────────────────────────────────────────────

const ModelSelect: React.FC<{ value: KiePro.KieModel; onChange: (v: KiePro.KieModel) => void }> = ({ value, onChange }) => (
    <div>
        <label className={labelCls}>AI Model</label>
        <select value={value} onChange={e => onChange(e.target.value as KiePro.KieModel)} className={selectCls}>
            <option value="V5">V5 — Fastest, Superior Quality</option>
            <option value="V4_5ALL">V4.5 All — Smart + Fast</option>
            <option value="V4_5PLUS">V4.5 Plus — Richest Sound</option>
            <option value="V4_5">V4.5 — Smart Prompts</option>
            <option value="V4">V4 — Best Vocals</option>
            <option value="V3_5">V3.5 — Better Structure</option>
        </select>
    </div>
);

// ─── Track selector (from library) ──────────────────────────────────────────

const TrackSelect: React.FC<{ library: SunoTrack[]; value: string; onChange: (id: string, track: SunoTrack) => void; label?: string }> = ({ library, value, onChange, label }) => (
    <div>
        <label className={labelCls}>{label || 'Select Track'}</label>
        <select
            value={value}
            onChange={e => {
                const t = library.find(l => l.id === e.target.value);
                if (t) onChange(t.id, t);
            }}
            className={selectCls}
        >
            <option value="">— Choose a track from your library —</option>
            {library.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({Math.round(t.duration)}s)</option>
            ))}
        </select>
    </div>
);

// ─── TAB: Generate ──────────────────────────────────────────────────────────

const GENRE_SUGGESTIONS = [
    { label: '🎤 Hip-Hop', prompt: 'A hard-hitting hip-hop track with deep 808 bass', style: 'Hip-Hop, Trap, Hard-hitting' },
    { label: '🎸 Rock', prompt: 'An energetic rock anthem with driving guitars and powerful drums', style: 'Rock, Anthemic, Guitar-driven' },
    { label: '🎹 Lo-Fi', prompt: 'A chill lo-fi beat with warm vinyl crackle and mellow keys', style: 'Lo-Fi, Chill, Warm' },
    { label: '🎬 Cinematic', prompt: 'An epic cinematic orchestral piece with soaring strings', style: 'Cinematic, Orchestral, Epic' },
    { label: '🎧 Electronic', prompt: 'A pulsing electronic dance track with synthetic arps', style: 'Electronic, Dance, Synth' },
    { label: '🎷 Jazz', prompt: 'A smooth jazz fusion track with saxophone and piano', style: 'Jazz, Smooth, Fusion' },
    { label: '💃 Latin', prompt: 'A vibrant Latin reggaeton track with infectious rhythm', style: 'Latin, Reggaeton, Vibrant' },
    { label: '🌊 Ambient', prompt: 'A serene ambient soundscape with ethereal pads', style: 'Ambient, Ethereal, Atmospheric' },
];

const GenerateTab: React.FC<{ apiKey: string; onSave?: (t: KiePro.KieTrack) => void; onPlay?: (t: KiePro.KieTrack) => void }> = ({ apiKey, onSave, onPlay }) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [title, setTitle] = useState('');
    const [model, setModel] = useState<KiePro.KieModel>('V5');
    const [instrumental, setInstrumental] = useState(false);
    const [customMode, setCustomMode] = useState(true);
    const [negativeTags, setNegativeTags] = useState('');
    const [personaId, setPersonaId] = useState('');
    const [guidanceScale, setGuidanceScale] = useState(5.0);
    const [steps, setSteps] = useState(50);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [boosting, setBoosting] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [tracks, setTracks] = useState<KiePro.KieTrack[]>([]);
    const [busy, setBusy] = useState(false);

    const handleBoostStyle = async () => {
        if (!style.trim()) return;
        setBoosting(true);
        try {
            const boosted = await KiePro.boostStyle(apiKey, style);
            setStyle(boosted);
        } catch { }
        setBoosting(false);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setBusy(true); setError(''); setTracks([]); setStatus('Starting...');

        try {
            const taskId = await KiePro.generateMusic(apiKey, {
                prompt, customMode, instrumental, model, style: customMode ? style : undefined,
                title: customMode ? title : undefined, negativeTags: negativeTags || undefined,
                personaId: personaId || undefined,
                guidanceScale: customMode ? guidanceScale : undefined,
                steps: customMode ? steps : undefined,
            });
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'music', setStatus);
            const returnedTracks: KiePro.KieTrack[] = result?.sunoData || [];
            const validTracks = returnedTracks.filter(t => t.audioUrl && t.duration > 0);

            if (validTracks.length > 0) {
                setTracks(validTracks);
                setStatus('');
                showToast('Track Ready!', `${validTracks.length} track${validTracks.length > 1 ? 's' : ''} generated successfully.`, 'success');
            } else {
                setError('No playable tracks were returned. The AI may have timed out — try again.');
                showToast('Generation Issue', 'No playable tracks returned. Please retry.', 'warning');
            }
        } catch (e: any) {
            const { title: t, body: b } = classifyError(e);
            setError(b);
            setStatus('');
            showToast(t, b, 'error');
        }
        setBusy(false);
    };

    const applyGenre = (g: typeof GENRE_SUGGESTIONS[0]) => {
        setPrompt(g.prompt);
        setStyle(g.style);
        setCustomMode(true);
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-xs text-slate-500">All models including V5 • Unlimited generations • Custom + Simple modes</p>
            </div>

            {/* Quick-start genre chips — 3D glossy */}
            {!prompt && (
                <div>
                    <label className={labelCls}>Quick Start</label>
                    <div className="flex flex-wrap gap-2 mt-1" style={{ perspective: '600px' }}>
                        {GENRE_SUGGESTIONS.map(g => (
                            <button key={g.label} onClick={() => applyGenre(g)}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-amber-500/30 hover:bg-amber-500/10 text-xs font-semibold text-slate-400 hover:text-amber-300"
                                style={{ transition: 'all 0.3s cubic-bezier(0.03,0.98,0.52,0.99)' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'perspective(400px) rotateX(-4deg) translateY(-2px) scale(1.06)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(245,158,11,0.15)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'perspective(400px) rotateX(0deg) translateY(0px) scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelCls}>Prompt</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Describe the music you want to create..." className={inputCls + ' resize-none'} />
                </div>

                <div className="md:col-span-2">
                    <label className={labelCls}>Persona (Optional)</label>
                    <select
                        value={personaId}
                        onChange={e => setPersonaId(e.target.value)}
                        className={selectCls}
                    >
                        <option value="">— No Persona (Default) —</option>
                        {JSON.parse(localStorage.getItem('aim8_settings') || '{}').personas?.map((p: any) => (
                            <option key={p.personaId} value={p.personaId}>{p.name}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1.5 px-1">
                        <Info className="w-3 h-3" /> Select a saved voice persona to guide the vocal identity.
                    </p>
                </div>

                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label className={labelCls}>Custom Mode</label>
                        <button onClick={() => setCustomMode(!customMode)} className={`${inputCls} text-left flex items-center gap-2`}>
                            <div className={`w-4 h-4 rounded border ${customMode ? 'bg-amber-500 border-amber-500' : 'border-white/20'} flex items-center justify-center`}>
                                {customMode && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {customMode ? 'On — Style & Title enabled' : 'Off — Simple mode'}
                        </button>
                    </div>
                    <div className="flex-1">
                        <label className={labelCls}>Instrumental</label>
                        <button onClick={() => setInstrumental(!instrumental)} className={`${inputCls} text-left flex items-center gap-2`}>
                            <div className={`w-4 h-4 rounded border ${instrumental ? 'bg-amber-500 border-amber-500' : 'border-white/20'} flex items-center justify-center`}>
                                {instrumental && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {instrumental ? 'On — No vocals' : 'Off — Vocals included'}
                        </button>
                    </div>
                </div>

                {customMode && (
                    <div className="md:col-span-2 space-y-4 pt-2">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-amber-500 uppercase tracking-widest transition-colors mb-2"
                        >
                            <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                            {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                        </button>

                        {showAdvanced && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-in fade-in slide-in-from-top-2 duration-300">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className={labelCls + ' mb-0'}>Guidance Scale</label>
                                        <span className="text-[10px] font-mono text-amber-500 font-bold">{guidanceScale.toFixed(1)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.5"
                                        value={guidanceScale}
                                        onChange={e => setGuidanceScale(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-[8px] text-slate-600">Soft (1.0)</span>
                                        <span className="text-[8px] text-slate-600">Strong (10.0)</span>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className={labelCls + ' mb-0'}>Generation Steps</label>
                                        <span className="text-[10px] font-mono text-amber-500 font-bold">{steps}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        step="5"
                                        value={steps}
                                        onChange={e => setSteps(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-[8px] text-slate-600">Fast (10)</span>
                                        <span className="text-[8px] text-slate-600">Quality (100)</span>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className={labelCls}>Negative Prompt (Style to avoid)</label>
                                    <input
                                        value={negativeTags}
                                        onChange={e => setNegativeTags(e.target.value)}
                                        placeholder="E.g. distorted, low quality, noise..."
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <ModelSelect value={model} onChange={setModel} />

                {customMode && (
                    <>
                        <div>
                            <label className={labelCls}>Style</label>
                            <div className="flex gap-2">
                                <input value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g. Pop, Energetic, Guitar-driven" className={inputCls + ' flex-1'} />
                                <button onClick={handleBoostStyle} disabled={boosting || !style.trim()} className="px-3 py-2 rounded-xl bg-purple-500/20 border border-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-bold transition-all disabled:opacity-50" title="AI Boost Style">
                                    {boosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Title</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title" className={inputCls} maxLength={80} />
                        </div>
                    </>
                )}

                <div className="md:col-span-2">
                    <label className={labelCls}>Negative Tags <span className="text-slate-600">(optional)</span></label>
                    <input value={negativeTags} onChange={e => setNegativeTags(e.target.value)} placeholder="Exclude: e.g. screaming, distortion" className={inputCls} />
                </div>
            </div>

            <button onClick={handleGenerate} disabled={busy || !prompt.trim()} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Music
            </button>

            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleGenerate : undefined} />}
            {tracks.length > 0 && <TrackResult tracks={tracks} onSave={onSave} onPlay={onPlay} />}
        </div>
    );
};

// ─── TAB: Lyrics ────────────────────────────────────────────────────────────

const LyricsTab: React.FC<{ apiKey: string }> = ({ apiKey }) => {
    const [prompt, setPrompt] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [lyrics, setLyrics] = useState<Array<{ title: string; text: string }>>([]);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState<number | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setBusy(true); setError(''); setLyrics([]); setStatus('Starting...');
        try {
            const taskId = await KiePro.generateLyrics(apiKey, prompt);
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'lyrics', setStatus);
            const data = result?.lyricsData || [];
            setLyrics(data);
            setStatus('');
            if (data.length > 0) showToast('Lyrics Ready!', `${data.length} variation${data.length > 1 ? 's' : ''} generated.`, 'success');
            else { setError('No lyrics returned. Try a different prompt.'); showToast('No Results', 'Lyrics generation returned empty.', 'warning'); }
        } catch (e: any) {
            const { title: t, body: b } = classifyError(e);
            setError(b); setStatus('');
            showToast(t, b, 'error');
        }
        setBusy(false);
    };

    const handleCopy = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Generate structured lyrics with verse/chorus sections from a prompt.</p>

            <div>
                <label className={labelCls}>Theme / Concept</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="A nostalgic song about childhood memories and growing up..." className={inputCls + ' resize-none'} maxLength={200} />
                <p className="text-[10px] text-slate-600 mt-1">{prompt.length}/200 characters</p>
            </div>

            <button onClick={handleGenerate} disabled={busy || !prompt.trim()} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Lyrics
            </button>

            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleGenerate : undefined} />}

            {lyrics.length > 0 && (
                <div className="space-y-4 mt-4">
                    {lyrics.map((l, i) => (
                        <div key={i} className="rounded-xl bg-slate-800/60 border border-white/5 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-white">{l.title || `Variation ${i + 1}`}</h4>
                                <button onClick={() => handleCopy(l.text, i)} className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                                    {copied === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                                </button>
                            </div>
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{l.text}</pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── TAB: Extend ────────────────────────────────────────────────────────────

const ExtendTab: React.FC<{ apiKey: string; library: SunoTrack[]; onSave?: (t: KiePro.KieTrack) => void; onPlay?: (t: KiePro.KieTrack) => void }> = ({ apiKey, library, onSave, onPlay }) => {
    const [audioId, setAudioId] = useState('');
    const [continueAt, setContinueAt] = useState(60);
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [title, setTitle] = useState('');
    const [model, setModel] = useState<KiePro.KieModel>('V5');
    const [useCustom, setUseCustom] = useState(true);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [tracks, setTracks] = useState<KiePro.KieTrack[]>([]);
    const [busy, setBusy] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<SunoTrack | null>(null);

    const handleExtend = async () => {
        if (!audioId) return;
        setBusy(true); setError(''); setTracks([]); setStatus('Starting...');
        try {
            const taskId = await KiePro.extendMusic(apiKey, {
                audioId, defaultParamFlag: useCustom, model,
                prompt: useCustom ? prompt : undefined,
                style: useCustom ? style : undefined,
                title: useCustom ? title : undefined,
                continueAt: useCustom ? continueAt : undefined,
            });
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'music', setStatus);
            const valid = (result?.sunoData || []).filter((t: KiePro.KieTrack) => t.audioUrl && t.duration > 0);
            setTracks(valid); setStatus('');
            if (valid.length > 0) showToast('Extended!', 'Track extended successfully.', 'success');
            else { setError('No playable tracks returned. Try again.'); showToast('Extend Issue', 'No playable tracks.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Extend an existing track seamlessly from a specific timestamp.</p>

            <TrackSelect library={library} value={audioId} onChange={(id, t) => { setAudioId(id); setSelectedTrack(t); }} />

            {selectedTrack && (
                <div className="rounded-xl bg-slate-800/40 border border-white/5 p-3 flex items-center gap-3">
                    {selectedTrack.imageUrl && <img src={selectedTrack.imageUrl} alt="" className="w-10 h-10 rounded-lg" />}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{selectedTrack.title}</p>
                        <p className="text-[10px] text-slate-500">{Math.round(selectedTrack.duration)}s • {selectedTrack.tags}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Continue At (seconds)</label>
                    <input type="number" value={continueAt} onChange={e => setContinueAt(Number(e.target.value))} min={0} max={selectedTrack?.duration || 480} className={inputCls} />
                </div>
                <ModelSelect value={model} onChange={setModel} />
            </div>

            <button onClick={() => setUseCustom(!useCustom)} className={`${inputCls} text-left flex items-center gap-2`}>
                <div className={`w-4 h-4 rounded border ${useCustom ? 'bg-amber-500 border-amber-500' : 'border-white/20'} flex items-center justify-center`}>
                    {useCustom && <Check className="w-3 h-3 text-white" />}
                </div>
                {useCustom ? 'Custom parameters — set new prompt/style' : 'Use original parameters from source track'}
            </button>

            {useCustom && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelCls}>Prompt</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Continue with an uplifting chorus..." className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                        <label className={labelCls}>Style</label>
                        <input value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g. Pop, Uplifting" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Extended track title" className={inputCls} />
                    </div>
                </div>
            )}

            <button onClick={handleExtend} disabled={busy || !audioId} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Extend Track
            </button>

            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleExtend : undefined} />}
            {tracks.length > 0 && <TrackResult tracks={tracks} onSave={onSave} onPlay={onPlay} />}
        </div>
    );
};

// ─── TAB: Upload & Cover ────────────────────────────────────────────────────

const UploadCoverTab: React.FC<{ apiKey: string; onSave?: (t: KiePro.KieTrack) => void; onPlay?: (t: KiePro.KieTrack) => void }> = ({ apiKey, onSave, onPlay }) => {
    const [uploadUrl, setUploadUrl] = useState('');
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [title, setTitle] = useState('');
    const [model, setModel] = useState<KiePro.KieModel>('V5');
    const [instrumental, setInstrumental] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [tracks, setTracks] = useState<KiePro.KieTrack[]>([]);
    const [busy, setBusy] = useState(false);

    const handleCover = async () => {
        if (!uploadUrl || !prompt.trim()) return;
        setBusy(true); setError(''); setTracks([]); setStatus('Starting...');
        try {
            const taskId = await KiePro.uploadAndCover(apiKey, {
                uploadUrl, prompt, customMode: true, instrumental, model,
                style: style || undefined, title: title || undefined,
            });
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'music', setStatus);
            const valid = (result?.sunoData || []).filter((t: KiePro.KieTrack) => t.audioUrl && t.duration > 0);
            setTracks(valid); setStatus('');
            if (valid.length > 0) showToast('Cover Ready!', 'Audio covered successfully.', 'success');
            else { setError('No playable tracks returned. Try again.'); showToast('Cover Issue', 'No playable tracks.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Upload audio and transform it into a completely new style while keeping the melody.</p>
            <ProUploader onUpload={setUploadUrl} label="Upload Audio File" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelCls}>Prompt</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Transform this into a jazzy bossa nova arrangement..." className={inputCls + ' resize-none'} />
                </div>
                <div>
                    <label className={labelCls}>Style</label>
                    <input value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g. Jazz, Bossa Nova" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Title</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Covered track title" className={inputCls} />
                </div>
                <ModelSelect value={model} onChange={setModel} />
                <div>
                    <label className={labelCls}>Instrumental</label>
                    <button onClick={() => setInstrumental(!instrumental)} className={`${inputCls} text-left flex items-center gap-2`}>
                        <div className={`w-4 h-4 rounded border ${instrumental ? 'bg-amber-500 border-amber-500' : 'border-white/20'} flex items-center justify-center`}>
                            {instrumental && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {instrumental ? 'Instrumental only' : 'Include vocals'}
                    </button>
                </div>
            </div>
            <button onClick={handleCover} disabled={busy || !uploadUrl || !prompt.trim()} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Cover Audio
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleCover : undefined} />}
            {tracks.length > 0 && <TrackResult tracks={tracks} onSave={onSave} onPlay={onPlay} />}
        </div>
    );
};

// ─── TAB: Upload & Extend ───────────────────────────────────────────────────

const UploadExtendTab: React.FC<{ apiKey: string; onSave?: (t: KiePro.KieTrack) => void; onPlay?: (t: KiePro.KieTrack) => void }> = ({ apiKey, onSave, onPlay }) => {
    const [uploadUrl, setUploadUrl] = useState('');
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [title, setTitle] = useState('');
    const [model, setModel] = useState<KiePro.KieModel>('V5');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [tracks, setTracks] = useState<KiePro.KieTrack[]>([]);
    const [busy, setBusy] = useState(false);

    const handleExtend = async () => {
        if (!uploadUrl) return;
        setBusy(true); setError(''); setTracks([]); setStatus('Starting...');
        try {
            const taskId = await KiePro.uploadAndExtend(apiKey, {
                uploadUrl, prompt: prompt || undefined, style: style || undefined,
                title: title || undefined, model,
            });
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'music', setStatus);
            const valid = (result?.sunoData || []).filter((t: KiePro.KieTrack) => t.audioUrl && t.duration > 0);
            setTracks(valid); setStatus('');
            if (valid.length > 0) showToast('Extended!', 'Audio extended successfully.', 'success');
            else { setError('No playable tracks returned. Try again.'); showToast('Extend Issue', 'No playable tracks.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Upload audio and extend it seamlessly, preserving the original style.</p>
            <ProUploader onUpload={setUploadUrl} label="Upload Audio to Extend" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelCls}>Prompt <span className="text-slate-600">(optional)</span></label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Continue the melody with a bridge section..." className={inputCls + ' resize-none'} />
                </div>
                <div>
                    <label className={labelCls}>Style</label>
                    <input value={style} onChange={e => setStyle(e.target.value)} placeholder="Inherited from source if empty" className={inputCls} />
                </div>
                <ModelSelect value={model} onChange={setModel} />
            </div>
            <button onClick={handleExtend} disabled={busy || !uploadUrl} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Extend Audio
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleExtend : undefined} />}
            {tracks.length > 0 && <TrackResult tracks={tracks} onSave={onSave} onPlay={onPlay} />}
        </div>
    );
};

// ─── TAB: Add Instrumental ──────────────────────────────────────────────────

const InstrumentalTab: React.FC<{ apiKey: string; onSave?: (t: KiePro.KieTrack) => void; onPlay?: (t: KiePro.KieTrack) => void }> = ({ apiKey, onSave, onPlay }) => {
    const [uploadUrl, setUploadUrl] = useState('');
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState('');
    const [negativeTags, setNegativeTags] = useState('');
    const [model, setModel] = useState<KiePro.KieModel>('V5');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [tracks, setTracks] = useState<KiePro.KieTrack[]>([]);
    const [busy, setBusy] = useState(false);

    const handleGenerate = async () => {
        if (!uploadUrl) return;
        setBusy(true); setError(''); setTracks([]); setStatus('Starting...');
        try {
            const taskId = await KiePro.addInstrumental(apiKey, {
                uploadUrl, title: title || undefined, model,
                tags: tags || undefined, negativeTags: negativeTags || undefined,
            });
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'music', setStatus);
            const valid = (result?.sunoData || []).filter((t: KiePro.KieTrack) => t.audioUrl && t.duration > 0);
            setTracks(valid); setStatus('');
            if (valid.length > 0) showToast('Instrumental Ready!', 'Instrumental generated successfully.', 'success');
            else { setError('No playable tracks returned. Try again.'); showToast('Issue', 'No playable tracks.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Upload vocals or a melody and generate a full instrumental accompaniment.</p>
            <ProUploader onUpload={setUploadUrl} label="Upload Vocals / Melody" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Title</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track title" className={inputCls} />
                </div>
                <ModelSelect value={model} onChange={setModel} />
                <div>
                    <label className={labelCls}>Style Tags</label>
                    <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Pop, Acoustic, Warm" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Exclude Tags</label>
                    <input value={negativeTags} onChange={e => setNegativeTags(e.target.value)} placeholder="e.g. Heavy Metal, Distortion" className={inputCls} />
                </div>
            </div>
            <button onClick={handleGenerate} disabled={busy || !uploadUrl} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Guitar className="w-4 h-4" />}
                Add Instrumental
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleGenerate : undefined} />}
            {tracks.length > 0 && <TrackResult tracks={tracks} onSave={onSave} onPlay={onPlay} />}
        </div>
    );
};

// ─── TAB: Add Vocals ────────────────────────────────────────────────────────

const VocalsTab: React.FC<{ apiKey: string; onSave?: (t: KiePro.KieTrack) => void; onPlay?: (t: KiePro.KieTrack) => void }> = ({ apiKey, onSave, onPlay }) => {
    const [uploadUrl, setUploadUrl] = useState('');
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [tags, setTags] = useState('');
    const [model, setModel] = useState<KiePro.KieModel>('V5');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [tracks, setTracks] = useState<KiePro.KieTrack[]>([]);
    const [busy, setBusy] = useState(false);

    const handleGenerate = async () => {
        if (!uploadUrl) return;
        setBusy(true); setError(''); setTracks([]); setStatus('Starting...');
        try {
            const taskId = await KiePro.addVocals(apiKey, {
                uploadUrl, prompt: prompt || undefined, style: style || undefined,
                tags: tags || undefined, model,
            });
            const result = await KiePro.pollTaskStatus(apiKey, taskId, 'music', setStatus);
            const valid = (result?.sunoData || []).filter((t: KiePro.KieTrack) => t.audioUrl && t.duration > 0);
            setTracks(valid); setStatus('');
            if (valid.length > 0) showToast('Vocals Ready!', 'Vocals generated successfully.', 'success');
            else { setError('No playable tracks returned. Try again.'); showToast('Issue', 'No playable tracks.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Upload an instrumental and add AI-generated vocals with custom lyrics and style.</p>
            <ProUploader onUpload={setUploadUrl} label="Upload Instrumental" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelCls}>Lyrics / Vocal Prompt</label>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Write the lyrics or describe the vocal style..." className={inputCls + ' resize-none'} />
                </div>
                <div>
                    <label className={labelCls}>Vocal Style</label>
                    <input value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g. Soulful, Breathy, Powerful" className={inputCls} />
                </div>
                <ModelSelect value={model} onChange={setModel} />
            </div>
            <button onClick={handleGenerate} disabled={busy || !uploadUrl} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
                Add Vocals
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleGenerate : undefined} />}
            {tracks.length > 0 && <TrackResult tracks={tracks} onSave={onSave} onPlay={onPlay} />}
        </div>
    );
};

// ─── TAB: Stem Separation ───────────────────────────────────────────────────

const StemsTab: React.FC<{ apiKey: string; library: SunoTrack[] }> = ({ apiKey, library }) => {
    const [audioId, setAudioId] = useState('');
    const [taskIdForStem, setTaskIdForStem] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ vocalUrl?: string; instrumentalUrl?: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const handleSeparate = async () => {
        if (!audioId) return;
        const track = library.find(t => t.id === audioId);
        setBusy(true); setError(''); setResult(null); setStatus('Starting...');
        try {
            const stemTaskId = await KiePro.separateVocals(apiKey, track?.taskId || '', audioId);
            const res = await KiePro.pollTaskStatus(apiKey, stemTaskId, 'stems', setStatus);
            setResult(res); setStatus('');
            if (res?.vocalUrl || res?.instrumentalUrl) showToast('Stems Ready!', 'Vocals and instrumental separated.', 'success');
            else { setError('Separation returned no results.'); showToast('Separation Issue', 'No stems returned.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">AI-powered vocal and instrumental separation using Suno's source separation model.</p>
            <TrackSelect library={library} value={audioId} onChange={(id) => setAudioId(id)} label="Select Track to Separate" />
            <button onClick={handleSeparate} disabled={busy || !audioId} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                Separate Stems
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleSeparate : undefined} />}
            {result && (
                <div className="mt-4 space-y-3">
                    {result.vocalUrl && (
                        <div className="rounded-xl bg-slate-800/60 border border-white/5 p-4 flex items-center gap-4">
                            <Mic2 className="w-5 h-5 text-purple-400" />
                            <span className="text-sm font-bold text-white flex-1">Vocals</span>
                            <a href={result.vocalUrl} onClick={() => trackEvent('export_track', { format: 'mp3', type: 'stem_vocals' })} download="vocals.mp3" className={btnCls + ' !px-4 !py-2 text-xs'}>
                                <Download className="w-3 h-3" /> Download
                            </a>
                        </div>
                    )}
                    {result.instrumentalUrl && (
                        <div className="rounded-xl bg-slate-800/60 border border-white/5 p-4 flex items-center gap-4">
                            <Guitar className="w-5 h-5 text-cyan-400" />
                            <span className="text-sm font-bold text-white flex-1">Instrumental</span>
                            <a href={result.instrumentalUrl} onClick={() => trackEvent('export_track', { format: 'mp3', type: 'stem_instrumental' })} download="instrumental.mp3" className={btnCls + ' !px-4 !py-2 text-xs'}>
                                <Download className="w-3 h-3" /> Download
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── TAB: Music Video ───────────────────────────────────────────────────────

const VideoTab: React.FC<{ apiKey: string; library: SunoTrack[] }> = ({ apiKey, library }) => {
    const [audioId, setAudioId] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [busy, setBusy] = useState(false);

    const handleGenerate = async () => {
        if (!audioId) return;
        const track = library.find(t => t.id === audioId);
        setBusy(true); setError(''); setVideoUrl(''); setStatus('Starting...');
        try {
            const vtId = await KiePro.generateMusicVideo(apiKey, track?.taskId || '', audioId);
            const res = await KiePro.pollTaskStatus(apiKey, vtId, 'video', setStatus);
            const url = res?.videoUrl || '';
            setVideoUrl(url); setStatus('');
            if (url) showToast('Video Ready!', 'Music video rendered.', 'success');
            else { setError('No video URL returned.'); showToast('Video Issue', 'No video returned.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Generate a visual music video synchronized with your track.</p>
            <TrackSelect library={library} value={audioId} onChange={(id) => setAudioId(id)} label="Select Track" />
            <button onClick={handleGenerate} disabled={busy || !audioId} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                Generate Music Video
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleGenerate : undefined} />}
            {videoUrl && (
                <div className="mt-4 rounded-xl overflow-hidden border border-white/5">
                    <video src={videoUrl} controls className="w-full max-h-[400px] bg-black" />
                    <div className="p-3 bg-slate-800/60 flex justify-end">
                        <a href={videoUrl} download className={btnCls + ' !px-4 !py-2 text-xs'}>
                            <Download className="w-3 h-3" /> Download Video
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── TAB: WAV Export ────────────────────────────────────────────────────────

const WavTab: React.FC<{ apiKey: string; library: SunoTrack[] }> = ({ apiKey, library }) => {
    const [audioId, setAudioId] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [wavUrl, setWavUrl] = useState('');
    const [busy, setBusy] = useState(false);

    const handleConvert = async () => {
        if (!audioId) return;
        const track = library.find(t => t.id === audioId);
        setBusy(true); setError(''); setWavUrl(''); setStatus('Starting...');
        try {
            const wtId = await KiePro.convertToWav(apiKey, track?.taskId || '', audioId);
            const res = await KiePro.pollTaskStatus(apiKey, wtId, 'wav', setStatus);
            const url = res?.wavUrl || '';
            setWavUrl(url); setStatus('');
            if (url) showToast('WAV Ready!', 'Lossless WAV file is ready for download.', 'success');
            else { setError('No WAV file returned.'); showToast('WAV Issue', 'Conversion returned no file.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Convert any track to lossless WAV format for professional production.</p>
            <TrackSelect library={library} value={audioId} onChange={(id) => setAudioId(id)} label="Select Track" />
            <button onClick={handleConvert} disabled={busy || !audioId} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileAudio className="w-4 h-4" />}
                Convert to WAV
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleConvert : undefined} />}
            {wavUrl && (
                <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-4">
                    <FileAudio className="w-6 h-6 text-emerald-400" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-white">WAV file ready</p>
                        <p className="text-[10px] text-emerald-400/60">Lossless quality • Ready for production</p>
                    </div>
                    <a href={wavUrl} onClick={() => trackEvent('export_track', { format: 'wav' })} download className={btnCls + ' !px-4 !py-2 text-xs'}>
                        <Download className="w-3 h-3" /> Download WAV
                    </a>
                </div>
            )}
        </div>
    );
};

// ─── TAB: Synced Lyrics ─────────────────────────────────────────────────────

const SyncedLyricsTab: React.FC<{ apiKey: string; library: SunoTrack[] }> = ({ apiKey, library }) => {
    const [audioId, setAudioId] = useState('');
    const [lyrics, setLyrics] = useState<KiePro.KieTimestampedLyric[]>([]);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const handleFetch = async () => {
        if (!audioId) return;
        const track = library.find(t => t.id === audioId);
        setBusy(true); setError(''); setLyrics([]); setStatus('Fetching...');
        try {
            const result = await KiePro.getTimestampedLyrics(apiKey, track?.taskId || '', audioId);
            setLyrics(result); setStatus('');
            if (result.length > 0) showToast('Lyrics Synced!', `${result.length} lines retrieved.`, 'success');
            else { setError('No synced lyrics found for this track.'); showToast('No Lyrics', 'This track has no synced lyrics available.', 'warning'); }
        } catch (e: any) { const { title: t, body: b } = classifyError(e); setError(b); setStatus(''); showToast(t, b, 'error'); }
        setBusy(false);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-slate-500">Retrieve time-synced karaoke-style lyrics for your tracks.</p>
            <TrackSelect library={library} value={audioId} onChange={(id) => setAudioId(id)} label="Select Track" />
            <button onClick={handleFetch} disabled={busy || !audioId} className={btnCls}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlignLeft className="w-4 h-4" />}
                Get Synced Lyrics
            </button>
            {(status || error) && <TaskProgress status={status} error={error} onDismiss={() => setError('')} onRetry={error ? handleFetch : undefined} />}
            {lyrics.length > 0 && (
                <div className="mt-4 rounded-xl bg-slate-800/60 border border-white/5 p-5 space-y-1 max-h-[400px] overflow-y-auto">
                    {lyrics.map((l, i) => (
                        <div key={i} className="flex items-start gap-3 py-1 hover:bg-white/[0.02] rounded-lg px-2 transition-colors">
                            <span className="text-[10px] text-amber-400/60 font-mono w-16 shrink-0 pt-0.5">{formatTime(l.startTime)} → {formatTime(l.endTime)}</span>
                            <p className="text-sm text-slate-300">{l.text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── TAB CONFIG ─────────────────────────────────────────────────────────────

const TAB_CONFIG: { id: ProTab; label: string; icon: any; group: 'create' | 'upload' | 'tools' }[] = [
    { id: 'generate', label: 'Generate', icon: Sparkles, group: 'create' },
    { id: 'lyrics', label: 'Lyrics', icon: FileText, group: 'create' },
    { id: 'extend', label: 'Extend', icon: Plus, group: 'create' },
    { id: 'video', label: 'Video', icon: Video, group: 'create' },
    { id: 'cover', label: 'Cover', icon: Upload, group: 'upload' },
    { id: 'upload-extend', label: 'Upload & Extend', icon: Plus, group: 'upload' },
    { id: 'instrumental', label: 'Add Instrumental', icon: Guitar, group: 'upload' },
    { id: 'vocals', label: 'Add Vocals', icon: Mic2, group: 'upload' },
    { id: 'stems', label: 'Stem Separation', icon: Scissors, group: 'tools' },
    { id: 'wav', label: 'WAV Export', icon: FileAudio, group: 'tools' },
    { id: 'synced-lyrics', label: 'Synced Lyrics', icon: AlignLeft, group: 'tools' },
];

// ─── MAIN PRO STUDIO SHELL ─────────────────────────────────────────────────

const ProStudio: React.FC<ProStudioProps> = ({ apiKey, isPro, library, onOpenPaywall, onTrackGenerated, onPlay }) => {
    // Convert KieTrack to SunoTrack format for saving to library
    const kieToSuno = (track: KiePro.KieTrack): SunoTrack => ({
        id: track.id || `pro_${Date.now()}`,
        title: track.title || 'Untitled',
        tags: track.tags || '',
        duration: track.duration || 0,
        audioUrl: track.audioUrl || '',
        imageUrl: track.imageUrl || '',
        model_name: 'KIE Pro',
        status: 'complete',
        created_at: track.createTime || new Date().toISOString(),
        taskId: '',
    });

    const handleSaveTrack = (track: KiePro.KieTrack) => {
        onTrackGenerated?.([kieToSuno(track)]);
    };

    const handlePlayTrack = (track: KiePro.KieTrack) => {
        onPlay?.(kieToSuno(track));
    };
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ProTab>('generate');
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

    // ─── Session History ─────────────────────────────────────────────
    type ProSession = { id: string; tab: ProTab; title: string; timestamp: number; trackCount?: number };
    const SESSIONS_KEY = `aim8_prostudio_sessions_${user?.uid || 'anon'}`;

    const [sessions, setSessions] = useState<ProSession[]>(() => {
        try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
    });

    // Save current session on tab change
    useEffect(() => {
        const now = Date.now();
        const tabLabel = TAB_CONFIG.find(t => t.id === activeTab)?.label || activeTab;
        setSessions(prev => {
            // Don't duplicate the same tab within 2 seconds
            if (prev.length > 0 && prev[0].tab === activeTab && (now - prev[0].timestamp) < 2000) return prev;
            const session: ProSession = {
                id: `ps_${now}`,
                tab: activeTab,
                title: `${tabLabel} Session`,
                timestamp: now,
            };
            const next = [session, ...prev].slice(0, 50); // keep max 50
            try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(next)); } catch { }
            return next;
        });
    }, [activeTab]);

    const groupedSessions = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const week = today - 7 * 86400000;
        const groups: { label: string; items: ProSession[] }[] = [
            { label: 'Today', items: [] },
            { label: 'Yesterday', items: [] },
            { label: 'Previous 7 Days', items: [] },
            { label: 'Older', items: [] },
        ];
        sessions.forEach(s => {
            if (s.timestamp >= today) groups[0].items.push(s);
            else if (s.timestamp >= yesterday) groups[1].items.push(s);
            else if (s.timestamp >= week) groups[2].items.push(s);
            else groups[3].items.push(s);
        });
        return groups.filter(g => g.items.length > 0);
    }, [sessions]);

    const handleLoadSession = (session: ProSession) => {
        setActiveTab(session.tab);
        setSidebarOpen(false);
    };

    const handleDeleteSession = (id: string) => {
        setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(next)); } catch { }
            return next;
        });
    };

    const handleNewChat = () => {
        setActiveTab('generate');
        setSidebarOpen(false);
    };

    // No more full gate — everyone sees the UI

    const renderTab = () => {
        switch (activeTab) {
            case 'generate': return <GenerateTab apiKey={apiKey} onSave={handleSaveTrack} onPlay={handlePlayTrack} />;
            case 'lyrics': return <LyricsTab apiKey={apiKey} />;
            case 'extend': return <ExtendTab apiKey={apiKey} library={library} onSave={handleSaveTrack} onPlay={handlePlayTrack} />;
            case 'video': return <VideoTab apiKey={apiKey} library={library} />;
            case 'cover': return <UploadCoverTab apiKey={apiKey} onSave={handleSaveTrack} onPlay={handlePlayTrack} />;
            case 'upload-extend': return <UploadExtendTab apiKey={apiKey} onSave={handleSaveTrack} onPlay={handlePlayTrack} />;
            case 'instrumental': return <InstrumentalTab apiKey={apiKey} onSave={handleSaveTrack} onPlay={handlePlayTrack} />;
            case 'vocals': return <VocalsTab apiKey={apiKey} onSave={handleSaveTrack} onPlay={handlePlayTrack} />;
            case 'stems': return <StemsTab apiKey={apiKey} library={library} />;
            case 'wav': return <WavTab apiKey={apiKey} library={library} />;
            case 'synced-lyrics': return <SyncedLyricsTab apiKey={apiKey} library={library} />;
            default: return null;
        }
    };

    const groups = [
        { key: 'create', label: 'Create' },
        { key: 'upload', label: 'Upload & Transform' },
        { key: 'tools', label: 'Tools' },
    ];

    return (
        <div className="h-full flex overflow-hidden relative">
            {/* ─── Sidebar (Desktop: static, Mobile: overlay) ─── */}
            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}
            <div className={`absolute md:relative z-50 md:z-auto h-full bg-slate-900/95 md:bg-slate-900/60 border-r border-white/[0.06] flex flex-col transition-all duration-300 backdrop-blur-xl ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:-translate-x-full'
                } overflow-hidden`}>
                {/* Sidebar Header */}
                <div className="px-4 py-4 flex items-center justify-between border-b border-white/[0.06] flex-shrink-0">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">History</span>
                    <button onClick={handleNewChat} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-1">
                        <Plus className="w-3 h-3" /> New Chat
                    </button>
                </div>
                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-none">
                    {groupedSessions.length === 0 && (
                        <div className="text-center py-10">
                            <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                            <p className="text-xs text-slate-600">No sessions yet</p>
                            <p className="text-[10px] text-slate-700 mt-1">Start creating to see history here</p>
                        </div>
                    )}
                    {groupedSessions.map(group => (
                        <div key={group.label}>
                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-1.5">{group.label}</p>
                            <div className="space-y-0.5">
                                {group.items.map(s => {
                                    const tabCfg = TAB_CONFIG.find(t => t.id === s.tab);
                                    const TabIcon = tabCfg?.icon || MessageSquare;
                                    const iconColor = tabCfg?.group === 'create' ? 'text-cyan-500' : tabCfg?.group === 'upload' ? 'text-purple-500' : 'text-amber-500';
                                    return (
                                        <div key={s.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors" onClick={() => handleLoadSession(s)}>
                                            <TabIcon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs text-slate-400 group-hover:text-white truncate block transition-colors">{s.title}</span>
                                                <span className="text-[9px] text-slate-600">
                                                    {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {s.trackCount ? ` • ${s.trackCount} track${s.trackCount > 1 ? 's' : ''}` : ''}
                                                </span>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-all">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Main Content ─── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Premium Header */}
                <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 flex-shrink-0">
                    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.06] to-purple-500/[0.08] border border-amber-500/10 px-4 py-3 sm:p-5">
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                        </div>
                        <div className="relative flex items-center gap-3">
                            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 sm:p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all flex-shrink-0">
                                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-none">Pro Studio</h1>
                                <p className="text-[9px] sm:text-[10px] text-amber-400/70 font-bold uppercase tracking-[0.12em] mt-0.5 truncate">All Features • Unlimited • V3.5 → V5</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab bar — 2 rows: Create+Upload on row 1, Tools on row 2 */}
                <div className="px-4 sm:px-6 pb-3 flex-shrink-0 space-y-1.5">
                    {/* Row 1: Create + Upload & Transform */}
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                        {['create', 'upload'].flatMap((gKey, gIdx, arr) => {
                            const tabs = TAB_CONFIG.filter(t => t.group === gKey);
                            return [
                                ...tabs.map(tab => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap flex-shrink-0 ${isActive
                                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                                : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                            {tab.label}
                                        </button>
                                    );
                                }),
                                ...(gIdx < arr.length - 1 ? [<div key={`sep-${gKey}`} className="w-px h-4 bg-white/10 mx-0.5 flex-shrink-0" />] : []),
                            ];
                        })}
                    </div>
                    {/* Row 2: Tools */}
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest mr-1 flex-shrink-0">Tools</span>
                        {TAB_CONFIG.filter(t => t.group === 'tools').map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap flex-shrink-0 ${isActive
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                        : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>


                {/* Active tab content */}
                <div className="flex-1 overflow-y-auto px-6 pb-8 relative">
                    <div className="max-w-3xl">
                        {renderTab()}
                    </div>
                    {/* Gate overlay for non-pro users */}
                </div>
            </div>
        </div>
    );
};

export default ProStudio;
