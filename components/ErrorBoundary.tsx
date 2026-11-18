import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children?: ReactNode;
    fallbackTitle?: string;
    resetError?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[999] bg-slate-950 flex items-center justify-center p-6 text-center antialiased">
                    <div className="max-w-md w-full p-8 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse">
                                <AlertTriangle className="w-10 h-10 text-amber-500" />
                            </div>

                            <h1 className="text-3xl font-black text-white mb-3 tracking-tighter">STUDIO CRASHED</h1>
                            <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">
                                Aim8 encountered a critical exception. Your sessions are saved in the cloud. Let's get you back in.
                            </p>

                            <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5 mb-10 text-left">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">System Error Log</div>
                                <code className="text-xs text-amber-500/90 font-mono break-all line-clamp-3 block leading-relaxed">
                                    {this.state.error?.message || 'Unknown Application Error State'}
                                </code>
                            </div>

                            <button
                                onClick={() => {
                                    if (this.props.resetError) {
                                        this.props.resetError();
                                    }
                                    window.location.reload();
                                }}
                                className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold transition-all shadow-xl shadow-cyan-900/20 active:scale-[0.98] group"
                            >
                                <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                                Reload Studio
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
