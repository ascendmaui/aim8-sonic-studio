import React from 'react';
import { Music2 } from './icons';

const NotFound: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Music2 className="w-8 h-8 text-slate-500" />
            </div>

            <div>
                <h1 className="text-7xl font-black text-white/10 font-outfit mb-2">404</h1>
                <h2 className="text-xl font-bold text-white font-outfit">Page Not Found</h2>
                <p className="mt-2 text-slate-400 text-sm max-w-md">
                    The page you're looking for doesn't exist or has been moved.
                </p>
            </div>

            <a
                href="/"
                className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-full hover:shadow-lg hover:shadow-cyan-500/20 transition-all text-sm"
            >
                Back to Studio
            </a>
        </div>
    </div>
);

export default NotFound;
