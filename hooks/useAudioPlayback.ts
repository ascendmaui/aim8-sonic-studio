import { useState, useEffect, useRef, useCallback } from 'react';
import { SunoTrack } from '../types';
import { soundManager } from '../services/soundService';

/**
 * useAudioPlayback — shared audio playback hook
 *
 * Manages a single HTML5 audio element and play/pause state.
 * Can be consumed by VoiceStudio, HomePage, GlobalLibrary, or any component
 * that needs track playback.
 */
export function useAudioPlayback() {
    const [activeTrackUrl, setActiveTrackUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playerVisible, setPlayerVisible] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const playTrack = useCallback((track: SunoTrack) => {
        soundManager.playClick();
        if (activeTrackUrl === track.audioUrl && isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            setActiveTrackUrl(track.audioUrl);
            setTimeout(() => {
                audioRef.current?.play();
                setIsPlaying(true);
            }, 50);
            setPlayerVisible(true);
        }
    }, [activeTrackUrl, isPlaying]);

    const togglePlayback = useCallback(() => {
        if (!audioRef.current || !activeTrackUrl) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    }, [isPlaying, activeTrackUrl]);

    const stopPlayback = useCallback(() => {
        audioRef.current?.pause();
        setIsPlaying(false);
        setActiveTrackUrl(null);
        setPlayerVisible(false);
    }, []);

    const handleEnded = useCallback(() => {
        setIsPlaying(false);
    }, []);

    return {
        audioRef,
        activeTrackUrl,
        isPlaying,
        playerVisible,
        setPlayerVisible,
        playTrack,
        togglePlayback,
        stopPlayback,
        handleEnded,
    };
}
