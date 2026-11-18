import React, { ReactNode } from 'react';
import { X, Sparkles } from 'lucide-react';

interface DecoratedModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: ReactNode;
    icon?: ReactNode;
    headerActions?: ReactNode;
    children: ReactNode;
    maxWidthClass?: string;
    gradientColors?: {
        from: string;
        via: string;
        to: string;
        iconFrom: string;
        iconTo: string;
        shadow: string;
    };
}

const defaultGradients = {
    from: 'from-cyan-500/20',
    via: 'via-purple-500/20',
    to: 'to-slate-900',
    iconFrom: 'from-cyan-400',
    iconTo: 'to-purple-500',
    shadow: 'shadow-cyan-500/20'
};

const DecoratedModal: React.FC<DecoratedModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon = <Sparkles className="w-6 h-6 text-cyan-400" />,
    headerActions,
    children,
    maxWidthClass = 'max-w-md',
    gradientColors = defaultGradients
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative w-full ${maxWidthClass} bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden shadow-[0_0_100px_rgba(34,211,238,0.15)] animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header Actions & Close Button */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                    {headerActions}
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Decorative header */}
                <div className={`shrink-0 h-32 bg-gradient-to-br ${gradientColors.from} ${gradientColors.via} ${gradientColors.to} flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="flex flex-col items-center z-10">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientColors.iconFrom} ${gradientColors.iconTo} p-[1px] shadow-lg ${gradientColors.shadow} mb-3`}>
                            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                                {icon}
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-wide">{title}</h2>
                        {subtitle && <div className="mt-1">{subtitle}</div>}
                    </div>
                </div>

                {/* Content Wrapper */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default DecoratedModal;
