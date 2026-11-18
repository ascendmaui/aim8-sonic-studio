import React, { useState } from 'react';
import { KeyRound, ExternalLink, ShieldCheck, Trash2, X } from 'lucide-react';
import { getKeys, saveKeys, clearKeys } from '../services/byok';

interface ApiKeySetupProps {
    /** Called after valid keys are saved. */
    onSaved?: () => void;
    /** When provided, renders as a dismissible modal instead of a full-screen gate. */
    onClose?: () => void;
}

/**
 * The only thing the app shows until the user enters their own keys.
 * AIM-8 has no bundled keys, no shared backend and no demo mode.
 */
const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onSaved, onClose }) => {
    const initial = getKeys();
    const [kie, setKie] = useState(initial.kie);
    const [gemini, setGemini] = useState(initial.gemini);
    const [error, setError] = useState<string | null>(null);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!kie.trim() || !gemini.trim()) {
            setError('Both keys are required. AIM-8 does not work without your own Kie.ai and Gemini API keys.');
            return;
        }
        saveKeys({ kie, gemini });
        setError(null);
        onSaved?.();
    };

    const handleClear = () => {
        clearKeys();
        setKie('');
        setGemini('');
    };

    const card = (
        <form
            onSubmit={handleSave}
            className="relative w-full max-w-lg bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_80px_rgba(34,211,238,0.15)] text-white"
        >
            {onClose && (
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white" title="Close">
                    <X className="w-5 h-5" />
                </button>
            )}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-cyan-400" />
                </div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight">Enter your API keys</h1>
            </div>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                AIM-8 Sonic Studio is bring-your-own-key. It includes no keys and has no demo mode, so nothing works
                until you add your own. Usage is billed to your own Kie.ai and Google accounts.
            </p>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1" htmlFor="kie-key">
                Kie.ai API key (Suno music generation)
            </label>
            <input
                id="kie-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={kie}
                onChange={(e) => setKie(e.target.value)}
                placeholder="Paste your Kie.ai key"
                className="w-full mb-1 px-4 py-3 rounded-xl bg-slate-950 border border-white/10 focus:border-cyan-400 outline-none text-sm font-mono"
            />
            <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline mb-4">
                Get a Kie.ai key <ExternalLink className="w-3 h-3" />
            </a>

            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1" htmlFor="gemini-key">
                Google Gemini API key (AI producer, lyrics, live voice)
            </label>
            <input
                id="gemini-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={gemini}
                onChange={(e) => setGemini(e.target.value)}
                placeholder="Paste your Gemini key"
                className="w-full mb-1 px-4 py-3 rounded-xl bg-slate-950 border border-white/10 focus:border-cyan-400 outline-none text-sm font-mono"
            />
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline mb-4">
                Get a Gemini key <ExternalLink className="w-3 h-3" />
            </a>

            {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}

            <div className="flex items-start gap-2 text-[11px] text-slate-500 mb-6">
                <ShieldCheck className="w-4 h-4 flex-none text-emerald-400" />
                <span>Keys are stored only in this browser (localStorage) and are sent only to api.kie.ai and Google's Gemini API. Use keys with spending limits, and clear them on shared computers.</span>
            </div>

            <div className="flex gap-3">
                <button type="submit" className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-sm uppercase tracking-wider">
                    Save keys
                </button>
                {(initial.kie || initial.gemini) && (
                    <button type="button" onClick={handleClear} className="px-4 py-3 rounded-xl border border-white/10 hover:border-red-400 text-slate-300 hover:text-red-300 text-sm inline-flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>
                )}
            </div>
        </form>
    );

    if (onClose) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                {card}
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4 gap-6">
            <div className="flex items-center gap-3 text-white">
                <img src="/logo-transparent.png" alt="AIM-8" className="w-10 h-10 object-contain" />
                <span className="text-2xl font-black tracking-tight">AIM-8 Sonic Studio</span>
            </div>
            {card}
        </div>
    );
};

export default ApiKeySetup;
