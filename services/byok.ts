/**
 * Bring-your-own-key (BYOK) storage.
 *
 * AIM-8 Sonic Studio ships with NO API keys. Every request to Kie.ai (Suno music
 * generation) and Google Gemini is made directly from the user's browser with the
 * key that user typed into the "API Keys" screen. Keys are kept only in this
 * browser's localStorage and are never sent anywhere except the provider's own API.
 */

const STORAGE_KEY = 'aim8_byok_keys';
const CHANGE_EVENT = 'aim8-byok-change';

export interface ByokKeys {
    kie: string;
    gemini: string;
}

export class MissingApiKeyError extends Error {
    provider: 'kie' | 'gemini';
    constructor(provider: 'kie' | 'gemini') {
        super(
            provider === 'kie'
                ? 'Missing Kie.ai API key. Open "API Keys" and enter your own key to continue.'
                : 'Missing Gemini API key. Open "API Keys" and enter your own key to continue.'
        );
        this.name = 'MissingApiKeyError';
        this.provider = provider;
    }
}

export function getKeys(): ByokKeys {
    if (typeof window === 'undefined') return { kie: '', gemini: '' };
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
        return { kie: String(parsed.kie || '').trim(), gemini: String(parsed.gemini || '').trim() };
    } catch {
        return { kie: '', gemini: '' };
    }
}

export function saveKeys(keys: ByokKeys): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ kie: keys.kie.trim(), gemini: keys.gemini.trim() }));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearKeys(): void {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const getKieKey = (): string => getKeys().kie;
export const getGeminiKey = (): string => getKeys().gemini;

/** Both keys are required before the studio does anything. */
export const hasRequiredKeys = (): boolean => {
    const k = getKeys();
    return !!k.kie && !!k.gemini;
};

export function requireKieKey(): string {
    const key = getKieKey();
    if (!key) throw new MissingApiKeyError('kie');
    return key;
}

export function requireGeminiKey(): string {
    const key = getGeminiKey();
    if (!key) throw new MissingApiKeyError('gemini');
    return key;
}

export function onKeysChange(cb: () => void): () => void {
    const handler = () => cb();
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
        window.removeEventListener(CHANGE_EVENT, handler);
        window.removeEventListener('storage', handler);
    };
}
