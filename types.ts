export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'audio' | 'video';
  attachment?: string; // base64 data
  isThinking?: boolean;
  timestamp?: number; // ms since epoch, set at creation
}

export interface SunoGenerationParams {
  prompt: string;
  customMode?: boolean;
  instrumental?: boolean;
  model?: 'V4_5' | 'V3_5' | 'V3';
  style?: string;
  title?: string;
  voiceType?: string;
  voicePitch?: number; // -2 to 2 (Low to High)
  musicalKey?: string; // e.g. "C", "F#"
  musicalScale?: string; // e.g. "Major", "Minor", "Phrygian"
  personaId?: string;
  guidanceScale?: number; // 1.0 to 10.0
  steps?: number; // 10 to 100
}

export interface AIMusicIntent {
  action: 'generate' | 'chat';
  reply: string;
  params?: SunoGenerationParams;
}

export interface SunoTrack {
  id: string;
  title: string;
  imageUrl: string;
  audioUrl: string;
  videoUrl?: string;
  duration: number;
  tags: string;
  model_name: string;
  status: string;
  created_at?: string;
  taskId?: string;
  creator_name?: string;
  user_id?: string;
  likes_count?: number;
  plays_count?: number;
  downloads_count?: number;
  category?: string;
}

export interface GenerationStatus {
  status: 'idle' | 'generating' | 'polling' | 'complete' | 'error';
  taskId?: string;
  progress?: string;
  error?: string;
  tracks?: SunoTrack[];
  retryParams?: SunoGenerationParams;
}

export interface MusicToolArgs {
  prompt: string;
  instrumental: boolean;
  style: string;
  title: string;
  voiceType?: string;
  voicePitch?: number;
  musicalKey?: string;
  musicalScale?: string;
}

export interface MusicSuggestion {
  title: string;
  genre: string;
  mood: string;
  theme: string;
  prompt: string;
}

export interface SunoPersona {
  personaId: string;
  name: string;
  description: string;
  audioId?: string; // Reference to source
  imageUrl?: string; // Optional reference to source image
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isPro?: boolean;
}

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  signInGoogle: () => Promise<void>;
  signInEmailPassword: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  error: string | null;
  configError: string | null;
  features: FeatureConfig;
}

export interface FeatureConfig {
  requireProForWav: boolean;
  requireProForVideo: boolean;
  videoCreditCost: number;
  stemCreditCost: number;
}

export interface UserSettings {
  sunoApiKey: string;
  backendProvider: 'none' | 'supabase' | 'firebase';
  supabaseUrl: string;
  supabaseKey: string;
  firebaseConfig?: FirebaseConfig;
  voicePitch?: number; // Default 0
  personas?: SunoPersona[];
  credits: number; // User credit balance
  isPro?: boolean; // Subscription status

  // Developer / Integration Keys
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  n8nWebhookUrl?: string;
  n8nApiKey?: string;
}