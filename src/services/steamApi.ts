import { CachedLibrary, OwnedGame, SteamUserSlot } from '../types/steam';
import { StorageService } from './storage';


declare global {
  interface Window {
    electronAPI?: {
      steamRequest: (url: string) => Promise<{ success: boolean; data?: any; status?: number; error?: string }>;
      openExternal: (url: string) => Promise<void>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
    };
  }
}

async function requestSteamApi<T>(url: string): Promise<T> {
  // If Electron IPC is available, use native net fetch to avoid CORS
  if (window.electronAPI && typeof window.electronAPI.steamRequest === 'function') {
    const res = await window.electronAPI.steamRequest(url);
    if (!res.success) {
      if (res.status === 429) {
        throw new Error('Valve Steam API rate limit reached (HTTP 429). Please wait a few minutes.');
      }
      throw new Error(res.error || `Steam API request failed (HTTP ${res.status || 'Unknown'})`);
    }
    return res.data as T;
  }

  // 1. Vercel Serverless Proxy (/api/proxy)
  try {
    const vercelProxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(vercelProxyUrl);
    if (response.status === 429) {
      throw new Error('Valve Steam API rate limit reached (HTTP 429). Please wait a few minutes.');
    }
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fall through to direct fetch
  }

  // 2. Direct fetch fallback (works if extension or dev proxy allows CORS)
  try {
    const response = await fetch(url);
    if (response.status === 429) {
      throw new Error('Valve Steam API rate limit reached (HTTP 429). Please wait a few minutes.');
    }
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fall through
  }

  throw new Error('Unable to connect to Steam API. Please verify your Steam API key.');
}

export function parseSteamInput(input: string): { type: 'steamid' | 'vanity'; value: string } {
  const clean = input.trim();
  if (!clean) return { type: 'vanity', value: '' };

  // Match https://steamcommunity.com/profiles/76561198...
  const profileMatch = clean.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) {
    return { type: 'steamid', value: profileMatch[1] };
  }

  // Match https://steamcommunity.com/id/<vanity>
  const vanityMatch = clean.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_\-]+)/i);
  if (vanityMatch) {
    return { type: 'vanity', value: vanityMatch[1] };
  }

  // 17 digit pure number starting with 7656
  if (/^7656\d{13}$/.test(clean)) {
    return { type: 'steamid', value: clean };
  }

  // Otherwise assume vanity name
  return { type: 'vanity', value: clean.replace(/\/$/, '') };
}

export function detectMaxPlayers(
  name: string,
  text: string = '',
  categories: string[] = [],
  genres: string[] = []
): number | undefined {
  const cleanName = (name || '').toLowerCase();
  const fullText = (text || '').toLowerCase();
  const wordNums: Record<string, number> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    eight: 8,
    ten: 10,
    twelve: 12,
    sixteen: 16,
  };

  // 1. Specific 2-player duo games
  if (/it takes two|a way out|portal 2\b|operation: tango|we were here/i.test(cleanName)) {
    return 2;
  }

  // 2. Large scale games (MMO, massive multiplayer, large lobby survival / shooters)
  if (
    categories.some(c => /massively multiplayer|mmo/i.test(c)) ||
    genres.some(g => /massively multiplayer/i.test(g))
  ) {
    return 64;
  }
  if (/counter-strike|cs2|team fortress|dota|rust|battlefield|battlebit|pubg|apex legends/i.test(cleanName)) {
    return 32;
  }
  if (/terraria|valheim|among us|project zomboid|starbound|palworld|ark|conan/i.test(cleanName)) {
    return 10;
  }
  if (/don't starve together/i.test(cleanName)) {
    return 6;
  }

  // 3. Regex extraction from store text (e.g. "1-4 player co-op", "up to four players", "for 4 players")
  const match = fullText.match(
    /\b(?:(?:up to|maximum of|max of|supports? up to|for up to)\s+([0-9]{1,2}|two|three|four|five|six|eight|ten|twelve|sixteen)\s+(?:players?|friends?|chefs?|dwarves|survivors?|investigators?|heisters?|hunters?|engineers?|party members?)|1\s*[-–]\s*([0-9]{1,2})\s*(?:player|players)?\s*(?:co-?op|multiplayer|online|campaign)|([0-9]{1,2}|two|three|four|five|six|eight)\s*[- ]player\s+(?:co-?op|cooperative|multiplayer|squad|team))\b/i
  );

  if (match) {
    const raw = match[1] || match[2] || match[3];
    if (raw) {
      const num = wordNums[raw.toLowerCase()] || parseInt(raw, 10);
      if (num && num >= 2 && num <= 128) {
        return num;
      }
    }
  }

  // 4. Standard 4-player co-op squad archetypes
  if (
    /left 4 dead|payday|vermintide|darktide|back 4 blood|phasmophobia|lethal company|deep rock|helldivers|risk of rain|gtfo|killing floor|warhammer 40,000|dead by daylight|ghostbusters/i.test(
      cleanName
    )
  ) {
    return 4;
  }

  return undefined;
}

export const SteamApiService = {
  async resolveVanityUrl(apiKey: string, vanityUrl: string): Promise<string> {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityUrl)}`;
    const data = await requestSteamApi<any>(url);

    if (data?.response?.success === 1 && data.response.steamid) {
      return data.response.steamid;
    }
    if (data?.response?.success === 42) {
      throw new Error(`No Steam account found matching custom URL "${vanityUrl}"`);
    }
    throw new Error(`Could not resolve vanity URL "${vanityUrl}"`);
  },

  async getPlayerSummaries(apiKey: string, steamIds: string[]): Promise<Record<string, { personaName: string; avatarUrl: string; profileUrl: string; isPrivate: boolean }>> {
    if (steamIds.length === 0) return {};
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamIds.join(',')}`;
    const data = await requestSteamApi<any>(url);

    const players = data?.response?.players || [];
    const result: Record<string, { personaName: string; avatarUrl: string; profileUrl: string; isPrivate: boolean }> = {};

    players.forEach((p: any) => {
      result[p.steamid] = {
        personaName: p.personaname || 'Unknown Player',
        avatarUrl: p.avatarfull || p.avatarmedium || p.avatar || '',
        profileUrl: p.profileurl || `https://steamcommunity.com/profiles/${p.steamid}`,
        // communityvisibilitystate: 3 means Public, 1 or 2 means Private / Friends-only
        isPrivate: p.communityvisibilitystate !== 3,
      };
    });

    return result;
  },

  async getOwnedGames(apiKey: string, steamId: string): Promise<{ games: OwnedGame[]; isPrivate: boolean }> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&include_free_sub=1&format=json`;
    const data = await requestSteamApi<any>(url);

    const response = data?.response;
    if (!response || !response.games || !Array.isArray(response.games)) {
      // Empty response or missing games indicates private or hidden game details
      return { games: [], isPrivate: true };
    }

    const games: OwnedGame[] = response.games.map((g: any) => ({
      appid: g.appid,
      name: g.name || `App ${g.appid}`,
      playtime_forever: g.playtime_forever || 0,
      img_icon_url: g.img_icon_url,
      playtime_windows_forever: g.playtime_windows_forever,
    }));

    return { games, isPrivate: false };
  },

  async resolveSquadSlot(apiKey: string, slot: SteamUserSlot): Promise<SteamUserSlot> {
    const parsed = parseSteamInput(slot.input);
    let resolvedSteamId = slot.steamId;

    if (parsed.type === 'steamid') {
      resolvedSteamId = parsed.value;
    } else if (parsed.type === 'vanity' && parsed.value) {
      resolvedSteamId = await this.resolveVanityUrl(apiKey, parsed.value);
    } else {
      throw new Error('Enter a SteamID64, custom vanity URL or profile link');
    }

    // Now fetch player summary
    const summaries = await this.getPlayerSummaries(apiKey, [resolvedSteamId]);
    const summary = summaries[resolvedSteamId];

    return {
      ...slot,
      steamId: resolvedSteamId,
      personaName: summary?.personaName || resolvedSteamId,
      avatarUrl: summary?.avatarUrl,
      profileUrl: summary?.profileUrl,
      isPrivate: summary?.isPrivate ?? false,
      error: undefined,
    };
  },

  async fetchLibraryWithCache(
    apiKey: string,
    steamId: string,
    personaName?: string,
    avatarUrl?: string,
    forceRefresh = false
  ): Promise<CachedLibrary> {
    // Check local cache if not forcing refresh
    if (!forceRefresh) {
      const cached = StorageService.getCachedLibrary(steamId);
      if (cached) {
        return cached;
      }
    }

    // Fetch from Steam API
    const { games, isPrivate } = await this.getOwnedGames(apiKey, steamId);

    const library: CachedLibrary = {
      steamId,
      personaName: personaName || steamId,
      avatarUrl: avatarUrl || '',
      isPrivate,
      timestamp: Date.now(),
      games,
    };

    // Save to local cache
    StorageService.setCachedLibrary(library);

    return library;
  },



  async fetchLiveStoreCategories(appid: number): Promise<{ 
    isMultiplayer: boolean; 
    isCoop: boolean; 
    isPvp: boolean; 
    isFree: boolean; 
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
    headerImage?: string;
    shortDescription?: string;
    releaseDateLabel?: string;
    comingSoon?: boolean;
  } | null> {
    const cached = StorageService.getAppStoreDetails(appid);
    if (cached && cached.priceFormatted !== undefined && cached.isAvailableOnSteam !== undefined && cached.maxPlayers !== undefined) {
      // Re-fetch if cache is stale (missing headerImage or shortDescription, or has placeholder $19.99 for upcoming titles)
      const isStale = (cached.comingSoon || cached.releaseDateLabel) && (!cached.headerImage || !cached.shortDescription || cached.priceFormatted === '$19.99');
      if (!isStale) {
        return { ...cached, isFree: cached.isFree ?? false };
      }
    }

    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,categories,genres,price_overview,release_date`;
      const json = await requestSteamApi<any>(url);
      const appData = json?.[appid]?.data;

      // If Steam Store returns success: false or no data, the game is delisted/unpurchasable
      if (!appData || json?.[appid]?.success === false) {
        const delistedResult = {
          isMultiplayer: false,
          isCoop: false,
          isPvp: false,
          isFree: false,
          isAvailableOnSteam: false,
          isLocalOrSplitScreenOnly: false,
          categories: [],
          genres: [],
          tags: [],
          priceFormatted: 'Unavailable on Steam',
          reviewScoreDesc: 'Delisted',
        };
        StorageService.setAppStoreDetails(appid, delistedResult);
        return delistedResult;
      }

      const rawCategories: { id: number; description: string }[] = appData.categories || [];
      const genres: string[] = (appData.genres || []).map((g: any) => g.description);
      const categories = rawCategories.map(c => c.description);

      const categoryIds = new Set<number>(rawCategories.map(c => Number(c.id)));

      // Check whether the game can currently be purchased/downloaded on Steam
      const isAvailableOnSteam = Boolean(
        appData.is_free ||
        appData.price_overview ||
        (appData.package_groups && appData.package_groups.length > 0) ||
        appData.release_date?.coming_soon
      );

      // Official Steam Category IDs:
      // 1: Multi-player, 9: Co-op, 38: Online Co-op, 36: Online PvP, 49: PvP, 24: Shared/Split Screen, 27: Cross-Platform Multiplayer, 37: Shared/Split Screen PvP, 39: Shared/Split Screen Co-op, 48: LAN PvP, 47: LAN Co-op
      const hasOnlineSupport = 
        categoryIds.has(1) || 
        categoryIds.has(38) || 
        categoryIds.has(36) || 
        categoryIds.has(27) ||
        categories.some(c => /online co-op|online pvp|multi-player/i.test(c));

      const hasLocalSupport = 
        categoryIds.has(24) || 
        categoryIds.has(37) || 
        categoryIds.has(39) ||
        categories.some(c => /shared\/split|local co-op|same-screen/i.test(c));

      const isLocalOrSplitScreenOnly = hasLocalSupport && !hasOnlineSupport;

      const isMultiplayer = 
        categoryIds.has(1) || 
        categoryIds.has(9) || 
        categoryIds.has(38) || 
        categoryIds.has(36) || 
        categoryIds.has(49) || 
        categoryIds.has(24) || 
        categoryIds.has(27) || 
        categoryIds.has(37) || 
        categoryIds.has(39) ||
        categories.some(c => /multi-?player|co-?op|pvp|shared\/split|mmo/i.test(c));

      const isCoop = 
        categoryIds.has(9) || 
        categoryIds.has(38) || 
        categoryIds.has(39) || 
        categoryIds.has(47) ||
        categories.some(c => /co-?op/i.test(c));

      const isPvp = 
        categoryIds.has(36) || 
        categoryIds.has(49) || 
        categoryIds.has(37) || 
        categoryIds.has(48) ||
        categories.some(c => /pvp/i.test(c));

      const isFree = Boolean(
        appData.is_free ||
        genres.some(g => /free to play/i.test(g)) ||
        categories.some(c => /free to play/i.test(c))
      );

      const comingSoon = Boolean(appData.release_date?.coming_soon);
      const priceOverview = appData.price_overview;
      const priceFormatted = isFree
        ? 'Free to Play'
        : (priceOverview?.final_formatted || (priceOverview?.final ? `$${(priceOverview.final / 100).toFixed(2)}` : (comingSoon ? 'Coming Soon' : 'Coming Soon')));
      const initialPriceFormatted = priceOverview?.initial_formatted || (priceOverview?.initial ? `$${(priceOverview.initial / 100).toFixed(2)}` : undefined);
      const discountPercent = priceOverview?.discount_percent || 0;

      // Extract high resolution header image & clean short description
      const headerImage = appData.header_image || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
      const shortDescription = appData.short_description ? appData.short_description.replace(/<[^>]*>/g, '').trim() : undefined;

      // Extract real review rating from Steam Community Reviews API
      let reviewScoreDesc = 'Very Positive';
      let reviewPercent = 88;
      try {
        const reviewUrl = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all&num_per_page=0`;
        const revData = await requestSteamApi<any>(reviewUrl);
        const qSummary = revData?.query_summary;
        if (qSummary?.review_score_desc) {
          reviewScoreDesc = qSummary.review_score_desc;
          if (qSummary.total_reviews > 0) {
            reviewPercent = Math.round((qSummary.total_positive / qSummary.total_reviews) * 100);
          }
        }
      } catch {
        // Fallback gracefully to default positive rating if review endpoint has issues
      }

      const tags = [...genres];
      if (isCoop && !tags.includes('Co-Op')) tags.unshift('Co-Op');
      if (isPvp && !tags.includes('PvP')) tags.unshift('PvP');
      if (isMultiplayer && !tags.includes('Multiplayer')) tags.unshift('Multiplayer');
      if (isFree && !tags.includes('Free to Play')) tags.push('Free to Play');
      const descText = `${appData.short_description || ''} ${appData.about_the_game || ''}`;
      const maxPlayers = detectMaxPlayers(appData.name || '', descText, categories, genres);

      const result = {
        name: appData.name || undefined,
        headerImage,
        shortDescription,
        isMultiplayer,
        isCoop,
        isPvp,
        isFree,
        isAvailableOnSteam,
        isLocalOrSplitScreenOnly,
        categories,
        genres,
        tags,
        priceFormatted,
        initialPriceFormatted,
        discountPercent,
        reviewScoreDesc,
        reviewPercent,
        maxPlayers,
        releaseDateLabel: appData.release_date?.date,
        comingSoon,
      };

      StorageService.setAppStoreDetails(appid, result);
      return result;
    } catch {
      return null;
    }
  },

  async getUserWishlist(apiKey: string, steamId: string): Promise<any[]> {
    if (!steamId) return [];

    // Helper to resolve title from store details if current title is missing or generic "App XXXXXXX"
    const resolveTitle = (appid: number, name?: string) => {
      const storeDetails = StorageService.getAppStoreDetails(appid);
      if (storeDetails?.name && !storeDetails.name.startsWith('App ')) {
        return storeDetails.name;
      }
      if (name && !name.startsWith('App ') && !name.startsWith('App #')) {
        return name;
      }
      return name || `App ${appid}`;
    };

    // Check local storage cache
    const cached = StorageService.getCachedWishlist(steamId);
    if (cached && cached.length > 0) {
      let updated = false;
      const refreshed = cached.map((g: any) => {
        const storeDetails = StorageService.getAppStoreDetails(g.appid);
        const resolvedName = resolveTitle(g.appid, g.name);
        if (resolvedName !== g.name || (storeDetails && storeDetails.priceFormatted && storeDetails.priceFormatted !== g.priceFormatted)) {
          updated = true;
          return {
            ...g,
            name: resolvedName,
            priceFormatted: storeDetails?.priceFormatted || g.priceFormatted,
            discountPercent: storeDetails?.discountPercent ?? g.discountPercent,
            reviewScoreDesc: storeDetails?.reviewScoreDesc || g.reviewScoreDesc,
            reviewPercent: storeDetails?.reviewPercent ?? g.reviewPercent,
            tags: (storeDetails?.tags && storeDetails.tags.length > 0) ? storeDetails.tags : g.tags,
          };
        }
        return g;
      });
      if (updated) {
        StorageService.setCachedWishlist(steamId, refreshed);
      }
      return refreshed;
    }

    try {
      // 1. Try official Steam Web API IWishlistService endpoint if API key is provided
      if (apiKey && apiKey.trim()) {
        const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=${encodeURIComponent(apiKey.trim())}&steamid=${steamId}`;
        const data = await requestSteamApi<any>(url);
        const items = data?.response?.items;

        if (Array.isArray(items) && items.length > 0) {
          const { getDynamicGameMeta } = await import('./intersectionEngine');
          const games = items.map((item: any) => {
            const storeDetails = StorageService.getAppStoreDetails(item.appid) || getDynamicGameMeta(item.appid);
            const resolvedName = resolveTitle(item.appid, (storeDetails as any).name);
            return {
              appid: item.appid,
              name: resolvedName,
              headerImage: (storeDetails as any)?.headerImage || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.appid}/header.jpg`,
              storeUrl: `https://store.steampowered.com/app/${item.appid}/`,
              addedTimestamp: item.date_added || 0,
              priceFormatted: storeDetails.priceFormatted || 'Coming Soon',
              discountPercent: storeDetails.discountPercent || 0,
              reviewScoreDesc: storeDetails.reviewScoreDesc || 'Very Positive',
              reviewPercent: storeDetails.reviewPercent || 88,
              tags: storeDetails.tags || ['Co-Op', 'Multiplayer'],
            };
          });

          StorageService.setCachedWishlist(steamId, games);
          return games;
        }
      }

      // 2. Fallback to public store page endpoint
      const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/`;
      const data = await requestSteamApi<any>(url);

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const games = Object.entries(data).map(([appidStr, item]: [string, any]) => ({
          appid: parseInt(appidStr, 10),
          name: item.name || `App ${appidStr}`,
          headerImage: item.capsule || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appidStr}/header.jpg`,
          storeUrl: `https://store.steampowered.com/app/${appidStr}/`,
          addedTimestamp: item.added || 0,
          priceFormatted: item.is_free_game ? 'Free to Play' : (item.subs && item.subs[0]?.discount_block ? `$${(item.subs[0].price / 100).toFixed(2)}` : 'Coming Soon'),
          discountPercent: item.subs && item.subs[0] ? item.subs[0].discount_pct : 0,
          reviewScoreDesc: item.review_desc || 'Very Positive',
          reviewPercent: item.reviews_percent || 88,
          tags: item.tags ? Object.values(item.tags) : ['Co-Op', 'Multiplayer'],
        }));
        if (games.length > 0) {
          StorageService.setCachedWishlist(steamId, games);
          return games;
        }
      }
    } catch {
      // Fallback if wishlist is private or unreachable
    }

    return [];
  },

  async resolveMissingCategories(appids: number[], onUpdate?: (resolvedCount: number) => void): Promise<void> {
    const unCached = appids.filter(id => !StorageService.getAppStoreDetails(id));
    let count = 0;

    for (const appid of unCached) {
      try {
        await this.fetchLiveStoreCategories(appid);
        count++;
        if (onUpdate) onUpdate(count);
        // Subtle throttling to respect Steam Store API limits
        await new Promise(res => setTimeout(res, 200));
      } catch {
        // Continue to next appid if one fails
      }
    }
  },

  async fetchLiveUpcomingGames(): Promise<{ appid: number; name: string; headerImage: string }[]> {
    try {
      const url = 'https://store.steampowered.com/search/results/?query&filter=comingsoon&category1=998&category3=38&json=1';
      const json = await requestSteamApi<any>(url);
      const rawItems = (json?.items || []).slice(0, 20); // Limit to top 20 results
      const results: { appid: number; name: string; headerImage: string }[] = [];

      for (const item of rawItems) {
        if (!item || !item.name || !item.logo) continue;
        const appidMatch = item.logo.match(/\/apps\/(\d+)\//);
        if (appidMatch && appidMatch[1]) {
          const appid = parseInt(appidMatch[1], 10);
          const rawLogo = item.logo;
          const capsule231 = rawLogo.replace('capsule_sm_120.jpg', 'capsule_231x87.jpg');
          results.push({
            appid,
            name: item.name.replace(/&amp;/g, '&').trim(),
            headerImage: capsule231 || rawLogo,
          });
        }
      }

      // Eagerly resolve store categories & high-res header images for the 20 items so dates, images, and descriptions are ready
      const detailsList = await Promise.all(
        results.map(async (r) => {
          const details = await this.fetchLiveStoreCategories(r.appid);
          return {
            ...r,
            headerImage: details?.headerImage || r.headerImage,
          };
        })
      );

      return detailsList;
    } catch {
      return [];
    }
  }
};
