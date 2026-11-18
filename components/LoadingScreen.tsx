import React from 'react';
import { Music2 } from './icons';

const LoadingScreen: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700 w-full max-w-md px-6">
            {/* Logo pulse */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20 animate-pulse">
                <Music2 className="w-10 h-10 text-white" />
            </div>

            {/* Brand */}
            <h1 className="text-3xl font-black tracking-tight font-outfit bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                Sonic Studio
            </h1>

            {/* Skeleton Content — mimics the studio layout for a more engaging load */}
            <div className="w-full space-y-4">
                {/* Top bar skeleton */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] animate-shimmer" />
                    <div className="flex-1 h-4 rounded-lg bg-white/[0.06] animate-shimmer" style={{ animationDelay: '0.1s' }} />
                    <div className="w-20 h-8 rounded-lg bg-white/[0.06] animate-shimmer" style={{ animationDelay: '0.2s' }} />
                </div>

                {/* Main content area skeleton */}
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5 space-y-4">
                    <div className="h-5 w-3/4 rounded-lg bg-white/[0.06] animate-shimmer" style={{ animationDelay: '0.15s' }} />
                    <div className="h-4 w-full rounded-lg bg-white/[0.04] animate-shimmer" style={{ animationDelay: '0.25s' }} />
                    <div className="h-4 w-2/3 rounded-lg bg-white/[0.04] animate-shimmer" style={{ animationDelay: '0.35s' }} />

                    {/* Button row skeleton */}
                    <div className="flex gap-3 pt-2">
                        <div className="flex-1 h-10 rounded-xl bg-cyan-500/10 animate-shimmer" style={{ animationDelay: '0.4s' }} />
                        <div className="w-10 h-10 rounded-xl bg-white/[0.06] animate-shimmer" style={{ animationDelay: '0.45s' }} />
                    </div>
                </div>

                {/* Bottom cards skeleton */}
                <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-shimmer" style={{ animationDelay: `${0.5 + i * 0.1}s` }} />
                    ))}
                </div>
            </div>

            {/* Loading bar */}
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-loading-bar" />
            </div>

            <p className="text-slate-500 text-xs font-medium tracking-wide uppercase">Preparing your studio…</p>
        </div>

        <style>{`
            @keyframes loading-bar {
                0% { width: 0%; margin-left: 0%; }
                50% { width: 60%; margin-left: 20%; }
                100% { width: 0%; margin-left: 100%; }
            }
            .animate-loading-bar {
                animation: loading-bar 1.5s ease-in-out infinite;
            }
            @keyframes shimmer {
                0% { opacity: 0.3; }
                50% { opacity: 0.6; }
                100% { opacity: 0.3; }
            }
            .animate-shimmer {
                animation: shimmer 1.8s ease-in-out infinite;
            }
        `}</style>
    </div>
);

export default LoadingScreen;
