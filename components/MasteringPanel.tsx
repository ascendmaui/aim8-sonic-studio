import React, { useState, useRef } from 'react';
import {
    Play, Pause, Download, Loader2, X, Check, RefreshCw, Volume2
} from './icons';
import { masterTrack, MasteringPreset, MASTERING_PRESETS } from '../services/masteringService';

interface MasteringPanelProps {
    track: { id: string; title: string; audioUrl: string; tags?: string };
    onClose: () => void;
    onApply: (blob: Blob, preset: MasteringPreset) => void;
}

const MasteringPanel: React.FC<MasteringPanelProps> = ({ track, onClose, onApply }) => {
    const [selectedPreset, setSelectedPreset] = useState<MasteringPreset>('studio');
    const [processing, setProcessing] = useState(false);
    const [masteredUrl, setMasteredUrl] = useState<string | null>(null);
    const [masteredBlob, setMasteredBlob] = useState<Blob | null>(null);
    const [abMode, setAbMode] = useState<'original' | 'mastered'>('original');
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleProcess = async () => {
        setProcessing(true);
        setMasteredUrl(null);
        try {
            const blob = await masterTrack(track.audioUrl, selectedPreset);
            const url = URL.createObjectURL(blob);
            setMasteredUrl(url);
            setMasteredBlob(blob);
            setAbMode('mastered');
        } catch (err) {
            console.error('Mastering failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (playing) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setPlaying(!playing);
    };

    const currentUrl = abMode === 'mastered' && masteredUrl ? masteredUrl : track.audioUrl;

    const handleApply = () => {
        if (masteredBlob) {
            onApply(masteredBlob, selectedPreset);
            onClose();
        }
    };

    const handleDownload = () => {
        if (!masteredUrl) return;
        const a = document.createElement('a');
        a.href = masteredUrl;
        a.download = `${track.title || 'track'}_mastered_${selectedPreset}.wav`;
        a.click();
    };

    const categories = ['classic', 'creative', 'specialized'] as const;
    const categoryLabels = { classic: 'Classic', creative: 'Creative', specialized: 'Specialized' };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            🎛️ Mastering Studio
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {track.title} — {track.tags}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Preset Grid */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {categories.map(cat => {
                        const presets = MASTERING_PRESETS.filter(p => p.category === cat);
                        return (
                            <div key={cat}>
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    {categoryLabels[cat]}
                                </h3>
                                <div className="grid grid-cols-5 gap-2">
                                    {presets.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedPreset(p.id)}
                                            className={`relative rounded-2xl p-3 text-center transition-all ${selectedPreset === p.id
                                                    ? 'bg-white/10 border-cyan-500/40 ring-1 ring-cyan-500/30 border'
                                                    : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.05]'
                                                }`}
                                        >
                                            <span className="text-2xl block mb-1">{p.icon}</span>
                                            <p className="text-xs font-bold text-white">{p.name}</p>
                                            <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>
                                            {selectedPreset === p.id && (
                                                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Player & Actions */}
                <div className="p-5 border-t border-white/5 space-y-3">
                    {/* A/B Toggle */}
                    {masteredUrl && (
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">A/B Compare</span>
                            <div className="flex gap-1 p-0.5 bg-slate-800 rounded-lg">
                                <button onClick={() => { setAbMode('original'); setPlaying(false); }}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${abMode === 'original' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>
                                    A · Original
                                </button>
                                <button onClick={() => { setAbMode('mastered'); setPlaying(false); }}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${abMode === 'mastered' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500'}`}>
                                    B · Mastered
                                </button>
                            </div>
                            <button onClick={togglePlay} className="ml-auto p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all">
                                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                        </div>
                    )}

                    <audio ref={audioRef} src={currentUrl} onEnded={() => setPlaying(false)} />

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button onClick={handleProcess} disabled={processing}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-bold hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50">
                            {processing ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                            ) : (
                                <><RefreshCw className="w-4 h-4" /> {masteredUrl ? 'Re-Master' : 'Master Track'}</>
                            )}
                        </button>

                        {masteredUrl && (
                            <>
                                <button onClick={handleApply}
                                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-all">
                                    <Check className="w-4 h-4" /> Apply
                                </button>
                                <button onClick={handleDownload}
                                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all">
                                    <Download className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasteringPanel;
