import { CachedLibrary, SteamUserSlot } from '../types/steam';

const STORAGE_KEYS = {
  API_KEY: 'steam_squad_sync_api_key',
  SAVED_SLOTS: 'steam_squad_sync_slots',
  CACHE_PREFIX: 'steam_squad_cache_v2_',
  SETTINGS: 'steam_squad_sync_settings',
};

// Simple reversible obfuscation for client-side storage
function encryptSecret(value: string): string {
  if (!value) return '';
  try {
    const encoded = btoa(encodeURIComponent(value));
    return `enc_${encoded.split('').reverse().join('')}`;
  } catch {
    return value;
  }
}

function decryptSecret(value: string): string {
  if (!value) return '';
  if (!value.startsWith('enc_')) return value;
  try {
    const raw = value.slice(4).split('').reverse().join('');
    return decodeURIComponent(atob(raw));
  } catch {
    return value;
  }
}

const DEFAULT_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const DEFAULT_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const StorageService = {
  // --- Steam API Key ---
  getApiKey(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEY);
      if (!stored) return (import.meta as any).env?.VITE_STEAM_API_KEY || '';
      const decrypted = decryptSecret(stored);
      return (decrypted && decrypted.trim().length > 0) ? decrypted : ((import.meta as any).env?.VITE_STEAM_API_KEY || '');
    } catch {
      return (import.meta as any).env?.VITE_STEAM_API_KEY || '';
    }
  },

  setApiKey(key: string): void {
    try {
      if (!key.trim()) {
        localStorage.removeItem(STORAGE_KEYS.API_KEY);
      } else {
        localStorage.setItem(STORAGE_KEYS.API_KEY, encryptSecret(key.trim()));
      }
    } catch (e) {
      console.error('Failed to save API key:', e);
    }
  },

  // --- Squad Slots ---
  getSavedSlots(): SteamUserSlot[] | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED_SLOTS);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  saveSlots(slots: SteamUserSlot[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_SLOTS, JSON.stringify(slots));
    } catch (e) {
      console.error('Failed to save slots:', e);
    }
  },

  // --- Library Cache keyed by steamid_timestamp ---
  getCachedLibrary(steamId: string, maxAgeHours = 24): CachedLibrary | null {
    try {
      // Find latest cache entry matching prefix
      const keyPrefix = `${STORAGE_KEYS.CACHE_PREFIX}${steamId}_`;
      let latestKey: string | null = null;
      let latestTime = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPrefix)) {
          const timestamp = parseInt(key.slice(keyPrefix.length), 10);
          if (!isNaN(timestamp) && timestamp > latestTime) {
            latestTime = timestamp;
            latestKey = key;
          }
        }
      }

      if (!latestKey) return null;

      // Check TTL
      const now = Date.now();
      const ageHours = (now - latestTime) / (1000 * 60 * 60);
      if (ageHours > maxAgeHours) {
        return null;
      }

      const raw = localStorage.getItem(latestKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading library cache:', e);
      return null;
    }
  },

  setCachedLibrary(library: CachedLibrary): void {
    try {
      // Clean up old entries for this steamId
      const keyPrefix = `${STORAGE_KEYS.CACHE_PREFIX}${library.steamId}_`;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPrefix)) {
          toRemove.push(key);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      // Save new entry with timestamp
      const newKey = `${keyPrefix}${library.timestamp}`;
      localStorage.setItem(newKey, JSON.stringify(library));
    } catch (e) {
      console.warn('Failed to cache library (storage quota reached?):', e);
    }
  },

  clearAllCache(): void {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(STORAGE_KEYS.CACHE_PREFIX) || key.startsWith('steam_store_cache_'))) {
          toRemove.push(key);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  },

  // --- Steam Store Official Category & Price Cache ---
  getAppStoreDetails(appid: number): { 
    name?: string;
    headerImage?: string;
    shortDescription?: string;
    releaseDateLabel?: string;
    comingSoon?: boolean;
    isMultiplayer: boolean; 
    isCoop: boolean; 
    isPvp: boolean; 
    isFree?: boolean; 
    isAvailableOnSteam?: boolean;
    isLocalOrSplitScreenOnly?: boolean;
    categories: string[]; 
    genres: string[]; 
    tags: string[];
    priceFormatted?: string;
    initialPriceFormatted?: string;
    discountPercent?: number;
    reviewScoreDesc?: string;
    reviewPercent?: number;
    maxPlayers?: number;
  } | null {
    try {
      const raw = localStorage.getItem(`steam_store_cache_${appid}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setAppStoreDetails(appid: number, data: { 
    name?: string;
    headerImage?: string;
    shortDescription?: string;
    releaseDateLabel?: string;
    comingSoon?: boolean;
    isMultiplayer: boolean; 
    isCoop: boolean; 
    isPvp: boolean; 
    isFree?: boolean; 
    isAvailableOnSteam?: boolean;
    isLocalOrSplitScreenOnly?: boolean;
    categories: string[]; 
    genres: string[]; 
    tags: string[];
    priceFormatted?: string;
    initialPriceFormatted?: string;
    discountPercent?: number;
    reviewScoreDesc?: string;
    reviewPercent?: number;
    maxPlayers?: number;
  }): void {
    try {
      localStorage.setItem(`steam_store_cache_${appid}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache app store details:', e);
    }
  },

  // --- Squad Overrides (Force game as owned by all squad members, e.g. Free-to-Play titles) ---
  getSquadOverrides(): number[] {
    try {
      const raw = localStorage.getItem('steam_squad_overrides');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  setSquadOverrides(appids: number[]): void {
    try {
      localStorage.setItem('steam_squad_overrides', JSON.stringify(appids));
    } catch (e) {
      console.warn('Failed to save squad overrides:', e);
    }
  },

  toggleSquadOverride(appid: number): number[] {
    const current = this.getSquadOverrides();
    const updated = current.includes(appid) ? current.filter(id => id !== appid) : [...current, appid];
    this.setSquadOverrides(updated);
    return updated;
  },

  // --- Hidden Games Persistence ---
  getHiddenAppIds(): number[] {
    try {
      const raw = localStorage.getItem('steam_squad_hidden_appids');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  setHiddenAppIds(appids: number[]): void {
    try {
      localStorage.setItem('steam_squad_hidden_appids', JSON.stringify(appids));
    } catch (e) {
      console.warn('Failed to save hidden appids:', e);
    }
  },

  toggleHideAppId(appid: number): number[] {
    const current = this.getHiddenAppIds();
    const updated = current.includes(appid) ? current.filter(id => id !== appid) : [...current, appid];
    this.setHiddenAppIds(updated);
    return updated;
  },

  clearAllHiddenAppIds(): void {
    try {
      localStorage.removeItem('steam_squad_hidden_appids');
    } catch (e) {
      console.warn('Failed to clear hidden appids:', e);
    }
  },

  // --- Wishlist Cache ---
  getCachedWishlist(steamId: string): any[] | null {
    try {
      const raw = localStorage.getItem(`steam_squad_wishlist_${steamId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setCachedWishlist(steamId: string, games: any[]): void {
    try {
      localStorage.setItem(`steam_squad_wishlist_${steamId}`, JSON.stringify(games));
    } catch (e) {
      console.warn('Failed to cache wishlist:', e);
    }
  },

  // --- Squad Availability & Gaming Schedule ---
  getSquadSchedules(): Record<string, any> {
    try {
      const raw = localStorage.getItem('steam_squad_schedules');
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  savePlayerSchedule(slotId: string, schedule: any): void {
    try {
      const current = this.getSquadSchedules();
      current[slotId] = schedule;
      localStorage.setItem('steam_squad_schedules', JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to save player schedule:', e);
    }
  },

  saveSquadSchedules(schedules: Record<string, any>): void {
    try {
      localStorage.setItem('steam_squad_schedules', JSON.stringify(schedules));
    } catch (e) {
      console.warn('Failed to save squad schedules:', e);
    }
  },

  getGameNightEvents(): any[] {
    try {
      const raw = localStorage.getItem('steam_squad_game_night_events');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveGameNightEvents(events: any[]): void {
    try {
      localStorage.setItem('steam_squad_game_night_events', JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to save game night events:', e);
    }
  },

  // --- App Theme ---
  getTheme(): any {
    try {
      const stored = localStorage.getItem('steam_squad_theme');
      if (stored === 'light' || stored === 'toast') return stored;
      return 'dark';
    } catch {
      return 'dark';
    }
  },

  setTheme(theme: string): void {
    try {
      localStorage.setItem('steam_squad_theme', theme);
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  },

  // --- Recurring Availability Patterns ---
  getRecurringPatterns(): Record<string, Record<string, boolean>> {
    try {
      const raw = localStorage.getItem('steam_squad_recurring_patterns');
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  savePlayerRecurringPattern(slotId: string, pattern: Record<string, boolean>): void {
    try {
      const current = this.getRecurringPatterns();
      current[slotId] = pattern;
      localStorage.setItem('steam_squad_recurring_patterns', JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to save recurring pattern:', e);
    }
  },

  // --- Supabase Cloud Sync Config ---
  getSupabaseConfig(): { url: string; anonKey: string; roomCode: string } {
    try {
      const storedUrl = (localStorage.getItem('steam_squad_supabase_url') || '').trim();
      const url = storedUrl || DEFAULT_SUPABASE_URL;
      const rawKey = localStorage.getItem('steam_squad_supabase_key') || '';
      const decryptedKey = rawKey ? decryptSecret(rawKey).trim() : '';
      const anonKey = decryptedKey || DEFAULT_SUPABASE_ANON_KEY;
      const roomCode = localStorage.getItem('steam_squad_room_code') || '';
      return { url, anonKey, roomCode };
    } catch {
      return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY, roomCode: '' };
    }
  },

  setSupabaseConfig(url: string, anonKey: string, roomCode: string): void {
    try {
      localStorage.setItem('steam_squad_supabase_url', url.trim());
      if (anonKey.trim()) {
        localStorage.setItem('steam_squad_supabase_key', encryptSecret(anonKey.trim()));
      } else {
        localStorage.removeItem('steam_squad_supabase_key');
      }
      localStorage.setItem('steam_squad_room_code', roomCode.trim().toUpperCase());
    } catch (e) {
      console.warn('Failed to save Supabase config:', e);
    }
  },

  // --- Active Tab State Persistence ---
  getActiveTab(): string {
    try {
      return localStorage.getItem('steam_squad_active_tab') || 'ready';
    } catch {
      return 'ready';
    }
  },

  setActiveTab(tab: string): void {
    try {
      localStorage.setItem('steam_squad_active_tab', tab);
    } catch (e) {
      console.warn('Failed to save active tab:', e);
    }
  },
};
