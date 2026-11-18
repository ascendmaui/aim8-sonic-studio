import React, { useState } from 'react';
import {
    BookOpen, Sparkles, Globe, Music2, Mic, Lightbulb,
    ChevronDown, ChevronRight, Zap, Target, Palette,
    Languages, Star, ArrowRight, Copy, Check, Volume2,
    Wand2, Hash, AlignLeft
} from './icons';

const sections = [
    {
        id: 'basics',
        icon: BookOpen,
        title: 'Prompt Basics',
        color: 'cyan',
        content: [
            {
                heading: 'How Prompting Works',
                text: 'Aim8 transforms text descriptions into full songs. The more specific your prompt, the better the result. Your prompt sets the genre, mood, vocal style, tempo, and lyrical content.',
            },
            {
                heading: 'Anatomy of a Great Prompt',
                text: 'A strong prompt has 3 parts:',
                list: [
                    '**Genre & Style** — e.g. "melodic trap", "indie folk ballad", "90s boom-bap"',
                    '**Mood & Vibe** — e.g. "melancholic", "euphoric sunset", "aggressive and dark"',
                    '**Subject / Theme** — e.g. "about chasing dreams", "breakup letter", "celebration anthem"',
                ],
            },
        ],
    },
    {
        id: 'structure',
        icon: AlignLeft,
        title: 'Song Structure',
        color: 'purple',
        content: [
            {
                heading: 'Using Tags to Control Structure',
                text: 'Use bracket tags to tell the AI exactly how to structure the song. Place them on separate lines before the lyrics for each section.',
                list: [
                    '**[Verse]** — Storytelling section, lower energy',
                    '**[Chorus]** — The hook — catchy, high energy, repeatable',
                    '**[Bridge]** — Contrast section, different melody or rhythm',
                    '**[Pre-Chorus]** — Build-up to the chorus',
                    '**[Outro]** — Closing section, wind-down',
                    '**[Intro]** — Instrumental opening',
                    '**[Drop]** — For EDM: the main beat drop',
                ],
            },
            {
                heading: 'Example: Structured Prompt',
                code: `[Verse]\nWalking through neon streets at midnight\nEvery shadow tells a story I can't fight\n\n[Chorus]\nWe're burning like stars tonight\nNothing can stop this fire inside\n\n[Bridge]\nSlow it down, feel the bass\nLet the rhythm take its place\n\n[Outro]\nFading out... neon glow...`,
            },
        ],
    },
    {
        id: 'genres',
        icon: Palette,
        title: 'Genre Guide',
        color: 'pink',
        content: [
            {
                heading: 'Supported Genres & Keywords',
                text: 'Use these genre keywords to nail the style you want:',
                grid: [
                    { genre: 'Hip-Hop / Rap', keywords: 'trap, boom-bap, drill, lo-fi hip-hop, cloud rap, mumble rap' },
                    { genre: 'Pop', keywords: 'synth-pop, dream pop, indie pop, k-pop style, electro-pop' },
                    { genre: 'R&B / Soul', keywords: 'neo-soul, R&B ballad, slow jam, modern R&B, 90s R&B' },
                    { genre: 'Electronic', keywords: 'house, techno, trance, dubstep, drum and bass, ambient' },
                    { genre: 'Rock', keywords: 'indie rock, punk, alternative, grunge, classic rock, metal' },
                    { genre: 'Country / Folk', keywords: 'modern country, folk ballad, bluegrass, Americana' },
                    { genre: 'Latin', keywords: 'reggaeton, bachata, salsa, Latin trap, cumbia' },
                    { genre: 'Afrobeats', keywords: 'afrobeats, afro-fusion, amapiano, highlife' },
                ],
            },
        ],
    },
    {
        id: 'vocal',
        icon: Mic,
        title: 'Vocal Styles',
        color: 'green',
        content: [
            {
                heading: 'Controlling Vocals in Your Prompt',
                text: 'Add vocal descriptors to shape the singing style:',
                list: [
                    '**"Soft female vocal"** — Light, airy, breathy delivery',
                    '**"Deep male voice"** — Rich baritone, authoritative feel',
                    '**"Raspy singing"** — Gritty, lived-in vocal texture',
                    '**"Falsetto"** — High, ethereal vocal register',
                    '**"Spoken word"** — Poetic, conversational delivery',
                    '**"Choir / Harmonies"** — Layered, group vocal feel',
                    '**"Aggressive rap delivery"** — Fast, punchy, high-energy flow',
                    '**"Whispered vocals"** — Intimate, ASMR-like softness',
                ],
            },
            {
                heading: 'Pro Tip: Combine Style + Emotion',
                text: 'For the best results, combine a vocal style with an emotional direction:\n\n• "Raspy female vocal, emotional and vulnerable"\n• "Deep male voice, confident and smooth"\n• "Energetic rap, aggressive but playful"',
            },
        ],
    },
    {
        id: 'languages',
        icon: Languages,
        title: 'Multi-Language Songs',
        color: 'amber',
        content: [
            {
                heading: 'Creating Songs in Other Languages',
                text: 'Aim8 supports songs in many languages. The key is to write your lyrics directly in the target language and specify the language in your prompt description.',
            },
            {
                heading: 'Method 1: Full Foreign-Language Lyrics',
                text: 'Write your lyrics in the target language:',
                code: `Genre: Latin Pop ballad, romantic\nVoice: Soft male tenor, Spanish\n\n[Verse]\nCaminando por las calles de Madrid\nBuscando algo que perdí\nTu recuerdo vive aquí\n\n[Chorus]\nDime por qué te fuiste\nDime por qué me dejaste solo\nBajo la luna triste`,
            },
            {
                heading: 'Method 2: Language Tag in Description',
                text: 'Simply describe the song in English but specify the language:',
                code: `A K-pop style dance track sung in Korean.\nUpbeat, catchy, with a powerful female vocal.\nTheme: self-confidence and independence.\nLanguage: Korean`,
            },
            {
                heading: 'Method 3: Bilingual / Code-Switching',
                text: 'Mix languages within the same song for a bilingual effect:',
                code: `Genre: Reggaeton / Latin Pop\n\n[Verse - English]\nShe walks in like she owns the night\nEvery step a spark, every word a light\n\n[Chorus - Spanish]\nBáilame, siente el fuego\nNo me dejes, quédate conmigo\nEsta noche es para siempre`,
            },
            {
                heading: 'Supported Languages',
                text: 'Best results with: **English**, **Spanish**, **French**, **Portuguese**, **Korean**, **Japanese**, **German**, **Italian**, **Hindi**, **Arabic**, **Mandarin Chinese**, **Russian**, **Turkish**, **Swahili**.\n\nFor less common languages, write the lyrics phonetically or in the native script for best accuracy.',
            },
        ],
    },
    {
        id: 'advanced',
        icon: Wand2,
        title: 'Advanced Techniques',
        color: 'rose',
        content: [
            {
                heading: 'Tempo & Energy Control',
                text: 'Use BPM ranges and energy descriptors to fine-tune:',
                list: [
                    '**"Slow, 70 BPM"** — Ballad pace, emotional',
                    '**"Medium tempo, 110 BPM"** — Laid-back groove',
                    '**"Fast, 140+ BPM"** — High-energy, dance-floor ready',
                    '**"Builds from slow to explosive drop"** — Dynamic arc',
                ],
            },
            {
                heading: 'Production Keywords',
                text: 'Add production-level detail to your prompt:',
                list: [
                    '**"808 bass heavy"** — Deep sub-bass, trap-style',
                    '**"Acoustic guitar only"** — Stripped-back, unplugged',
                    '**"Orchestral strings"** — Cinematic layering',
                    '**"Lo-fi, vinyl crackle"** — Warm, nostalgic texture',
                    '**"Reverb-heavy, atmospheric"** — Spacious, dreamy',
                    '**"Punchy drums, tight mix"** — Clean, modern production',
                ],
            },
            {
                heading: 'Emotional Arcs',
                text: 'Describe how the song should feel over time:\n\n• "Starts melancholic, builds to an empowering chorus"\n• "Dreamy intro → hard-hitting verse → euphoric drop"\n• "Intimate and quiet throughout, like a lullaby"',
            },
        ],
    },
    {
        id: 'examples',
        icon: Star,
        title: 'Full Examples',
        color: 'yellow',
        content: [
            {
                heading: '🎵 Example 1: Trap Banger',
                code: `Dark trap, heavy 808s, aggressive male rap, 145 BPM\n\n[Verse]\nPulling up in the black on black\nNo looking back, I stay on track\nHaters talk but I don't hear that\nMoney stacking, that's a fact\n\n[Chorus]\nWe don't stop, we go harder\nEvery day we climb farther\nFrom the bottom to the top\nThis the wave, we don't flop`,
            },
            {
                heading: '🌸 Example 2: Japanese City Pop',
                code: `City pop, 1980s Japanese style, dreamy synths, female vocal\nLanguage: Japanese\n\n[Verse]\n夜の街を歩いて\nネオンの光に包まれて\n風がそっと囁く\nあの日々を思い出す\n\n[Chorus]\nトキメキは止まらない\nこの瞬間が永遠になれ\n踊り明かそう tonight`,
            },
            {
                heading: '🌍 Example 3: Afrobeats Hit',
                code: `Afrobeats, amapiano influence, groovy bassline\nMale and female vocal duet, 116 BPM\nTheme: summer love in Lagos\n\n[Verse]\nShe dey move like water for the moonlight\nEvery step she take na pure delight\nI no fit look away, she too right\n\n[Chorus]\nDance with me oh, under the stars\nForget your worries, forget the scars\nNa only love we dey feel tonight`,
            },
            {
                heading: '🎻 Example 4: Cinematic Orchestral',
                code: `Epic cinematic orchestral, no vocals, instrumental only\nBuilds from quiet piano to full orchestra with brass and strings\n140 BPM, heroic and inspiring\n\nThink: movie trailer for an adventure film\nDynamic range: whisper to thunderous`,
            },
        ],
    },
];

const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', glow: 'shadow-cyan-500/10' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', glow: 'shadow-purple-500/10' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', glow: 'shadow-pink-500/10' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', glow: 'shadow-green-500/10' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', glow: 'shadow-rose-500/10' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', glow: 'shadow-yellow-500/10' },
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all"
            title="Copy to clipboard"
        >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
};

const PromptTutorial: React.FC = () => {
    const [activeSection, setActiveSection] = useState('basics');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ basics: true });

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
        setActiveSection(id);
    };

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 pb-32">

                {/* Hero */}
                <div className="mb-10 md:mb-14">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Prompting Guide</h1>
                            <p className="text-slate-500 text-sm">Master the art of AI music creation</p>
                        </div>
                    </div>

                    {/* Quick Tips Bar */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
                            <Target className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-white text-xs font-bold">Be Specific</p>
                                <p className="text-slate-500 text-[11px] mt-0.5">Genre + mood + theme = great results</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                            <AlignLeft className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-white text-xs font-bold">Use Structure Tags</p>
                                <p className="text-slate-500 text-[11px] mt-0.5">[Verse], [Chorus], [Bridge] for control</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                            <Globe className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-white text-xs font-bold">Any Language</p>
                                <p className="text-slate-500 text-[11px] mt-0.5">Write lyrics in native script for best results</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Pill Bar */}
                <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-2 scrollbar-none">
                    {sections.map(s => {
                        const c = colorMap[s.color];
                        const isActive = activeSection === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => { setActiveSection(s.id); setExpandedSections(prev => ({ ...prev, [s.id]: true })); document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${isActive ? `${c.bg} ${c.text} ${c.border} border` : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <s.icon className="w-3.5 h-3.5" />
                                {s.title}
                            </button>
                        );
                    })}
                </div>

                {/* Sections */}
                <div className="space-y-4">
                    {sections.map(section => {
                        const c = colorMap[section.color];
                        const isExpanded = expandedSections[section.id] ?? false;

                        return (
                            <div key={section.id} id={`section-${section.id}`} className="scroll-mt-6">
                                {/* Section Header */}
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${isExpanded ? `bg-slate-800/50 ${c.border}` : 'bg-slate-800/20 border-white/5 hover:bg-slate-800/40 hover:border-white/10'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                                        <section.icon className={`w-5 h-5 ${c.text}`} />
                                    </div>
                                    <span className="text-white font-bold text-sm flex-1 text-left">{section.title}</span>
                                    {isExpanded ? (
                                        <ChevronDown className={`w-4 h-4 ${c.text}`} />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                    )}
                                </button>

                                {/* Section Content */}
                                {isExpanded && (
                                    <div className="mt-3 space-y-5 pl-2 pr-1">
                                        {section.content.map((block, i) => (
                                            <div key={i}>
                                                <h3 className="text-white font-bold text-sm mb-2">{block.heading}</h3>
                                                {block.text && (
                                                    <p className="text-slate-400 text-[13px] leading-relaxed whitespace-pre-line mb-3">
                                                        {block.text.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                                                            part.startsWith('**') && part.endsWith('**')
                                                                ? <span key={j} className="text-white font-semibold">{part.slice(2, -2)}</span>
                                                                : part
                                                        )}
                                                    </p>
                                                )}
                                                {'list' in block && block.list && (
                                                    <ul className="space-y-2 mb-3">
                                                        {block.list.map((item, j) => (
                                                            <li key={j} className="flex items-start gap-2 text-slate-400 text-[13px]">
                                                                <ArrowRight className={`w-3 h-3 ${c.text} mt-1 shrink-0`} />
                                                                <span>
                                                                    {item.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                                                                        part.startsWith('**') && part.endsWith('**')
                                                                            ? <span key={k} className="text-white font-semibold">{part.slice(2, -2)}</span>
                                                                            : part
                                                                    )}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {'code' in block && block.code && (
                                                    <div className="relative bg-slate-900/80 border border-white/[0.06] rounded-xl p-4 font-mono text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                        <CopyButton text={block.code} />
                                                        {block.code}
                                                    </div>
                                                )}
                                                {'grid' in block && block.grid && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {block.grid.map((item, j) => (
                                                            <div key={j} className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
                                                                <p className="text-white text-xs font-bold mb-1">{item.genre}</p>
                                                                <p className="text-slate-500 text-[11px]">{item.keywords}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PromptTutorial;
