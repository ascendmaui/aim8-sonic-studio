import React, { useState, useMemo } from 'react';
import {
    Clock, Search, Play, Pause, RefreshCw, Download,
    Filter, X, Music2, Zap, Calendar, ChevronDown, ChevronUp, Loader2
} from './icons';
import DecoratedModal from './DecoratedModal';

interface SunoTrack {
    id: string;
    title: string;
    tags?: string;
    audioUrl: string;
    imageUrl?: string;
    createdAt?: string;
    status?: string;
}

interface SessionHistoryProps {
    library: SunoTrack[];
    onRegenerate: (track: SunoTrack) => void;
    onPlay: (track: SunoTrack) => void;
    onClose: () => void;
    activeTrackUrl?: string | null;
    isPlaying?: boolean;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({
    library, onRegenerate, onPlay, onClose, activeTrackUrl, isPlaying
}) => {
    const [search, setSearch] = useState('');
    const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest');
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [filterStyle, setFilterStyle] = useState('');

    // Group tracks by date
    const grouped = useMemo(() => {
        const filtered = library.filter(t => {
            const q = search.toLowerCase();
            const matchesSearch = !q || (t.title?.toLowerCase() || '').includes(q) || (t.tags?.toLowerCase() || '').includes(q);
            const matchesStyle = !filterStyle || (t.tags?.toLowerCase() || '').includes(filterStyle.toLowerCase());
            return matchesSearch && matchesStyle;
        });

        const sorted = [...filtered].sort((a, b) => {
            const da = new Date(a.createdAt || 0).getTime();
            const db = new Date(b.createdAt || 0).getTime();
            return sortDir === 'newest' ? db - da : da - db;
        });

        const groups: Record<string, SunoTrack[]> = {};
        sorted.forEach(track => {
            const date = track.createdAt ? new Date(track.createdAt).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }) : 'Unknown Date';
            if (!groups[date]) groups[date] = [];
            groups[date].push(track);
        });
        return groups;
    }, [library, search, sortDir, filterStyle]);

    // Extract unique styles for filter
    const styles = useMemo(() => {
        const set = new Set<string>();
        library.forEach(t => {
            if (t.tags) t.tags.split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
        });
        return Array.from(set).slice(0, 12);
    }, [library]);

    const dateKeys = Object.keys(grouped);

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const getRelativeDate = (dateStr: string) => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (dateStr === today) return '📍 Today';
        if (dateStr === yesterday) return '📅 Yesterday';
        return dateStr;
    };

    return (
        <DecoratedModal
            isOpen={true}
            onClose={onClose}
            title="Session History"
            subtitle={
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                    {library.length} tracks · {dateKeys.length} sessions
                </p>
            }
            icon={<Clock className="w-6 h-6 text-amber-400" />}
            maxWidthClass="max-w-2xl"
            gradientColors={{
                from: 'from-amber-500/20',
                via: 'via-orange-500/20',
                to: 'to-slate-900',
                iconFrom: 'from-amber-400',
                iconTo: 'to-orange-500',
                shadow: 'shadow-amber-500/20'
            }}
        >

            {/* Search, Sort, Filter */}
            <div className="p-4 space-y-2 border-b border-white/5">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search songs, styles..."
                            className="w-full bg-slate-800/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none" />
                    </div>
                    <button onClick={() => setSortDir(sortDir === 'newest' ? 'oldest' : 'newest')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-all">
                        {sortDir === 'newest' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        {sortDir === 'newest' ? 'Newest' : 'Oldest'}
                    </button>
                </div>
                {styles.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setFilterStyle('')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${!filterStyle ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
                            All
                        </button>
                        {styles.map(s => (
                            <button key={s} onClick={() => setFilterStyle(filterStyle === s ? '' : s)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${filterStyle === s ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {dateKeys.length === 0 ? (
                    <div className="text-center py-16 text-slate-600">
                        <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No sessions found</p>
                        <p className="text-xs mt-1">Generate some tracks to see them here</p>
                    </div>
                ) : dateKeys.map(date => (
                    <div key={date}>
                        {/* Date Header */}
                        <button onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                            className="flex items-center gap-3 w-full mb-2 group">
                            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">
                                {getRelativeDate(date)}
                            </span>
                            <div className="flex-1 h-px bg-white/5" />
                            <span className="text-[10px] text-slate-600 px-2 py-0.5 rounded-full bg-white/[0.03]">
                                {grouped[date].length} tracks
                            </span>
                        </button>

                        {/* Tracks for this date */}
                        <div className="space-y-1.5 pl-2 border-l border-white/5 ml-1">
                            {grouped[date].map(track => {
                                const isActive = activeTrackUrl === track.audioUrl;
                                return (
                                    <div key={track.id}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${isActive ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/[0.03]'
                                            }`}>
                                        {/* Play button */}
                                        <button onClick={() => onPlay(track)}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isActive && isPlaying
                                                ? 'bg-cyan-500 text-white'
                                                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                                }`}>
                                            {isActive && isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        </button>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{track.title || 'Untitled'}</p>
                                            <p className="text-[10px] text-slate-500 truncate">
                                                {track.tags} · {formatTime(track.createdAt)}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => onRegenerate(track)} title="Re-generate"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </DecoratedModal>
    );
};

export default SessionHistory;
