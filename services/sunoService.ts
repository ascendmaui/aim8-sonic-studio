
import { SunoGenerationParams, SunoTrack, SunoPersona } from "../types";
import { getKieKey, MissingApiKeyError } from "./byok";

const API_BASE = 'https://api.kie.ai/api/v1';




/** Fetch with a timeout — throws a friendly error if the request takes too long */
const fetchWithTimeout = (url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .catch((err) => {
            if (err.name === 'AbortError') {
                throw new Error('The server is taking too long to respond. Please try again in a moment.');
            }
            throw new Error('Network error — check your internet connection and try again.');
        })
        .finally(() => clearTimeout(id));
};



const callKieApi = async (
    endpoint: string,
    apiKey: string,
    options: { method?: string; body?: any; timeoutMs?: number } = {}
): Promise<any> => {
    const { method = 'GET', body, timeoutMs = 30000 } = options;

    // BYOK only: always the user's own key. No bundled key, no proxy, no demo fallback.
    apiKey = apiKey || getKieKey();
    if (!apiKey) throw new MissingApiKeyError('kie');

    const fetchOptions: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
    };
    if (body) fetchOptions.body = JSON.stringify(body);

    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, fetchOptions, timeoutMs);
    return response.json();
};

export const generateMusicTask = async (params: SunoGenerationParams, apiKey: string): Promise<string> => {
    // Construct style string with voice type if applicable
    const styleBase = params.style || '';
    let voiceTagString = params.voiceType || '';

    // Check if voiceType is our new JSON format (contains tags, gender, etc)
    try {
        const trimmed = voiceTagString.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const parsed = JSON.parse(trimmed);
            if (parsed.tags) {
                voiceTagString = parsed.tags;
            }
        }
    } catch (e) {
        // Not JSON, proceed as plain string
    }

    const voiceTag = voiceTagString && !params.instrumental ? `${voiceTagString} vocals` : '';

    // Map pitch value to tags
    let pitchTag = '';
    if (params.voicePitch && !params.instrumental) {
        const p = params.voicePitch;
        if (p <= -2) pitchTag = 'Very Deep Pitch, Low Voice';
        else if (p <= -1) pitchTag = 'Low Pitch, Deep Voice';
        else if (p >= 2) pitchTag = 'Very High Pitch, Chipmunk style';
        else if (p >= 1) pitchTag = 'High Pitch, Youthful';
    }

    // Incorporate Musical Key and Scale
    let theoryTag = '';
    if (params.musicalKey) {
        theoryTag += `${params.musicalKey} `;
    }
    if (params.musicalScale) {
        theoryTag += params.musicalScale;
    }
    theoryTag = theoryTag.trim();

    // Sanitize and Truncate Style (Max 120 chars recommended for stability)
    const rawStyle = [styleBase, voiceTag, pitchTag, theoryTag].filter(Boolean).join(', ');
    const finalStyle = rawStyle.slice(0, 180).replace(/[^\w\s,\-]/g, ''); // Remove special chars that might break API

    // Ensure prompt is present
    const finalPrompt = params.prompt?.trim() || (params.instrumental ? "A creative instrumental composition" : "[Instrumental Intro]");

    // Ensure instrumental is strictly boolean (false default) to prevent "cannot be null" errors
    const isInstrumental = params.instrumental === true;

    // Map model to API values
    const modelMap: Record<string, string> = { 'V3': 'V3', 'V3_5': 'V3_5', 'V4': 'V4', 'V4_5': 'V4_5', 'V4_5PLUS': 'V4_5PLUS', 'V4_5ALL': 'V4_5ALL', 'V5': 'V5' };
    const selectedModel = params.model || 'V4_5';

    const body: any = {
        // Required by API/Proxy
        callBackUrl: "https://example.com/api/callback",
        customMode: true,

        // Primary Fields
        prompt: finalPrompt,
        style: finalStyle,
        title: params.title?.slice(0, 80) || "Untitled", // Truncate title
        instrumental: isInstrumental,
        model: modelMap[selectedModel] || 'V4_5',
    };

    if (params.personaId) {
        body.persona_id = params.personaId;
    }

    if (params.guidanceScale) {
        body.guidance_scale = params.guidanceScale;
    }

    if (params.steps) {
        body.num_steps = params.steps;
    }

    const result = await callKieApi('/generate', apiKey, { method: 'POST', body, timeoutMs: 30000 });

    if (result.code !== 200) {
        const msg = result.msg || '';
        if (msg.toLowerCase().includes('key') || msg.toLowerCase().includes('auth')) {
            throw new Error('API key is invalid or expired. Please check your settings.');
        }
        throw new Error(msg || 'Music generation request failed. The server may be busy — try again shortly.');
    }

    return result.data.taskId;
};

export const pollTaskStatus = async (
    taskId: string,
    apiKey: string,
    onProgress?: (text: string) => void
): Promise<SunoTrack[]> => {
    const maxAttempts = 60; // 10 minutes max
    let attempts = 0;
    let successPollCount = 0; // Count polls after first SUCCESS-like status

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const result = await callKieApi(`/generate/record-info?taskId=${taskId}`, apiKey, { timeoutMs: 15000 });

                if (result.code !== 200) {
                    throw new Error('Could not check generation status. Will retry shortly...');
                }

                const status = result.data.status;

                if (status === 'SUCCESS' || status === 'FIRST_SUCCESS' || status === 'TEXT_SUCCESS') {
                    const tracks = (result.data.response?.sunoData || []) as SunoTrack[];

                    // Normalize: use streamAudioUrl as fallback for audioUrl
                    const normalizedTracks = tracks.map((t: any) => ({
                        ...t,
                        audioUrl: t.audioUrl || t.streamAudioUrl || '',
                    }));

                    // Check if any track has a usable audio URL
                    const hasAudio = normalizedTracks.length > 0 && normalizedTracks.some((t: any) => !!t.audioUrl);

                    if (hasAudio) {
                        // If we have audioUrl (not just streamAudioUrl), resolve immediately
                        const hasFinalAudio = normalizedTracks.some((t: any) => !!t.audioUrl && t.audioUrl !== t.streamAudioUrl);

                        if (hasFinalAudio || status === 'SUCCESS' || successPollCount >= 15) {
                            // Final audio is ready, or we've waited long enough
                            if (onProgress) onProgress("Complete!");
                            const tracksWithId = normalizedTracks.map((t: any) => ({ ...t, taskId }));
                            resolve(tracksWithId);
                            return;
                        }

                        // We only have streamAudioUrl — keep polling briefly for final audioUrl
                        successPollCount++;
                        if (onProgress) onProgress(`Finalizing high-quality audio... (${successPollCount * 10}s)`);
                        setTimeout(poll, 10000);
                        return;
                    }

                    // No audio at all yet — keep polling
                    successPollCount++;
                    attempts++;
                    if (attempts >= maxAttempts || successPollCount >= 15) {
                        // Accept whatever we have
                        if (onProgress) onProgress("Complete!");
                        const tracksWithId = normalizedTracks.map((t: any) => ({ ...t, taskId }));
                        resolve(tracksWithId);
                        return;
                    }
                    if (onProgress) onProgress(`Rendering audio... (${attempts * 10}s)`);
                    setTimeout(poll, 10000);
                } else if (status === 'CREATE_TASK_FAILED' || status === 'GENERATE_AUDIO_FAILED' || status === 'SENSITIVE_WORD_ERROR') {
                    reject(new Error(result.data.errorMessage || 'Generation failed'));
                } else {
                    // PENDING or queued
                    attempts++;

                    if (onProgress) {
                        let msg = "Initializing composition...";
                        if (attempts <= 2) msg = `Queued for generation (${attempts * 10}s)...`;
                        else if (attempts <= 4) msg = `Composing melody & harmony (${attempts * 10}s)...`;
                        else if (attempts <= 7) msg = `Synthesizing vocals & lyrics (${attempts * 10}s)...`;
                        else if (attempts <= 10) msg = `Arranging song structure (${attempts * 10}s)...`;
                        else msg = `Mastering final tracks (${attempts * 10}s)...`;

                        onProgress(msg);
                    }

                    if (attempts >= maxAttempts) {
                        reject(new Error('Generation is taking longer than expected. Your track may still be processing — check your library shortly.'));
                    } else {
                        setTimeout(poll, 10000); // Poll every 10 seconds
                    }
                }
            } catch (error) {
                reject(error);
            }
        };
        poll();
    });
};

export const createPersona = async (
    apiKey: string,
    taskId: string,
    audioId: string,
    name: string,
    description: string
): Promise<SunoPersona> => {
    try {
        const result = await callKieApi('/generate/generate-persona', apiKey, {
            method: 'POST',
            body: { taskId, audioId, name, description },
            timeoutMs: 30000,
        });

        if (result.code !== undefined && result.code !== 200) {
            throw new Error(result.msg || 'Failed to create Persona');
        }

        const data = result.data || result;
        return {
            personaId: data.personaId,
            name: data.name || name,
            description: data.description || description,
            audioId,
        };
    } catch (e: any) {
        console.warn("Kie.ai createPersona failed", e);
        throw e;
    }
};

export const generateVideoTask = async (apiKey: string, taskId: string, audioId: string): Promise<string> => {
    const response = await fetchWithTimeout(`${API_BASE}/mp4/generate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            taskId,
            audioId,
            callBackUrl: "https://example.com/api/callback",
            author: "AIM-8 Studio",
            domainName: "kie.ai"
        })
    }, 30000);

    const result = await response.json();

    if (result.code !== 200) {
        throw new Error(result.msg || 'Video generation request failed');
    }

    return result.data.taskId;
};

export const pollVideoTaskStatus = async (apiKey: string, videoTaskId: string): Promise<string | null> => {
    const maxAttempts = 60;
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const response = await fetchWithTimeout(`${API_BASE}/mp4/record-info?taskId=${videoTaskId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                }, 15000);

                const result = await response.json();

                if (result.code !== 200) {
                    throw new Error('Could not check video status. Will retry shortly...');
                }

                // The status code is inside data, or successFlag depending on response version
                const status = result.data.successFlag || result.data.status;

                if (status === 'SUCCESS') {
                    // The videoUrl is nested in result.data.response.videoUrl based on spec
                    const videoUrl = result.data.response?.videoUrl;
                    if (videoUrl) {
                        resolve(videoUrl);
                    } else {
                        reject(new Error("Video URL not found in success response"));
                    }
                } else if (status === 'CREATE_TASK_FAILED' || status === 'GENERATE_MP4_FAILED') {
                    reject(new Error(result.data.errorMessage || 'Video generation failed'));
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        reject(new Error('Video generation is taking longer than expected. It may still be rendering — check back shortly.'));
                    } else {
                        setTimeout(poll, 5000);
                    }
                }
            } catch (error) {
                reject(error);
            }
        };
        poll();
    });
};
