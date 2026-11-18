import { Message, AIMusicIntent, MusicSuggestion } from "../types";
import { getGeminiKey, MissingApiKeyError } from "./byok";

// Type enum — mirrors @google/genai Type without importing the SDK at module level.
// This avoids the "An API Key must be set" crash in production where the SDK is unused.
const Type = {
    STRING: "STRING" as const,
    BOOLEAN: "BOOLEAN" as const,
    OBJECT: "OBJECT" as const,
    ARRAY: "ARRAY" as const,
    NUMBER: "NUMBER" as const,
};

// Lazy-loaded Gemini SDK, created with the user's own key (BYOK). No proxy, no bundled key.
let _ai: any = null;
let _aiKey = '';

const getAI = async () => {
    const key = getGeminiKey();
    if (!key) throw new MissingApiKeyError('gemini');
    if (!_ai || _aiKey !== key) {
        const { GoogleGenAI } = await import("@google/genai");
        _ai = new GoogleGenAI({ apiKey: key });
        _aiKey = key;
    }
    return _ai;
};

const generateContent = async (params: { model: string; contents: any; config?: any }) => {
    const ai = await getAI();
    return ai.models.generateContent(params);
};

const MUSIC_SYSTEM_INSTRUCTION = `
You are AIM8, an elite AI Music Producer & Creative Director.
Your Persona: Energetic, Creative, Proactive, and Multilingual.
You are not just a tool; you are a visionary creative partner.

Analyze the conversation history and the latest user message.
Determine the User's Intent:

1. **CHAT / BRAINSTORM**: If the request is vague, asks for an opinion, or needs clarification.
   - **Reply**: Pitch ideas! Don't just ask "what do you want?". Say "I'm thinking a high-energy House track for this. Thoughts?"
   - **Language**: Respond in the same language the user is speaking.
   - **Action**: "chat"

2. **GENERATE**: If the user wants to create music and has provided enough intent (Vibe, Genre, Topic, or specific Style).
   - **Action**: "generate"
   - **Construct \`SunoGenerationParams\`**:
     - **style**: CRITICAL. Expand the user's genre request into a rich, comma-separated list of 6-12 descriptive tags.
       - Include: Sub-genre, Instrumentation, Vibe, Tempo/Rhythm, Production Style.
       - *Example*: "Cyberpunk" -> "Dark Synthwave, Arpeggiated Bass, Neon Atmosphere, 140bpm, Distorted Drums, Cinematic, Retro-Futuristic"
       - *Example*: "Acoustic Ballad" -> "Folk Pop, Acoustic Guitar, Intimate Vocals, Soft Piano, Emotional, Slow Tempo, Reverb"
     - **prompt**:
       - **IF VOCAL (instrumental=false)**:
         - **If user provided lyrics**: USE THEM EXACTLY. Do not rewrite them. You may add structure tags like [Verse] or [Chorus] if missing, but keep the words.
         - **If no lyrics provided**: Write FULL CREATIVE LYRICS.
           - **Language**: CRITICAL. If the user input is in a different language (e.g., Spanish, French, Japanese, German), **WRITE THE LYRICS IN THAT LANGUAGE**. Do not default to English.
           - Structure is MANDATORY: Use [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro] tags.
           - Content: Avoid clichés. Use specific imagery and strictly adhere to the user's topic.
           - Length: 1 Verse + 1 Chorus minimum.
       - **IF INSTRUMENTAL (instrumental=true)**: Write a vivid description of the musical progression (e.g., "Slow atmospheric build-up leading into a heavy bass drop").
     - **voiceType**: Extract specific vocal styles (e.g., "Gravelly Male", "Ethereal Female", "Robot", "Choir").
     - **musicalKey**: Deduce the best key for the mood if not specified (e.g., Sad/Dark -> "C Minor", Happy/Pop -> "G Major").
     - **musicalScale**: Deduce the scale (Major, Minor, Pentatonic, Phrygian, etc.).

**Response Guidelines**:
- **If Generating**: Be exciting and specific. Confirm the creative choices you made.
  - *Good*: "Locked in. crafting a gritty 'Industrial Techno' track in F Minor with distorted kicks. Lyrics focus on the rise of AI."
- **If Chatting**: Be helpful and proactive. Ask relevant follow-up questions.
  - *Good*: "I can definitely do a Jazz track. Are we thinking smooth 'Coffee Shop Jazz' or chaotic 'Bebop'?"

**Output JSON ONLY.**
`;

// 1. Fast Intent Analysis (Music) using Flash
export const analyzeMusicIntent = async (history: Message[]): Promise<AIMusicIntent> => {
    try {
        const conversationText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const response = await generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Current conversation:\n${conversationText}\n\nAnalyze the user's latest intent for music creation.`,
            config: {
                systemInstruction: MUSIC_SYSTEM_INSTRUCTION,
                temperature: 0.8, // Slightly higher for creativity
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, enum: ["chat", "generate"] },
                        reply: { type: Type.STRING },
                        params: {
                            type: Type.OBJECT,
                            properties: {
                                prompt: { type: Type.STRING },
                                instrumental: { type: Type.BOOLEAN },
                                style: { type: Type.STRING },
                                title: { type: Type.STRING },
                                voiceType: { type: Type.STRING, nullable: true },
                                musicalKey: { type: Type.STRING, nullable: true },
                                musicalScale: { type: Type.STRING, nullable: true },
                            },
                            nullable: true
                        }
                    },
                    required: ["action", "reply"]
                }
            },
        });

        const text = response.text;
        if (!text) throw new Error("No response from Gemini");

        return JSON.parse(text) as AIMusicIntent;
    } catch (error: any) {
        console.error("Gemini Analysis Error:", error);
        return {
            action: 'chat',
            reply: error instanceof MissingApiKeyError
                ? error.message
                : `Gemini request failed with your API key: ${error?.message || 'unknown error'}`
        };
    }
};

// 2. Deep Chat with Thinking & Video Understanding
export const chatWithThinking = async (history: Message[], currentMessage: string, attachment?: { data: string, mimeType: string }): Promise<string> => {
    const contents = [];

    // Add simplified history with correct roles
    history.forEach(msg => {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        });
    });

    // Build current user message with optional attachment (Video/Image)
    const userParts: any[] = [];
    if (attachment) {
        userParts.push({
            inlineData: {
                data: attachment.data,
                mimeType: attachment.mimeType
            }
        });
    }
    userParts.push({ text: currentMessage });

    contents.push({
        role: 'user',
        parts: userParts
    });

    try {
        const response = await generateContent({
            model: "gemini-3-pro-preview", // Thinking & Video understanding
            contents: contents,
            config: {
                thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget
                systemInstruction: "You are AIM8. Be interactive, concise, and straight to the point. Do not waffle. Provide direct answers. If you need more information to answer a question, ask for it directly."
            }
        });

        return response.text || "I couldn't generate a response.";
    } catch (error) {
        console.warn("Gemini 3 Pro Thinking failed, falling back to Flash:", error);
        // Fallback to Flash
        try {
            const response = await generateContent({
                model: "gemini-3-flash-preview",
                contents: contents,
                config: {
                    systemInstruction: "You are AIM8. Be interactive, concise, and straight to the point."
                }
            });
            return response.text || "I couldn't generate a response.";
        } catch (fallbackError: any) {
            throw fallbackError;
        }
    }
};

// 3. Generate Speech (TTS)
export const generateSpeech = async (text: string): Promise<string> => {
    const response = await generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text }] },
        config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    return base64Audio; // Return base64 PCM
};

// 4. Transcribe Audio
export const transcribeAudio = async (audioBase64: string): Promise<string> => {
    const response = await generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
                { text: "Transcribe this audio exactly. Do not add any other text." }
            ]
        }
    });
    return response.text || "";
};

// 5. Generate Creative Prompt (Idea Generator)
export const generateCreativePrompt = async (history: Message[] = []): Promise<string> => {
    // Extract recent user messages to understand their taste
    const userHistory = history
        .filter(m => m.role === 'user')
        .slice(-5)
        .map(m => m.content)
        .join('; ');

    const systemPrompt = `
    You are a musical muse. Generate a highly creative, specific music prompt.
    
    User Context (History): ${userHistory || "None (Fresh session)"}
    
    Instructions:
    1. Analyze the User Context to match their preferred vibe/genre if available.
    2. If context is empty, look for current viral music trends (e.g. Phonk, Hyperpop, Lo-Fi, Synthwave revivals).
    3. Generate a prompt that fuses genres (e.g. "Gregorian Chant Phonk", "Jazz-Metal Fusion") or describes a vivid scene.
    4. Suggest a specific mood, tempo, and instruments.
    5. Keep it concise (under 200 chars).
    6. Output ONLY the prompt string.
    `;

    try {
        const response = await generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [{ text: systemPrompt }]
            },
            config: {
                temperature: 1.0 // High creativity
            }
        });
        const text = response.text?.trim();
        if (!text) throw new Error("Gemini returned an empty prompt.");
        return text;
    } catch (e) {
        throw e;
    }
};

// 6. Structured Brainstorming Suggestions
// 6. Structured Brainstorming Suggestions

export const getMusicSuggestions = async (history: Message[] = []): Promise<MusicSuggestion[]> => {
    const userHistory = history.filter(m => m.role === 'user').slice(-3).map(m => m.content).join('; ');

    const systemPrompt = `
    You are a world-class Music Creative Director. Brainstorm 3 distinct, viral, and high-impact song concepts.
    
    User Context: ${userHistory || "Fresh studio session"}
    
    Generate 3 concepts with:
    1. **title**: A punchy, creative title.
    2. **genre**: A specific genre or fusion (e.g., "Deep House / Soul Fusion").
    3. **mood**: The emotional emotional core (e.g., "Bittersweet", "Electric", "Nostalgic").
    4. **theme**: The lyrical or instrumental narrative focus.
    5. **prompt**: A highly detailed music prompt for generating including style, instruments, and mood.
    
    Ensure the concepts are diverse (one chill, one high energy, one experimental).
    Output JSON ONLY.
    `;

    try {
        const response = await generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            genre: { type: Type.STRING },
                            mood: { type: Type.STRING },
                            theme: { type: Type.STRING },
                            prompt: { type: Type.STRING }
                        },
                        required: ["title", "genre", "mood", "theme", "prompt"]
                    }
                }
            }
        });

        const text = response.text;
        return text ? JSON.parse(text) : [];
    } catch (e) {
        console.error("Suggestions failed", e);
        return [];
    }
};

// 7. Lyrics Suggestion Engine
export const suggestLyrics = async (currentLyrics: string, history: Message[]): Promise<string[]> => {
    const conversationText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    try {
        const response = await generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Conversation Context:\n${conversationText}\n\nCurrent Lyrics:\n${currentLyrics}\n\nTask: Suggest the absolute best next 3 creative lines for this song. They should rhyme or flow perfectly with the current structure. Return ONLY a JSON array of 3 strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                temperature: 0.9
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        console.error("Lyrics suggestion error", e);
        return [];
    }
};

// 8. Generate Complete Lyrics
export const generateCompleteLyrics = async (history: Message[], currentLyrics: string): Promise<string> => {
    const header = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt = `
    Based on the following conversation history and current lyrics draft, write the COMPLETE lyrics for the song.
    Ensure good structure (Verse, Chorus, Bridge, Outro).
    
    Conversation Context:
    ${header}

    Current Draft:
    "${currentLyrics}"
    
    Output ONLY the lyrics. No markdown code blocks.
    `;

    try {
        const response = await generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        return response.text || currentLyrics;
    } catch (e) {
        console.error("Lyrics generation error", e);
        return currentLyrics; // Fallback
    }
};

// 9. Generate Creative Track Name
export const generateTrackName = async (description: string, style: string): Promise<string> => {
    const prompt = `
    Generate a short, creative, and punchy song title based on this description and style.
    
    Description: "${description}"
    Style: "${style}"
    
    Rules:
    - Max 3-4 words.
    - No quotes.
    - Catchy and relevant to the genre.
    - Output ONLY the title.
    `;

    try {
        const response = await generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: prompt
        });
        const title = response.text?.trim().replace(/['"]/g, '');
        return title || "Untitled Track"; // Fallback
    } catch (e) {
        console.error("Title generation error", e);
        if (e instanceof MissingApiKeyError) throw e;
        return "Untitled Track";
    }
};

