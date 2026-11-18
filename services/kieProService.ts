/**
 * KIE.ai Pro Service — Complete API Client
 * All 12 endpoints for the Pro Studio experience
 */

const API_BASE = 'https://api.kie.ai/api/v1';
const CALLBACK_URL = 'https://example.com/api/callback';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KieModel = 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5';

export type TaskStatus =
    | 'PENDING'
    | 'TEXT_SUCCESS'
    | 'FIRST_SUCCESS'
    | 'SUCCESS'
    | 'CREATE_TASK_FAILED'
    | 'GENERATE_AUDIO_FAILED'
    | 'CALLBACK_EXCEPTION'
    | 'SENSITIVE_WORD_ERROR';

export interface KieTrack {
    id: string;
    audioUrl: string;
    streamAudioUrl?: string;
    imageUrl?: string;
    prompt?: string;
    title: string;
    tags: string;
    duration: number;
    createTime?: string;
}

export interface KieTaskResult {
    taskId: string;
    status: TaskStatus;
    errorMessage?: string;
    response?: {
        sunoData?: KieTrack[];
    };
}

export interface KieLyricsResult {
    taskId: string;
    status: TaskStatus;
    errorMessage?: string;
    response?: {
        lyricsData?: Array<{
            title: string;
            text: string;
        }>;
    };
}

export interface KieStemResult {
    taskId: string;
    status: TaskStatus;
    response?: {
        vocalUrl?: string;
        instrumentalUrl?: string;
    };
}

export interface KieVideoResult {
    taskId: string;
    status: TaskStatus;
    response?: {
        videoUrl?: string;
    };
}

export interface KieWavResult {
    taskId: string;
    status: TaskStatus;
    response?: {
        wavUrl?: string;
    };
}

export interface KieTimestampedLyric {
    startTime: number;
    endTime: number;
    text: string;
}

// ─── BYOK key resolution ─────────────────────────────────────────────────────

function resolveKey(apiKey: string): string {
    const key = apiKey || getKieKey();
    if (!key) throw new MissingApiKeyError('kie');
    return key;
}

import { getKieKey, MissingApiKeyError } from './byok';

// ─── Fetch with Timeout ──────────────────────────────────────────────────────

const fetchWithTimeout = (url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .catch((err) => {
            if (err.name === 'AbortError') {
                throw new Error('TIMEOUT: The server is taking too long to respond.');
            }
            throw new Error('NETWORK: Check your internet connection and try again.');
        })
        .finally(() => clearTimeout(id));
};

// ─── Error Classifier ────────────────────────────────────────────────────────

/**
 * Converts raw errors into user-friendly messages.
 * Returns { title, body, retryable } for toast display.
 */
export function classifyError(err: any): { title: string; body: string; retryable: boolean } {
    const msg: string = err?.message || String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('timeout') || lower.includes('taking too long')) {
        return { title: 'Request Timeout', body: 'The AI server is busy. Please try again in a moment.', retryable: true };
    }
    if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('connection')) {
        return { title: 'Connection Error', body: 'Could not reach the server. Check your internet and try again.', retryable: true };
    }
    if (lower.includes('key') || lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
        return { title: 'Auth Error', body: 'Your API key is invalid or expired. Please check your settings.', retryable: false };
    }
    if (lower.includes('sensitive') || lower.includes('content policy') || lower.includes('moderation')) {
        return { title: 'Content Blocked', body: 'Your prompt contains restricted content. Rephrase and try again.', retryable: false };
    }
    if (lower.includes('generation timeout') || lower.includes('taking longer than expected')) {
        return { title: 'Generation Timeout', body: 'This is taking longer than expected. Your track may still be processing — check your library shortly.', retryable: true };
    }
    if (lower.includes('rate limit') || lower.includes('too many')) {
        return { title: 'Rate Limited', body: 'Too many requests. Please wait a minute before trying again.', retryable: true };
    }
    // Generic fallback
    return { title: 'Generation Failed', body: msg || 'Something went wrong. Please try again.', retryable: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function kiePost(endpoint: string, apiKey: string, body: Record<string, any>): Promise<any> {
    apiKey = resolveKey(apiKey);

    const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    }, 30000);
    const data = await res.json();
    if (data.code !== 200) {
        throw new Error(data.msg || `API error (${data.code})`);
    }
    return data.data;
}

async function kieGet(endpoint: string, apiKey: string): Promise<any> {
    apiKey = resolveKey(apiKey);

    const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
    }, 15000);
    const data = await res.json();
    if (data.code !== 200) {
        throw new Error(data.msg || `API error (${data.code})`);
    }
    return data.data;
}

// ─── 1. Generate Music ──────────────────────────────────────────────────────

export interface GenerateMusicParams {
    prompt: string;
    customMode?: boolean;
    instrumental?: boolean;
    model?: KieModel;
    style?: string;
    title?: string;
    negativeTags?: string;
    personaId?: string;
    guidanceScale?: number;
    steps?: number;
}

export async function generateMusic(apiKey: string, params: GenerateMusicParams): Promise<string> {
    const body: any = {
        prompt: params.prompt,
        customMode: params.customMode ?? false,
        instrumental: params.instrumental ?? false,
        model: params.model || 'V4_5',
        callBackUrl: CALLBACK_URL,
    };
    if (params.customMode) {
        if (params.style) body.style = params.style;
        if (params.title) body.title = params.title;
    }
    if (params.negativeTags) body.negativeTags = params.negativeTags;
    if (params.personaId) body.personaId = params.personaId;
    if (params.guidanceScale) body.guidance_scale = params.guidanceScale;
    if (params.steps) body.num_steps = params.steps;

    const data = await kiePost('/generate', apiKey, body);
    return data.taskId;
}

// ─── 2. Extend Music ────────────────────────────────────────────────────────

export interface ExtendMusicParams {
    audioId: string;
    defaultParamFlag?: boolean;
    model?: KieModel;
    prompt?: string;
    style?: string;
    title?: string;
    continueAt?: number; // seconds
}

export async function extendMusic(apiKey: string, params: ExtendMusicParams): Promise<string> {
    const body: any = {
        audioId: params.audioId,
        defaultParamFlag: params.defaultParamFlag ?? false,
        model: params.model || 'V4_5',
        callBackUrl: CALLBACK_URL,
    };
    if (params.defaultParamFlag) {
        if (params.prompt) body.prompt = params.prompt;
        if (params.style) body.style = params.style;
        if (params.title) body.title = params.title;
        if (params.continueAt != null) body.continueAt = params.continueAt;
    }

    const data = await kiePost('/generate/extend', apiKey, body);
    return data.taskId;
}

// ─── 3. Generate Lyrics ─────────────────────────────────────────────────────

export async function generateLyrics(apiKey: string, prompt: string): Promise<string> {
    const data = await kiePost('/lyrics', apiKey, {
        prompt,
        callBackUrl: CALLBACK_URL,
    });
    return data.taskId;
}

// ─── 4. Upload & Cover Audio ────────────────────────────────────────────────

export interface UploadCoverParams {
    uploadUrl: string;
    prompt: string;
    customMode?: boolean;
    instrumental?: boolean;
    model?: KieModel;
    style?: string;
    title?: string;
    negativeTags?: string;
}

export async function uploadAndCover(apiKey: string, params: UploadCoverParams): Promise<string> {
    const body: any = {
        prompt: params.prompt,
        uploadUrl: params.uploadUrl,
        customMode: params.customMode ?? false,
        instrumental: params.instrumental ?? false,
        model: params.model || 'V4_5',
        callBackUrl: CALLBACK_URL,
    };
    if (params.customMode) {
        if (params.style) body.style = params.style;
        if (params.title) body.title = params.title;
    }
    if (params.negativeTags) body.negativeTags = params.negativeTags;

    const data = await kiePost('/generate', apiKey, body);
    return data.taskId;
}

// ─── 5. Upload & Extend Audio ───────────────────────────────────────────────

export interface UploadExtendParams {
    uploadUrl: string;
    prompt?: string;
    style?: string;
    title?: string;
    customMode?: boolean;
    instrumental?: boolean;
    model?: KieModel;
    continueAt?: number;
}

export async function uploadAndExtend(apiKey: string, params: UploadExtendParams): Promise<string> {
    const body: any = {
        uploadUrl: params.uploadUrl,
        customMode: params.customMode ?? false,
        instrumental: params.instrumental ?? false,
        model: params.model || 'V4_5',
        callBackUrl: CALLBACK_URL,
    };
    if (params.prompt) body.prompt = params.prompt;
    if (params.style) body.style = params.style;
    if (params.title) body.title = params.title;
    if (params.continueAt != null) body.continueAt = params.continueAt;

    const data = await kiePost('/generate/extend', apiKey, body);
    return data.taskId;
}

// ─── 6. Add Instrumental ────────────────────────────────────────────────────

export interface AddInstrumentalParams {
    uploadUrl: string;
    title?: string;
    model?: KieModel;
    tags?: string;
    negativeTags?: string;
    styleWeight?: number;
    audioWeight?: number;
    weirdnessConstraint?: number;
    vocalGender?: 'male' | 'female';
}

export async function addInstrumental(apiKey: string, params: AddInstrumentalParams): Promise<string> {
    const body: any = {
        uploadUrl: params.uploadUrl,
        model: params.model || 'V4_5',
        callBackUrl: CALLBACK_URL,
    };
    if (params.title) body.title = params.title;
    if (params.tags) body.tags = params.tags;
    if (params.negativeTags) body.negativeTags = params.negativeTags;
    if (params.styleWeight != null) body.styleWeight = params.styleWeight;
    if (params.audioWeight != null) body.audioWeight = params.audioWeight;
    if (params.weirdnessConstraint != null) body.weirdnessConstraint = params.weirdnessConstraint;
    if (params.vocalGender) body.vocalGender = params.vocalGender;

    const data = await kiePost('/add-instrumental/generate', apiKey, body);
    return data.taskId;
}

// ─── 7. Add Vocals ──────────────────────────────────────────────────────────

export interface AddVocalsParams {
    uploadUrl: string;
    prompt?: string;
    style?: string;
    model?: KieModel;
    tags?: string;
    negativeTags?: string;
    vocalGender?: 'male' | 'female';
    styleWeight?: number;
    audioWeight?: number;
    weirdnessConstraint?: number;
}

export async function addVocals(apiKey: string, params: AddVocalsParams): Promise<string> {
    const body: any = {
        uploadUrl: params.uploadUrl,
        model: params.model || 'V4_5',
        callBackUrl: CALLBACK_URL,
    };
    if (params.prompt) body.prompt = params.prompt;
    if (params.style) body.style = params.style;
    if (params.tags) body.tags = params.tags;
    if (params.negativeTags) body.negativeTags = params.negativeTags;
    if (params.vocalGender) body.vocalGender = params.vocalGender;
    if (params.styleWeight != null) body.styleWeight = params.styleWeight;
    if (params.audioWeight != null) body.audioWeight = params.audioWeight;
    if (params.weirdnessConstraint != null) body.weirdnessConstraint = params.weirdnessConstraint;

    const data = await kiePost('/add-vocals/generate', apiKey, body);
    return data.taskId;
}

// ─── 8. Separate Vocals (Stem Separation) ───────────────────────────────────

export async function separateVocals(apiKey: string, taskId: string, audioId: string): Promise<string> {
    const data = await kiePost('/vocal-removal/generate', apiKey, {
        taskId,
        audioId,
        callBackUrl: CALLBACK_URL,
    });
    return data.taskId;
}

// ─── 9. Generate Music Video ────────────────────────────────────────────────

export async function generateMusicVideo(apiKey: string, taskId: string, audioId: string): Promise<string> {
    const data = await kiePost('/mp4/generate', apiKey, {
        taskId,
        audioId,
        author: 'AIM-8 Pro Studio',
        domainName: 'aim8.io',
        callBackUrl: CALLBACK_URL,
    });
    return data.taskId;
}

// ─── 10. Convert to WAV ─────────────────────────────────────────────────────

export async function convertToWav(apiKey: string, taskId: string, audioId: string): Promise<string> {
    const data = await kiePost('/wav/generate', apiKey, {
        taskId,
        audioId,
        callBackUrl: CALLBACK_URL,
    });
    return data.taskId;
}

// ─── 11. Boost Style ────────────────────────────────────────────────────────

export async function boostStyle(apiKey: string, content: string): Promise<string> {
    const data = await kiePost('/style/generate', apiKey, { content });
    return data.result;
}

// ─── 12. Poll Task Status (shared) ──────────────────────────────────────────

export type PollResultType = 'music' | 'video' | 'wav' | 'lyrics' | 'stems';

export async function pollTaskStatus(
    apiKey: string,
    taskId: string,
    type: PollResultType = 'music',
    onProgress?: (msg: string) => void,
): Promise<any> {
    const maxAttempts = 90; // 15 minutes max (90 × 10s)
    let attempts = 0;

    const endpoint = type === 'video'
        ? `/mp4/record-info?taskId=${taskId}`
        : type === 'wav'
            ? `/wav/record-info?taskId=${taskId}`
            : type === 'lyrics'
                ? `/lyrics/record-info?taskId=${taskId}`
                : type === 'stems'
                    ? `/vocal-removal/record-info?taskId=${taskId}`
                    : `/generate/record-info?taskId=${taskId}`;

    /** For music tasks, check that the returned tracks actually have playable audio */
    const hasValidAudio = (response: any): boolean => {
        if (type !== 'music') return true; // Only validate music tracks
        const tracks: KieTrack[] | undefined = response?.sunoData;
        if (!tracks || tracks.length === 0) return false;
        // Only require a non-empty audioUrl — duration may be 0 or absent even when audio is playable
        return tracks.some(t => !!t.audioUrl);
    };

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const data = await kieGet(endpoint, apiKey);
                const status: TaskStatus = data.status || data.successFlag;

                if (status === 'SUCCESS' || status === 'FIRST_SUCCESS' || status === 'TEXT_SUCCESS') {
                    // Validate: are tracks actually ready with audio?
                    if (hasValidAudio(data.response)) {
                        onProgress?.('Complete!');
                        resolve(data.response);
                        return;
                    }
                    // Tracks exist but no audio URL yet — keep polling briefly
                    attempts++;
                    if (attempts >= maxAttempts || (status === 'SUCCESS' && attempts >= 3)) {
                        // Accept whatever we have after enough retries or full SUCCESS
                        onProgress?.('Complete!');
                        resolve(data.response);
                        return;
                    }
                    onProgress?.(`Audio rendering in progress... (${attempts * 10}s)`);
                    setTimeout(poll, 10000);
                    return;
                }

                if (
                    status === 'CREATE_TASK_FAILED' ||
                    status === 'GENERATE_AUDIO_FAILED' ||
                    status === 'SENSITIVE_WORD_ERROR' ||
                    status === 'CALLBACK_EXCEPTION'
                ) {
                    reject(new Error(data.errorMessage || `Task failed (${status})`));
                    return;
                }

                // PENDING — keep polling
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(new Error('Generation timeout — please try again'));
                    return;
                }

                const progressMessages: Record<PollResultType, string[]> = {
                    music: ['Queued...', 'Composing melody...', 'Synthesizing vocals...', 'Arranging structure...', 'Mastering...'],
                    video: ['Queued...', 'Rendering frames...', 'Compositing video...', 'Encoding...'],
                    wav: ['Queued...', 'Converting to lossless WAV...', 'Finalizing...'],
                    lyrics: ['Queued...', 'Writing lyrics...', 'Formatting sections...'],
                    stems: ['Queued...', 'Separating vocals...', 'Isolating instrumental...', 'Finalizing stems...'],
                };
                const msgs = progressMessages[type];
                onProgress?.(msgs[Math.min(Math.floor(attempts / 3), msgs.length - 1)] + ` (${attempts * 10}s)`);

                setTimeout(poll, 10000);
            } catch (err) {
                // Network errors during polling should NOT immediately fail — retry
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(err);
                    return;
                }
                onProgress?.(`Connection hiccup, retrying... (${attempts * 10}s)`);
                setTimeout(poll, 10000);
            }
        };
        poll();
    });
}

// ─── 13. Get Timestamped Lyrics ─────────────────────────────────────────────

export async function getTimestampedLyrics(
    apiKey: string,
    taskId: string,
    audioId: string
): Promise<KieTimestampedLyric[]> {
    const data = await kieGet(
        `/lyrics/record-info?taskId=${taskId}&audioId=${audioId}`,
        apiKey,
    );
    return data.response?.lyricsData || [];
}

// ─── Upload Helper (Kie.ai File Upload API, BYOK) ───────────────────────────
// Uploads go to Kie.ai's own temporary file storage with the user's key.
// Kie deletes uploaded files after 24 hours.

export async function uploadAudioToStorage(file: File): Promise<string> {
    const apiKey = resolveKey('');
    const form = new FormData();
    form.append('file', file);
    form.append('uploadPath', 'aim8/uploads');
    const res = await fetchWithTimeout('https://kieai.redpandaai.co/api/file-stream-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: form,
    }, 120000);
    const data = await res.json();
    if (data.code !== 200 || !data.data?.downloadUrl) {
        throw new Error(data.msg || `Upload failed (${data.code})`);
    }
    return data.data.downloadUrl as string;
}
