import { PlayerAvailability, SquadGameAnalysis } from '../types/steam';
import { parseSteamInput } from './steamApi';
import { getDayNameFromDateStr } from './scheduleEngine';

/**
 * Deterministically generates a unique Squad Room Key based on active player SteamIDs.
 * 1. Filters valid, active 64-bit SteamIDs.
 * 2. Sorts SteamIDs numerically so player order in slots NEVER changes the key.
 * 3. Hashes the sorted SteamIDs to produce a clean 4-digit or 8-character squad key.
 */
export function generateDeterministicSquadKey(slots: { steamId?: string }[]): string {
  const validIds = slots
    .map((s) => (s.steamId || '').trim())
    .filter((id) => id.length > 0)
    .sort();

  if (validIds.length < 2) {
    return '';
  }

  const combined = validIds.join('|');
  let h1 = 5381;
  let h2 = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    h1 = (h1 * 33) ^ char;
    h2 = char + (h2 << 6) + (h2 << 16) - h2;
  }

  const p1 = (h1 >>> 0).toString(36).toUpperCase();
  const p2 = (h2 >>> 0).toString(36).toUpperCase();
  const raw = (p1 + p2 + '00000000').slice(0, 8);
  return raw;
}

// Category Enum Mapping for Micro Cloud Payload Size
export const CATEGORY_ENUM_MAP: Record<string, number> = {
  'Multi-player': 1,
  'Co-op': 2,
  'Online Co-op': 3,
  'PvP': 4,
  'Online PvP': 5,
  'Single-player': 6,
  'Cross-Platform Multiplayer': 7,
  'Shared/Split Screen Co-op': 8,
  'Shared/Split Screen PvP': 9,
  'Full controller support': 10,
  'Steam Achievements': 11,
  'Steam Cloud': 12,
};

export const REVERSE_CATEGORY_MAP: Record<number, string> = Object.entries(CATEGORY_ENUM_MAP).reduce(
  (acc, [key, val]) => {
    acc[val] = key;
    return acc;
  },
  {} as Record<number, string>
);

// Genre Enum Mapping
export const GENRE_ENUM_MAP: Record<string, number> = {
  'Action': 1,
  'Adventure': 2,
  'RPG': 3,
  'Strategy': 4,
  'Simulation': 5,
  'Casual': 6,
  'Indie': 7,
  'Free to Play': 8,
  'Massively Multiplayer': 9,
  'Racing': 10,
  'Sports': 11,
};

export const REVERSE_GENRE_MAP: Record<number, string> = Object.entries(GENRE_ENUM_MAP).reduce(
  (acc, [key, val]) => {
    acc[val] = key;
    return acc;
  },
  {} as Record<number, string>
);

export interface CompactCloudSlot {
  id: string;
  input: string;
  steamId?: string;
  personaName?: string;
  avatarUrl?: string;
  gameCount?: number;
}

export interface CompactCloudGame {
  appid: number;
  name: string;
  ownedBySteamIds: string[];
  missingBySteamIds: string[];
  ownershipCount: number;
  totalSquadPlaytimeMinutes: number;
  isMultiplayer: boolean;
  isCoop: boolean;
  isPvp: boolean;
  categories: number[];
  genres: number[];
  tags: string[];
  maxPlayers?: number;
}

export interface CleanedCloudPayload {
  slots?: CompactCloudSlot[];
  schedules: Record<string, {
    slotId: string;
    personaName?: string;
    timezone: string;
    grid: Record<string, boolean>;
  }>;
  events?: any[];
  sharedGames?: {
    readyGames: any[];
    nearOverlapGames: any[];
    updatedAt: number;
  };
}

/**
 * Compact player slot payload for cloud:
 * Strips out full URLs (e.g. https://steamcommunity.com/profiles/...) and keeps raw IDs.
 * Uses 1-based index numbers for IDs.
 */
export function sanitizeSlotsForCloud(slots: any[]): CompactCloudSlot[] {
  return slots.map((s, idx) => {
    const parsed = parseSteamInput(s.input || '');
    return {
      id: `${idx + 1}`,
      input: parsed.value || s.input || '',
      steamId: s.steamId,
      personaName: s.personaName,
      gameCount: s.gameCount,
    };
  });
}

/**
 * Clean and compact schedule grids before uploading to cloud/Supabase.
 * - Retains recurring day keys (e.g. "Mon-night": true).
 * - Strips redundant date keys (e.g. "2026-09-21-night": true) if "Mon-night": true is set.
 * - Retains explicit date overrides/exceptions (e.g. "2026-09-23-evening": false) when overriding recurring defaults.
 */
export function sanitizeSchedulesForCloud(
  schedules: Record<string, PlayerAvailability>
): Record<string, { slotId: string; personaName?: string; timezone: string; grid: Record<string, boolean> }> {
  const cleaned: Record<string, any> = {};

  Object.entries(schedules).forEach(([slotId, player]) => {
    const compactGrid: Record<string, boolean> = {};

    if (player.grid) {
      // 1. First pass: Collect all recurring day-of-week keys that are true (e.g., "Mon-night": true)
      const recurringTrueKeys = new Set<string>();
      Object.entries(player.grid).forEach(([key, val]) => {
        if (val === true && /^[A-Z][a-z]{2}-[a-z]+$/.test(key)) {
          recurringTrueKeys.add(key);
          compactGrid[key] = true;
        }
      });

      // 2. Second pass: Process date-based keys (e.g., "2026-09-21-night")
      Object.entries(player.grid).forEach(([key, val]) => {
        const dateMatch = key.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
        if (dateMatch) {
          const dateStr = dateMatch[1];
          const blockId = dateMatch[2];
          const dayName = getDayNameFromDateStr(dateStr);
          const recurringKey = `${dayName}-${blockId}`;
          const isRecurringFree = recurringTrueKeys.has(recurringKey);

          if (val === true) {
            // Only store date key if recurring default is NOT free
            if (!isRecurringFree) {
              compactGrid[key] = true;
            }
          } else if (val === false) {
            // Store explicit override if recurring default IS free (user marked busy for specific date)
            if (isRecurringFree) {
              compactGrid[key] = false;
            }
          }
        }
      });
    }

    cleaned[slotId] = {
      slotId: player.slotId,
      personaName: player.personaName || '',
      timezone: player.timezone || 'America/Los_Angeles',
      grid: compactGrid,
    };
  });

  return cleaned;
}

/**
 * Super-compact squad game analysis summaries for cloud storage:
 * 1. Omits static header image URLs and store URLs (reconstructed dynamically from appid).
 * 2. Omits price/discount details (real-time sale prices calculated on client).
 * 3. Maps categories & genres to short Enum numbers.
 * Reduces total squad cloud JSON size by >90%!
 */
export function sanitizeGamesForCloud(games: SquadGameAnalysis[]): CompactCloudGame[] {
  return games.map((g) => {
    const categoryEnums = (g.categories || [])
      .map((c) => CATEGORY_ENUM_MAP[c] || 0)
      .filter((n) => n > 0);

    const genreEnums = (g.genres || [])
      .map((gen) => GENRE_ENUM_MAP[gen] || 0)
      .filter((n) => n > 0);

    return {
      appid: g.appid,
      name: g.name,
      ownedBySteamIds: g.ownedBySteamIds || [],
      missingBySteamIds: g.missingBySteamIds || [],
      ownershipCount: g.ownershipCount || 0,
      totalSquadPlaytimeMinutes: g.totalSquadPlaytimeMinutes || 0,
      isMultiplayer: Boolean(g.isMultiplayer),
      isCoop: Boolean(g.isCoop),
      isPvp: Boolean(g.isPvp),
      categories: categoryEnums,
      genres: genreEnums,
      tags: (g.tags || []).slice(0, 4),
      maxPlayers: g.maxPlayers,
    };
  });
}

/**
 * Hydrate compact cloud game objects back into full SquadGameAnalysis objects on load
 */
export function hydrateGamesFromCloud(rawGames: any[]): SquadGameAnalysis[] {
  if (!Array.isArray(rawGames)) return [];

  return rawGames.map((g) => {
    const categories = (g.categories || []).map((cat: any) =>
      typeof cat === 'number' ? REVERSE_CATEGORY_MAP[cat] || `Category-${cat}` : cat
    );

    const genres = (g.genres || []).map((gen: any) =>
      typeof gen === 'number' ? REVERSE_GENRE_MAP[gen] || `Genre-${gen}` : gen
    );

    const appid = g.appid;
    const headerImage = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
    const storeUrl = `https://store.steampowered.com/app/${appid}`;
    const totalSquadPlaytimeMinutes = g.totalSquadPlaytimeMinutes || 0;

    return {
      appid,
      name: g.name,
      headerImage,
      storeUrl,
      ownedBySteamIds: g.ownedBySteamIds || [],
      missingBySteamIds: g.missingBySteamIds || [],
      ownershipCount: g.ownershipCount || 0,
      totalSquadPlaytimeMinutes,
      totalSquadPlaytimeHours: Math.round((totalSquadPlaytimeMinutes / 60) * 10) / 10,
      playerPlaytimes: g.playerPlaytimes || {},
      isMultiplayer: Boolean(g.isMultiplayer),
      isCoop: Boolean(g.isCoop),
      isPvp: Boolean(g.isPvp),
      categories,
      genres,
      tags: g.tags || [],
      maxPlayers: g.maxPlayers,
    };
  });
}

/**
 * Supabase HTTP REST API client (No NPM dependencies required).
 */
export const CloudSyncService = {
  /**
   * Fetch squad payload (schedules + cached shared games) from Supabase PostgREST API
   */
  async fetchSquadPayload(
    supabaseUrl: string,
    supabaseAnonKey: string,
    squadCode: string
  ): Promise<CleanedCloudPayload | null> {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const codeClean = squadCode.replace(/^SQUAD-/i, '').trim();
    const endpoint = `${cleanUrl}/rest/v1/squad_data?squad_code=in.(${encodeURIComponent(codeClean)},${encodeURIComponent('SQUAD-' + codeClean)})&select=data`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase GET failed (HTTP ${response.status})`);
      }

      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return rows[0].data as CleanedCloudPayload;
      }
      return null;
    } catch (err: any) {
      console.warn('Cloud sync fetch error:', err);
      throw err;
    }
  },

  /**
   * Upsert ultra-compact squad payload to Supabase
   */
  async pushSquadPayload(
    supabaseUrl: string,
    supabaseAnonKey: string,
    squadCode: string,
    payload: CleanedCloudPayload
  ): Promise<boolean> {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const codeClean = squadCode.replace(/^SQUAD-/i, '').trim();
    const endpoint = `${cleanUrl}/rest/v1/squad_data`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          squad_code: codeClean,
          data: payload,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Supabase POST failed (HTTP ${response.status})`);
      }

      return true;
    } catch (err: any) {
      console.warn('Cloud sync push error:', err);
      throw err;
    }
  },
};
