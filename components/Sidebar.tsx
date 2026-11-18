import React, { useState, useMemo } from 'react';
import { KeyRound } from 'lucide-react';
import { clearKeys } from '../services/byok';
import { useAuth } from './AuthContext';
import {
    Home, Music2, Disc, Mic, LayoutGrid,
    Coins, Crown, LogOut, ChevronLeft, ChevronRight,
    Menu, X, User, BookOpen, Flame, MessageSquare, Trash2,
    ShieldCheck, Download, Copy, Megaphone,
    HeartHandshake
} from './icons';

export type SidebarPage = 'music' | 'library' | 'explore' | 'live' | 'pro' | 'dashboard' | 'admin' | 'tutorial';

interface SidebarProps {
    activePage: SidebarPage;
    onNavigate: (page: SidebarPage) => void;
    credits: number;
    isPro: boolean;
    onOpenPaywall: () => void;

    onOpenFeedback?: () => void;
}

interface NavItemProps {
    icon: any;
    label: string;
    active: boolean;
    onClick: () => void;
    badge?: string;
    collapsed: boolean;
    accent?: string;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onClick, badge, collapsed, accent }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center rounded-xl transition-all group relative
            ${collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2.5'}
            ${active
                ? `bg-gradient-to-r ${accent || 'from-cyan-500/15 to-purple-500/10'} text-white border border-white/10 shadow-lg`
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
        title={collapsed ? label : undefined}
    >
        <div className={`${collapsed ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${active
            ? 'bg-white/10'
            : 'group-hover:bg-white/5'
            }`}>
            <Icon className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} ${active ? 'text-cyan-400' : ''}`} />
        </div>
        {!collapsed && (
            <>
                <span className="text-sm font-semibold flex-1 text-left">{label}</span>
                {badge && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20">
                        {badge}
                    </span>
                )}
            </>
        )}
        {/* Tooltip for collapsed state */}
        {collapsed && (
            <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-xl z-[100]">
                {label}
            </div>
        )}
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({
    activePage, onNavigate, credits, isPro, onOpenPaywall, onOpenFeedback
}) => {
    const { user } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems: { page: SidebarPage; icon: any; label: string; badge?: string; accent?: string }[] = [
        { page: 'music', icon: Music2, label: 'Studio', accent: 'from-cyan-500/15 to-blue-500/10' },
        { page: 'library', icon: Disc, label: 'Library', accent: 'from-purple-500/15 to-pink-500/10' },
        { page: 'pro', icon: Crown, label: 'Pro Studio',  accent: 'from-amber-500/15 to-yellow-500/10' },
        { page: 'tutorial', icon: BookOpen, label: 'Guide', accent: 'from-rose-500/15 to-pink-500/10' },
    ];

    // Chat history from localStorage
    type ChatSession = { id: string; tab: string; title: string; timestamp: number };
    const CHAT_KEY = `aim8_prostudio_sessions_${user?.uid || 'anon'}`;
    const chatSessions = useMemo<ChatSession[]>(() => {
        try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]').slice(0, 8); } catch { return []; }
    }, [CHAT_KEY, activePage]);

    const handleDeleteChat = (id: string) => {
        try {
            const all: ChatSession[] = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
            const next = all.filter(s => s.id !== id);
            localStorage.setItem(CHAT_KEY, JSON.stringify(next));
        } catch { }
    };

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`pt-6 pb-5 flex items-center flex-shrink-0 ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
                <div className="flex items-center gap-3">
                    {/* Icon mark */}
                    <div className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 shadow-xl shadow-cyan-900/20 shrink-0 overflow-hidden ring-1 ring-white/10">
                        <img src="/logo-transparent.png" alt="Aim8" className="w-7 h-7 object-contain" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col justify-center">
                            <h1 className="text-xl font-black tracking-tight text-white flex items-center">
                                Aim8
                            </h1>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden lg:flex w-7 h-7 rounded-lg hover:bg-white/10 border border-white/5 items-center justify-center text-slate-500 hover:text-white transition-all"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 py-2 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
                <div className="mb-3">
                    {!collapsed && (
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-2 px-3">
                            Navigation
                        </p>
                    )}
                    {collapsed && <div className="w-6 h-px bg-white/5 mx-auto mb-2" />}
                    {navItems.slice(0, 5).map(item => (
                        <NavItem
                            key={item.page}
                            icon={item.icon}
                            label={item.label}
                            active={activePage === item.page || (item.page === 'music' && activePage === 'live')}
                            onClick={() => { onNavigate(item.page); setMobileOpen(false); }}
                            badge={item.badge}
                            collapsed={collapsed}
                            accent={item.accent}
                        />
                    ))}
                </div>

                <div className="border-t border-white/5 pt-3">
                    {!collapsed && (
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-2 px-3">
                            Account
                        </p>
                    )}
                    {collapsed && <div className="w-6 h-px bg-white/5 mx-auto mb-2" />}

                    {onOpenFeedback && (
                        <NavItem
                            icon={HeartHandshake}
                            label="Give Feedback"
                            active={false}
                            onClick={() => { onOpenFeedback(); setMobileOpen(false); }}
                            collapsed={collapsed}
                            accent="from-rose-500/15 to-pink-500/10"
                        />
                    )}
                </div>

                {/* Chat History */}
                {!collapsed && chatSessions.length > 0 && (
                    <div className="border-t border-white/5 pt-3 mt-2">
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-2 px-3">
                            Recent Activity
                        </p>
                        <div className="space-y-0.5">
                            {chatSessions.slice(0, 5).map(s => (
                                <div key={s.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors">
                                    <MessageSquare className="w-3 h-3 text-slate-700 shrink-0" />
                                    <span className="text-[11px] text-slate-600 group-hover:text-slate-400 truncate flex-1 transition-colors">{s.title}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteChat(s.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-slate-700 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </nav>


            {/* BYOK keys */}
            <div className={`pb-4 pt-2 border-t border-white/5 flex-shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
                <button
                    onClick={() => { if (confirm('Remove your API keys from this browser?')) clearKeys(); }}
                    className={`w-full rounded-xl border border-white/10 hover:border-red-400/40 transition-all ${collapsed ? 'p-2' : 'p-3'} text-left`}
                    title="Your own API keys are stored only in this browser. Click to remove them."
                >
                    <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                            <KeyRound className="w-4 h-4 text-cyan-400" />
                        </div>
                        {!collapsed && (
                            <div className="flex-1">
                                <p className="text-xs font-black text-white">Your own API keys</p>
                                <p className="text-[9px] text-slate-500 font-medium">Stored in this browser • tap to remove</p>
                            </div>
                        )}
                    </div>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden fixed top-3 left-3 z-[80] p-2.5 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
                    <div
                        className="w-64 h-full bg-slate-950/95 backdrop-blur-xl border-r border-white/5 shadow-2xl animate-in slide-in-from-left duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Desktop sidebar */}
            <div className={`hidden lg:flex flex-col h-full bg-slate-950/50 backdrop-blur-xl border-r border-white/5 transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
                {sidebarContent}
            </div>

            {/* Mobile Bottom Nav Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-slate-950/95 backdrop-blur-xl border-t border-white/[0.06] shadow-2xl safe-area-bottom">
                <nav className="flex items-center justify-around px-2 py-1">
                    {navItems.slice(0, 5).map(item => {
                        const Icon = item.icon;
                        const isActive = activePage === item.page;
                        return (
                            <button
                                key={item.page}
                                onClick={() => { onNavigate(item.page); setMobileOpen(false); }}
                                className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all relative ${isActive
                                    ? 'text-cyan-400'
                                    : 'text-slate-600 active:text-white'
                                    }`}
                            >
                                {isActive && (
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-cyan-400 rounded-full" />
                                )}
                                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : ''}`} />
                                <span className={`text-[9px] font-bold tracking-tight ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
                                    {item.label}
                                </span>
                                {item.badge && (
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-purple-500" />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </>
    );
};

export default Sidebar;
