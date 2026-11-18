import { getGeminiKey, MissingApiKeyError } from "./byok";

const TRENDS_CACHE_SLOT = 'aim8_viral_trends';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface ViralTrend {
    caption: string;
    hook: string;
    vibe: string;
}

interface ViralCache {
    timestamp: number;
    trends: ViralTrend[];
}

// BYOK: calls Gemini directly with the user's own key.
const generateContent = async (params: { model: string; contents: any; config?: any }) => {
    const key = getGeminiKey();
    if (!key) throw new MissingApiKeyError('gemini');
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    return ai.models.generateContent(params);
};

export const checkViralTrendsAndGenerateChorus = async (): Promise<string> => {
    // 1. Check Cache
    const cachedRaw = localStorage.getItem(TRENDS_CACHE_SLOT);
    let trends: ViralTrend[] = [];
    
    if (cachedRaw) {
        try {
            const cached: ViralCache = JSON.parse(cachedRaw);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                trends = cached.trends;
                console.log("AIM-8: Using cached viral trends");
            }
        } catch (e) {
            localStorage.removeItem(TRENDS_CACHE_SLOT);
        }
    }

    // 2. Fetch from Gemini if no cache
    if (trends.length === 0) {
        console.log("AIM-8: Fetching fresh viral trends from Gemini...");
        try {
            const response = await generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    parts: [{ 
                        text: `You are a social media trend analyst. List 5 of the absolute hottest, most viral TikTok/Reels caption hooks trending RIGHT NOW (current year). 
                        For each, give the Caption/Hook and the Vibe.
                        Return JSON array of objects: { caption, hook, vibe }.` 
                    }]
                },
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = response.text;
            if (text) {
                trends = JSON.parse(text);
                localStorage.setItem(TRENDS_CACHE_SLOT, JSON.stringify({
                    timestamp: Date.now(),
                    trends
                }));
            }
        } catch (e) {
            console.error("Viral fetch failed", e);
            throw e;
        }
    }

    // 3. Generate Chorus
    try {
        const trendContext = trends.map(t => `${t.hook} (${t.vibe})`).join(', ');
        const response = await generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [{ 
                    text: `Write a catchy, viral musical Chorus (4-6 lines) based on these trending hooks: ${trendContext}.
                    Mix them into a cohesive, rhythmic earworm.
                    Output ONLY the lyrics. No headers.` 
                }]
            }
        });
        
        let lyrics = response.text?.trim() || "";
        // Clean up markdown if present
        lyrics = lyrics.replace(/\*\*/g, '').replace(/^Chorus:/i, '').trim();
        
        return `[Chorus]\n${lyrics}`;
    } catch (e) {
        console.error("Chorus generation failed", e);
        throw e;
    }
};
