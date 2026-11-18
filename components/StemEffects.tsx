import React, { useState, useRef, useEffect } from 'react';
import {
    Play, Pause, Download, Loader2, X, Volume2, VolumeX,
    RefreshCw, Music2
} from './icons';
import {
    StemEffectParams, DEFAULT_STEM_EFFECTS, StemName, STEM_COLORS, STEM_ICONS,
    bounceStemMix
} from '../services/stemEffectsService';

interface StemEffectsProps {
    stemUrls: Record<StemName, string>;
    trackTitle: string;
    onClose: () => void;
}

const Knob: React.FC<{
    value: number; min: number; max: number; label: string; unit?: string;
    onChange: (v: number) => void; color?: string;
}> = ({ value, min, max, label, unit = '', onChange, color = 'cyan' }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value));
    };
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/5" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className={`text-${color}-400`}
                        strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                </svg>
                <span className="absolute text-[8px] font-bold text-white">{typeof value === 'number' ? (value > 0 && unit === 'dB' ? `+${value}` : value) : value}{unit && <span className="text-slate-500 text-[6px]">{unit}</span>}</span>
            </div>
            <input type="range" min={min} max={max} step={max <= 2 ? 0.05 : 1} value={value} onChange={handleChange}
                className="w-12 h-1 appearance-none bg-white/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-cyan-400" />
            <span className="text-[8px] text-slate-500 font-bold uppercase">{label}</span>
        </div>
    );
};

const StemEffects: React.FC<StemEffectsProps> = ({ stemUrls, trackTitle, onClose }) => {
    const [effects, setEffects] = useState<Record<StemName, StemEffectParams>>({
        vocals: { ...DEFAULT_STEM_EFFECTS },
        drums: { ...DEFAULT_STEM_EFFECTS },
        bass: { ...DEFAULT_STEM_EFFECTS },
        other: { ...DEFAULT_STEM_EFFECTS },
    });
    const [bouncing, setBouncing] = useState(false);
    const [playingStem, setPlayingStem] = useState<StemName | null>(null);
    const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

    const stemNames: StemName[] = ['vocals', 'drums', 'bass', 'other'];

    const updateEffect = (stem: StemName, key: keyof StemEffectParams, value: any) => {
        setEffects(prev => ({
            ...prev,
            [stem]: { ...prev[stem], [key]: value }
        }));
    };

    const toggleMute = (stem: StemName) => updateEffect(stem, 'mute', !effects[stem].mute);
    const toggleSolo = (stem: StemName) => updateEffect(stem, 'solo', !effects[stem].solo);

    const handlePreview = (stem: StemName) => {
        if (playingStem === stem) {
            audioRefs.current[stem]?.pause();
            setPlayingStem(null);
            return;
        }
        // Pause all
        (Object.values(audioRefs.current) as HTMLAudioElement[]).forEach(a => a?.pause());
        if (audioRefs.current[stem]) {
            audioRefs.current[stem].currentTime = 0;
            audioRefs.current[stem].play();
        }
        setPlayingStem(stem);
    };

    const handleBounce = async () => {
        setBouncing(true);
        try {
            const blob = await bounceStemMix(stemUrls, effects);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${trackTitle || 'mix'}_stem_mix.wav`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Bounce failed:', err);
            alert('Stem mix bounce failed. Please try again.');
        } finally {
            setBouncing(false);
        }
    };

    const resetAll = () => {
        setEffects({
            vocals: { ...DEFAULT_STEM_EFFECTS },
            drums: { ...DEFAULT_STEM_EFFECTS },
            bass: { ...DEFAULT_STEM_EFFECTS },
            other: { ...DEFAULT_STEM_EFFECTS },
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
                            <Music2 className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Stem Mixer</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                {trackTitle} — 4 stems
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-400 hover:text-white transition-all">
                            <RefreshCw className="w-3 h-3" /> Reset
                        </button>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stem Channels */}
                <div className="flex-1 overflow-x-auto p-5">
                    <div className="grid grid-cols-4 gap-4 min-w-[600px]">
                        {stemNames.map(stem => {
                            const fx = effects[stem];
                            const isMuted = fx.mute;
                            const isSoloed = fx.solo;
                            const hasSolo = (Object.values(effects) as StemEffectParams[]).some(e => e.solo);
                            const isActive = !isMuted && (!hasSolo || isSoloed);

                            return (
                                <div key={stem}
                                    className={`rounded-2xl border p-4 space-y-4 transition-all ${isActive
                                        ? 'bg-white/[0.03] border-white/10'
                                        : 'bg-white/[0.01] border-white/5 opacity-40'
                                        }`}>
                                    {/* Label */}
                                    <div className="text-center space-y-1">
                                        <span className="text-2xl block">{STEM_ICONS[stem]}</span>
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">{stem}</p>
                                    </div>

                                    {/* Solo / Mute */}
                                    <div className="flex justify-center gap-1.5">
                                        <button onClick={() => toggleSolo(stem)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${isSoloed ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-500 hover:text-white'
                                                }`}>S</button>
                                        <button onClick={() => toggleMute(stem)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                                                }`}>M</button>
                                    </div>

                                    {/* Volume Fader */}
                                    <div className="flex flex-col items-center space-y-1">
                                        <span className="text-[8px] text-slate-500 font-bold uppercase">Vol</span>
                                        <input type="range" min={0} max={2} step={0.05} value={fx.gain}
                                            onChange={e => updateEffect(stem, 'gain', parseFloat(e.target.value))}
                                            className="w-full h-20 appearance-none bg-transparent cursor-pointer writing-mode-vertical [writing-mode:vertical-lr] [-webkit-appearance:slider-vertical] rotate-180"
                                            style={{ WebkitAppearance: 'slider-vertical' as any }} />
                                        <span className="text-[9px] font-bold text-white">{Math.round(fx.gain * 100)}%</span>
                                    </div>

                                    {/* Pan */}
                                    <Knob value={fx.pan} min={-1} max={1} label="Pan"
                                        onChange={v => updateEffect(stem, 'pan', Math.round(v * 100) / 100)} />

                                    {/* EQ */}
                                    <div className="space-y-1.5">
                                        <p className="text-[8px] text-slate-500 font-bold uppercase text-center tracking-widest">EQ</p>
                                        <div className="flex justify-center gap-2">
                                            <Knob value={fx.eqLow} min={-12} max={12} label="Low" unit="dB"
                                                onChange={v => updateEffect(stem, 'eqLow', Math.round(v))} />
                                            <Knob value={fx.eqMid} min={-12} max={12} label="Mid" unit="dB"
                                                onChange={v => updateEffect(stem, 'eqMid', Math.round(v))} />
                                            <Knob value={fx.eqHigh} min={-12} max={12} label="Hi" unit="dB"
                                                onChange={v => updateEffect(stem, 'eqHigh', Math.round(v))} />
                                        </div>
                                    </div>

                                    {/* Sends */}
                                    <div className="flex justify-center gap-3">
                                        <Knob value={fx.reverbSend} min={0} max={1} label="Reverb"
                                            onChange={v => updateEffect(stem, 'reverbSend', Math.round(v * 100) / 100)} />
                                        <Knob value={fx.delaySend} min={0} max={1} label="Delay"
                                            onChange={v => updateEffect(stem, 'delaySend', Math.round(v * 100) / 100)} />
                                    </div>

                                    {/* Preview */}
                                    <button onClick={() => handlePreview(stem)}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-all">
                                        {playingStem === stem ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                        {playingStem === stem ? 'Stop' : 'Preview'}
                                    </button>

                                    {/* Hidden audio */}
                                    <audio
                                        ref={el => { if (el) audioRefs.current[stem] = el; }}
                                        src={stemUrls[stem]}
                                        onEnded={() => setPlayingStem(null)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bounce */}
                <div className="p-5 border-t border-white/5">
                    <button onClick={handleBounce} disabled={bouncing}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-bold hover:shadow-lg hover:shadow-violet-500/20 transition-all disabled:opacity-50">
                        {bouncing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Bouncing Mix...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Bounce & Download Mix</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StemEffects;
