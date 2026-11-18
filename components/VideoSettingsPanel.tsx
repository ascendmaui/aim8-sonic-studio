import React, { useState } from 'react';
import { X, Loader2, Video, Film, CheckCircle } from './icons';
import { SunoTrack } from '../types';
import { generateMusicVideo, pollTaskStatus } from '../services/kieProService';

interface VideoSettingsPanelProps {
    track: SunoTrack;
    apiKey: string;
    onClose: () => void;
    onVideoReady: (videoUrl: string) => void;
}

const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({ track, apiKey, onClose, onVideoReady }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleGenerate = async () => {
        const audioId = track.id;
        const taskId = track.taskId;

        if (!taskId || !audioId) {
            setError('This track is missing required metadata for video generation. Please try re-generating the track.');
            return;
        }

        setIsGenerating(true);
        setError('');
        setProgress('Submitting video generation request...');

        try {
            const videoTaskId = await generateMusicVideo(apiKey, taskId, audioId);
            setProgress('Video queued — rendering in progress...');

            const result = await pollTaskStatus(apiKey, videoTaskId, 'video', (msg) => {
                setProgress(msg);
            });

            const videoUrl: string = result?.videoUrl || result?.mp4Url || result?.url || '';
            if (!videoUrl) throw new Error('Video URL not returned. Please try again.');

            setDone(true);
            setProgress('Video ready!');
            onVideoReady(videoUrl);
        } catch (err: any) {
            console.error('Video generation failed:', err);
            setError(err?.message || 'Video generation failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                            <Video className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold tracking-tight">Generate Music Video</h2>
                            <p className="text-xs text-white/40 truncate max-w-[200px]">{track.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isGenerating} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 transition-colors disabled:opacity-40">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Track preview */}
                    <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                        {track.imageUrl && (
                            <img src={track.imageUrl} alt={track.title} className="w-14 h-14 rounded-xl object-cover flex-none" />
                        )}
                        <div className="min-w-0">
                            <p className="text-white font-semibold truncate">{track.title}</p>
                            <p className="text-xs text-slate-400 truncate">{track.tags}</p>
                        </div>
                    </div>

                    {/* Format info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-center">
                            <p className="text-xs text-slate-500 mb-1">Format</p>
                            <p className="text-sm text-white font-semibold">MP4 Video</p>
                        </div>
                        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-center">
                            <p className="text-xs text-slate-500 mb-1">Style</p>
                            <p className="text-sm text-white font-semibold">AI Visualizer</p>
                        </div>
                        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-center">
                            <p className="text-xs text-slate-500 mb-1">Aspect Ratio</p>
                            <p className="text-sm text-white font-semibold">16:9 + 9:16</p>
                        </div>
                        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-center">
                            <p className="text-xs text-slate-500 mb-1">Platforms</p>
                            <p className="text-sm text-white font-semibold">All</p>
                        </div>
                    </div>

                    {/* Progress / Error / Done */}
                    {isGenerating && (
                        <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl animate-in fade-in">
                            <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-none" />
                            <span className="text-sm text-purple-300 font-medium">{progress}</span>
                        </div>
                    )}

                    {done && (
                        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in fade-in">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-none" />
                            <span className="text-sm text-green-300 font-medium">Video generated and saved to your track!</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in">
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5">
                    {done ? (
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 transition-colors"
                        >
                            Close
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full relative overflow-hidden group py-3.5 rounded-xl font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_auto] animate-gradient" />
                            <div className="relative flex items-center justify-center gap-2">
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Film className="w-5 h-5" />
                                        <span>Generate Video</span>
                                    </>
                                )}
                            </div>
                        </button>
                    )}
                    <p className="text-center text-[10px] text-white/30 mt-3 uppercase tracking-widest">Powered by KIE.ai · ~2–5 min render</p>
                </div>
            </div>
        </div>
    );
};

export default VideoSettingsPanel;
