import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mic, MicOff, Send, Download, Play, Pause,
    Loader2, Settings, Sparkles, Music2, Zap, X,
    CheckCircle2, Clock, Database, Save, LayoutGrid,
    Headphones, Share2, User, Upload, Fingerprint, FileAudio,
    Wand2, StopCircle, Sliders, Menu, ChevronDown, ChevronUp,
    PenTool, UserPlus, AlignLeft, Clapperboard, Film, Trash2, Edit2, Check, Info,
    Coins, CreditCard, Crown, Lock,
    Volume2, Volume1, VolumeX, Disc,
    Layers, Package, Flame, RefreshCw, Plus, Lightbulb,
    MessageCircle, Minimize2, Shield, Mail,
    Heart, Bookmark, Copy, Star, Users, ListMusic, Gift, HelpCircle, Command, ArrowRight, Globe, ChevronRight, Keyboard, Home,
    Repeat, SkipBack, SkipForward, FastForward, Rewind,
    Search, ExternalLink
} from './icons';
import { analyzeMusicIntent, generateCreativePrompt, getMusicSuggestions, suggestLyrics, generateCompleteLyrics, generateTrackName } from '../services/geminiService';
import { trackEvent } from '../services/analyticsService';
import { generateMusicTask, pollTaskStatus, createPersona, generateVideoTask, pollVideoTaskStatus } from '../services/sunoService';
import { LiveClient } from '../services/liveService';
import { soundManager } from '../services/soundService';
import { backendManager } from '../services/backendService';
import { getKieKey, getGeminiKey } from '../services/byok';
import ApiKeySetup from './ApiKeySetup';
import { separateStems } from '../services/stemService';
import { showToast } from '../services/notificationService';

import { generateTikTokClip } from '../services/tiktokService';
import { checkViralTrendsAndGenerateChorus } from '../services/viralService';
import { masterTrack, MasteringPreset, MASTERING_PRESETS } from '../services/masteringService';
import DecoratedModal from './DecoratedModal';

import SonicTiles from './SonicTiles';
import Sidebar from './Sidebar';
import type { SidebarPage } from './Sidebar';
import type { GenerationPreset } from './PresetLibrary';
import ErrorBoundary from './ErrorBoundary';
import type { StemName } from '../services/stemEffectsService';

import { useAuth } from './AuthContext';
import {
    Message,
    SunoGenerationParams,
    SunoTrack,
    GenerationStatus,
    SunoPersona,
    FirebaseConfig,
    UserSettings,
    MusicSuggestion
} from '../types';

// Lazy-loaded heavy components (only loaded when tab/modal is opened)

import StudioChatPanel from './StudioChatPanel';
import StudioMainPanel from './StudioMainPanel';

const ProStudio = React.lazy(() => import('./ProStudio'));
const PresetLibrary = React.lazy(() => import('./PresetLibrary'));
const MasteringPanel = React.lazy(() => import('./MasteringPanel'));
const SessionHistory = React.lazy(() => import('./SessionHistory'));
const StemEffects = React.lazy(() => import('./StemEffects'));
const StemMixer = React.lazy(() => import('./StemMixer'));
const VideoSettingsPanel = React.lazy(() => import('./VideoSettingsPanel'));
const PromptTutorial = React.lazy(() => import('./PromptTutorial'));


// --- CONFIGURATION ---
const HARDCODED_SUNO_KEY = "";
// ---------------------

const VideoPlayer: React.FC<{ url: string; title: string; onClose: () => void }> = ({ url, title, onClose }) => (
    <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300">
        <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/20 border border-white/10">
            <video
                src={url}
                controls
                autoPlay
                className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-6 right-16 flex flex-col pointer-events-none">
                <h3 className="text-white font-black text-lg md:text-xl drop-shadow-lg">{title}</h3>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest drop-shadow-lg">Aim8 Sonic Video</p>
            </div>
            <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all border border-white/10 hover:scale-110 z-50"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    </div>
);

{/* --- Components --- */ }

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: any; label: string; dataIntro?: string; dataStep?: string }> = ({ active, onClick, icon: Icon, label, dataIntro, dataStep }) => (
    <button
        onClick={() => {
            soundManager.playClick();
            onClick();
        }}
        data-intro={dataIntro}
        data-step={dataStep}
        className={`flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 rounded-full transition-all duration-300 font-semibold text-xs md:text-sm whitespace-nowrap snap-center relative overflow-hidden group border flex-1 md:flex-none ${active
            ? 'glass text-white shadow-lg shadow-cyan-500/10 border-cyan-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            }`}
    >
        {active && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 pointer-events-none" />}
        <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-colors ${active ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span>{label}</span>
    </button>
);

// --- Timeline Component ---

const GenerationTimeline: React.FC<{ genStatus: GenerationStatus & { retryParams?: any }; onRegenerate?: () => void; onStop?: () => void }> = ({ genStatus, onRegenerate, onStop }) => {
    const { status, progress, error } = genStatus;
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        let interval: any;
        if (status === 'generating' || status === 'polling') {
            interval = setInterval(() => setElapsed(prev => prev + 0.1), 100);
        } else if (status === 'idle') {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    const getProgressPercent = () => {
        if (status === 'complete') return 100;
        if (status === 'error') return 100;
        if (status === 'generating') return Math.min(15, elapsed * 5);

        // Dynamic linear-log hybrid: 
        // 0-60s: Fast progress to 50%
        // 60-180s: Slower progress to 85%
        // 180s+: Extremely slow crawl towards 99.5%
        let p = 15;
        if (elapsed < 60) {
            p = 15 + (elapsed / 60) * 35; // 15% -> 50%
        } else if (elapsed < 180) {
            p = 50 + ((elapsed - 60) / 120) * 35; // 50% -> 85%
        } else {
            // Logarithmic crawl: 85% -> 99.5%
            const extraTime = elapsed - 180;
            p = 85 + 14.5 * (1 - Math.exp(-extraTime / 300));
        }
        return Math.min(p, 99.5);
    };

    const percent = getProgressPercent();

    const getStepState = (stepName: string) => {
        if (status === 'idle') return 'pending';
        if (status === 'error') return 'pending';
        if (status === 'complete') return 'completed';

        if (stepName === 'concept') return status === 'generating' ? 'active' : 'completed';

        if (status === 'polling') {
            if (stepName === 'composing') return elapsed < 40 ? 'active' : 'completed';
            if (stepName === 'mastering') return elapsed >= 40 ? 'active' : 'pending';
        }
        return 'pending';
    };

    return (
        <div className="w-full rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 border border-white/10 mb-8 relative overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 glass">
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex flex-col min-w-0 gap-2">
                    <h3 className="text-cyan-300 font-black flex items-center gap-3 text-lg md:text-xl tracking-tight truncate font-outfit">
                        {status === 'polling' || status === 'generating' ? (
                            <span className="animate-spin"><Loader2 className="w-5 h-5 md:w-6 md:h-6" /></span>
                        ) : status === 'complete' ? (
                            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                        ) : status === 'error' ? (
                            <X className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                        ) : (
                            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                        )}

                        {status === 'complete' ? "Production Complete" :
                            status === 'error' ? "Production Failed" :
                                "Generating Track"}
                    </h3>
                    <p className="text-xs md:text-sm text-cyan-100/60 font-mono truncate pl-8 md:pl-9">
                        {status === 'error' ? (error || "Unknown error") : (progress || "Initializing studio...")}
                    </p>
                </div>

                <div className="flex items-center gap-2 pl-4">
                    {/* Stop button during generation */}
                    {(status === 'generating' || status === 'polling') && onStop && (
                        <button
                            onClick={onStop}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all active:scale-95"
                            title="Stop generation"
                        >
                            Stop
                        </button>
                    )}

                    {/* Regenerate button on error */}
                    {status === 'error' && onRegenerate && (
                        <button
                            onClick={onRegenerate}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Regenerate
                        </button>
                    )}

                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-3xl md:text-4xl font-black text-white/90 font-sans tabular-nums tracking-tighter">
                            {status === 'complete' ? '100' : Math.floor(percent)}
                            <span className="text-sm md:text-base font-normal text-white/40 mt-2 md:mt-3">%</span>
                        </div>
                        {(status === 'polling' || status === 'generating') && (
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-cyan-200/50 font-bold bg-cyan-900/20 px-2 py-1 md:px-3 md:py-1.5 rounded-full mt-2 border border-cyan-500/10">
                                <Clock className="w-3 h-3" />
                                {formatTime(elapsed)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="relative h-2 md:h-2.5 bg-slate-800/50 rounded-full mb-8 md:mb-10 overflow-hidden">
                <div
                    className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out rounded-full ${status === 'error' ? 'bg-red-500' :
                        status === 'complete' ? 'bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' :
                            'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                        }`}
                    style={{ width: `${percent}%` }}
                >
                    {(status === 'generating' || status === 'polling') && (
                        <div className="absolute inset-0 w-full h-full bg-white/30 animate-[shimmer_1s_infinite] -skew-x-12" />
                    )}
                </div>
            </div>

            <div className="flex justify-between relative z-10 px-0 md:px-12">
                <TimelineStep icon="🧠" label="Concept" stepState={getStepState('concept')} />
                <TimelineStep icon="🎹" label="Compose" stepState={getStepState('composing')} />
                <TimelineStep icon="🎧" label="Master" stepState={getStepState('mastering')} />
                <TimelineStep icon="✨" label="Ready" stepState={status === 'complete' ? 'completed' : 'pending'} />
            </div>

            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-48 blur-3xl pointer-events-none transition-colors duration-1000 ${status === 'error' ? 'bg-red-500/10' :
                status === 'complete' ? 'bg-emerald-500/10' :
                    'bg-cyan-500/5'
                }`} />
        </div>
    );
};

const TimelineStep: React.FC<{ icon: string, label: string, stepState: 'pending' | 'active' | 'completed' }> = ({ icon, label, stepState }) => {
    const isActive = stepState === 'active';
    const isCompleted = stepState === 'completed';

    return (
        <div className={`flex flex-col items-center gap-2 md:gap-4 transition-all duration-500 ${stepState === 'pending' ? 'opacity-30 scale-95 grayscale' : 'opacity-100 scale-100'}`}>
            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-2xl border transition-all relative z-10 bg-slate-900/80 backdrop-blur-sm ${isCompleted ? 'border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-110' :
                isActive ? 'border-cyan-400 text-cyan-300 animate-bounce shadow-[0_0_10px_rgba(34,211,238,0.3)]' :
                    'border-slate-700 text-slate-500'
                }`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 text-cyan-400" /> : icon}
            </div>
            <span className={`text-[9px] md:text-[11px] font-bold uppercase tracking-widest ${isActive || isCompleted ? 'text-cyan-200' : 'text-slate-600'}`}>
                {label}
            </span>
        </div>
    );
};


// Extracted TrackCard for reusability
const TrackCard: React.FC<{
    track: SunoTrack,
    playTrack: (track: SunoTrack) => void,
    activeTrackUrl: string | null,
    isPlaying: boolean,
    onShare: () => void,
    onRemix: () => void,
    onVideo: () => void,
    onVideoWatch?: (url: string, title: string) => void,
    onPersona: () => void,
    onMaster: () => void,
    onPlaylist?: () => void,
    onRename?: (trackId: string, newTitle: string) => void,
    videoLoading: boolean,
    masteringLoading: boolean
}> = ({ track, playTrack, activeTrackUrl, isPlaying, onShare, onRemix, onVideo, onVideoWatch, onPersona, onMaster, onPlaylist, onRename, videoLoading, masteringLoading }) => {
    const isActive = activeTrackUrl === track.audioUrl;
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(track.title || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) inputRef.current.focus();
    }, [isEditing]);

    const commitRename = () => {
        const trimmed = editTitle.trim();
        if (trimmed && trimmed !== track.title && onRename) {
            onRename(track.id, trimmed);
        }
        setIsEditing(false);
    };

    const formatDur = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`group relative overflow-hidden rounded-2xl md:rounded-[1.5rem] transition-all duration-300 border glass-card ${isActive && isPlaying
            ? 'border-cyan-500/30'
            : 'border-white/[0.04] hover:border-white/[0.08] hover:shadow-xl'
            }`}>

            {/* Playing glow */}
            {isActive && isPlaying && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-blue-500/5" />
                </div>
            )}

            <div className="relative z-10 flex gap-4 md:gap-5 p-3.5 md:p-5">
                <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-xl md:rounded-2xl overflow-hidden shrink-0 shadow-lg group/art ring-1 ring-white/[0.06]">
                    <img src={track.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover/art:scale-110" alt="Cover" />

                    <button
                        onClick={() => playTrack(track)}
                        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isActive && isPlaying ? 'bg-black/30' : 'bg-black/10 opacity-0 group-hover:opacity-100 hover:bg-black/30'}`}
                    >
                        <div className={`w-9 h-9 md:w-12 md:h-12 backdrop-blur-md rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 ${isActive && isPlaying ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-white/20 text-white ring-1 ring-white/40'}`}>
                            {isActive && isPlaying ? (
                                <Pause className="w-3.5 h-3.5 md:w-5 md:h-5 fill-current" />
                            ) : (
                                <Play className="w-3.5 h-3.5 md:w-5 md:h-5 fill-current ml-0.5" />
                            )}
                        </div>
                    </button>

                    {/* Equalizer bars for playing state */}
                    {isActive && isPlaying && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-end gap-[2px]">
                            {[1, 2, 3, 4].map(i => (
                                <div
                                    key={i}
                                    className="w-[3px] bg-cyan-400 rounded-full"
                                    style={{
                                        height: `${8 + Math.random() * 10}px`,
                                        animation: `equalizer ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                                        animationDelay: `${i * 0.1}s`
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                    <div>
                        <div className="flex justify-between items-start mb-1 md:mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                {isEditing ? (
                                    <input
                                        ref={inputRef}
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditTitle(track.title || ''); setIsEditing(false); } }}
                                        className="font-black text-sm md:text-lg leading-tight truncate font-outfit bg-transparent border-b border-cyan-500/50 text-white outline-none px-0 py-0 w-full"
                                    />
                                ) : (
                                    <h4
                                        className={`font-black text-sm md:text-lg leading-tight truncate font-outfit cursor-pointer hover:underline decoration-white/20 ${isActive ? 'text-cyan-300' : 'text-white'}`}
                                        title="Double-click to rename"
                                        onDoubleClick={() => { setEditTitle(track.title || ''); setIsEditing(true); }}
                                    >{track.title || "Untitled Track"}</h4>
                                )}
                                {isActive && isPlaying && (
                                    <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md shrink-0 border border-cyan-500/20">Playing</span>
                                )}
                            </div>
                            <span className="text-[9px] md:text-[10px] text-slate-500 font-mono bg-black/20 px-1.5 py-0.5 rounded-md whitespace-nowrap border border-white/[0.04] ml-2 tracking-tighter flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />{formatDur(track.duration)}
                            </span>
                        </div>
                        <p className="text-[11px] md:text-xs text-slate-400 font-medium mb-3 md:mb-4 line-clamp-2 leading-relaxed" title={track.tags}>{track.tags || "AI Generated"}</p>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar pb-0.5">
                        <div className="flex bg-slate-800/60 rounded-xl p-0.5 md:p-1 border border-white/[0.04] flex-shrink-0 gap-0.5">
                            <button onClick={onShare} className="p-1.5 md:p-2 hover:bg-white/[0.08] rounded-lg text-slate-500 hover:text-white transition-colors" title="Share & Export">
                                <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button onClick={() => {
                                const a = document.createElement('a');
                                a.href = track.audioUrl;
                                a.download = `${track.title || 'track'} - Made with Aim8.io.mp3`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                soundManager.playClick();
                                trackEvent('track_downloaded', { track_id: track.id, track_title: track.title, source: 'track_menu' });
                            }} className="p-1.5 md:p-2 hover:bg-white/[0.08] rounded-lg text-slate-500 hover:text-cyan-400 transition-colors" title="Download MP3">
                                <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button onClick={onMaster} disabled={masteringLoading} className="p-1.5 md:p-2 hover:bg-white/[0.08] rounded-lg text-slate-500 hover:text-emerald-400 transition-colors" title="Mastering">
                                {masteringLoading ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                            </button>
                            <button onClick={onRemix} className="p-1.5 md:p-2 hover:bg-white/[0.08] rounded-lg text-slate-500 hover:text-yellow-400 transition-colors" title="Remix">
                                <Sliders className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            {onPlaylist && (
                                <button onClick={onPlaylist} className="p-1.5 md:p-2 hover:bg-white/[0.08] rounded-lg text-slate-500 hover:text-purple-400 transition-colors" title="Add to Playlist">
                                    <ListMusic className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </button>
                            )}
                        </div>

                        {(track.videoUrl || track.taskId) && (
                            <button
                                onClick={track.videoUrl ? () => onVideoWatch?.(track.videoUrl!, track.title) : onVideo}
                                disabled={videoLoading}
                                className={`px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl text-[9px] md:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 md:gap-1.5 transition-all flex-shrink-0 ${track.videoUrl
                                    ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500 hover:text-white border border-purple-500/20'
                                    : 'bg-white/[0.03] text-slate-500 hover:text-pink-400 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06]'
                                    }`}
                            >
                                {videoLoading ? <Loader2 className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin" /> : track.videoUrl ? <Film className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Clapperboard className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                                {track.videoUrl ? "Watch" : "Video"}
                            </button>
                        )}

                        {track.taskId && (
                            <button onClick={onPersona} className="p-1.5 md:p-2 bg-white/[0.03] hover:bg-indigo-500/15 text-slate-500 hover:text-indigo-300 rounded-xl transition-colors border border-transparent hover:border-indigo-500/20 flex-shrink-0" title="Create Persona">
                                <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9\s-_]/gi, '').trim().replace(/\s+/g, '_');
};

/** Cross-browser roundRect polyfill */
function canvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
    } else {
        const ri = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + ri, y);
        ctx.lineTo(x + w - ri, y);
        ctx.arcTo(x + w, y, x + w, y + ri, ri);
        ctx.lineTo(x + w, y + h - ri);
        ctx.arcTo(x + w, y + h, x + w - ri, y + h, ri);
        ctx.lineTo(x + ri, y + h);
        ctx.arcTo(x, y + h, x, y + h - ri, ri);
        ctx.lineTo(x, y + ri);
        ctx.arcTo(x, y, x + ri, y, ri);
        ctx.closePath();
    }
}

const ShareModal: React.FC<{
    track: SunoTrack;
    onClose: () => void;
    onGenerateVideo: (track: SunoTrack) => void;
    onStemExport: (track: SunoTrack) => void;
    onTikTokExport: (track: SunoTrack) => void;
    exportLoading: boolean;
}> = ({ track, onClose, onGenerateVideo, onStemExport, onTikTokExport, exportLoading }) => {
    const [copyLabel, setCopyLabel] = useState("Copy Link");
    const [videoGenProgress, setVideoGenProgress] = useState<string | null>(null);
    const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);

    const genreTags = (track.tags || 'Music').split(/[,/]/).map(t => t.trim().replace(/[^a-zA-Z0-9]/g, '')).filter(t => t.length > 1).slice(0, 3).map(t => `#${t}`);
    const shareUrl = `${window.location.origin}/?track=${encodeURIComponent(track.title || 'Untitled')}&audio=${encodeURIComponent(track.audioUrl)}`;

    const socialPosts = {
        x: `🎵 Check out "${track.title}" — AI-crafted with @Aim8Music! 🔥\n\n${genreTags.join(' ')} #Aim8 #AIMusic #NewMusic #MusicProduction\n\n${shareUrl}`,
        tiktok: `🎵 ${track.title} — made with Aim8 AI 🔥\n\n#Aim8 #AIMusic #TikTokMusic ${genreTags.join(' ')} #fyp #viral #newmusic`,
        facebook: `🎶 Just created "${track.title}" with Aim8 AI Music Studio!\n\nListen now 👇\n\n#Aim8 #AIMusic ${genreTags.join(' ')} #NewMusic #MusicCreation`,
        youtube: `${track.title} — AI Music by Aim8 🎶\n\nCreated with Aim8 AI Music Studio\n\n#Aim8 #AIMusic #Shorts ${genreTags.join(' ')} #MusicGeneration #AIGenerated`,
    };

    const handleCopy = () => { navigator.clipboard.writeText(shareUrl); soundManager.playSuccess(); setCopyLabel("Copied!"); setTimeout(() => setCopyLabel("Copy Link"), 2000); };

    const generateSocialVideo = (): Promise<Blob> => new Promise(async (resolve, reject) => {
        try {
            setVideoGenProgress('Loading audio...');
            const audioResponse = await fetch(track.audioUrl);
            const audioArrayBuf = await audioResponse.arrayBuffer();
            setVideoGenProgress('Setting up video...');
            const canvas = document.createElement('canvas');
            canvas.width = 1080; canvas.height = 1920;
            const ctx = canvas.getContext('2d')!;
            let trackImg: HTMLImageElement | null = null;
            if (track.imageUrl) { try { trackImg = await new Promise<HTMLImageElement>((res, rej) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => res(img); img.onerror = rej; img.src = track.imageUrl; }); } catch { trackImg = null; } }

            const drawFrame = (time: number) => {
                const grad = ctx.createLinearGradient(0, 0, 0, 1920);
                grad.addColorStop(0, '#0f0a2e'); grad.addColorStop(0.5, '#1a1145'); grad.addColorStop(1, '#0a0520');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920);
                if (trackImg) { ctx.save(); ctx.filter = 'blur(60px) brightness(0.3)'; ctx.drawImage(trackImg, -100, -100, 1280, 2120); ctx.restore(); }
                const gX = 540 + Math.sin(time * 0.5) * 100, gY = 700 + Math.cos(time * 0.3) * 50;
                const gGrad = ctx.createRadialGradient(gX, gY, 0, gX, gY, 400);
                gGrad.addColorStop(0, 'rgba(6,182,212,0.15)'); gGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = gGrad; ctx.fillRect(0, 0, 1080, 1920);
                const artSize = 600, artX = 240, artY = 400;
                ctx.save(); ctx.beginPath(); canvasRoundRect(ctx, artX, artY, artSize, artSize, 40); ctx.clip();
                if (trackImg) ctx.drawImage(trackImg, artX, artY, artSize, artSize);
                else { ctx.fillStyle = '#1e293b'; ctx.fillRect(artX, artY, artSize, artSize); ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 120px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🎵', 540, artY + 340); }
                ctx.restore();
                ctx.strokeStyle = 'rgba(6,182,212,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); canvasRoundRect(ctx, artX, artY, artSize, artSize, 40); ctx.stroke();
                ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 64px system-ui, sans-serif';
                const tt = track.title || 'Untitled Track'; ctx.fillText(tt.length > 25 ? tt.slice(0, 25) + '…' : tt, 540, 1150);
                ctx.fillStyle = 'rgba(6,182,212,0.8)'; ctx.font = '36px system-ui, sans-serif';
                const tg = track.tags || 'AI Music'; ctx.fillText(tg.length > 40 ? tg.slice(0, 40) + '…' : tg, 540, 1220);
                for (let i = 0; i < 40; i++) { const h = 20 + Math.abs(Math.sin(time * 3 + i * 0.5)) * 80; const bG = ctx.createLinearGradient(0, 1350 - h, 0, 1350); bG.addColorStop(0, 'rgba(6,182,212,0.9)'); bG.addColorStop(1, 'rgba(59,130,246,0.5)'); ctx.fillStyle = bG; ctx.beginPath(); canvasRoundRect(ctx, 141 + i * 18, 1350 - h, 12, h, 4); ctx.fill(); }
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 32px system-ui, sans-serif'; ctx.fillText('Made with Aim8.io 🎵', 540, 1750);
                ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '24px system-ui, sans-serif'; ctx.fillText('Aim8.io', 540, 1800);
            };

            const audioCtx = new AudioContext();
            const audioBuf = await audioCtx.decodeAudioData(audioArrayBuf);
            const maxDur = Math.min(audioBuf.duration, 60);
            setVideoGenProgress('Generating video...');
            const stream = canvas.captureStream(30);
            const src = audioCtx.createBufferSource(); src.buffer = audioBuf;
            const dest = audioCtx.createMediaStreamDestination(); src.connect(dest); src.connect(audioCtx.destination);
            const combined = new MediaStream([...stream.getTracks(), ...dest.stream.getTracks()]);
            const rec = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' });
            const chunks: Blob[] = []; rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            rec.onstop = () => { const blob = new Blob(chunks, { type: 'video/webm' }); audioCtx.close(); setVideoGenProgress(null); resolve(blob); };
            rec.start(100); src.start();
            const st = performance.now();
            const anim = () => { const el = (performance.now() - st) / 1000; if (el >= maxDur) { rec.stop(); src.stop(); return; } drawFrame(el); setVideoGenProgress(`Generating video... ${Math.floor((el / maxDur) * 100)}%`); requestAnimationFrame(anim); };
            anim();
        } catch (err) { setVideoGenProgress(null); reject(err); }
    });

    const handleSocialShare = async (platform: 'tiktok' | 'facebook' | 'youtube') => {
        try {
            let blob = generatedVideoBlob;
            if (!blob) { blob = await generateSocialVideo(); setGeneratedVideoBlob(blob); }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `${(track.title || 'Aim8_Track').replace(/[^a-zA-Z0-9_\- ]/g, '')} - Made with Aim8.io.webm`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            soundManager.playSuccess();
            setTimeout(() => {
                const posts: Record<string, string> = { tiktok: socialPosts.tiktok, facebook: socialPosts.facebook, youtube: socialPosts.youtube };
                navigator.clipboard.writeText(posts[platform]);
                const urls: Record<string, string> = { tiktok: 'https://www.tiktok.com/upload?lang=en', facebook: 'https://www.facebook.com/reels/create', youtube: 'https://studio.youtube.com' };
                window.open(urls[platform], '_blank');
                showToast('Video Downloaded! 🎬', `Upload the video to ${platform === 'youtube' ? 'YouTube Shorts' : platform.charAt(0).toUpperCase() + platform.slice(1)} — caption copied to clipboard!`, 'success');
            }, 500);
        } catch (err) { console.error('Social video error:', err); showToast('Video Generation Failed', 'Try downloading the MP3 instead.', 'error'); }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in zoom-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] w-full max-w-lg p-6 md:p-10 shadow-2xl relative overflow-y-auto max-h-[95vh] custom-scrollbar">
                <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-500 hover:text-white transition-colors bg-white/5 md:bg-transparent rounded-full p-2 z-10 backdrop-blur-md">
                    <X className="w-5 h-5 md:w-7 md:h-7" />
                </button>

                <div className="text-center mb-8 md:mb-10 mt-2 md:mt-0">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl mx-auto mb-4 md:mb-6 shadow-2xl overflow-hidden relative group border border-white/10 ring-4 ring-white/5">
                        <img src={track.imageUrl} alt={track.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 truncate px-2 md:px-4 tracking-tight">{track.title || "Untitled Track"}</h3>
                    <p className="text-sm md:text-base text-slate-400 font-medium truncate px-4 md:px-8 opacity-80">{track.tags}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button onClick={async () => {
                        try {
                            soundManager.playClick();
                            const r = await fetch(track.audioUrl);
                            const b = await r.blob();
                            const u = URL.createObjectURL(new Blob([b], { type: 'audio/mpeg' }));
                            const a = document.createElement('a');
                            trackEvent('track_downloaded', { track_id: track.id, track_title: track.title, source: 'share_modal' });
                            a.href = u;
                            a.download = `${sanitizeFilename(track.title || 'track')} - Made with Aim8.io.mp3`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(u);
                        } catch {
                            trackEvent('track_downloaded', { track_id: track.id, track_title: track.title, source: 'share_modal' });
                            window.open(track.audioUrl, '_blank');
                        }
                    }}
                        className="p-5 bg-slate-800 hover:bg-slate-700 rounded-3xl flex flex-col items-center gap-3 border border-white/5 hover:border-cyan-500/50 transition-all group shadow-lg">
                        <Download className="w-7 h-7 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">Download MP3</span>
                    </button>
                    {track.videoUrl ? (
                        <button onClick={async () => {
                            try {
                                soundManager.playClick();
                                const r = await fetch(track.videoUrl!);
                                const b = await r.blob();
                                const u = URL.createObjectURL(new Blob([b], { type: 'video/mp4' }));
                                const a = document.createElement('a');
                                trackEvent('video_downloaded', { track_id: track.id, track_title: track.title, source: 'share_modal' });
                                a.href = u;
                                a.download = `${sanitizeFilename(track.title || 'track')} - Made with Aim8.io.mp4`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(u);
                            } catch {
                                trackEvent('video_downloaded', { track_id: track.id, track_title: track.title, source: 'share_modal' });
                                window.open(track.videoUrl!, '_blank');
                            }
                        }}
                            className="p-5 bg-slate-800 hover:bg-slate-700 rounded-3xl flex flex-col items-center gap-3 border border-white/5 hover:border-purple-500/50 transition-all group shadow-lg">
                            <Film className="w-7 h-7 text-purple-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">Download Video</span>
                        </button>
                    ) : (
                        <button onClick={() => { onClose(); onGenerateVideo(track); }}
                            className="p-5 bg-slate-800 hover:bg-slate-700 rounded-3xl flex flex-col items-center gap-3 border border-white/5 hover:border-pink-500/50 transition-all group shadow-lg opacity-70 hover:opacity-100">
                            <Clapperboard className="w-7 h-7 text-pink-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">Generate Video</span>
                        </button>
                    )}
                    <button onClick={() => onStemExport(track)} disabled={exportLoading}
                        className="p-5 bg-slate-800 hover:bg-slate-700 rounded-3xl flex flex-col items-center gap-3 border border-white/5 hover:border-yellow-500/50 transition-all group shadow-lg">
                        {exportLoading ? <Loader2 className="w-7 h-7 animate-spin text-yellow-400" /> : <Layers className="w-7 h-7 text-yellow-400 group-hover:scale-110 transition-transform" />}
                        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">Export Stems</span>
                    </button>
                    <button onClick={() => onTikTokExport(track)} disabled={exportLoading}
                        className="p-5 bg-slate-800 hover:bg-slate-700 rounded-3xl flex flex-col items-center gap-3 border border-white/5 hover:border-red-500/50 transition-all group shadow-lg">
                        {exportLoading ? <Loader2 className="w-7 h-7 animate-spin text-red-400" /> : <Share2 className="w-7 h-7 text-red-400 group-hover:scale-110 transition-transform" />}
                        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">TikTok Video</span>
                    </button>
                </div>

                {videoGenProgress && (
                    <div className="mb-6 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-none" />
                        <span className="text-sm text-cyan-300 font-medium">{videoGenProgress}</span>
                    </div>
                )}

                <div className="mb-6">
                    <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Share to Social Media</p>
                    <div className="space-y-3">
                        <button onClick={() => { soundManager.playClick(); window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(socialPosts.x)}`, '_blank', 'width=600,height=500'); }}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 hover:border-white/20 transition-all group text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center flex-none">
                                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                </div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Post to X</span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-500 ml-auto" />
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed pl-11 line-clamp-2 font-mono">{socialPosts.x.split('\n')[0]}</p>
                        </button>

                        <button onClick={() => handleSocialShare('tiktok')} disabled={!!videoGenProgress}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 hover:border-white/20 transition-all group text-left disabled:opacity-50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center flex-none">
                                    <svg className="w-4 h-4 text-[#ff0050]" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.17V11.2a4.85 4.85 0 01-2.65-.77 4.85 4.85 0 01-1.35-3.74z" /></svg>
                                </div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Share to TikTok</span>
                                <span className="text-[9px] text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded-full font-bold ml-auto">+ Video</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed pl-11 line-clamp-2 font-mono">{socialPosts.tiktok.split('\n')[0]}</p>
                        </button>

                        <button onClick={() => handleSocialShare('facebook')} disabled={!!videoGenProgress}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 hover:border-white/20 transition-all group text-left disabled:opacity-50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-[#1877f2]/10 flex items-center justify-center flex-none">
                                    <svg className="w-4 h-4 text-[#1877f2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                </div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Share to Facebook</span>
                                <span className="text-[9px] text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded-full font-bold ml-auto">+ Video</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed pl-11 line-clamp-2 font-mono">{socialPosts.facebook.split('\n')[0]}</p>
                        </button>

                        <button onClick={() => handleSocialShare('youtube')} disabled={!!videoGenProgress}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 hover:border-white/20 transition-all group text-left disabled:opacity-50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-[#ff0000]/10 flex items-center justify-center flex-none">
                                    <svg className="w-4 h-4 text-[#ff0000]" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                                </div>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">YouTube Shorts</span>
                                <span className="text-[9px] text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded-full font-bold ml-auto">+ Video</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed pl-11 line-clamp-2 font-mono">{socialPosts.youtube.split('\n')[0]}</p>
                        </button>
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Share</p>
                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🎵 "${track.title}" — made with Aim8!\n${shareUrl}`)}`, '_blank')}
                            className="flex-1 min-w-[60px] p-2 md:p-3 bg-slate-800 hover:bg-[#25d366]/10 rounded-xl flex flex-col items-center gap-1.5 border border-white/5 hover:border-[#25d366]/50 transition-all group">
                            <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-[#25d366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 group-hover:text-white uppercase">WhatsApp</span>
                        </button>
                        <button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Check out "${track.title}" on Aim8`)}&body=${encodeURIComponent(`I just created this track with Aim8 AI Music Studio!\n\nListen here: ${shareUrl}`)}`, '_self')}
                            className="flex-1 min-w-[60px] p-2 md:p-3 bg-slate-800 hover:bg-cyan-500/10 rounded-xl flex flex-col items-center gap-1.5 border border-white/5 hover:border-cyan-500/50 transition-all group">
                            <Mail className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-cyan-400" />
                            <span className="text-[8px] md:text-[9px] font-bold text-slate-500 group-hover:text-white uppercase">Email</span>
                        </button>
                    </div>
                </div>

                <div className="bg-black/30 rounded-2xl p-4 md:p-5 border border-white/10 flex items-center gap-3 md:gap-5">
                    <div className="flex-1 truncate text-[10px] md:text-xs text-slate-400 font-mono select-all">{shareUrl}</div>
                    <button onClick={handleCopy} className={`px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-white transition-colors text-[10px] md:text-xs font-bold uppercase tracking-wider ${copyLabel === 'Copied!' ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-white/10 hover:bg-white/20'}`}>{copyLabel}</button>
                </div>
            </div>
        </div>
    );
};


// --- Time Formatter Utility ---
const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const VoiceStudio: React.FC<{ onRequireAuth?: () => void }> = ({ onRequireAuth }) => {
    const { user } = useAuth();
    // BYOK build: usage is billed to the user's own API keys, so there is no credit metering.
    const unmetered = true;
    const [showKeySettings, setShowKeySettings] = useState(false);
    const initialTab = 'music' as SidebarPage;
    const [liveTrigger, setLiveTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState<SidebarPage>(initialTab);
    const [showSettings, setShowSettings] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [inputText, setInputText] = useState('');
    const [songTitle, setSongTitle] = useState('');
    const [voiceStyle, setVoiceStyle] = useState<string>('Auto');
    const [musicQuality, setMusicQuality] = useState<string>('V3_5');
    const [playerVisible, setPlayerVisible] = useState(true);
    const playerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const initialKieKey = getKieKey();
    const [settings, setSettings] = useState<UserSettings>({
        sunoApiKey: initialKieKey,
        backendProvider: 'none',
        supabaseUrl: '',
        supabaseKey: '',
        firebaseConfig: undefined,
        voicePitch: 0,
        personas: [],
        credits: 0,
        isPro: true,

        stripePublishableKey: '',
        stripeSecretKey: '',
        n8nWebhookUrl: '',
        n8nApiKey: ''
    });

    const [sessionTaskQueue, setSessionTaskQueue] = useState<(GenerationStatus & { id: string; retryParams?: any; tracks?: SunoTrack[] })[]>([]);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const [userLibrary, setUserLibrary] = useState<SunoTrack[]>([]);
    const [liveGeneratedTracks, setLiveGeneratedTracks] = useState<SunoTrack[]>([]);
    const [activeTrackUrl, setActiveTrackUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const pendingPlayRef = useRef(false);

    // Audio Player State
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    // Library State
    const [librarySearch, setLibrarySearch] = useState('');
    const [librarySort, setLibrarySort] = useState<'newest' | 'oldest' | 'az'>('newest');

    const filteredLibrary = userLibrary.filter(track =>
        (track.title?.toLowerCase() || '').includes(librarySearch.toLowerCase()) ||
        (track.tags?.toLowerCase() || '').includes(librarySearch.toLowerCase())
    ).sort((a, b) => {
        if (librarySort === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        if (librarySort === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        return (a.title || '').localeCompare(b.title || '');
    });
    const [personaModal, setPersonaModal] = useState<{ open: boolean, track?: SunoTrack, taskId?: string, name: string, desc: string, customImage?: string }>({
        open: false, name: '', desc: ''
    });
    const [isCreatingPersona, setIsCreatingPersona] = useState(false);
    const [videoLoadingState, setVideoLoadingState] = useState<Record<string, boolean>>({});
    const [masteringLoadingState, setMasteringLoadingState] = useState<Record<string, boolean>>({});
    const [remixTrack, setRemixTrack] = useState<SunoTrack | null>(null);
    const [videoSettingsTrack, setVideoSettingsTrack] = useState<SunoTrack | null>(null);
    const [shareModal, setShareModal] = useState<{ open: boolean, track: SunoTrack | null }>({ open: false, track: null });
    const [exportLoading, setExportLoading] = useState(false);
    const [masteringSelection, setMasteringSelection] = useState<SunoTrack | null>(null);
    const [videoPlayerUrl, setVideoPlayerUrl] = useState<{ url: string; title: string } | null>(null);

    // Phase 4 state
    const [showPresetLibrary, setShowPresetLibrary] = useState(false);
    const [showMasteringPanel, setShowMasteringPanel] = useState(false);
    const [stemEffectsData, setStemEffectsData] = useState<{ urls: Record<StemName, string>; title: string } | null>(null);



    // ─── NEW FEATURE STATE ─────────────────────────────────────────
    // Prompt Favorites
    const [promptFavorites, setPromptFavorites] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('aim8_prompt_favorites') || '[]'); } catch { return []; }
    });
    const [showPromptFavorites, setShowPromptFavorites] = useState(false);
    const togglePromptFavorite = (prompt: string) => {
        setPromptFavorites(prev => {
            const next = prev.includes(prompt) ? prev.filter(p => p !== prompt) : [...prev, prompt];
            localStorage.setItem('aim8_prompt_favorites', JSON.stringify(next));
            return next;
        });
    };

    // Keyboard Shortcuts
    const [showShortcuts, setShowShortcuts] = useState(false);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
            if (e.key === '?') { e.preventDefault(); setShowShortcuts(prev => !prev); }
            if (e.key === ' ' && activeTrackUrl) { e.preventDefault(); setIsPlaying(prev => !prev); }
            if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setActiveTab('music'); }
            if (e.key === 'l' || e.key === 'L') { e.preventDefault(); setActiveTab('library'); }
            if (e.key === 'Escape') { setShowShortcuts(false); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeTrackUrl]);

    // Session History (Live Mode transcripts)
    const [sessionHistory, setSessionHistory] = useState<{ id: string; date: string; title: string; transcript: { role: 'user' | 'model'; text: string }[] }[]>(() => {
        try { return JSON.parse(localStorage.getItem('aim8_session_history') || '[]'); } catch { return []; }
    });
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    /** Prepend a completed live session to history and persist to localStorage. */
    const saveSession = useCallback((sessionTranscript: { role: 'user' | 'model'; text: string }[]) => {
        if (sessionTranscript.length === 0) return;
        setSessionHistory(prev => {
            const firstUserMsg = sessionTranscript.find(t => t.role === 'user')?.text || '';
            const title = firstUserMsg.slice(0, 60) || 'Untitled Session';
            const entry = { id: Date.now().toString(), date: new Date().toISOString(), title, transcript: sessionTranscript };
            const updated = [entry, ...prev].slice(0, 50); // keep last 50 sessions
            try { localStorage.setItem('aim8_session_history', JSON.stringify(updated)); } catch { }
            return updated;
        });
    }, []);

    // Onboarding Tour
    const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('aim8_onboarding_done'));
    const [onboardingStep, setOnboardingStep] = useState(0);
    const dismissOnboarding = () => { setShowOnboarding(false); localStorage.setItem('aim8_onboarding_done', 'yes'); };

    // Referral
    const [showReferral, setShowReferral] = useState(false);
    const referralCode = user?.uid ? user.uid.slice(0, 8).toUpperCase() : 'AIM8USER';
    const [referralCopied, setReferralCopied] = useState(false);

    // Playlists
    const [playlists, setPlaylists] = useState<{ id: string; name: string; trackIds: string[] }[]>(() => {
        try { return JSON.parse(localStorage.getItem('aim8_playlists') || '[]'); } catch { return []; }
    });
    const [showPlaylistModal, setShowPlaylistModal] = useState<{ open: boolean; trackId?: string }>({ open: false });
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const savePlaylists = (next: typeof playlists) => { setPlaylists(next); localStorage.setItem('aim8_playlists', JSON.stringify(next)); };
    const createPlaylist = (name: string) => {
        const pl = { id: Date.now().toString(), name, trackIds: showPlaylistModal.trackId ? [showPlaylistModal.trackId] : [] };
        savePlaylists([...playlists, pl]);
        setNewPlaylistName('');
    };
    const addToPlaylist = (playlistId: string, trackId: string) => {
        savePlaylists(playlists.map(p => p.id === playlistId ? { ...p, trackIds: Array.from(new Set([...p.trackIds, trackId])) } : p));
    };
    const removeFromPlaylist = (playlistId: string, trackId: string) => {
        savePlaylists(playlists.map(p => p.id === playlistId ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId) } : p));
    };
    const deletePlaylist = (playlistId: string) => {
        savePlaylists(playlists.filter(p => p.id !== playlistId));
    };

    useEffect(() => {
const storedSettings = localStorage.getItem('aim8_settings');
        const runtimeKieKey = getKieKey();

        // No hosted backend in the open-source build.
        const defaultFirebaseConfig: FirebaseConfig | undefined = undefined;

        if (storedSettings) {
            try {
                const parsed = JSON.parse(storedSettings);
                setSettings(prev => {
                    const newSettings = {
                        ...prev,
                        ...parsed,
                        sunoApiKey: runtimeKieKey,
                        backendProvider: 'none',
                        firebaseConfig: defaultFirebaseConfig,
                        credits: 0,
                        isPro: true
                    };
                    if (false) {
                        localStorage.setItem('aim8_settings', JSON.stringify(newSettings));
                    }
                    // Re-initialize backend with new settings immediately
                    if (newSettings.firebaseConfig) {
                        backendManager.initialize(newSettings);
                    }
                    return newSettings;
                });
            } catch (e) { }
        } else {
            setSettings(prev => {
                const newSettings = {
                    ...prev,
                    sunoApiKey: runtimeKieKey,
                    backendProvider: 'none' as const,
                    firebaseConfig: defaultFirebaseConfig
                };
                backendManager.initialize(newSettings);
                return newSettings;
            });
        }

        // Load locally-saved tracks immediately (for free users & fast load)
        try {
            const localTracks = JSON.parse(localStorage.getItem('aim8_user_tracks') || '[]');
            if (localTracks.length > 0) {
                setUserLibrary(localTracks);
            }
        } catch { /* ignore parse errors */ }


        const fetchData = async () => {
            if (backendManager.isReady()) {
                const remotePersonas = await backendManager.getPersonas();
                if (remotePersonas.length > 0) {
                    setSettings(prev => {
                        const existingIds = new Set((prev.personas || []).map(p => p.personaId));
                        const newOnes = remotePersonas.filter(p => !existingIds.has(p.personaId));
                        if (newOnes.length === 0) return prev;
                        const merged = [...(prev.personas || []), ...newOnes];
                        localStorage.setItem('aim8_settings', JSON.stringify({ ...prev, personas: merged }));
                        return { ...prev, personas: merged };
                    });
                }
                const tracks = await backendManager.getUserTracks();
                setUserLibrary(tracks);
            }
        };
        fetchData();

    }, []);

    // Persist library to localStorage whenever it changes
    const libraryInitialized = useRef(false);
    useEffect(() => {
        // Skip the first render (we just loaded from localStorage above)
        if (!libraryInitialized.current) {
            libraryInitialized.current = true;
            return;
        }
        try {
            localStorage.setItem('aim8_user_tracks', JSON.stringify(userLibrary));
        } catch { /* quota exceeded — silent */ }
    }, [userLibrary]);

    // On sign-in: merge local tracks with remote, sync local-only tracks to Firebase
    useEffect(() => {
        if (!user) return;
        const mergeTracksOnSignIn = async () => {
            try {
                const remoteTracks = await backendManager.getUserTracks();
                const localTracks: any[] = JSON.parse(localStorage.getItem('aim8_user_tracks') || '[]');

                // Merge: remote + any local-only tracks (dedup by ID)
                const remoteIds = new Set(remoteTracks.map((t: any) => t.id));
                const localOnly = localTracks.filter((t: any) => !remoteIds.has(t.id));

                // Sync local-only tracks to Firebase
                for (const track of localOnly) {
                    try { await backendManager.saveTrack(track); } catch { /* silent */ }
                }

                // Merged library: remote first, then local-only additions
                const merged = [...remoteTracks, ...localOnly];
                if (merged.length > 0) {
                    setUserLibrary(merged);
                    localStorage.setItem('aim8_user_tracks', JSON.stringify(merged));
                }
            } catch { /* silent */ }
        };
        mergeTracksOnSignIn();
    }, [user?.uid]);

    useEffect(() => {
        if (settings.backendProvider !== 'none') {
            backendManager.initialize(settings);
        }
    }, [settings.backendProvider, settings.supabaseUrl, settings.firebaseConfig]);

    const handlePlay = (track: SunoTrack) => {
        soundManager.playClick();
        if (!track.audioUrl) return; // No audio to play

        // Ensure the track is in the library so it renders nicely in the bottom player
        setUserLibrary(prev => {
            if (!prev.some(t => t.id === track.id || t.audioUrl === track.audioUrl)) {
                return [track, ...prev];
            }
            return prev;
        });

        if (activeTrackUrl === track.audioUrl && isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else if (activeTrackUrl === track.audioUrl && !isPlaying) {
            // Same track, just resume — but verify audio element has correct src
            const audio = audioRef.current;
            if (audio && audio.src && audio.src === track.audioUrl && audio.readyState >= 2) {
                audio.play().then(() => setIsPlaying(true)).catch((err) => {
                    console.warn('AIM-8: Resume play failed, reloading:', err);
                    // Fallback: reload
                    pendingPlayRef.current = true;
                    setActiveTrackUrl(null);
                    setTimeout(() => setActiveTrackUrl(track.audioUrl), 50);
                });
            } else {
                // Audio element lost its source, reload
                pendingPlayRef.current = true;
                setActiveTrackUrl(null);
                setTimeout(() => setActiveTrackUrl(track.audioUrl), 50);
            }
            setPlayerVisible(true);
        } else {
            // New track — set URL, mark pending play
            pendingPlayRef.current = true;
            setActiveTrackUrl(track.audioUrl);
            setPlayerVisible(true);
        }
    };

    // When activeTrackUrl changes, load and play the new source
    useEffect(() => {
        if (!activeTrackUrl || !audioRef.current) return;
        const audio = audioRef.current;
        audio.src = activeTrackUrl;
        audio.load();

        if (pendingPlayRef.current) {
            const doPlay = () => {
                audio.play()
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.warn('AIM-8: Audio play failed:', err);
                        setIsPlaying(false);
                    });
                pendingPlayRef.current = false;
            };

            // If audio is already loaded (cached), play immediately
            if (audio.readyState >= 3) {
                doPlay();
            } else {
                const onCanPlay = () => {
                    doPlay();
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('canplay', onCanPlay);
                };
                const onError = (e: Event) => {
                    console.error('AIM-8: Audio load error:', (e.target as HTMLAudioElement)?.error);
                    pendingPlayRef.current = false;
                    setIsPlaying(false);
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                };
                audio.addEventListener('canplaythrough', onCanPlay);
                audio.addEventListener('canplay', onCanPlay);
                audio.addEventListener('error', onError, { once: true });
                return () => {
                    audio.removeEventListener('canplaythrough', onCanPlay);
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                };
            }
        }
    }, [activeTrackUrl]);

    const handleUpdateSettings = useCallback((key: keyof UserSettings, value: any) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem('aim8_settings', JSON.stringify(newSettings));
            return newSettings;
        });

        if (key === 'credits') {
            if (user) {
                backendManager.updateUserCredits('current_user', value as number);
            }
        }
    }, [user]);

    const handleUpdateFirebase = (key: keyof FirebaseConfig, value: string) => {
        setSettings(prev => {
            const newConfig = { ...prev.firebaseConfig, [key]: value } as FirebaseConfig;
            const newSettings = { ...prev, firebaseConfig: newConfig };
            localStorage.setItem('aim8_settings', JSON.stringify(newSettings));
            return newSettings;
        });
    };



    const handleStartEdit = (p: SunoPersona) => {
        setEditingPersonaId(p.personaId);
        setEditName(p.name);
        setEditDesc(p.description);
    };

    const handleSaveEdit = async () => {
        if (!editingPersonaId) return;
        const original = settings.personas?.find(p => p.personaId === editingPersonaId);
        if (!original) return;
        const updated = { ...original, name: editName, description: editDesc };
        const updatedPersonas = settings.personas?.map(p => p.personaId === editingPersonaId ? updated : p) || [];
        handleUpdateSettings('personas', updatedPersonas);
        await backendManager.savePersona(updated);
        setEditingPersonaId(null);
        soundManager.playSuccess();
    };

    const handleDeletePersona = async (id: string) => {
        if (!confirm("Are you sure you want to delete this persona?")) return;
        const updatedPersonas = settings.personas?.filter(p => p.personaId !== id) || [];
        handleUpdateSettings('personas', updatedPersonas);
        await backendManager.deletePersona(id);
        soundManager.playClick();
    };

    const handleGenerate = useCallback(async (params: SunoGenerationParams): Promise<boolean> => {

// Save prompt locally
        if (params.prompt) {
            const storedPrompts = localStorage.getItem('aim8_saved_prompts');
            let prompts: string[] = storedPrompts ? JSON.parse(storedPrompts) : [];
            if (!prompts.includes(params.prompt)) {
                prompts = [params.prompt, ...prompts].slice(0, 50);
                localStorage.setItem('aim8_saved_prompts', JSON.stringify(prompts));
            }
        }

        const genId = Math.random().toString(36).substring(7);
        trackEvent('generation_started', { style: params.style, instrumental: params.instrumental });
        setSessionTaskQueue(prev => [...prev, { id: genId, status: 'generating', progress: 'Initializing creative process...' }]);

        const MAX_RETRIES = 2;
        let lastError: any = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Auto-generate title if missing
                let finalTitle = params.title;
                if (!finalTitle) {
                    setSessionTaskQueue(prev => prev.map(g => g.id === genId ? { ...g, progress: 'Dreaming up a title...' } : g));
                    finalTitle = await generateTrackName(params.prompt, params.style || 'Custom Style');
                }

                if (attempt > 1) {
                    setSessionTaskQueue(prev => prev.map(g => g.id === genId ? { ...g, status: 'generating', progress: `Retry attempt ${attempt}/${MAX_RETRIES}...`, error: undefined } : g));
                    showToast('Retrying...', `Generation attempt ${attempt} of ${MAX_RETRIES}`, 'info');
                }

                // BYOK: the user's own Kie.ai key, entered in the API Keys screen.
                const effectiveApiKey = getKieKey();

                const taskId = await generateMusicTask({ ...params, title: finalTitle }, effectiveApiKey);
                setSessionTaskQueue(prev => prev.map(g => g.id === genId ? { ...g, status: 'polling', taskId, progress: 'Queued for generation...' } : g));

                const tracks = await pollTaskStatus(taskId, effectiveApiKey, (msg) => {
                    setSessionTaskQueue(prev => prev.map(g => g.id === genId ? { ...g, progress: msg } : g));
                });

                // Validate tracks have real audio
                const validTracks = tracks.filter(t => !!t.audioUrl);

                if (validTracks.length > 0) {
                    if (user) {
                        validTracks.forEach(t => backendManager.saveTrack(t));
                    }
                    setUserLibrary(prev => [...validTracks, ...prev]);
                    // If triggered from Live Mode, surface tracks there
                    if (activeTab === 'music') {
                        setLiveGeneratedTracks(prev => [...prev, ...validTracks]);
                    }
                    setSessionTaskQueue(prev => prev.map(g => g.id === genId ? { ...g, status: 'complete', tracks: validTracks } : g));
                    trackEvent('generation_completed', { trackCount: validTracks.length });
                    soundManager.playSuccess();
                    showToast('Track Ready! 🎶', `"${validTracks[0]?.title}" has been added to your library.`, 'success');

                    return true; // Success — exit the retry loop
                } else if (tracks.length > 0) {
                    // Tracks returned but none valid — still save the best one as fallback
                    const fallback = tracks[0];
                    if (user) {
                        backendManager.saveTrack(fallback);
                    }
                    setUserLibrary(prev => [fallback, ...prev]);
                    if (activeTab === 'music') {
                        setLiveGeneratedTracks(prev => [...prev, fallback]);
                    }
                    setSessionTaskQueue(prev => prev.map(g => g.id === genId ? { ...g, status: 'complete', tracks: [fallback] } : g));
                    soundManager.playSuccess();
                    showToast('Track Generated', 'Your track is ready but may still be processing audio. Check your library.', 'warning');
                } else {
                    throw new Error('Generation completed but no tracks were returned. Please try again.');
                }

                return true; // Success — exit the retry loop
            } catch (error: any) {
                lastError = error;
                console.error(`Generation attempt ${attempt} failed:`, error);

                if (attempt < MAX_RETRIES) {
                    // Wait briefly before retrying
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
            }
        }

        // All retries exhausted — handle the final failure
        let errorMessage = lastError?.message || 'Unknown generation error';
        if (errorMessage.includes('Credits insufficient')) {
            errorMessage = 'Your Kie.ai account is out of credits. Top up at kie.ai, then try again.';
        }

        const isAuthError = /unauthorized|401|must be logged in|not logged in|auth/i.test(errorMessage);
        if (isAuthError) {
            setSessionTaskQueue(prev => prev.map(g => g.id === genId ? {
                ...g, status: 'error', error: 'Your Kie.ai API key is missing or was rejected.',
                retryParams: params
            } : g));
            soundManager.playError();
            showToast('Generation Failed', 'Your Kie.ai API key is missing or was rejected. Open API Keys to check it.', 'error');
            return false;
        }


        // Record the failed attempt (no audio) so the user can retry it from the library
        const errorPlaceholderTrack: any = {
            id: `failed_${Date.now()}`,
            title: params.title || 'Generating...',
            tags: params.style || params.prompt?.slice(0, 50) || '',
            audioUrl: '',
            imageUrl: '',
            duration: 0,
            createdAt: new Date().toISOString(),
            status: 'failed',
            prompt: params.prompt,
        };
        if (user) {
            backendManager.saveTrack(errorPlaceholderTrack);
        }
        setUserLibrary(prev => [errorPlaceholderTrack, ...prev]);

        setSessionTaskQueue(prev => prev.map(g => g.id === genId ? {
            ...g, status: 'error', error: errorMessage,
            // Store params so the regenerate button can re-trigger
            retryParams: params,
        } : g));
        soundManager.playError();
        showToast('Generation Failed', `${errorMessage}. A placeholder has been saved to your library — tap regenerate to try again.`, 'error');
        return false;
    }, [unmetered, settings, user, onRequireAuth, activeTab, handleUpdateSettings]);

    const openPersonaModal = (track: SunoTrack, taskId?: string) => {
        if (!taskId) return;
        setPersonaModal({
            open: true,
            track,
            taskId,
            name: track.title ? `${track.title.substring(0, 15)} Singer` : 'New Persona',
            desc: `A unique persona based on the style: ${track.tags}`,
            customImage: undefined
        });
    };

    const submitPersona = async () => {
        if (!personaModal.track || !personaModal.taskId) {
            alert("Cannot create persona: Missing track data or Task ID. Please generate a new track first.");
            return;
        }
        setIsCreatingPersona(true);
        const trackWithImage = {
            ...personaModal.track,
            imageUrl: personaModal.customImage || personaModal.track.imageUrl
        };
        const success = await handleCreatePersona(personaModal.taskId, trackWithImage, personaModal.name, personaModal.desc);
        setIsCreatingPersona(false);
        if (success) {
            setPersonaModal({ ...personaModal, open: false });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setPersonaModal(prev => ({ ...prev, customImage: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleCreatePersona = async (taskId: string, track: SunoTrack, name: string, desc: string) => {
        // BYOK: createPersona() uses the user's own Kie.ai key.

try {
            soundManager.playClick();
const persona = await createPersona(getKieKey(), taskId, track.id, name, desc);
            const enrichedPersona = { ...persona, imageUrl: track.imageUrl };
            const updatedPersonas = [...(settings.personas || []), enrichedPersona];
            handleUpdateSettings('personas', updatedPersonas);

            // Save to backend — but don't block success on Firebase errors
            try {
                await backendManager.savePersona(enrichedPersona);
            } catch (dbErr) {
                console.warn('Aim8: Persona saved locally but backend sync failed:', dbErr);
                // Persona is still saved in local settings, so this is not a blocker
            }

            soundManager.playSuccess();
            return true;
        } catch (e: any) {
            console.error('Persona creation error:', e);
            soundManager.playError();
            // Show a friendly error instead of raw Firebase/API error
            const msg = e.message?.includes('Firebase') || e.message?.includes('firestore') || e.message?.includes('permission')
                ? 'Persona created locally but could not sync to cloud. It will be available in this session.'
                : (e.message || 'Failed to create Persona');
            alert(msg);
            return false;
        }
    };

    const handleVideoGeneration = async (track: SunoTrack): Promise<string | null> => {
        setVideoSettingsTrack(track);
        return null; // Return null since it's now handled by the async panel UI
    };

    const handleMastering = async (track: SunoTrack, preset: MasteringPreset) => {
        setMasteringLoadingState(prev => ({ ...prev, [track.id]: true }));
        try {
            const masteredBlob = await masterTrack(track.audioUrl, preset);
            const newUrl = URL.createObjectURL(masteredBlob);
            const updatedTrack = {
                ...track,
                audioUrl: newUrl,
                tags: track.tags + " (Mastered)"
            };
            setUserLibrary(prev => prev.map(t => t.id === track.id ? updatedTrack : t));
            setSessionTaskQueue(prev => prev.map(g => g.tracks ? { ...g, tracks: g.tracks.map(t => t.id === track.id ? updatedTrack : t) } : g));
            backendManager.saveTrack(updatedTrack);
            soundManager.playSuccess();
        } catch (e) {
            console.error("Mastering failed", e);
            soundManager.playError();
            alert("Mastering process failed. Please try again.");
        } finally {
            setMasteringLoadingState(prev => ({ ...prev, [track.id]: false }));
            setMasteringSelection(null);
        }
    };

    const handleStemExport = async (track: SunoTrack) => {
        setExportLoading(true);
        trackEvent('stem_export_started', { track_id: track.id, track_title: track.title });
        try {
            const blob = await separateStems(track);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = sanitizeFilename(track.title);
            a.download = `${safeTitle} - Stems - Made with Aim8.io.zip`;
            a.click();
            URL.revokeObjectURL(url);
            soundManager.playSuccess();
            trackEvent('stem_export_completed', { track_id: track.id, track_title: track.title });
        } catch (e) {
            console.error(e);
            alert("Stem separation failed. Please try again.");
            soundManager.playError();
            trackEvent('stem_export_failed', { track_id: track.id, track_title: track.title, error: String(e) });
        } finally {
            setExportLoading(false);
        }
    };

    const handleTikTokExport = async (track: SunoTrack) => {
        setExportLoading(true);
        trackEvent('tiktok_export_started', { track_id: track.id, track_title: track.title });
        try {
            const blob = await generateTikTokClip(track);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = sanitizeFilename(track.title);
            a.download = `${safeTitle} - TikTok - Made with Aim8.io.mp4`;
            a.click();
            window.open('https://www.tiktok.com/upload', '_blank');
            soundManager.playSuccess();
            trackEvent('tiktok_export_completed', { track_id: track.id, track_title: track.title });
        } catch (e) {
            console.error(e);
            alert("Video generation failed.");
            trackEvent('tiktok_export_failed', { track_id: track.id, track_title: track.title, error: String(e) });
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex relative">
            <Sidebar
                activePage={activeTab}
                onNavigate={(page) => {
                    soundManager.playClick();
                    if (page === 'live') {
                        setLiveTrigger(prev => prev + 1);
                    } else {
                        setActiveTab(page);
                    }
                }}
                credits={settings.credits}
                isPro={!!settings.isPro}
                onOpenPaywall={() => setShowPaywall(true)}
            />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">


                {/* Top Bar — credits only */}
                <div className="flex items-center justify-end gap-3 px-4 md:px-6 pt-3 pb-2 flex-none relative z-40">
                    <button
                        onClick={() => { soundManager.playClick(); setShowKeySettings(true); }}
                        className="flex items-center justify-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all shadow-lg font-bold text-[10px] md:text-xs uppercase tracking-wider bg-slate-900/40 backdrop-blur-md border-cyan-500/30 text-cyan-400 hover:bg-slate-800"
                        title="Manage your own API keys"
                    >
                        <Shield className="w-3.5 h-3.5" /><span>API Keys</span>
                    </button>

                    {user?.photoURL && (
                        <button
                            onClick={() => { soundManager.playClick(); setActiveTab('dashboard'); }}
                            className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-white/10 hover:border-cyan-500/50 transition-all shadow-lg hover:shadow-cyan-500/20 flex-none"
                        >
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                    )}
                </div>

                

                <div className="flex-1 relative overflow-hidden flex flex-col">
                    <React.Suspense fallback={
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                        </div>
                    }>
                        <ErrorBoundary key={activeTab} fallbackTitle={`${activeTab} couldn't load`}>
                            {activeTab === 'music' ? (
                                <div className="flex flex-1 h-full overflow-hidden">
                                    <StudioMainPanel
                                        onGenerate={handleGenerate}
                                        onSwitchToLive={() => setLiveTrigger(prev => prev + 1)}
                                        voiceStyle={voiceStyle}
                                        onVoiceStyleChange={setVoiceStyle}
                                        musicQuality={musicQuality}
                                        onMusicQualityChange={setMusicQuality}
                                        voicePitch={settings.voicePitch ?? 0}
                                        personas={settings.personas || []}
                                        inputText={inputText}
                                        setInputText={setInputText}
                                        songTitle={songTitle}
                                        setSongTitle={setSongTitle}
                                        sessionTaskQueue={sessionTaskQueue as any}
                                        setSessionTaskQueue={setSessionTaskQueue}
                                        playTrack={handlePlay}
                                        activeTrackUrl={activeTrackUrl || ''}
                                        isPlaying={isPlaying}
                                        setShareModal={setShareModal}
                                        setRemixTrack={setRemixTrack}
                                        openPersonaModal={(track, taskId) => setPersonaModal({ open: true, track, taskId, name: '', desc: '', customImage: undefined })}
                                        videoLoadingState={videoLoadingState}
                                        masteringLoadingState={masteringLoadingState}
                                        handleVideoGeneration={handleVideoGeneration}
                                        onSelectMastering={(track) => { soundManager.playClick(); setMasteringSelection(track); }}
                                        GenerationTimelineComponent={GenerationTimeline}
                                        TrackCardComponent={TrackCard}
                                    />
                                    <StudioChatPanel
                                        onGenerate={handleGenerate}
                                        onSwitchToLive={() => setLiveTrigger(prev => prev + 1)}
                                        liveTrigger={liveTrigger}
                                        voiceStyle={voiceStyle}
                                        voicePitch={settings.voicePitch ?? 0}
                                        musicQuality={musicQuality}
                                        personas={settings.personas || []}
                                        isCollapsed={chatCollapsed}
                                        onToggleCollapse={() => setChatCollapsed(c => !c)}
                                        onVideoWatch={(url, title) => setVideoPlayerUrl({ url, title })}
                                        sessionTaskQueue={sessionTaskQueue}
                                        setSessionTaskQueue={setSessionTaskQueue}
                                        playTrack={handlePlay}
                                        activeTrackUrl={activeTrackUrl || ''}
                                        isPlaying={isPlaying}
                                        setShareModal={setShareModal}
                                        setRemixTrack={setRemixTrack}
                                        openPersonaModal={(track, taskId) => setPersonaModal({ open: true, track, taskId, name: '', desc: '', customImage: undefined })}
                                        videoLoadingState={videoLoadingState}
                                        masteringLoadingState={masteringLoadingState}
                                        handleVideoGeneration={handleVideoGeneration}
                                        onSelectMastering={(track) => { soundManager.playClick(); setMasteringSelection(track); }}
                                        GenerationTimelineComponent={GenerationTimeline}
                                        TrackCardComponent={TrackCard}
                                    />
                                </div>
                            ) : activeTab === 'library' ? (
                                <div className="flex flex-col h-full p-4 md:p-8 overflow-hidden">
                                    <div className="mb-6 md:mb-8 flex items-center gap-4">
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-800 flex items-center justify-center border border-white/10 shadow-lg">
                                            <Database className="w-6 h-6 md:w-7 md:h-7 text-cyan-400" />
                                        </div>
                                        <div className="flex items-center justify-between flex-1">
                                            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Your Library</h2>
                                            <span className="text-slate-400 text-sm font-medium">{filteredLibrary.length} Tracks</span>
                                        </div>
                                    </div>

                                    {/* Search & Sort Bar */}
                                    <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-0 z-10 py-4 border-b border-white/5">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="Search tracks, genres, vibes..."
                                                value={librarySearch}
                                                onChange={(e) => setLibrarySearch(e.target.value)}
                                                className="w-full bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl pl-11 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:bg-white/[0.06] transition-all shadow-lg shadow-black/10"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                value={librarySort}
                                                onChange={(e) => setLibrarySort(e.target.value as any)}
                                                className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-5 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 appearance-none cursor-pointer hover:bg-white/[0.08] transition-all shadow-lg shadow-black/10"
                                            >
                                                <option value="newest">Newest First</option>
                                                <option value="oldest">Oldest First</option>
                                                <option value="az">A-Z</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
                                        {filteredLibrary.length > 0 ? (
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                                                {filteredLibrary.map(track => (
                                                    <TrackCard
                                                        key={track.id}
                                                        track={track}
                                                        playTrack={handlePlay}
                                                        activeTrackUrl={activeTrackUrl}
                                                        isPlaying={activeTrackUrl === track.audioUrl && isPlaying}
                                                        onShare={() => setShareModal({ open: true, track })}
                                                        onRemix={() => {
                                                            setActiveTab('music');
                                                            setInputText(`Remix: ${track.title}`);
                                                        }}
                                                        onVideo={() => handleVideoGeneration(track)}
                                                        onVideoWatch={(url, title) => setVideoPlayerUrl({ url, title })}
                                                        onPersona={() => track.taskId ? openPersonaModal(track, track.taskId) : null}
                                                        onMaster={() => { soundManager.playClick(); setMasteringSelection(track); }}
                                                        onRename={(id, newTitle) => {
                                                            setUserLibrary(prev => {
                                                                const updated = prev.map(t => t.id === id ? { ...t, title: newTitle } : t);
                                                                localStorage.setItem('aim8_user_library', JSON.stringify(updated));
                                                                return updated;
                                                            });
                                                        }}
                                                        videoLoading={videoLoadingState[track.id]}
                                                        masteringLoading={masteringLoadingState[track.id]}
                                                        onPlaylist={() => setShowPlaylistModal({ open: true, trackId: track.id })}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                                                    <Music2 className="w-8 h-8 text-slate-600" />
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-2">No tracks found</h3>
                                                <p className="text-slate-500 max-w-xs mx-auto mb-6">
                                                    {librarySearch ? "Try adjusting your search terms." : "Start creating music in the Studio!"}
                                                </p>
                                                {!librarySearch && (
                                                    <button
                                                        onClick={() => setActiveTab('music')}
                                                        className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-full transition-colors"
                                                    >
                                                        Create Music
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeTab === 'tutorial' ? (
                                <PromptTutorial />
                            ) : activeTab === 'pro' ? (
                                <ProStudio
                                    apiKey={getKieKey()}
                                    isPro={true}
                                    library={userLibrary}
                                    onOpenPaywall={() => setShowPaywall(true)}
                                    onTrackGenerated={(tracks) => {
                                        setUserLibrary(prev => [...tracks, ...prev]);
                                        try { localStorage.setItem(`aim8_library_${user?.uid || 'anon'}`, JSON.stringify([...tracks, ...userLibrary])); } catch { }
                                    }}
                                    onPlay={(track) => handlePlay(track)}
                                />
                            ) : null}
                        </ErrorBoundary>
                    </React.Suspense>
                </div>
                {showKeySettings && (
                    <ApiKeySetup onClose={() => setShowKeySettings(false)} onSaved={() => { setShowKeySettings(false); handleUpdateSettings('sunoApiKey', getKieKey()); }} />
                )}
                <audio
                    ref={audioRef}
                    crossOrigin="anonymous"
                    onEnded={() => {
                        if (isLooping && audioRef.current) {
                            audioRef.current.currentTime = 0;
                            audioRef.current.play();
                        } else {
                            setIsPlaying(false);
                            setCurrentTime(0);
                        }
                    }}
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            setCurrentTime(audioRef.current.currentTime);
                        }
                    }}
                    onLoadedMetadata={() => {
                        if (audioRef.current) {
                            setDuration(audioRef.current.duration);
                        }
                    }}
                    onError={(e) => {
                        const target = e.target as HTMLAudioElement;
                        console.error("AIM-8 Audio Playback Error:", target.error?.message, "Code:", target.error?.code, "Src:", target.src);
                    }}
                    muted={isMuted}
                />

                {/* Pro badge (inline) */}
                {settings.isPro && (
                    <div className="fixed bottom-32 md:bottom-6 right-4 md:right-6 z-50">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">Pro</span>
                        </div>
                    </div>
                )}

                {/* ─── Floating Mini Player (Premium Redesign) ─── */}
                {activeTrackUrl && (
                    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] transition-all duration-700 w-full max-w-[600px] px-4 font-sans perspective-1000">
                        <div
                            className={`rounded-[28px] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform shadow-2xl shadow-cyan-900/20 ${playerVisible
                                ? 'opacity-100 translate-y-0 scale-100'
                                : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
                                }`}
                            style={{
                                backdropFilter: 'blur(40px) saturate(2)',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                                borderTop: '1px solid rgba(255,255,255,0.15)',
                                borderLeft: '1px solid rgba(255,255,255,0.1)',
                                borderRight: '1px solid rgba(255,255,255,0.02)',
                                borderBottom: '1px solid rgba(255,255,255,0.02)'
                            }}
                            onMouseEnter={(e) => {
                                setPlayerVisible(true);
                                if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02) rotateX(2deg)';
                                e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(6, 182, 212, 0.25), 0 18px 36px -18px rgba(0,0,0,0.5)';
                            }}
                            onMouseLeave={(e) => {
                                playerTimerRef.current = setTimeout(() => setPlayerVisible(false), 8000);
                                e.currentTarget.style.transform = 'translateY(0) scale(1) rotateX(0)';
                                e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.4)';
                            }}
                        >
                            {/* Glass highlights & Shimmers */}
                            <div className="absolute inset-0 pointer-events-none rounded-[28px] overflow-hidden">
                                <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                                {isPlaying && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -skew-x-12 animate-[shimmer_3s_infinite]" />
                                )}
                            </div>

                            {/* Main Content Area */}
                            <div className="flex flex-col relative z-10 w-full pl-3 pr-4 py-3">

                                {/* Top Row: Layout */}
                                <div className="flex items-center justify-between gap-4 w-full h-[52px]">

                                    {/* Left: Track Info & Visualizer */}
                                    <div className="flex items-center gap-3 min-w-[140px] flex-1">
                                        <div className="w-[52px] h-[52px] rounded-[18px] bg-slate-800 flex-none overflow-hidden relative shadow-inner border border-white/5 group">
                                            {userLibrary.find(t => t.audioUrl === activeTrackUrl)?.imageUrl ? (
                                                <img src={userLibrary.find(t => t.audioUrl === activeTrackUrl)?.imageUrl} className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-110' : 'scale-100'}`} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
                                                    <Music2 className="w-5 h-5 text-slate-500" />
                                                </div>
                                            )}
                                            {isPlaying && (
                                                <div className="absolute inset-0 bg-black/20" />
                                            )}
                                        </div>

                                        <div className="flex flex-col justify-center min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-bold text-[13px] truncate leading-tight tracking-tight drop-shadow-sm font-outfit">
                                                    {userLibrary.find(t => t.audioUrl === activeTrackUrl)?.title || 'Untitled Track'}
                                                </p>
                                                {/* Animated Equalizer */}
                                                {isPlaying && (
                                                    <div className="flex items-end gap-[1.5px] h-3 opacity-80">
                                                        <div className="w-1 bg-cyan-400 rounded-full animate-[eq_0.8s_ease-in-out_infinite_alternate]" style={{ animationDelay: '0ms' }} />
                                                        <div className="w-1 bg-cyan-400 rounded-full animate-[eq_0.8s_ease-in-out_infinite_alternate]" style={{ animationDelay: '200ms' }} />
                                                        <div className="w-1 bg-cyan-400 rounded-full animate-[eq_0.8s_ease-in-out_infinite_alternate]" style={{ animationDelay: '400ms' }} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-cyan-100/60 text-[10px] truncate uppercase tracking-widest font-bold mt-0.5">
                                                {userLibrary.find(t => t.audioUrl === activeTrackUrl)?.tags || 'Unknown Genre'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Center: Playback Controls */}
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10; }}
                                            className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-30"
                                            disabled={currentTime <= 0}
                                        >
                                            <Rewind className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (isPlaying) {
                                                    audioRef.current?.pause();
                                                    setIsPlaying(false);
                                                } else {
                                                    audioRef.current?.play();
                                                    setIsPlaying(true);
                                                }
                                            }}
                                            className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 shadow-lg shadow-cyan-500/30 flex items-center justify-center transition-all active:scale-95 group relative overflow-hidden text-white"
                                        >
                                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            {isPlaying ? <Pause className="w-5 h-5 fill-current relative z-10" /> : <Play className="w-5 h-5 fill-current ml-1 relative z-10" />}
                                        </button>

                                        <button
                                            onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10; }}
                                            className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-30"
                                            disabled={currentTime >= duration}
                                        >
                                            <FastForward className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Right: Utility Controls */}
                                    <div className="flex items-center justify-end gap-1.5 min-w-[140px] flex-1 text-slate-400">
                                        <button
                                            onClick={() => setIsMuted(!isMuted)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'text-red-400 bg-red-400/10' : 'hover:text-white hover:bg-white/10'}`}
                                            title="Mute"
                                        >
                                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                        </button>

                                        <button
                                            onClick={() => setIsLooping(!isLooping)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isLooping ? 'text-cyan-400 bg-cyan-400/10' : 'hover:text-white hover:bg-white/10'}`}
                                            title="Repeat"
                                        >
                                            <Repeat className="w-4 h-4" />
                                        </button>

                                        <a
                                            href={activeTrackUrl}
                                            download={`${(userLibrary.find(t => t.audioUrl === activeTrackUrl)?.title || 'AIM8_Track').replace(/[^a-zA-Z0-9_\- ]/g, '')}.mp3`}
                                            onClick={() => {
                                                const currentTrack = userLibrary.find(t => t.audioUrl === activeTrackUrl);
                                                if (currentTrack) trackEvent('track_downloaded', { track_id: currentTrack.id, track_title: currentTrack.title, source: 'mini_player' });
                                            }}
                                            className="w-8 h-8 rounded-full hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                                            title="Download MP3"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>

                                        {/* Add to Playlist */}
                                        <button
                                            onClick={() => {
                                                const currentTrack = userLibrary.find(t => t.audioUrl === activeTrackUrl);
                                                if (currentTrack) {
                                                    setShowPlaylistModal({ open: true, trackId: currentTrack.id });
                                                }
                                            }}
                                            className="w-8 h-8 rounded-full hover:text-purple-400 hover:bg-purple-400/10 flex items-center justify-center transition-colors"
                                            title="Add to Playlist"
                                        >
                                            <ListMusic className="w-4 h-4" />
                                        </button>

                                        {/* Share */}
                                        <button
                                            onClick={() => {
                                                const currentTrack = userLibrary.find(t => t.audioUrl === activeTrackUrl);
                                                if (currentTrack) {
                                                    setShareModal({ open: true, track: currentTrack });
                                                }
                                            }}
                                            className="w-8 h-8 rounded-full hover:text-cyan-400 hover:bg-cyan-400/10 flex items-center justify-center transition-colors"
                                            title="Share Track"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>

                                        <div className="w-px h-4 bg-white/10 mx-1" />

                                        <button
                                            onClick={() => { setActiveTrackUrl(null); setIsPlaying(false); audioRef.current?.pause(); }}
                                            className="w-8 h-8 rounded-full hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-colors -mr-1"
                                            title="Close Player"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                </div>

                                {/* Bottom Row: Seek Bar */}
                                <div className="w-full mt-3 flex items-center gap-3 px-1">
                                    <span className="text-[10px] font-mono text-slate-500 font-medium translate-y-px">
                                        {formatTime(currentTime)}
                                    </span>

                                    <div className="relative flex-1 h-2 group cursor-pointer flex items-center"
                                        onClick={(e) => {
                                            if (!audioRef.current || !duration) return;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pos = (e.clientX - rect.left) / rect.width;
                                            audioRef.current.currentTime = pos * duration;
                                        }}
                                    >
                                        <div className="absolute left-0 right-0 h-1 bg-white/10 rounded-full overflow-hidden transition-all group-hover:h-1.5">
                                            <div
                                                className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                            />
                                        </div>
                                        {/* Playhead thumb */}
                                        <div
                                            className="absolute w-3 h-3 bg-white rounded-full shadow-lg shadow-black/50 opacity-0 group-hover:opacity-100 transition-opacity scale-0 group-hover:scale-100 ease-out z-10"
                                            style={{
                                                left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)`,
                                                top: '50%',
                                                transform: 'translateY(-50%)'
                                            }}
                                        />
                                    </div>

                                    <span className="text-[10px] font-mono text-slate-400 font-medium translate-y-px">
                                        {formatTime(duration)}
                                    </span>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

                

                {masteringSelection && (
                    <MasteringPanel
                        track={masteringSelection}
                        onClose={() => setMasteringSelection(null)}
                        onApply={(blob, preset) => {
                            const newUrl = URL.createObjectURL(blob);
                            const updatedTrack = {
                                ...masteringSelection,
                                audioUrl: newUrl,
                                tags: (masteringSelection.tags || '') + ` (Mastered: ${preset})`
                            };
                            setUserLibrary(prev => prev.map(t => t.id === masteringSelection.id ? updatedTrack : t));
                            setSessionTaskQueue(prev => prev.map(g => g.tracks ? { ...g, tracks: g.tracks.map(t => t.id === masteringSelection.id ? updatedTrack : t) } : g));
                            backendManager.saveTrack(updatedTrack);
                            soundManager.playSuccess();
                            setMasteringSelection(null);
                        }}
                    />
                )}

                {showPresetLibrary && (
                    <PresetLibrary
                        currentGenre={voiceStyle}
                        currentQuality={musicQuality}
                        onUsePreset={(preset) => {
                            setVoiceStyle(preset.style || 'Auto');
                            setMusicQuality(preset.quality || 'V3_5');
                            setInputText(prev => prev || `${preset.genre} ${preset.mood} song`);
                            setShowPresetLibrary(false);
                        }}
                        onClose={() => setShowPresetLibrary(false)}
                    />
                )}

                {showSessionHistory && (
                    <SessionHistory
                        library={userLibrary}
                        onRegenerate={(track) => {
                            setInputText(track.tags || track.title || '');
                            setShowSessionHistory(false);
                            setActiveTab('music');
                        }}
                        onPlay={(track) => {
                            if (activeTrackUrl === track.audioUrl) {
                                setIsPlaying(!isPlaying);
                            } else {
                                setActiveTrackUrl(track.audioUrl);
                                setIsPlaying(true);
                            }
                        }}
                        activeTrackUrl={activeTrackUrl}
                        isPlaying={isPlaying}
                        onClose={() => setShowSessionHistory(false)}
                    />
                )}

                {stemEffectsData && (
                    <React.Suspense fallback={null}>
                        <StemEffects
                            stemUrls={stemEffectsData.urls}
                            trackTitle={stemEffectsData.title}
                            onClose={() => setStemEffectsData(null)}
                        />
                    </React.Suspense>
                )}

                {shareModal.open && shareModal.track && (
                    <ShareModal
                        track={shareModal.track}
                        onClose={() => setShareModal({ open: false, track: null })}
                        onGenerateVideo={handleVideoGeneration}
                        onStemExport={handleStemExport}
                        onTikTokExport={handleTikTokExport}
                        exportLoading={exportLoading}
                    />
                )}

                {remixTrack && (
                    <React.Suspense fallback={
                        <div className="fixed inset-0 z-[120] bg-[#09090b] flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                        </div>
                    }>
                        <StemMixer track={remixTrack} onClose={() => setRemixTrack(null)}
                            onApplyMaster={(blob, preset) => {
                                const newUrl = URL.createObjectURL(blob);
                                const updatedTrack = {
                                    ...remixTrack,
                                    audioUrl: newUrl,
                                    tags: (remixTrack.tags || '') + ` (Mastered: ${preset})`
                                };
                                setUserLibrary(prev => prev.map(t => t.id === remixTrack.id ? updatedTrack : t));
                                setSessionTaskQueue(prev => prev.map(g => g.tracks ? { ...g, tracks: g.tracks.map(t => t.id === remixTrack.id ? updatedTrack : t) } : g));
                                backendManager.saveTrack(updatedTrack);
                                soundManager.playSuccess();
                            }}
                        />
                    </React.Suspense>
                )}

                {videoSettingsTrack && (
                    <React.Suspense fallback={
                        <div className="fixed inset-0 z-[130] bg-black/95 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                        </div>
                    }>
                        <VideoSettingsPanel
                            track={videoSettingsTrack}
                            apiKey={getKieKey()}
                            onClose={() => setVideoSettingsTrack(null)}
                            onVideoReady={(videoUrl) => {
                                const updated = { ...videoSettingsTrack, videoUrl };
                                setUserLibrary(prev => prev.map(t => t.id === videoSettingsTrack.id ? updated : t));
                                setSessionTaskQueue(prev => prev.map(g => g.tracks ? { ...g, tracks: g.tracks.map(t => t.id === videoSettingsTrack.id ? updated : t) } : g));
                                backendManager.saveTrack(updated);
                                soundManager.playSuccess();
                                setVideoSettingsTrack(null);
                            }}
                        />
                    </React.Suspense>
                )}

                

                {personaModal.open && (
                    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
                        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-lg w-full relative overflow-hidden shadow-2xl">
                            <button onClick={() => setPersonaModal(prev => ({ ...prev, open: false }))} className="absolute top-6 right-6 text-slate-500 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3 border-b border-white/5 pb-4">
                                <UserPlus className="w-6 h-6 text-indigo-400" /> Save Persona
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2.5 tracking-wider ml-1">Persona Name</label>
                                    <input
                                        value={personaModal.name}
                                        onChange={e => setPersonaModal(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full bg-slate-800 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                        placeholder="e.g. Cyber Diva"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2.5 tracking-wider ml-1">Description</label>
                                    <textarea
                                        value={personaModal.desc}
                                        onChange={e => setPersonaModal(prev => ({ ...prev, desc: e.target.value }))}
                                        className="w-full bg-slate-800 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500/50 h-28 resize-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2.5 tracking-wider ml-1">Custom Image (Optional)</label>
                                    <div className="flex items-center gap-5">
                                        <div className="w-20 h-20 rounded-2xl bg-slate-800 overflow-hidden border border-white/5 shadow-md">
                                            {(personaModal.customImage || personaModal.track?.imageUrl) && (
                                                <img src={personaModal.customImage || personaModal.track?.imageUrl} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <label className="px-5 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer transition-colors border border-white/5 hover:border-white/20 uppercase tracking-wide">
                                            Upload
                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        </label>
                                    </div>
                                </div>

                                <button
                                    onClick={submitPersona}
                                    disabled={isCreatingPersona || !personaModal.name}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all mt-4 shadow-lg shadow-indigo-600/20 text-sm uppercase tracking-wider"
                                >
                                    {isCreatingPersona ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Persona (1 Credit)"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}




                {/* ─── KEYBOARD SHORTCUTS MODAL ─── */}
                <DecoratedModal
                    isOpen={showShortcuts}
                    onClose={() => setShowShortcuts(false)}
                    title="Keyboard Shortcuts"
                    icon={<Keyboard className="w-6 h-6 text-cyan-400" />}
                    maxWidthClass="max-w-md"
                >
                    <div className="space-y-3 mt-2">
                        {[
                            { key: 'Space', desc: 'Play / Pause track' },
                            { key: 'N', desc: 'New track (open Studio)' },
                            { key: 'L', desc: 'Open Library' },
                            { key: '?', desc: 'Toggle this help' },
                            { key: 'Esc', desc: 'Close modals' },
                        ].map(s => (
                            <div key={s.key} className="flex items-center justify-between py-2 border-b border-white/5">
                                <span className="text-sm text-slate-300">{s.desc}</span>
                                <kbd className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-xs font-mono font-bold text-slate-400">{s.key}</kbd>
                            </div>
                        ))}
                    </div>
                </DecoratedModal>

                {/* ─── ONBOARDING TOUR ─── */}
                {showOnboarding && (
                    <div className="fixed inset-0 z-[210] bg-black/90 backdrop-blur-lg flex items-center justify-center p-6 animate-in fade-in duration-500">
                        <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-10 shadow-2xl text-center">
                            {[
                                { icon: Music2, title: 'Welcome to Aim8!', desc: 'Create professional music with AI. Just describe the sound you hear in your head — we\'ll handle the rest.', color: 'text-cyan-400' },
                                { icon: Database, title: 'Your Library', desc: 'All your tracks are saved automatically. Search, sort, and manage your growing music catalog.', color: 'text-purple-400' },
                                { icon: Mic, title: 'Live Voice Studio', desc: 'Talk to your AI producer in real-time — in any of 40+ languages. Generate music by voice.', color: 'text-amber-400' },
                            ].map((step, i) => i === onboardingStep && (
                                <div key={i} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mx-auto mb-6 border border-white/10`}>
                                        <step.icon className={`w-10 h-10 ${step.color}`} />
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-3">{step.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">{step.desc}</p>
                                </div>
                            ))}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === onboardingStep ? 'bg-cyan-400 w-6' : 'bg-slate-700'}`} />
                                ))}
                            </div>
                            <div className="flex items-center gap-3 justify-center">
                                <button onClick={dismissOnboarding} className="px-6 py-2.5 text-sm text-slate-500 hover:text-white transition-colors">Skip</button>
                                <button
                                    onClick={() => onboardingStep < 2 ? setOnboardingStep(prev => prev + 1) : dismissOnboarding()}
                                    className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-full hover:scale-105 transition-all shadow-lg shadow-cyan-500/20"
                                >
                                    {onboardingStep < 2 ? 'Next' : 'Get Started!'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── REFERRAL MODAL ─── */}
                <DecoratedModal
                    isOpen={showReferral}
                    onClose={() => setShowReferral(false)}
                    title="Invite Friends"
                    icon={<Gift className="w-6 h-6 text-amber-500" />}
                    maxWidthClass="max-w-md"
                >
                    <div className="text-center mb-6 mt-2">
                        <p className="text-slate-300 text-sm">Share your code — both you and your friend get <span className="text-amber-400 font-bold">2 free credits!</span></p>
                    </div>
                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-4 flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Your Referral Code</p>
                            <p className="text-2xl font-black text-white font-mono tracking-widest">{referralCode}</p>
                        </div>
                        <button
                            onClick={() => { navigator.clipboard.writeText(referralCode); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000); }}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${referralCopied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1]'}`}
                        >
                            {referralCopied ? '✓ Copied!' : 'Copy'}
                        </button>
                    </div>
                    <button
                        onClick={() => { const url = `${window.location.origin}?ref=${referralCode}`; navigator.clipboard.writeText(url); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000); }}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl hover:scale-[1.02] transition-all shadow-lg shadow-amber-500/20 text-sm"
                    >
                        Copy Invite Link
                    </button>
                </DecoratedModal>

                {/* ─── PLAYLIST MODAL ─── */}
                <DecoratedModal
                    isOpen={showPlaylistModal.open}
                    onClose={() => setShowPlaylistModal({ open: false })}
                    title="Playlists"
                    icon={<ListMusic className="w-6 h-6 text-purple-400" />}
                    maxWidthClass="max-w-md"
                >
                    <div className="mt-4">
                        {/* Create new */}
                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                placeholder="New playlist name..."
                                value={newPlaylistName}
                                onChange={e => setNewPlaylistName(e.target.value)}
                                className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
                                onKeyDown={e => e.key === 'Enter' && newPlaylistName.trim() && createPlaylist(newPlaylistName.trim())}
                            />
                            <button
                                onClick={() => newPlaylistName.trim() && createPlaylist(newPlaylistName.trim())}
                                disabled={!newPlaylistName.trim()}
                                className="px-4 py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-colors disabled:opacity-40 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        {/* List */}
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {playlists.length === 0 ? (
                                <p className="text-center text-slate-500 text-sm py-6">No playlists yet. Create one above!</p>
                            ) : playlists.map(pl => (
                                <div key={pl.id} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-all group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <ListMusic className="w-4 h-4 text-purple-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{pl.name}</p>
                                            <p className="text-[10px] text-slate-500">{pl.trackIds.length} tracks</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {showPlaylistModal.trackId && (
                                            <button
                                                onClick={() => { addToPlaylist(pl.id, showPlaylistModal.trackId!); setShowPlaylistModal({ open: false }); }}
                                                className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-500/30 transition-colors"
                                            >
                                                + Add
                                            </button>
                                        )}
                                        <button onClick={() => deletePlaylist(pl.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DecoratedModal>

                {/* ─── SESSION HISTORY ─── */}
                <DecoratedModal
                    isOpen={showSessionHistory}
                    onClose={() => setShowSessionHistory(false)}
                    title="Session History"
                    icon={<Clock className="w-6 h-6 text-amber-400" />}
                    maxWidthClass="max-w-lg"
                >
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 max-h-[60vh] mt-4">
                        {sessionHistory.length === 0 ? (
                            <div className="text-center py-12">
                                <Mic className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">No sessions yet. Start a Live Mode conversation!</p>
                            </div>
                        ) : sessionHistory.map(session => (
                            <div key={session.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-400">{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-[10px] text-slate-600">{session.transcript.length} messages</span>
                                </div>
                                <p className="text-sm text-slate-300 line-clamp-2">{session.transcript[0]?.text || 'Empty session'}</p>
                            </div>
                        ))}
                    </div>
                </DecoratedModal>

                {/* ─── PROMPT FAVORITES PANEL ─── */}
                <DecoratedModal
                    isOpen={showPromptFavorites}
                    onClose={() => setShowPromptFavorites(false)}
                    title="Saved Prompts"
                    icon={<Bookmark className="w-6 h-6 text-yellow-400" />}
                    maxWidthClass="max-w-md"
                >
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar mt-4">
                        {promptFavorites.length === 0 ? (
                            <p className="text-center text-slate-500 text-sm py-6">No saved prompts yet. Click the ★ when creating a track!</p>
                        ) : promptFavorites.map((prompt, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-all group">
                                <button
                                    onClick={() => { setInputText(prompt); setActiveTab('music'); setShowPromptFavorites(false); }}
                                    className="text-sm text-slate-300 text-left hover:text-white transition-colors flex-1"
                                >
                                    {prompt}
                                </button>
                                <button onClick={() => togglePromptFavorite(prompt)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100 mt-0.5">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </DecoratedModal>

            </div>
        </div >
    );
};

export default React.memo(VoiceStudio);
