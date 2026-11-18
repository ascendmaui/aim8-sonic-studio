import { UserSettings, SunoTrack, SunoPersona } from '../types';

/**
 * The open-source BYOK build has no hosted backend (no Firebase, Firestore or Supabase).
 * Tracks and personas are kept in the browser by the components that use them
 * (localStorage); these methods are intentional no-ops so the UI code stays unchanged.
 */
class BackendService {
    public initialize(_settings: UserSettings) { /* no backend */ }
    public isReady(): boolean { return false; }
    public async saveTrack(_track: SunoTrack) { /* stored locally by the caller */ }
    public async deleteTrack(_trackId: string) { /* stored locally by the caller */ }
    public async getUserTracks(): Promise<SunoTrack[]> { return []; }
    public async getGlobalTracks(_limitCount = 100): Promise<SunoTrack[]> { return []; }
    public async getExploreTracks(_limitCount = 200): Promise<SunoTrack[]> { return []; }
    public async incrementTrackStat(_trackId: string, _creatorId: string, _statType: string, _points: number) { }
    public async getUserReputation(_userId: string): Promise<number> { return 0; }
    public async savePersona(_persona: SunoPersona) { /* stored locally by the caller */ }
    public async deletePersona(_personaId: string) { /* stored locally by the caller */ }
    public async getPersonas(): Promise<SunoPersona[]> { return []; }
    public async updateUserCredits(_userId: string, _credits: number) { /* no credits in BYOK build */ }
    public async submitBetaFeedback(_feedback: string, _userId: string, _userEmail?: string | null) { }
}

export const backendManager = new BackendService();
