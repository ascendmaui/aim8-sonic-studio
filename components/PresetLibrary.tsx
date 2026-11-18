import React, { useState, useEffect } from 'react';
import {
    Search, Plus, Music2, Zap, Star, Share2, Download,
    Loader2, Crown, Heart, Filter, X, Check, Globe, Lock
} from './icons';
import DecoratedModal from './DecoratedModal';

export interface GenerationPreset {
    id: string;
    name: string;
    description: string;
    genre: string;
    mood: string;
    style: string;
    quality: string;
    tags: string[];
    icon: string;
    isPublic: boolean;
    userId?: string;
    usedCount: number;
    createdAt: string;
}

// Built-in community presets
const BUILT_IN_PRESETS: GenerationPreset[] = [
    { id: 'preset_viral_pop', name: 'Viral Pop Hit', description: 'Catchy hooks with modern production', genre: 'Pop', mood: 'Energetic', style: 'Auto', quality: 'V3_5', tags: ['trending', 'catchy', 'radio'], icon: '🔥', isPublic: true, usedCount: 1240, createdAt: '' },
    { id: 'preset_chill_lofi', name: 'Chill Lo-Fi', description: 'Relaxing beats for studying', genre: 'Lo-Fi', mood: 'Chill', style: 'Auto', quality: 'V3_5', tags: ['study', 'relax', 'ambient'], icon: '☕', isPublic: true, usedCount: 980, createdAt: '' },
    { id: 'preset_epic_cinematic', name: 'Epic Cinematic', description: 'Orchestral soundscapes for film', genre: 'Cinematic', mood: 'Epic', style: 'Instrumental', quality: 'V4', tags: ['film', 'orchestral', 'dramatic'], icon: '🎬', isPublic: true, usedCount: 756, createdAt: '' },
    { id: 'preset_trap_banger', name: 'Trap Banger', description: 'Hard-hitting 808s and hi-hats', genre: 'Trap', mood: 'Aggressive', style: 'Auto', quality: 'V3_5', tags: ['hip-hop', '808', 'hard'], icon: '💥', isPublic: true, usedCount: 890, createdAt: '' },
    { id: 'preset_rnb_smooth', name: 'Smooth R&B', description: 'Silky vocals with soul', genre: 'R&B', mood: 'Romantic', style: 'Auto', quality: 'V3_5', tags: ['soul', 'smooth', 'vocals'], icon: '🌙', isPublic: true, usedCount: 620, createdAt: '' },
    { id: 'preset_edm_festival', name: 'Festival EDM', description: 'Main stage energy drops', genre: 'EDM', mood: 'Hype', style: 'Instrumental', quality: 'V3_5', tags: ['festival', 'drop', 'dance'], icon: '🎪', isPublic: true, usedCount: 710, createdAt: '' },
    { id: 'preset_acoustic_folk', name: 'Acoustic Folk', description: 'Warm guitar and storytelling', genre: 'Folk', mood: 'Warm', style: 'Auto', quality: 'V3_5', tags: ['acoustic', 'guitar', 'indie'], icon: '🪕', isPublic: true, usedCount: 430, createdAt: '' },
    { id: 'preset_jazz_lounge', name: 'Jazz Lounge', description: 'Sophisticated jazz arrangements', genre: 'Jazz', mood: 'Sophisticated', style: 'Instrumental', quality: 'V4', tags: ['jazz', 'piano', 'saxophone'], icon: '🎷', isPublic: true, usedCount: 380, createdAt: '' },
];

interface PresetLibraryProps {
    onUsePreset: (preset: GenerationPreset) => void;
    onClose: () => void;
    currentGenre?: string;
    currentMood?: string;
    currentStyle?: string;
    currentQuality?: string;
}

const PresetLibrary: React.FC<PresetLibraryProps> = ({
    onUsePreset, onClose, currentGenre, currentMood, currentStyle, currentQuality
}) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'popular' | 'mine'>('all');
    const [saving, setSaving] = useState(false);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveDesc, setSaveDesc] = useState('');
    const [saveTags, setSaveTags] = useState('');
    const [saveIcon, setSaveIcon] = useState('🎵');
    const [savePublic, setSavePublic] = useState(true);
    const [userPresets, setUserPresets] = useState<GenerationPreset[]>([]);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());

    useEffect(() => {
        const saved = localStorage.getItem('aim8_presets');
        if (saved) setUserPresets(JSON.parse(saved));
        const favs = localStorage.getItem('aim8_preset_favs');
        if (favs) setFavorites(new Set(JSON.parse(favs)));
    }, []);

    const allPresets = [...BUILT_IN_PRESETS, ...userPresets];

    const filtered = allPresets.filter(p => {
        if (filter === 'mine') return p.userId === 'me';
        const q = search.toLowerCase();
        if (!q) return true;
        return p.name.toLowerCase().includes(q) || p.genre.toLowerCase().includes(q) ||
            p.tags.some(t => t.toLowerCase().includes(q)) || p.description.toLowerCase().includes(q);
    }).sort((a, b) => {
        if (filter === 'popular') return b.usedCount - a.usedCount;
        return 0;
    });

    const handleSave = () => {
        if (!saveName.trim()) return;
        setSaving(true);
        const newPreset: GenerationPreset = {
            id: `preset_${Date.now()}`, name: saveName, description: saveDesc,
            genre: currentGenre || 'Pop', mood: currentMood || 'Auto',
            style: currentStyle || 'Auto', quality: currentQuality || 'V3_5',
            tags: saveTags.split(',').map(t => t.trim()).filter(Boolean),
            icon: saveIcon, isPublic: savePublic, userId: 'me',
            usedCount: 0, createdAt: new Date().toISOString(),
        };
        const updated = [...userPresets, newPreset];
        setUserPresets(updated);
        localStorage.setItem('aim8_presets', JSON.stringify(updated));
        setSaving(false);
        setShowSaveForm(false);
        setSaveName(''); setSaveDesc(''); setSaveTags('');
    };

    const toggleFavorite = (id: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            localStorage.setItem('aim8_preset_favs', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const emojiPicker = ['🎵', '🔥', '☕', '🎬', '💥', '🌙', '🎪', '🪕', '🎷', '💎', '🚀', '⚡', '🌊', '🎸', '🥁', '🎹'];

    return (
        <DecoratedModal
            isOpen={true}
            onClose={onClose}
            title="Preset Library"
            subtitle={
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">
                    {allPresets.length} presets available
                </p>
            }
            icon={<Music2 className="w-6 h-6 text-cyan-400" />}
            maxWidthClass="max-w-2xl"
            gradientColors={{
                from: 'from-cyan-500/20',
                via: 'via-purple-500/20',
                to: 'to-slate-900',
                iconFrom: 'from-cyan-400',
                iconTo: 'to-purple-500',
                shadow: 'shadow-cyan-500/20'
            }}
            headerActions={
                <button onClick={() => setShowSaveForm(!showSaveForm)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-cyan-500/20 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Save Current
                </button>
            }
        >

            {/* Save Form */}
            {showSaveForm && (
                <div className="p-4 border-b border-white/5 bg-white/[0.02] space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1 space-y-2">
                            <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Preset name..."
                                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                            <input value={saveDesc} onChange={e => setSaveDesc(e.target.value)} placeholder="Short description..."
                                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex gap-1 flex-wrap max-w-[120px]">
                                {emojiPicker.slice(0, 8).map(e => (
                                    <button key={e} onClick={() => setSaveIcon(e)}
                                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${saveIcon === e ? 'bg-cyan-500/20 ring-1 ring-cyan-500/50' : 'hover:bg-white/5'}`}>
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input value={saveTags} onChange={e => setSaveTags(e.target.value)} placeholder="Tags (comma-separated)..."
                            className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                        <button onClick={() => setSavePublic(!savePublic)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold ${savePublic ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-slate-400'}`}>
                            {savePublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            {savePublic ? 'Public' : 'Private'}
                        </button>
                        <button onClick={handleSave} disabled={saving || !saveName.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-600">
                        Saves: {currentGenre || 'Pop'} / {currentMood || 'Auto'} / {currentStyle || 'Auto'} / {currentQuality || 'V3_5'}
                    </p>
                </div>
            )}

            {/* Search & Filter */}
            <div className="p-4 flex items-center gap-2 border-b border-white/5">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search presets..."
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                </div>
                {(['all', 'popular', 'mine'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {f === 'all' ? 'All' : f === 'popular' ? '🔥 Popular' : '👤 Mine'}
                    </button>
                ))}
            </div>

            {/* Preset Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
                {filtered.length === 0 ? (
                    <div className="col-span-2 text-center py-12 text-slate-600 text-sm">No presets found</div>
                ) : filtered.map(preset => (
                    <div key={preset.id}
                        className="group relative rounded-2xl bg-white/[0.02] border border-white/5 p-4 hover:border-cyan-500/20 hover:bg-white/[0.04] transition-all cursor-pointer"
                        onClick={() => { onUsePreset(preset); onClose(); }}>
                        <div className="flex items-start justify-between mb-2">
                            <span className="text-2xl">{preset.icon}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.id); }}
                                    className={`p-1 rounded-lg transition-all ${favorites.has(preset.id) ? 'text-pink-400' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`}>
                                    <Heart className="w-3.5 h-3.5" />
                                </button>
                                {preset.userId === 'me' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold">MINE</span>}
                            </div>
                        </div>
                        <h3 className="text-sm font-bold text-white mb-0.5">{preset.name}</h3>
                        <p className="text-[10px] text-slate-500 mb-2 line-clamp-1">{preset.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[9px] font-bold">{preset.genre}</span>
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[9px] font-bold">{preset.mood}</span>
                            {preset.usedCount > 0 && (
                                <span className="text-[9px] text-slate-600 ml-auto flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5" /> {preset.usedCount}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </DecoratedModal>
    );
};

export default PresetLibrary;
