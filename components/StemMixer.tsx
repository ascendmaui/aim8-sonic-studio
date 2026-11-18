import React, { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import JSZip from 'jszip';

import {
    X, Play, Pause, Download, Loader2, Save, FileAudio, FileArchive, Check,
    Volume1, Volume2, VolumeX, Sliders, Waves, SkipBack, SkipForward,
    RefreshCw, Music2, Headphones, Repeat, AudioWaveform, Gauge
} from './icons';
import { SunoTrack } from '../types';
import { useAuth } from './AuthContext';
import { encodeToMp3 } from '../utils/mp3encoder';
import {
    StemEffectParams, DEFAULT_STEM_EFFECTS, bounceStemMix, StemName
} from '../services/stemEffectsService';
import {
    masterTrack, MasteringPreset, MASTERING_PRESETS
} from '../services/masteringService';

interface StemMixerProps {
    track: SunoTrack;
    onClose: () => void;
    onApplyMaster?: (blob: Blob, preset: MasteringPreset) => void;
}

interface StemData {
    name: string;
    label: string;
    blobUrl: string | null;
    buffer: AudioBuffer | null;
    color: string;
    colorHex: string;
    icon: string;
}

type StudioTab = 'tracks' | 'mixer' | 'master';

/* ═══════════════════════════════════════════════════════════════
   Helpers: Wav / MP3 Encoding
   ═══════════════════════════════════════════════════════════════ */
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

async function bufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2;
    const headerBuf = new ArrayBuffer(44);
    const hv = new DataView(headerBuf);
    writeString(hv, 0, 'RIFF');
    hv.setUint32(4, 36 + length, true);
    writeString(hv, 8, 'WAVE');
    writeString(hv, 12, 'fmt ');
    hv.setUint32(16, 16, true);
    hv.setUint16(20, 1, true);
    hv.setUint16(22, numChannels, true);
    hv.setUint32(24, buffer.sampleRate, true);
    hv.setUint32(28, buffer.sampleRate * numChannels * 2, true);
    hv.setUint16(32, numChannels * 2, true);
    hv.setUint16(34, 16, true);
    writeString(hv, 36, 'data');
    hv.setUint32(40, length, true);
    const wavData = new Uint8Array(headerBuf.byteLength + length);
    wavData.set(new Uint8Array(headerBuf), 0);
    const view = new DataView(wavData.buffer);
    const channels: Float32Array[] = [];
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

async function bufferToMp3(buffer: AudioBuffer): Promise<Blob> {
    const mp3Blob = await encodeToMp3(buffer);
    if (!mp3Blob) throw new Error('MP3 encoding unavailable');
    return mp3Blob;
}


/* ═══════════════════════════════════════════════════════════════
   Knob Component
   ═══════════════════════════════════════════════════════════════ */
const Knob: React.FC<{
    value: number; min: number; max: number; label: string; unit?: string;
    onChange: (v: number) => void; accentColor?: string; size?: 'sm' | 'md';
}> = ({ value, min, max, label, unit = '', onChange, accentColor = '#06b6d4', size = 'sm' }) => {
    const pct = ((value - min) / (max - min)) * 100;
    const circumference = 2 * Math.PI * 14;
    const strokeLen = (pct / 100) * circumference * 0.75; // 270-degree arc
    const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    const textSize = size === 'sm' ? 'text-[7px]' : 'text-[8px]';
    const labelSize = size === 'sm' ? 'text-[6px]' : 'text-[7px]';

    return (
        <div className="flex flex-col items-center gap-0.5 select-none">
            <div className={`relative ${dim} flex items-center justify-center`}>
                <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(135deg)' }}>
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
                        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`} strokeLinecap="round" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke={accentColor} strokeWidth="2.5"
                        strokeDasharray={`${strokeLen} ${circumference - strokeLen}`} strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.1s ease' }} />
                </svg>
                <span className={`absolute ${textSize} font-bold text-white/90 tabular-nums`}>
                    {typeof value === 'number' ? (value > 0 && unit === 'dB' ? `+${value}` : Math.round(value * 100) / 100) : value}
                </span>
            </div>
            <input type="range" min={min} max={max} step={max <= 2 ? 0.05 : 1} value={value} onChange={e => onChange(parseFloat(e.target.value))}
                className="w-10 h-0.5 appearance-none bg-white/5 rounded-full cursor-pointer [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white/70 hover:[&::-webkit-slider-thumb]:bg-white"
            />
            <span className={`${labelSize} text-white/30 font-bold uppercase tracking-wider`}>{label}</span>
        </div>
    );
};


/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
const StemMixer: React.FC<StemMixerProps> = ({ track, onClose, onApplyMaster }) => {
    const { user, isAdmin, features } = useAuth();

    // Loading / Status
    const [loading, setLoading] = useState(true);
    const [statusText, setStatusText] = useState("Downloading track...");

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLooping, setIsLooping] = useState(false);
    const isLoopingRef = useRef(false); // ref to avoid stale closure in WaveSurfer handlers
    const blobUrlsRef = useRef<string[]>([]); // track blob URLs for proper cleanup

    // UI State
    const [activeTab, setActiveTab] = useState<StudioTab>('tracks');
    const [showExport, setShowExport] = useState(false);
    const [exportProgress, setExportProgress] = useState<{ active: boolean; text: string; percent: number }>({ active: false, text: "", percent: 0 });

    // Stems
    const STEM_DEFS: StemData[] = [
        { name: 'vocals', label: 'Vocals', blobUrl: null, buffer: null, color: 'cyan', colorHex: '#06b6d4', icon: '🎤' },
        { name: 'drums', label: 'Drums', blobUrl: null, buffer: null, color: 'amber', colorHex: '#f59e0b', icon: '🥁' },
        { name: 'bass', label: 'Bass', blobUrl: null, buffer: null, color: 'violet', colorHex: '#8b5cf6', icon: '🎸' },
        { name: 'other', label: 'Synth/Other', blobUrl: null, buffer: null, color: 'emerald', colorHex: '#10b981', icon: '🎹' },
    ];
    const [stems, setStems] = useState<StemData[]>(STEM_DEFS);

    // Per-stem effects (the mixer parameters)
    const [effects, setEffects] = useState<Record<string, StemEffectParams>>({
        vocals: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
        drums: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
        bass: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
        other: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
    });

    // Mastering
    const [selectedPreset, setSelectedPreset] = useState<MasteringPreset>('studio');
    const [masterProcessing, setMasterProcessing] = useState(false);
    const [masteredUrl, setMasteredUrl] = useState<string | null>(null);
    const [masteredBlob, setMasteredBlob] = useState<Blob | null>(null);

    // Keep ref in sync with state
    useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

    // Audio refs
    const masterCtxRef = useRef<AudioContext | null>(null);
    const wavesurfersRef = useRef<Record<string, WaveSurfer>>({});
    const wavesurferContainersRef = useRef<Record<string, HTMLDivElement | null>>({});
    const mountedRef = useRef(true);
    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

    // ── Generate Stems on mount ──
    useEffect(() => {
        let isCancelled = false;

        const generateStems = async () => {
            try {
                setStatusText("Decoding original audio...");
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                masterCtxRef.current = ctx;
                const res = await fetch(track.audioUrl);
                if (isCancelled) { ctx.close(); return; }
                const ab = await res.arrayBuffer();
                if (isCancelled) { ctx.close(); return; }
                const decoded = await ctx.decodeAudioData(ab);
                if (isCancelled) { ctx.close(); return; }
                setDuration(decoded.duration);

                setStatusText("Separating stems (AI Engine DSP)...");

                const renderStem = async (type: string): Promise<{ buffer: AudioBuffer; blobUrl: string }> => {
                    const offCtx = new OfflineAudioContext(2, decoded.length, decoded.sampleRate);
                    const src = offCtx.createBufferSource();
                    src.buffer = decoded;

                    const filters: BiquadFilterNode[] = [];

                    if (type === 'vocals') {
                        const hp = offCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.5;
                        const pk = offCtx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3000; pk.Q.value = 1; pk.gain.value = 6;
                        filters.push(hp, pk);
                    }
                    if (type === 'drums') {
                        const hp = offCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
                        const pk = offCtx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 4000; pk.Q.value = 1.5; pk.gain.value = 4;
                        filters.push(hp, pk);
                    }
                    if (type === 'bass') {
                        const lp = offCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 250;
                        const hp = offCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40;
                        filters.push(lp, hp);
                    }
                    if (type === 'other') {
                        const bp = offCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.8;
                        filters.push(bp);
                    }

                    let lastNode: AudioNode = src;
                    for (const f of filters) {
                        lastNode.connect(f);
                        lastNode = f;
                    }
                    const comp = offCtx.createDynamicsCompressor();
                    comp.threshold.value = -24; comp.knee.value = 30; comp.ratio.value = 12;
                    comp.attack.value = 0.003; comp.release.value = 0.25;
                    lastNode.connect(comp);
                    comp.connect(offCtx.destination);
                    src.start();

                    const renderedBuffer = await offCtx.startRendering();
                    const wavBlob = await bufferToWav(renderedBuffer);
                    const blobUrl = URL.createObjectURL(wavBlob);
                    blobUrlsRef.current.push(blobUrl); // Track for cleanup
                    return { buffer: renderedBuffer, blobUrl };
                };

                const newStems = await Promise.all(STEM_DEFS.map(async (s) => {
                    const { buffer, blobUrl } = await renderStem(s.name);
                    return { ...s, buffer, blobUrl };
                }));

                if (isCancelled) {
                    // Revoke any URLs we just created
                    newStems.forEach(s => s.blobUrl && URL.revokeObjectURL(s.blobUrl));
                    ctx.close();
                    return;
                }
                setStems(newStems);
                setStatusText("Building Remix Studio...");
                setTimeout(() => {
                    if (!isCancelled) setLoading(false);
                }, 400);
            } catch (e) {
                console.error("Failed to generate stems:", e);
                if (!isCancelled) setStatusText("Engine Error. Please restart.");
            }
        };

        generateStems();

        return () => {
            isCancelled = true;
            // Destroy all WaveSurfer instances and clear refs
            Object.values(wavesurfersRef.current).forEach(ws => {
                try { ws.destroy(); } catch (_) { /* already destroyed */ }
            });
            wavesurfersRef.current = {};
            // Close audio context
            try { masterCtxRef.current?.close(); } catch (_) {}
            masterCtxRef.current = null;
            // Revoke all blob URLs
            blobUrlsRef.current.forEach(url => {
                try { URL.revokeObjectURL(url); } catch (_) {}
            });
            blobUrlsRef.current = [];
        };
    }, [track.audioUrl]);

    // ── Initialize WaveSurfers ──
    useEffect(() => {
        if (loading) return;

        const created: string[] = [];

        stems.forEach(stem => {
            const container = wavesurferContainersRef.current[stem.name];
            if (!container || !stem.blobUrl || wavesurfersRef.current[stem.name]) return;

            try {
                const ws = WaveSurfer.create({
                    container,
                    waveColor: stem.colorHex + '40',
                    progressColor: stem.colorHex + 'cc',
                    cursorColor: 'transparent',
                    barWidth: 2,
                    barGap: 1,
                    barRadius: 2,
                    height: 56,
                    normalize: true,
                    url: stem.blobUrl,
                    interact: false,
                });

                if (stem.name === 'vocals') {
                    ws.on('timeupdate', (ct) => {
                        if (mountedRef.current) setCurrentTime(ct);
                    });
                    ws.on('finish', () => {
                        if (!mountedRef.current) return;
                        if (isLoopingRef.current) {
                            Object.values(wavesurfersRef.current).forEach(w => {
                                try { w.setTime(0); w.play(); } catch (_) {}
                            });
                            setCurrentTime(0);
                        } else {
                            setIsPlaying(false);
                            setCurrentTime(0);
                            Object.values(wavesurfersRef.current).forEach(w => {
                                try { w.pause(); w.setTime(0); } catch (_) {}
                            });
                        }
                    });
                }

                wavesurfersRef.current[stem.name] = ws;
                created.push(stem.name);
            } catch (e) {
                console.error(`Failed to init WaveSurfer for ${stem.name}:`, e);
            }
        });

        return () => {
            // Clean up only wavesurfers created in THIS effect run
            created.forEach(name => {
                const ws = wavesurfersRef.current[name];
                if (ws) {
                    try { ws.destroy(); } catch (_) {}
                    delete wavesurfersRef.current[name];
                }
            });
        };
    }, [loading, stems]);

    // ── Sync volumes from effects ──
    useEffect(() => {
        const anySolo = Object.values(effects).some(e => e.solo);

        stems.forEach(stem => {
            const ws = wavesurfersRef.current[stem.name];
            if (!ws) return;
            const fx = effects[stem.name];
            if (!fx) return;

            let targetVol = fx.gain;
            if (fx.mute) targetVol = 0;
            if (anySolo && !fx.solo) targetVol = 0;
            try { ws.setVolume(Math.min(targetVol, 2)); } catch (_) {}
        });
    }, [effects, stems]);

    // ── Safe WaveSurfer helper ──
    const forEachWS = useCallback((fn: (ws: WaveSurfer) => void) => {
        Object.values(wavesurfersRef.current).forEach(ws => {
            try { fn(ws); } catch (_) {}
        });
    }, []);

    // ── Playback controls ──
    const playAll = useCallback(() => {
        forEachWS(ws => ws.play());
        setIsPlaying(true);
    }, [forEachWS]);

    const stopAll = useCallback(() => {
        forEachWS(ws => { ws.pause(); ws.setTime(0); });
        setCurrentTime(0);
        setIsPlaying(false);
    }, [forEachWS]);

    const pauseAll = useCallback(() => {
        forEachWS(ws => ws.pause());
        setIsPlaying(false);
    }, [forEachWS]);

    const togglePlay = () => isPlaying ? pauseAll() : playAll();

    const skipBack = () => {
        const t = Math.max(0, currentTime - 5);
        forEachWS(ws => ws.setTime(t));
        setCurrentTime(t);
    };

    const skipForward = () => {
        const t = Math.min(duration, currentTime + 5);
        forEachWS(ws => ws.setTime(t));
        setCurrentTime(t);
    };

    const handleGlobalSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetTime = p * (duration || 1);
        forEachWS(ws => ws.setTime(targetTime));
        setCurrentTime(targetTime);
    };

    // ── Effects helpers ──
    const updateEffect = (stem: string, key: keyof StemEffectParams, value: any) => {
        setEffects(prev => ({ ...prev, [stem]: { ...prev[stem], [key]: value } }));
    };

    const resetEffects = () => {
        setEffects({
            vocals: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
            drums: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
            bass: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
            other: { ...DEFAULT_STEM_EFFECTS, gain: 0.85 },
        });
    };

    // ── Mastering ──
    const handleMaster = async () => {
        setMasterProcessing(true);
        setMasteredUrl(null);
        try {
            const blob = await masterTrack(track.audioUrl, selectedPreset);
            const url = URL.createObjectURL(blob);
            setMasteredUrl(url);
            setMasteredBlob(blob);
        } catch (err) {
            console.error('Mastering failed:', err);
        } finally {
            setMasterProcessing(false);
        }
    };

    const handleApplyMaster = () => {
        if (masteredBlob && onApplyMaster) {
            onApplyMaster(masteredBlob, selectedPreset);
        }
    };

    // ── Formatting ──
    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60).toString().padStart(2, '0');
        const ms = Math.floor((t % 1) * 10);
        return `${m}:${s}.${ms}`;
    };

    const formatTimeShort = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // ── Export Engine ──
    const triggerDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    const exportStem = async (stem: StemData, format: 'wav' | 'mp3') => {
        if (!isAdmin) {
            if (format === 'wav' && features.requireProForWav && !user?.isPro) {
                alert("PRO subscription required for high-res WAV exports."); return;
            }
            if (features.stemCreditCost > 0 && !user?.isPro) {
                if (!confirm(`Exporting this stem costs ${features.stemCreditCost} credits. Proceed?`)) return;
            }
        }
        if (!stem.buffer) return;
        setExportProgress({ active: true, text: `Encoding ${stem.label}...`, percent: 30 });
        try {
            let blob: Blob;
            let actualFormat = format;
            if (format === 'mp3') {
                const mp3Blob = await encodeToMp3(stem.buffer);
                if (mp3Blob) {
                    blob = mp3Blob;
                } else {
                    // Fallback to WAV if MP3 encoder unavailable
                    blob = await bufferToWav(stem.buffer);
                    actualFormat = 'wav';
                }
            } else {
                blob = await bufferToWav(stem.buffer);
            }
            const safeTitle = (track.title || "Remix").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            triggerDownload(blob, `${safeTitle}_${stem.name}.${actualFormat}`);
        } catch (e) {
            console.error(e); alert("Export failed. Please try again.");
        } finally {
            setExportProgress({ active: false, text: "", percent: 0 });
            setShowExport(false);
        }
    };

    const buildStemMaps = () => {
        const stemUrls: Record<StemName, string> = {} as any;
        const effectsMap: Record<StemName, StemEffectParams> = {} as any;
        let validCount = 0;
        for (const s of stems) {
            if (s.blobUrl) {
                stemUrls[s.name as StemName] = s.blobUrl;
                validCount++;
            }
            effectsMap[s.name as StemName] = effects[s.name] || DEFAULT_STEM_EFFECTS;
        }
        return { stemUrls, effectsMap, validCount };
    };

    const exportMixdown = async () => {
        if (!isAdmin && features.requireProForWav && !user?.isPro) {
            alert("PRO subscription required for mixdown exports."); return;
        }
        const { stemUrls, effectsMap, validCount } = buildStemMaps();
        if (validCount === 0) { alert("No stems available to export."); return; }

        setExportProgress({ active: true, text: "Bouncing mixdown with effects...", percent: 10 });
        try {
            setExportProgress({ active: true, text: "Applying effects & rendering...", percent: 40 });
            const blob = await bounceStemMix(stemUrls, effectsMap);
            if (!blob || blob.size === 0) throw new Error("Mixdown produced no audio data. Please try again.");
            const safeTitle = (track.title || "Remix").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            triggerDownload(blob, `${safeTitle}_mixdown.wav`);
        } catch (e) {
            console.error("Mixdown export failed:", e);
            alert("Mixdown export failed. Please try again.");
        } finally {
            setExportProgress({ active: false, text: "", percent: 0 });
            setShowExport(false);
        }
    };

    const exportStudioPack = async () => {
        if (!isAdmin && features.requireProForWav && !user?.isPro) {
            alert("PRO subscription required for Full Studio Pack."); return;
        }
        const { stemUrls, effectsMap, validCount } = buildStemMaps();
        if (validCount === 0) { alert("No stems available to export."); return; }

        setExportProgress({ active: true, text: "Creating Studio Pack...", percent: 5 });
        try {
            const zip = new JSZip();
            const safeTitle = (track.title || "Remix").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const folder = zip.folder(`${safeTitle}_studio_pack`);
            if (!folder) throw new Error("Could not create zip folder");

            for (let i = 0; i < stems.length; i++) {
                const s = stems[i];
                if (s.buffer) {
                    setExportProgress({ active: true, text: `Encoding ${s.label} WAV...`, percent: 10 + (i * 20) });
                    const wavBlob = await bufferToWav(s.buffer);
                    folder.file(`${s.name}.wav`, wavBlob);
                }
            }

            // Also bounce the mixdown into the pack
            setExportProgress({ active: true, text: "Bouncing mixdown...", percent: 80 });
            const mixBlob = await bounceStemMix(stemUrls, effectsMap);
            if (!mixBlob || mixBlob.size === 0) throw new Error("Mixdown produced no audio data.");
            folder.file('mixdown.wav', mixBlob);

            setExportProgress({ active: true, text: "Packaging ZIP...", percent: 90 });
            const zipBlob = await zip.generateAsync({ type: "blob" });
            triggerDownload(zipBlob, `${safeTitle}_studio_pack.zip`);
        } catch (e) {
            console.error("Studio Pack export failed:", e);
            alert("Studio Pack export failed. Please try again.");
        } finally {
            setExportProgress({ active: false, text: "", percent: 0 });
            setShowExport(false);
        }
    };

    /* ═══════════════════════════════════════════════════════════════
       Render
       ═══════════════════════════════════════════════════════════════ */
    return (
        <div className="fixed inset-0 z-[120] bg-[#09090b] text-white flex flex-col animate-in fade-in duration-300">
            {/* ── Header ── */}
            <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06] flex items-center justify-between bg-[#0a0a0c] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-950/30 via-transparent to-purple-950/30 pointer-events-none" />

                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {track.imageUrl ? (<img src={track.imageUrl} className="w-full h-full object-cover" alt="" />) : (<span className="text-lg">🎵</span>)}
                    </div>
                    <div>
                        <h2 className="text-sm font-black tracking-tight flex items-center gap-2">
                            Remix Studio
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/20 uppercase tracking-[0.15em] font-bold">PRO</span>
                        </h2>
                        <p className="text-[11px] text-white/40 truncate max-w-[200px]">{track.title} · {duration > 0 ? formatTimeShort(duration) : '--:--'}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-white/[0.03] rounded-lg border border-white/[0.06] p-0.5 relative z-10">
                    {([
                        { id: 'tracks' as StudioTab, label: 'Tracks', icon: <AudioWaveform className="w-3.5 h-3.5" /> },
                        { id: 'mixer' as StudioTab, label: 'Mixer', icon: <Sliders className="w-3.5 h-3.5" /> },
                        { id: 'master' as StudioTab, label: 'Master', icon: <Gauge className="w-3.5 h-3.5" /> },
                    ]).map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${activeTab === tab.id
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-white/40 hover:text-white/60'
                            }`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 relative z-10">
                    <button onClick={() => setShowExport(!showExport)} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 font-bold text-[11px] shadow-lg shadow-purple-500/20 transition-all disabled:opacity-40">
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Export Dropdown ── */}
            {showExport && !loading && (
                <div className="absolute top-14 right-5 w-72 bg-[#141418] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2.5 border-b border-white/[0.04]">
                        <h3 className="font-bold text-xs text-white/80">Export Studio Files</h3>
                    </div>
                    {exportProgress.active ? (
                        <div className="p-5 flex flex-col items-center justify-center gap-3 text-center">
                            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                            <div className="w-full">
                                <p className="text-[11px] font-bold text-white/80 mb-2">{exportProgress.text}</p>
                                <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full transition-all duration-500" style={{ width: `${exportProgress.percent}%` }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {/* Mixdown */}
                            <button onClick={exportMixdown}
                                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gradient-to-r from-cyan-500/[0.08] to-blue-500/[0.08] hover:from-cyan-500/15 hover:to-blue-500/15 border border-cyan-500/10 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <Waves className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-cyan-100 text-[11px]">Bounce Mixdown</p>
                                    <p className="text-[9px] text-cyan-400/50">WAV with all effects applied</p>
                                </div>
                            </button>

                            {/* Studio Pack */}
                            <button onClick={exportStudioPack}
                                className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-gradient-to-r from-purple-500/[0.08] to-violet-500/[0.08] hover:from-purple-500/15 hover:to-violet-500/15 border border-purple-500/10 transition-all text-left group">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <FileArchive className="w-4 h-4 text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-purple-100 text-[11px]">Studio Pack</p>
                                    <p className="text-[9px] text-purple-400/50">.ZIP — 4 stems + mixdown WAV</p>
                                </div>
                            </button>

                            {/* Individual stems */}
                            <div className="pt-1 mt-1 border-t border-white/[0.04]">
                                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest px-2 mb-1">Individual Stems</p>
                                {stems.map(stem => (
                                    <div key={stem.name} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.03] group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{stem.icon}</span>
                                            <span className="text-[11px] text-white/60">{stem.label}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => exportStem(stem, 'mp3')} className="px-1.5 py-0.5 text-[9px] font-bold bg-white/[0.06] hover:bg-white/10 rounded text-white/60 hover:text-white">MP3</button>
                                            <button onClick={() => exportStem(stem, 'wav')} className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 rounded">WAV</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Mastered */}
                            {masteredUrl && (
                                <div className="pt-1 mt-1 border-t border-white/[0.04]">
                                    <button onClick={() => { if (masteredUrl) { const a = document.createElement('a'); a.href = masteredUrl; a.download = `${(track.title || 'track').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_mastered.wav`; a.click(); } }}
                                        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-500/[0.08] hover:bg-emerald-500/15 border border-emerald-500/10 transition-all text-left">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                            <Headphones className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-emerald-100 text-[11px]">Mastered Track</p>
                                            <p className="text-[9px] text-emerald-400/50">{selectedPreset} preset — WAV</p>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Content ── */}
            <div className="flex-1 overflow-y-auto bg-[#09090b]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-black text-white mb-1">Initializing Studio</h3>
                            <p className="font-mono text-[11px] text-white/40">{statusText}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ═══ TRACKS TAB ═══ */}
                        {activeTab === 'tracks' && (
                            <div className="p-4 md:p-5 pb-28">
                                <div className="max-w-6xl mx-auto space-y-3">
                                    {/* Timeline */}
                                    <div className="flex items-center bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2 sticky top-0 z-20 backdrop-blur-xl">
                                        <div className="w-[180px] flex-shrink-0 text-[9px] font-mono text-white/30 uppercase tracking-widest">
                                            Channels
                                        </div>
                                        <div className="flex-1 relative h-5 bg-black/40 rounded-md border border-white/[0.04] cursor-pointer group" onClick={handleGlobalSeek}>
                                            {duration > 0 && Array.from({ length: Math.ceil(duration / 10) + 1 }).map((_, i) => (
                                                <div key={i} className="absolute top-0 h-full border-l border-white/[0.06]" style={{ left: `${(i * 10 / duration) * 100}%` }}>
                                                    <span className="absolute top-0.5 ml-1 text-[7px] text-white/20 font-mono">{formatTimeShort(i * 10)}</span>
                                                </div>
                                            ))}
                                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none transition-[left] duration-75" style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}>
                                                <div className="absolute -top-1 -left-[3px] w-[7px] h-[7px] bg-red-500 rounded-full" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stem Tracks */}
                                    {stems.map((stem) => {
                                        const fx = effects[stem.name];
                                        const anySolo = Object.values(effects).some(e => e.solo);
                                        const isDimmed = fx?.mute || (anySolo && !fx?.solo);

                                        return (
                                            <div key={stem.name} className={`flex h-[72px] bg-[#0f0f12] border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-200 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
                                                {/* Track Header */}
                                                <div className="w-[180px] flex-shrink-0 bg-[#111115] border-r border-white/[0.06] p-2.5 flex flex-col justify-between relative">
                                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full" style={{ backgroundColor: stem.colorHex }} />

                                                    <div className="flex items-center justify-between ml-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm">{stem.icon}</span>
                                                            <span className="font-bold text-[11px] text-white/90">{stem.label}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 ml-2">
                                                        <button onClick={() => updateEffect(stem.name, 'mute', !fx?.mute)}
                                                            className={`w-6 h-6 rounded text-[9px] font-black transition-all ${fx?.mute ? 'bg-red-500/90 text-white' : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/60'}`}>M</button>
                                                        <button onClick={() => updateEffect(stem.name, 'solo', !fx?.solo)}
                                                            className={`w-6 h-6 rounded text-[9px] font-black transition-all ${fx?.solo ? 'bg-amber-400/90 text-black' : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/60'}`}>S</button>

                                                        <div className="flex-1 flex items-center gap-1.5 ml-1">
                                                            <Volume1 className="w-3 h-3 text-white/20 flex-shrink-0" />
                                                            <input type="range" min="0" max="1.5" step="0.01" value={fx?.gain ?? 0.85}
                                                                onChange={e => updateEffect(stem.name, 'gain', parseFloat(e.target.value))}
                                                                className="w-full h-[3px] bg-white/[0.06] rounded-full appearance-none cursor-ew-resize [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                                                                style={{ accentColor: stem.colorHex }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Waveform */}
                                                <div className="flex-1 relative bg-[#0b0b0e] group overflow-hidden">
                                                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/15 pointer-events-none z-10 transition-[left] duration-75"
                                                        style={{ left: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%` }} />
                                                    <div ref={el => { wavesurferContainersRef.current[stem.name] = el; }} className="w-full h-full" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ═══ MIXER TAB ═══ */}
                        {activeTab === 'mixer' && (
                            <div className="p-4 md:p-6 pb-28">
                                <div className="max-w-5xl mx-auto">
                                    {/* Mixer Header */}
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-2">
                                            <Sliders className="w-4 h-4 text-white/30" />
                                            <h3 className="text-sm font-black text-white/80">Channel Mixer</h3>
                                        </div>
                                        <button onClick={resetEffects} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] font-bold text-white/40 hover:text-white/70 transition-all">
                                            <RefreshCw className="w-3 h-3" /> Reset All
                                        </button>
                                    </div>

                                    {/* Channel Strips */}
                                    <div className="grid grid-cols-4 gap-3">
                                        {stems.map((stem) => {
                                            const fx = effects[stem.name] || DEFAULT_STEM_EFFECTS;
                                            const anySolo = Object.values(effects).some(e => e.solo);
                                            const isActive = !fx.mute && (!anySolo || fx.solo);

                                            return (
                                                <div key={stem.name}
                                                    className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col items-center gap-3 ${isActive
                                                        ? 'bg-white/[0.02] border-white/[0.08]'
                                                        : 'bg-white/[0.01] border-white/[0.04] opacity-35'
                                                    }`}>
                                                    {/* Label */}
                                                    <div className="text-center">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1" style={{ backgroundColor: stem.colorHex + '15', border: `1px solid ${stem.colorHex}30` }}>
                                                            <span className="text-xl">{stem.icon}</span>
                                                        </div>
                                                        <p className="text-[10px] font-black text-white/70 uppercase tracking-wider">{stem.label}</p>
                                                    </div>

                                                    {/* Solo / Mute */}
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => updateEffect(stem.name, 'solo', !fx.solo)}
                                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all ${fx.solo ? 'bg-amber-400 text-black shadow-md shadow-amber-500/30' : 'bg-white/[0.04] text-white/30 hover:text-white/60'}`}>S</button>
                                                        <button onClick={() => updateEffect(stem.name, 'mute', !fx.mute)}
                                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all ${fx.mute ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : 'bg-white/[0.04] text-white/30 hover:text-white/60'}`}>M</button>
                                                    </div>

                                                    {/* Volume */}
                                                    <div className="flex flex-col items-center gap-1 w-full">
                                                        <span className="text-[7px] text-white/25 font-bold uppercase tracking-widest">Volume</span>
                                                        <div className="h-24 flex items-center justify-center relative">
                                                            <input type="range" min={0} max={2} step={0.02} value={fx.gain}
                                                                onChange={e => updateEffect(stem.name, 'gain', parseFloat(e.target.value))}
                                                                className="h-20 appearance-none bg-transparent cursor-pointer [writing-mode:vertical-lr] [-webkit-appearance:slider-vertical] rotate-180"
                                                                style={{ WebkitAppearance: 'slider-vertical' as any, accentColor: stem.colorHex }} />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white/60 tabular-nums">{Math.round(fx.gain * 100)}%</span>
                                                    </div>

                                                    {/* Pan */}
                                                    <Knob value={fx.pan} min={-1} max={1} label="Pan"
                                                        onChange={v => updateEffect(stem.name, 'pan', Math.round(v * 100) / 100)}
                                                        accentColor={stem.colorHex} />

                                                    {/* EQ */}
                                                    <div className="w-full">
                                                        <p className="text-[7px] text-white/20 font-bold uppercase text-center tracking-[0.2em] mb-2">EQ</p>
                                                        <div className="flex justify-center gap-2">
                                                            <Knob value={fx.eqLow} min={-12} max={12} label="Lo" unit="dB"
                                                                onChange={v => updateEffect(stem.name, 'eqLow', Math.round(v))} accentColor="#f59e0b" />
                                                            <Knob value={fx.eqMid} min={-12} max={12} label="Mid" unit="dB"
                                                                onChange={v => updateEffect(stem.name, 'eqMid', Math.round(v))} accentColor="#10b981" />
                                                            <Knob value={fx.eqHigh} min={-12} max={12} label="Hi" unit="dB"
                                                                onChange={v => updateEffect(stem.name, 'eqHigh', Math.round(v))} accentColor="#06b6d4" />
                                                        </div>
                                                    </div>

                                                    {/* Sends */}
                                                    <div className="w-full border-t border-white/[0.04] pt-3">
                                                        <p className="text-[7px] text-white/20 font-bold uppercase text-center tracking-[0.2em] mb-2">Sends</p>
                                                        <div className="flex justify-center gap-3">
                                                            <Knob value={fx.reverbSend} min={0} max={1} label="Verb"
                                                                onChange={v => updateEffect(stem.name, 'reverbSend', Math.round(v * 100) / 100)} accentColor="#8b5cf6" />
                                                            <Knob value={fx.delaySend} min={0} max={1} label="Delay"
                                                                onChange={v => updateEffect(stem.name, 'delaySend', Math.round(v * 100) / 100)} accentColor="#ec4899" />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Bounce Button */}
                                    <div className="mt-5">
                                        <button onClick={exportMixdown} disabled={exportProgress.active}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-600/80 to-purple-600/80 hover:from-cyan-500/90 hover:to-purple-500/90 text-white text-[12px] font-bold shadow-lg shadow-purple-500/10 transition-all disabled:opacity-40">
                                            {exportProgress.active ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Bouncing...</>
                                            ) : (
                                                <><Download className="w-4 h-4" /> Bounce Mixdown with Effects</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ MASTER TAB ═══ */}
                        {activeTab === 'master' && (
                            <div className="p-4 md:p-6 pb-28">
                                <div className="max-w-4xl mx-auto">
                                    {/* Master Header */}
                                    <div className="flex items-center gap-2 mb-5">
                                        <Gauge className="w-4 h-4 text-white/30" />
                                        <h3 className="text-sm font-black text-white/80">Mastering Suite</h3>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">AI-Powered</span>
                                    </div>

                                    {/* Preset Grid */}
                                    {(['classic', 'creative', 'specialized'] as const).map(cat => {
                                        const presets = MASTERING_PRESETS.filter(p => p.category === cat);
                                        const labels = { classic: 'Classic', creative: 'Creative', specialized: 'Specialized' };
                                        return (
                                            <div key={cat} className="mb-4">
                                                <h4 className="text-[9px] font-bold text-white/25 uppercase tracking-[0.2em] mb-2">{labels[cat]}</h4>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {presets.map(p => (
                                                        <button key={p.id} onClick={() => setSelectedPreset(p.id)}
                                                            className={`relative rounded-xl p-3 text-center transition-all group ${selectedPreset === p.id
                                                                ? 'bg-white/[0.08] border-cyan-500/30 ring-1 ring-cyan-500/20 border shadow-lg shadow-cyan-500/5'
                                                                : 'bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04]'
                                                            }`}>
                                                            <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">{p.icon}</span>
                                                            <p className="text-[10px] font-bold text-white/80">{p.name}</p>
                                                            <p className="text-[8px] text-white/30 mt-0.5 line-clamp-1">{p.description}</p>
                                                            {selectedPreset === p.id && (
                                                                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-cyan-500 flex items-center justify-center">
                                                                    <Check className="w-2 h-2 text-white" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Actions */}
                                    <div className="mt-6 flex items-center gap-2">
                                        <button onClick={handleMaster} disabled={masterProcessing}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-600/80 to-purple-600/80 hover:from-cyan-500/90 hover:to-purple-500/90 text-white text-[12px] font-bold shadow-lg shadow-cyan-500/10 transition-all disabled:opacity-40">
                                            {masterProcessing ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                            ) : (
                                                <><Waves className="w-4 h-4" /> {masteredUrl ? 'Re-Master' : 'Master Track'}</>
                                            )}
                                        </button>

                                        {masteredUrl && (
                                            <>
                                                {onApplyMaster && (
                                                    <button onClick={handleApplyMaster}
                                                        className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 transition-all">
                                                        <Check className="w-3.5 h-3.5" /> Apply
                                                    </button>
                                                )}
                                                <button onClick={() => {
                                                    if (masteredUrl) {
                                                        const a = document.createElement('a');
                                                        a.href = masteredUrl;
                                                        a.download = `${(track.title || 'track').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_mastered_${selectedPreset}.wav`;
                                                        a.click();
                                                    }
                                                }}
                                                    className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Mastered Success State */}
                                    {masteredUrl && !masterProcessing && (
                                        <div className="mt-4 p-4 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/10 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                                <Check className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-emerald-300">Mastering Complete</p>
                                                <p className="text-[10px] text-emerald-400/50 mt-0.5">
                                                    Preset: {MASTERING_PRESETS.find(p => p.id === selectedPreset)?.name} — Ready for download or apply
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Floating Transport Bar ── */}
            <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#141418]/95 backdrop-blur-2xl border border-white/[0.08] px-5 md:px-6 py-2.5 md:py-3 rounded-2xl shadow-2xl shadow-black/50 z-[125] animate-in slide-in-from-bottom-4 duration-300">
                {/* Time display */}
                <span className="text-lg font-mono text-cyan-400 w-16 text-right shrink-0 tabular-nums tracking-tight">{formatTime(currentTime)}</span>

                <div className="w-px h-6 bg-white/[0.06]" />

                {/* Controls */}
                <button onClick={skipBack} disabled={loading} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all" title="Skip back 5s">
                    <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button onClick={stopAll} disabled={loading} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all" title="Stop">
                    <div className="w-2.5 h-2.5 bg-white/70 rounded-sm" />
                </button>

                <button onClick={togglePlay} disabled={loading}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <button onClick={skipForward} disabled={loading} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all" title="Skip forward 5s">
                    <SkipForward className="w-3.5 h-3.5" />
                </button>

                <button onClick={() => setIsLooping(!isLooping)} disabled={loading}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isLooping ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.03] text-white/30 hover:bg-white/[0.08] hover:text-white/60'}`} title="Loop">
                    <Repeat className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-6 bg-white/[0.06]" />

                <span className="text-sm font-mono text-white/30 w-16 shrink-0 tabular-nums">{formatTimeShort(duration)}</span>
            </div>
        </div>
    );
};

export default StemMixer;
