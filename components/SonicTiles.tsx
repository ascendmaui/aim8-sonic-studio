
import React from 'react';
import { Zap, Headphones, Sparkles, Disc, Flame, Music2, Radio, Layers } from './icons';

interface SonicTilesProps {
  setInputText: (text: string) => void;
}

const TILES = [
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    icon: Zap,
    color: 'from-cyan-500 to-blue-600',
    shadow: 'shadow-cyan-500/20',
    glow: 'group-hover:shadow-cyan-500/15',
    prompt: "A high-energy Cyberpunk track with distorted bass, neon synth leads, and aggressive industrial percussion."
  },
  {
    id: 'lofi',
    label: 'Lo-Fi Chill',
    icon: Headphones,
    color: 'from-purple-500 to-indigo-600',
    shadow: 'shadow-purple-500/20',
    glow: 'group-hover:shadow-purple-500/15',
    prompt: "A chill Lo-Fi Hip Hop beat with jazzy piano chords, vinyl crackle, and a relaxed downtempo groove."
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/20',
    glow: 'group-hover:shadow-amber-500/15',
    prompt: "An epic Cinematic orchestral score with swelling strings, thunderous drums, and a heroic melody."
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    icon: Disc,
    color: 'from-pink-500 to-rose-600',
    shadow: 'shadow-pink-500/20',
    glow: 'group-hover:shadow-pink-500/15',
    prompt: "A retro 80s Synthwave track with driving arpeggiators, gated reverb drums, and nostalgic analog pads."
  },
  {
    id: 'trap',
    label: 'Dark Trap',
    icon: Flame,
    color: 'from-red-500 to-orange-600',
    shadow: 'shadow-red-500/20',
    glow: 'group-hover:shadow-red-500/15',
    prompt: "A hard-hitting Dark Trap beat with 808 bass, rapid hi-hats, and ominous bells."
  },
  {
    id: 'house',
    label: 'Deep House',
    icon: Music2,
    color: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/20',
    glow: 'group-hover:shadow-emerald-500/15',
    prompt: "A groovy Deep House track with soulful vocals, warm basslines, and a steady 4/4 rhythm."
  },
  {
    id: 'afrobeat',
    label: 'Afrobeat',
    icon: Radio,
    color: 'from-yellow-500 to-amber-600',
    shadow: 'shadow-yellow-500/20',
    glow: 'group-hover:shadow-yellow-500/15',
    prompt: "An uplifting Afrobeat track with layered percussion, infectious guitar riffs, and vibrant horn sections."
  },
  {
    id: 'ambient',
    label: 'Ambient',
    icon: Layers,
    color: 'from-sky-400 to-indigo-500',
    shadow: 'shadow-sky-400/20',
    glow: 'group-hover:shadow-sky-400/15',
    prompt: "A serene Ambient soundscape with evolving textures, gentle drones, and crystalline reverb tails."
  },
];

const SonicTiles: React.FC<SonicTilesProps> = ({ setInputText }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-2.5">
      {TILES.map((tile) => (
        <button
          key={tile.id}
          onClick={() => setInputText(tile.prompt)}
          className={`group relative overflow-hidden rounded-xl p-3 md:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${tile.glow} border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center gap-2 md:gap-2.5 h-[5.5rem] md:h-[6.5rem]`}
          title={tile.prompt}
        >
          {/* Color bleed on hover */}
          <div className={`absolute inset-0 bg-gradient-to-br ${tile.color} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500`} />

          {/* Icon */}
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br ${tile.color} flex items-center justify-center shadow-md ${tile.shadow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-1 ring-white/10`}>
            <tile.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>

          {/* Label */}
          <span className="text-[9px] md:text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors uppercase tracking-wider text-center leading-tight">
            {tile.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SonicTiles;
