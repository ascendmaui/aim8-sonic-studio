import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileAudio, Loader2, CheckCircle2 } from 'lucide-react';
import { uploadAudioToStorage } from '../services/kieProService';

interface ProUploaderProps {
    onUpload: (publicUrl: string) => void;
    disabled?: boolean;
    label?: string;
}

const ProUploader: React.FC<ProUploaderProps> = ({ onUpload, disabled, label }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const MAX_DURATION_MINUTES = 8;
    const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/ogg', 'audio/x-m4a', 'audio/aac'];

    const validateAndUpload = useCallback(async (file: File) => {
        setError(null);

        // Check type
        if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a|ogg|aac)$/i)) {
            setError('Unsupported format. Use MP3, WAV, FLAC, M4A, OGG, or AAC.');
            return;
        }

        // Check size (max ~100MB)
        if (file.size > 100 * 1024 * 1024) {
            setError('File too large. Max 100 MB.');
            return;
        }

        setUploading(true);
        setFileName(file.name);

        try {
            const url = await uploadAudioToStorage(file);
            onUpload(url);
        } catch (err: any) {
            setError(err.message || 'Upload failed');
            setFileName(null);
        } finally {
            setUploading(false);
        }
    }, [onUpload]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (disabled || uploading) return;
        const file = e.dataTransfer.files[0];
        if (file) validateAndUpload(file);
    };

    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) validateAndUpload(file);
    };

    return (
        <div className="space-y-2">
            {label && <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>}
            <div
                onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !disabled && !uploading && inputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${dragging
                        ? 'border-amber-400/60 bg-amber-500/10'
                        : fileName && !uploading
                            ? 'border-emerald-400/40 bg-emerald-500/5'
                            : 'border-white/10 hover:border-amber-400/30 bg-slate-900/30 hover:bg-slate-800/30'
                    } ${(disabled || uploading) ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".mp3,.wav,.flac,.m4a,.ogg,.aac"
                    className="hidden"
                    onChange={handleSelect}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                        <p className="text-sm text-amber-300 font-semibold">Uploading {fileName}...</p>
                    </div>
                ) : fileName ? (
                    <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        <p className="text-sm text-emerald-300 font-semibold truncate max-w-full">{fileName}</p>
                        <p className="text-[10px] text-slate-500">Click to change file</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-amber-400" />
                        </div>
                        <p className="text-sm text-slate-300 font-semibold">Drop audio file here or click to browse</p>
                        <p className="text-[10px] text-slate-500">MP3, WAV, FLAC, M4A, OGG • Max {MAX_DURATION_MINUTES} min • Max 100 MB</p>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                    <X className="w-3 h-3" /> {error}
                </p>
            )}
        </div>
    );
};

export default ProUploader;
