import { SunoTrack } from "../types";

/** Cross-browser roundRect polyfill — ctx.roundRect is not available in all browsers */
function canvasRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
) {
    if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, w, h, r);
    } else {
        const ri = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + ri, y);
        ctx.lineTo(x + w - ri, y);
        ctx.arcTo(x + w, y, x + w, y + ri, ri);
        ctx.lineTo(x + w, y + h - ri);
        ctx.arcTo(x + w, y + h, x + w - ri, y + h, ri);
        ctx.lineTo(x + ri, y + h);
        ctx.arcTo(x, y + h, x, y + h - ri, ri);
        ctx.lineTo(x, y + ri);
        ctx.arcTo(x, y, x + ri, y, ri);
        ctx.closePath();
    }
}

export const generateTikTokClip = async (track: SunoTrack): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Setup Canvas (9:16 Aspect Ratio)
            const canvas = document.createElement('canvas');
            canvas.width = 540;
            canvas.height = 960;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not create canvas context");

            // 2. Load Assets
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.src = track.imageUrl;

            // Audio setup
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();

            // Fetch audio data
            const response = await fetch(track.audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            await new Promise((res, rej) => {
                image.onload = res;
                image.onerror = rej;
            });

            // 3. Setup Recording Stream
            const streamDestination = audioCtx.createMediaStreamDestination();
            const canvasStream = canvas.captureStream(30); // 30 FPS

            // Combine Audio and Video tracks
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...streamDestination.stream.getAudioTracks()
            ]);

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : MediaRecorder.isTypeSupported('video/webm')
                        ? 'video/webm'
                        : '';
            const recorderOptions = mimeType ? { mimeType } : {};
            const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);

            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
                // Cleanup
                audioCtx.close();
                resolve(blob);
            };

            // 4. Animation / Drawing Loop
            let startTime = performance.now();
            const duration = 7000; // 7 Seconds strict
            let animationFrameId: number;

            const draw = (now: number) => {
                const elapsed = now - startTime;

                // --- Visuals ---
                // Background (Blurred, Zoomed)
                ctx.filter = 'blur(20px) brightness(0.6)';
                ctx.drawImage(image, -100, -100, canvas.width + 200, canvas.height + 200);

                // Center Art
                ctx.filter = 'none';
                // Simple beat pulse effect
                const pulse = 1 + Math.sin(elapsed / 250) * 0.02;
                const artSize = 300 * pulse;
                const centerX = (canvas.width - artSize) / 2;
                const centerY = (canvas.height - artSize) / 2 - 50;

                // Shadow
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 40;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 20;

                ctx.save();
                ctx.beginPath();
                canvasRoundRect(ctx, centerX, centerY, artSize, artSize, 20);
                ctx.clip();
                ctx.drawImage(image, centerX, centerY, artSize, artSize);
                ctx.restore();

                // Text Overlay
                ctx.shadowColor = 'transparent';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';

                // Title
                ctx.font = 'bold 32px sans-serif';
                ctx.fillText(track.title.substring(0, 20), canvas.width / 2, centerY + artSize + 60);

                // Artist/Tags
                ctx.font = '16px sans-serif';
                ctx.fillStyle = '#ccc';
                ctx.fillText(track.tags.substring(0, 30), canvas.width / 2, centerY + artSize + 90);

                // Existing Watermark (Bottom)
                ctx.font = 'bold 24px sans-serif';
                ctx.fillStyle = '#22d3ee'; // Cyan-400
                ctx.fillText("Made with Aim8.io", canvas.width / 2, canvas.height - 80);

                // NEW: Top Left Watermark (aim8.io)
                // Mimicking ffmpeg: -vf "drawtext=text='aim8.io':fontcolor=white:x=10:y=10:fontsize=40"
                ctx.save();
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = '40px sans-serif';
                ctx.fillStyle = 'white';
                ctx.fillText('aim8.io', 10, 10);
                ctx.restore();

                // Progress Bar
                const progress = Math.min(elapsed / duration, 1);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
                ctx.fillStyle = '#22d3ee';
                ctx.fillRect(0, canvas.height - 10, canvas.width * progress, 10);

                if (elapsed < duration) {
                    animationFrameId = requestAnimationFrame(draw);
                } else {
                    cancelAnimationFrame(animationFrameId);
                    mediaRecorder.stop();
                    source.stop();
                }
            };

            // 5. Start Playback & Recording
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination); // For monitoring (optional)
            source.connect(streamDestination); // For recording

            mediaRecorder.start();
            source.start();
            startTime = performance.now();
            draw(startTime);

        } catch (e) {
            reject(e);
        }
    });
};
