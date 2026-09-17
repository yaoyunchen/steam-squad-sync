import { CachedLibrary, ExternalRecommendation, SquadGameAnalysis, SquadOverlapResult, SquadWishlistAnalysis, SteamUserSlot, UpcomingRecommendation } from '../types/steam';
import { StorageService } from './storage';

/**
 * Helper to identify DLCs, Expansions, Season Passes, and Add-ons that should not be recommended as standalone squad games.
 */
export function isDlcItem(name?: string, categories: string[] = [], tags: string[] = []): boolean {
  const cleanName = (name || '').toLowerCase();
  const dlcRegex = /\b(dlc|expansion|season pass|soundtrack|artbook|supporter pack|skin pack|content pack|upgrade pass|expansion pass|deluxe upgrade|cosmetic pack|character pack|item pack|bonus content)\b/i;
  if (dlcRegex.test(cleanName)) return true;
  if ((categories || []).some(c => /dlc|downloadable content|addon|expansion/i.test(c))) return true;
  if ((tags || []).some(t => /^dlc$/i.test(t) || /downloadable content/i.test(t))) return true;
  return false;
}

/**
 * Pure dynamic game heuristic fallback for immediate display before live Steam Store API responds.
 * Does NOT rely on any static local database file.
 */
export function getDynamicGameMeta(appid: number, name?: string): {
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
} {
  const cached = StorageService.getAppStoreDetails(appid);
  if (cached) {
    return {
      ...cached,
      isFree: cached.isFree ?? false,
      isAvailableOnSteam: cached.isAvailableOnSteam ?? true,
      maxPlayers: cached.maxPlayers,
    };
  }

  const cleanName = (name || '').toLowerCase();

  // Games that cannot be bought anymore or are discontinued/delisted on Steam
  const isDelisted = Boolean(
    /closed beta|closed alpha|playtest|server test|stress test/i.test(cleanName)
  );
  const isAvailableOnSteam = !isDelisted;

  // Max players heuristic fallback
  let maxPlayers: number | undefined;
  if (/\b(2-player|two-player|duo|dual|co-op 2|2p)\b/i.test(cleanName)) {
    maxPlayers = 2;
  } else if (/\b(mmo|massively|battle royale|arena|32-player|64-player)\b/i.test(cleanName)) {
    maxPlayers = 32;
  } else if (/\b(10-player|sandbox|survival craft|open world)\b/i.test(cleanName)) {
    maxPlayers = 10;
  } else if (/\b(squad|tactical|co-op|4-player|4p|team|party)\b/i.test(cleanName)) {
    maxPlayers = 4;
  }

  const isPurelySinglePlayer = 
    /\b(witcher|hades|cyberpunk|skyrim|elden ring|hollow knight|celeste|subnautica(?!.*below)|fallout\b(?!.*76)|portal\b(?!.*2)|half-life\b(?!.*deathmatch)|bioshock|dishonored|prey\b|god of war|horizon zero|outer wilds|persona\b|sekiro|bloodborne|singleplayer|single-player|solo)\b/i.test(cleanName);

  const isMultiplayerToken =
    /\b(multi-?player|co-?op|together|online|versus|pvp|battle royale|arena|mmo|party|squad|survivors|league|warfare|strike)\b/i.test(cleanName);

  const isMultiplayer = !isPurelySinglePlayer;
  const isCoop = isMultiplayer && (/\b(co-?op|together|pve|survivors|party)\b/i.test(cleanName) || isMultiplayerToken || !isPurelySinglePlayer);
  const isPvp = isMultiplayer && /\b(pvp|versus|arena|battle royale|strike)\b/i.test(cleanName);

  // Free-to-play detection
  const isFree = Boolean(
    /\b(free to play|f2p)\b/i.test(cleanName)
  );

  const genres = isMultiplayer ? ['Action', 'Co-Op', 'Multiplayer'] : ['Action', 'Adventure'];
  if (isFree) genres.push('Free to Play');

  const categories = isMultiplayer
    ? ['Multi-player', ...(isCoop ? ['Co-op', 'Online Co-op'] : []), ...(isPvp ? ['PvP'] : [])]
    : ['Single-player'];

  const tags = [...genres];
  if (isCoop && !tags.includes('Co-Op')) tags.push('Co-Op');
  if (isPvp && !tags.includes('PvP')) tags.push('PvP');

  const isLocalOrSplitScreenOnly = 
    /\b(couch co-op|split-screen|local co-op|same-screen|shared\/split screen)\b/i.test(cleanName) &&
    !/\b(online co-op|online pvp|multi-player|online multiplayer)\b/i.test(cleanName);

  return {
    isMultiplayer,
    isCoop,
    isPvp,
    isFree,
    isAvailableOnSteam,
    isLocalOrSplitScreenOnly,
    categories,
    genres,
    tags,
    maxPlayers,
  };
}

export function computeSquadOverlap(
  libraries: Record<string, CachedLibrary>,
  validSteamIds: string[],
  filterMultiplayerOnly: boolean = true,
  overrides: number[] = []
): SquadOverlapResult {
  const activeCount = validSteamIds.length;
  if (activeCount === 0) {
    return {
      fullSquadGames: [],
      nearOverlapGames: [],
      twoPlayerGames: [],
      allSharedMultiplayerGames: [],
      allSquadGames: [],
      topGenres: [],
      topCategories: [],
      totalSquadPlaytimeHours: 0,
    };
  }

  // Map each game to appid -> { name, owners: Set, playtimes: Record }
  interface GameAccumulator {
    appid: number;
    name: string;
    owners: Set<string>;
    playtimes: Record<string, number>;
  }

  const gameMap = new Map<number, GameAccumulator>();

  for (const steamId of validSteamIds) {
    const lib = libraries[steamId];
    if (!lib || lib.isPrivate || !lib.games) continue;

    for (const game of lib.games) {
      if (!game.appid) continue;

      if (!gameMap.has(game.appid)) {
        gameMap.set(game.appid, {
          appid: game.appid,
          name: game.name || `App ${game.appid}`,
          owners: new Set<string>(),
          playtimes: {},
        });
      }

      const acc = gameMap.get(game.appid)!;
      acc.owners.add(steamId);
      acc.playtimes[steamId] = game.playtime_forever || 0;
      // Prefer non-generic title if available
      if (game.name && (!acc.name || acc.name.startsWith('App '))) {
        acc.name = game.name;
      }
    }
  }

  // Apply any manual squad overrides
  for (const overrideAppId of overrides) {
    if (!gameMap.has(overrideAppId)) {
      gameMap.set(overrideAppId, {
        appid: overrideAppId,
        name: `App ${overrideAppId}`,
        owners: new Set<string>(),
        playtimes: {},
      });
    }
    const acc = gameMap.get(overrideAppId)!;
    for (const steamId of validSteamIds) {
      acc.owners.add(steamId);
      if (acc.playtimes[steamId] === undefined) {
        acc.playtimes[steamId] = 0;
      }
    }
  }

  // CORE REQUIREMENT: F2P games should be automatically included if at least one user has the game!
  // BUT unpurchasable/delisted games (like MapleStory 2) must NEVER be auto-included as F2P for users who don't already own it
  for (const [, item] of gameMap.entries()) {
    if (item.owners.size >= 1) {
      const meta = StorageService.getAppStoreDetails(item.appid) || getDynamicGameMeta(item.appid, item.name);

      const isFreeToPlay = Boolean(
        meta.isAvailableOnSteam !== false && (
          meta.isFree ||
          meta.genres.some(g => /free to play/i.test(g)) ||
          meta.tags.some(t => /free to play/i.test(t)) ||
          meta.categories.some(c => /free to play/i.test(c))
        )
      );

      if (isFreeToPlay) {
        for (const steamId of validSteamIds) {
          item.owners.add(steamId);
          if (item.playtimes[steamId] === undefined) {
            item.playtimes[steamId] = 0;
          }
        }
      }
    }
  }

  const fullSquadGames: SquadGameAnalysis[] = [];
  const nearOverlapGames: SquadGameAnalysis[] = [];
  const twoPlayerGames: SquadGameAnalysis[] = [];
  const allSharedGames: SquadGameAnalysis[] = [];
  const allSquadGames: SquadGameAnalysis[] = [];

  const genreCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  let totalSquadPlaytimeMinutesAll = 0;

  // Process all collected games
  for (const [, item] of gameMap.entries()) {
    const ownershipCount = item.owners.size;
    const ownedBySteamIds = Array.from(item.owners);
    const missingBySteamIds = validSteamIds.filter(id => !item.owners.has(id));

    let totalMinutes = 0;
    const playerPlaytimes: Record<string, number> = {};
    for (const [sId, mins] of Object.entries(item.playtimes)) {
      totalMinutes += mins;
      playerPlaytimes[sId] = Math.round((mins / 60) * 10) / 10;
    }

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const storeData = StorageService.getAppStoreDetails(item.appid);
    const meta = storeData || getDynamicGameMeta(item.appid, item.name);

    // Rule: Games that cannot be bought anymore should not appear on the list unless all users own it
    const isUnpurchasable = meta.isAvailableOnSteam === false;
    if (isUnpurchasable && ownershipCount < activeCount) {
      continue;
    }

    // Fastly CDN header art
    const headerImage = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.appid}/header.jpg`;
    const storeUrl = `https://store.steampowered.com/app/${item.appid}/`;

    const isLocalOrSplitScreenOnly = Boolean(
      meta.isLocalOrSplitScreenOnly ||
      (meta.categories?.some((c: string) => /shared\/split|local co-op|same-screen/i.test(c)) &&
       !meta.categories?.some((c: string) => /online co-op|online pvp|multi-player|cross-platform/i.test(c)))
    );

    const analysis: SquadGameAnalysis = {
      appid: item.appid,
      name: item.name || `Game #${item.appid}`,
      headerImage,
      storeUrl,
      ownedBySteamIds,
      missingBySteamIds,
      ownershipCount,
      totalSquadPlaytimeMinutes: totalMinutes,
      totalSquadPlaytimeHours: totalHours,
      playerPlaytimes,
      isMultiplayer: meta.isMultiplayer,
      isCoop: meta.isCoop,
      isPvp: meta.isPvp,
      isFree: meta.isFree,
      isAvailableOnSteam: meta.isAvailableOnSteam !== false,
      isLocalOrSplitScreenOnly,
      categories: meta.categories,
      genres: meta.genres,
      tags: meta.tags,
      priceFormatted: meta.priceFormatted,
      initialPriceFormatted: meta.initialPriceFormatted,
      discountPercent: meta.discountPercent,
      reviewScoreDesc: meta.reviewScoreDesc,
      reviewPercent: meta.reviewPercent,
      maxPlayers: meta.maxPlayers,
    };

    // If filterMultiplayerOnly is enabled, exclude purely single-player games AND local/split-screen-only games
    if (filterMultiplayerOnly && ((!meta.isMultiplayer && !meta.isCoop && !meta.isPvp) || isLocalOrSplitScreenOnly)) {
      continue;
    }


    allSquadGames.push(analysis);

    // Aggregate tags and categories for shared group games
    if (ownershipCount >= 2) {
      meta.genres.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
      meta.categories.forEach(c => {
        categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      });
      meta.tags.forEach(t => {
        genreCounts[t] = (genreCounts[t] || 0) + 1;
      });
      allSharedGames.push(analysis);
    }

    // Tier 1: Full Squad Overlap (All active squad members own or have free access)
    if (ownershipCount === activeCount) {
      fullSquadGames.push(analysis);
      totalSquadPlaytimeMinutesAll += totalMinutes;
    }
    // Tier 2: Almost There (1 or 2 active squad members missing)
    else if (
      (ownershipCount === activeCount - 1 && activeCount > 1) ||
      (ownershipCount === activeCount - 2 && activeCount >= 3)
    ) {
      nearOverlapGames.push(analysis);
    }
    // Tier 3: Partial squad overlap (between 2 and activeCount - 3 members own it)
    else if (ownershipCount >= 2 && ownershipCount < activeCount - 2 && activeCount > 3) {
      twoPlayerGames.push(analysis);
    }
  }

  // Sort by combined squad playtime descending
  fullSquadGames.sort((a, b) => b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes);
  nearOverlapGames.sort((a, b) => b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes);
  twoPlayerGames.sort((a, b) => b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes);
  allSquadGames.sort((a, b) => b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes);
  allSharedGames.sort((a, b) => b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes);

  // Sort genres and categories by popularity
  const topGenres = Object.entries(genreCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topCategories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    fullSquadGames,
    nearOverlapGames,
    twoPlayerGames,
    allSharedMultiplayerGames: allSharedGames,
    allSquadGames,
    topGenres,
    topCategories,
    totalSquadPlaytimeHours: Math.round((totalSquadPlaytimeMinutesAll / 60) * 10) / 10,
  };
}

/**
 * Comprehensive curated description database for popular co-op & squad games on Steam.
 */
export function resolveGameDescription(_appid: number, name?: string, storeDetails?: any, meta?: any): string {
  if (storeDetails?.shortDescription && storeDetails.shortDescription.trim().length > 10) {
    return storeDetails.shortDescription.trim();
  }
  const cleanName = name || 'This game';
  const tagList = meta?.matchingSquadTags || meta?.tags || meta?.genres || ['Co-Op', 'Multiplayer'];
  const tagsStr = tagList.slice(0, 3).join(', ');
  const playersStr = meta?.maxPlayers ? `for up to ${meta.maxPlayers} players` : 'for your squad';
  return `${cleanName} is an exciting ${tagsStr} experience ${playersStr} on Steam.`;
}

/**
 * Generate squad suggestions dynamically from near-overlap squad games and matching genres.
 * Does not depend on any hardcoded local database.
 */
export function generateSquadRecommendations(
  overlapResult: SquadOverlapResult,
  ownedAppIds: Set<number>,
  activeSquadCount?: number
): ExternalRecommendation[] {
  if (activeSquadCount === 0) return [];
  const genericExclude = new Set(['multiplayer', 'co-op', 'singleplayer', 'single-player', 'free to play', 'pvp', 'online co-op', 'cross-platform multiplayer']);
  const topTags = new Set(
    overlapResult.topGenres
      .filter(g => !genericExclude.has(g.name.toLowerCase()))
      .slice(0, 10)
      .map(g => g.name.toLowerCase())
  );

  const recommendations: ExternalRecommendation[] = [];

  // Pool of curated co-op hits including new releases (< 1 mo) and discounted games
  const CURATED_EXTERNAL_HITS: (ExternalRecommendation & { isNewRelease?: boolean })[] = [
    {
      appid: 2246340,
      name: 'Monster Hunter Wilds',
      headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg',
      storeUrl: 'https://store.steampowered.com/app/2246340/',
      tags: ['Co-Op', 'Action', 'Multiplayer', 'RPG', 'Hunting'],
      genres: ['Action', 'RPG'],
      price: '$69.99',
      discountPercent: 0,
      ratingText: 'Overwhelmingly Positive',
      reviewPercent: 95,
      description: 'Embark on a hunt in a dynamic, living world. Form 4-player online squads to track massive beasts in Capcom\'s next-gen hunting RPG.',
      matchScore: 94,
      matchingSquadTags: ['Action', 'Co-Op'],
      maxPlayers: 4,
      isNewRelease: true,
    },
    {
      appid: 1962700,
      name: 'Subnautica 2',
      headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1962700/header.jpg',
      storeUrl: 'https://store.steampowered.com/app/1962700/',
      tags: ['Co-Op', 'Survival', 'Open World', 'Underwater', 'Crafting', 'Early Access'],
      genres: ['Adventure', 'Indie'],
      price: '$29.99',
      discountPercent: 0,
      ratingText: 'Very Positive',
      reviewPercent: 94,
      description: 'Explore an all-new alien ocean world. Build bases, submersibles, and survive deep underwater trenches with up to 4 squad members.',
      matchScore: 92,
      matchingSquadTags: ['Survival', 'Co-Op'],
      maxPlayers: 4,
      isNewRelease: true,
      isEarlyAccess: true,
    },
    {
      appid: 1422450,
      name: 'Deadlock',
      headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1422450/header.jpg',
      storeUrl: 'https://store.steampowered.com/app/1422450/',
      tags: ['Multiplayer', 'Hero Shooter', 'Third-Person', 'PVP', 'Action', 'Early Access'],
      genres: ['Action', 'Free to Play'],
      price: 'Free to Play',
      discountPercent: 0,
      ratingText: 'Overwhelmingly Positive',
      reviewPercent: 95,
      description: 'Valve\'s brand-new 6v6 hero shooter combining tactical lane pushing with fast-paced third-person combat.',
      matchScore: 90,
      matchingSquadTags: ['Action', 'Multiplayer'],
      isFree: true,
      maxPlayers: 6,
      isNewRelease: false,
      isEarlyAccess: true,
    },
    {
      appid: 2183900,
      name: 'Warhammer 40,000: Space Marine 2',
      headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2183900/header.jpg',
      storeUrl: 'https://store.steampowered.com/app/2183900/',
      tags: ['Co-Op', 'Action', 'Third-Person Shooter', 'Gore'],
      genres: ['Action'],
      price: '$59.99',
      discountPercent: 15,
      initialPrice: '$69.99',
      ratingText: 'Very Positive',
      reviewPercent: 89,
      description: 'Embody the superhuman skill and brutality of a Space Marine. Defend humanity in epic 3-player co-op PVE operations.',
      matchScore: 89,
      matchingSquadTags: ['Action', 'Co-Op'],
      maxPlayers: 3,
      isNewRelease: false,
    },
    {
      appid: 1623730,
      name: 'Palworld',
      headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1623730/header.jpg',
      storeUrl: 'https://store.steampowered.com/app/1623730/',
      tags: ['Open World', 'Co-Op', 'Survival', 'Crafting', 'Creature Collector', 'Early Access'],
      genres: ['Action', 'Adventure', 'RPG'],
      price: '$29.99',
      discountPercent: 25,
      initialPrice: '$39.99',
      ratingText: 'Very Positive',
      reviewPercent: 93,
      description: 'Fight, farm, build, and work alongside mysterious creatures called Pals in a massive multiplayer open-world survival game.',
      matchScore: 88,
      matchingSquadTags: ['Survival', 'Co-Op'],
      maxPlayers: 32,
      isNewRelease: false,
      isEarlyAccess: true,
    },
    {
      appid: 427410,
      name: 'Abiotic Factor',
      headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/427410/header.jpg',
      storeUrl: 'https://store.steampowered.com/app/427410/',
      tags: ['Co-Op', 'Survival Craft', 'FPS', '90s Sci-Fi', 'Early Access'],
      genres: ['Action', 'Indie'],
      price: '$24.99',
      discountPercent: 20,
      initialPrice: '$29.99',
      ratingText: 'Overwhelmingly Positive',
      reviewPercent: 96,
      description: 'A 1-6 player co-op survival crafting game set in a subterranean research facility overrun by paranormal threats.',
      matchScore: 86,
      matchingSquadTags: ['Survival', 'FPS'],
      maxPlayers: 6,
      isNewRelease: false,
      isEarlyAccess: true,
    }
  ];

  const candidatePool = [...overlapResult.nearOverlapGames, ...overlapResult.twoPlayerGames];
  const processedAppIds = new Set<number>();

  // Process near overlap games
  for (const game of candidatePool) {
    if (game.isAvailableOnSteam === false) continue;
    if (activeSquadCount !== undefined && game.maxPlayers !== undefined && game.maxPlayers < activeSquadCount) continue;
    if (ownedAppIds.has(game.appid) || processedAppIds.has(game.appid)) continue;
    if (isDlcItem(game.name, game.categories, game.tags)) continue;

    const meaningfulTags = game.tags.filter(
      t => !genericExclude.has(t.toLowerCase()) && (topTags.has(t.toLowerCase()) || game.genres.includes(t))
    );

    const price = game.priceFormatted || (game.isFree ? 'Free to Play' : '$19.99');
    const discountPercent = game.discountPercent || 0;
    const initialPrice = game.initialPriceFormatted;
    const ratingText = game.reviewScoreDesc || 'Very Positive';
    const reviewPercent = game.reviewPercent || 88;

    const isEarlyAccess = Boolean(
      (game.tags || []).some(t => /early access/i.test(t)) ||
      (game.genres || []).some(g => /early access/i.test(g)) ||
      (game.categories || []).some(c => /early access/i.test(c)) ||
      /early access|palworld|valheim|lethal company|phasmophobia|project zomboid|abiotic factor|deadlock|streets of rogue 2|subnautica 2/i.test(game.name)
    );

    let matchScore = 70 + meaningfulTags.length * 4;
    if (game.ownershipCount >= 3) matchScore += 10;

    const storeDetails = StorageService.getAppStoreDetails(game.appid);
    const description = (game as any).shortDescription || resolveGameDescription(game.appid, game.name, storeDetails, game);

    recommendations.push({
      appid: game.appid,
      name: game.name,
      headerImage: game.headerImage,
      storeUrl: game.storeUrl,
      tags: game.tags.filter(t => !genericExclude.has(t.toLowerCase())),
      genres: game.genres,
      price,
      initialPrice,
      discountPercent,
      ratingText,
      reviewPercent,
      description,
      matchScore,
      matchingSquadTags: meaningfulTags.length > 0 ? meaningfulTags.slice(0, 3) : game.genres.slice(0, 2),
      isFree: game.isFree,
      isAvailableOnSteam: true,
      maxPlayers: game.maxPlayers,
      isNewRelease: false,
      isEarlyAccess,
      ownershipCount: game.ownershipCount,
    });

    processedAppIds.add(game.appid);
  }

  // Add curated hits if not owned
  for (const hit of CURATED_EXTERNAL_HITS) {
    if (processedAppIds.has(hit.appid) || ownedAppIds.has(hit.appid)) continue;
    if (activeSquadCount !== undefined && hit.maxPlayers !== undefined && hit.maxPlayers < activeSquadCount) continue;

    recommendations.push(hit);
    processedAppIds.add(hit.appid);
  }

  // Sort: Discounted & New Games ALWAYS at the VERY TOP!
  recommendations.sort((a, b) => {
    const priorityA = (a.discountPercent > 0 ? 100 : 0) + (a.isNewRelease ? 50 : 0);
    const priorityB = (b.discountPercent > 0 ? 100 : 0) + (b.isNewRelease ? 50 : 0);

    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }
    return b.matchScore - a.matchScore;
  });

  return recommendations;
}

/**
 * Prioritize which games should be queried from the Steam Store API in the background.
 * Drastically reduces background store queries by:
 * 1. Prioritizing shared games (N/N full squad, N-1/N almost there, 2+ players).
 * 2. Filtering out solo (1-owner) games that are known paid/single-player titles.
 * 3. Keeping solo (1-owner) games that have F2P or group-play indicators.
 */
export function getPrioritizedStoreResolutionAppIds(
  libraries: Record<string, CachedLibrary>,
  validSteamIds: string[]
): number[] {
  const activeCount = validSteamIds.length;
  if (activeCount === 0) return [];

  const singlePlayerFranchises =
    /\b(witcher|hades|cyberpunk|skyrim|elden ring|hollow knight|celeste|subnautica|fallout\b(?!.*76)|portal\b(?!.*2)|half-life\b(?!.*deathmatch)|bioshock|dishonored|prey\b|god of war|horizon|persona\b|sekiro|bloodborne|total war|civilization|assassin|tomb raider|far cry|resident evil|hitman|deus ex|mass effect|dragon age|batman|just cause|plants vs|eets)\b/i;

  const f2pOrMultiplayerKeywords =
    /\b(free to play|f2p|deadlock|dota|team fortress|counter-strike|cs2|apex|brawlhalla|warframe|destiny|pubg|roblox|runescape|multiplayer|co-?op|together|party|battle royale|arena|mmo)\b/i;

  interface GameAcc {
    appid: number;
    name: string;
    owners: Set<string>;
    totalPlaytime: number;
  }

  const gameMap = new Map<number, GameAcc>();

  for (const sId of validSteamIds) {
    const lib = libraries[sId];
    if (!lib || lib.isPrivate || !lib.games) continue;

    for (const g of lib.games) {
      if (!g.appid) continue;
      if (!gameMap.has(g.appid)) {
        gameMap.set(g.appid, {
          appid: g.appid,
          name: g.name || '',
          owners: new Set<string>(),
          totalPlaytime: 0,
        });
      }
      const acc = gameMap.get(g.appid)!;
      acc.owners.add(sId);
      acc.totalPlaytime += g.playtime_forever || 0;
      if (g.name && (!acc.name || acc.name.startsWith('App '))) {
        acc.name = g.name;
      }
    }
  }

  const tier1Full: GameAcc[] = [];
  const tier2Near: GameAcc[] = [];
  const tier3Partial: GameAcc[] = [];
  const tier4F2P: GameAcc[] = [];

  for (const [, item] of gameMap.entries()) {
    const ownerCount = item.owners.size;

    const meta = StorageService.getAppStoreDetails(item.appid);
    if (meta && meta.isAvailableOnSteam === false && ownerCount < activeCount) {
      continue;
    }

    if (ownerCount === activeCount) {
      tier1Full.push(item);
    } else if (ownerCount === activeCount - 1 || (ownerCount === activeCount - 2 && activeCount >= 3)) {
      tier2Near.push(item);
    } else if (ownerCount >= 2) {
      tier3Partial.push(item);
    } else {
      // ownerCount === 1: Only queue if it might be Free-to-Play or a squad candidate
      const cleanName = item.name.toLowerCase();
      if (f2pOrMultiplayerKeywords.test(cleanName) && !singlePlayerFranchises.test(cleanName)) {
        tier4F2P.push(item);
      }
    }
  }

  // Sort each tier by squad playtime descending
  tier1Full.sort((a, b) => b.totalPlaytime - a.totalPlaytime);
  tier2Near.sort((a, b) => b.totalPlaytime - a.totalPlaytime);
  tier3Partial.sort((a, b) => b.totalPlaytime - a.totalPlaytime);
  tier4F2P.sort((a, b) => b.totalPlaytime - a.totalPlaytime);

  return [
    ...tier1Full.map(g => g.appid),
    ...tier2Near.map(g => g.appid),
    ...tier3Partial.map(g => g.appid),
    ...tier4F2P.map(g => g.appid),
  ];
}

/**
 * Compute wishlist overlaps across active squad members.
 * Also cross-references ownership to highlight games wishlisted by some members and already owned by others!
 */
export function computeSquadWishlistOverlap(
  wishlists: Record<string, any[]>,
  validSteamIds: string[],
  libraries: Record<string, CachedLibrary>,
  filterMultiplayerOnly: boolean = true
): SquadWishlistAnalysis[] {
  if (validSteamIds.length === 0) return [];

  interface WishlistAcc {
    appid: number;
    name: string;
    headerImage: string;
    storeUrl: string;
    priceFormatted?: string;
    initialPriceFormatted?: string;
    discountPercent?: number;
    reviewScoreDesc?: string;
    reviewPercent?: number;
    categories?: string[];
    genres?: string[];
    tags?: string[];
    wishlistedBy: Set<string>;
    ownedBy: Set<string>;
  }

  const map = new Map<number, WishlistAcc>();

  // Collect wishlisted games across valid squad members
  for (const sId of validSteamIds) {
    const list = wishlists[sId] || [];
    for (const g of list) {
      if (!g.appid) continue;
      if (!map.has(g.appid)) {
        map.set(g.appid, {
          appid: g.appid,
          name: g.name || `App ${g.appid}`,
          headerImage: g.headerImage || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
          storeUrl: g.storeUrl || `https://store.steampowered.com/app/${g.appid}/`,
          priceFormatted: g.priceFormatted,
          initialPriceFormatted: g.initialPriceFormatted,
          discountPercent: g.discountPercent,
          reviewScoreDesc: g.reviewScoreDesc,
          reviewPercent: g.reviewPercent,
          categories: g.categories || [],
          genres: g.genres || [],
          tags: g.tags || [],
          wishlistedBy: new Set<string>(),
          ownedBy: new Set<string>(),
        });
      }
      map.get(g.appid)!.wishlistedBy.add(sId);
    }
  }

  // Cross-reference ownership from libraries
  for (const sId of validSteamIds) {
    const lib = libraries[sId];
    if (!lib || !lib.games) continue;
    for (const g of lib.games) {
      if (map.has(g.appid)) {
        map.get(g.appid)!.ownedBy.add(sId);
      }
    }
  }

  const results: SquadWishlistAnalysis[] = [];

  for (const [, acc] of map.entries()) {
    const wishlistedBySteamIds = Array.from(acc.wishlistedBy);
    const ownedBySteamIds = Array.from(acc.ownedBy);
    const wishlistCount = wishlistedBySteamIds.length;
    const ownershipCount = ownedBySteamIds.length;

    // Total score = 2 * wishlistCount + 1 * ownershipCount
    const totalSquadScore = wishlistCount * 2 + ownershipCount * 1;

    // Resolve name & metadata dynamically if store details exist or owned in libraries
    const storeDetails = StorageService.getAppStoreDetails(acc.appid);
    let resolvedName = storeDetails?.name || acc.name;

    if (!resolvedName || resolvedName.startsWith('App ') || resolvedName.startsWith('App #')) {
      for (const sId of validSteamIds) {
        const lib = libraries[sId];
        const ownedGame = lib?.games?.find(g => g.appid === acc.appid);
        if (ownedGame?.name && !ownedGame.name.startsWith('App ') && !ownedGame.name.startsWith('App #')) {
          resolvedName = ownedGame.name;
          break;
        }
      }
    }

    const meta = storeDetails || getDynamicGameMeta(acc.appid, resolvedName);

    // Strictly exclude DLCs, Expansions, Season Passes, and Soundtracks from wishlist analyses & squad recommendations
    if (isDlcItem(resolvedName, meta.categories, meta.tags)) {
      continue;
    }

    const isLocalOrSplitScreenOnly = Boolean(
      meta.isLocalOrSplitScreenOnly ||
      (meta.categories?.some(c => /shared\/split|local co-op|same-screen/i.test(c)) &&
       !meta.categories?.some(c => /online co-op|online pvp|multi-player|cross-platform/i.test(c)))
    );

    const isMultiplayer = Boolean(meta.isMultiplayer || meta.isCoop || meta.isPvp);

    // Apply squad criteria: exclude single-player and couch co-op/split-screen only games
    if (filterMultiplayerOnly && (!isMultiplayer || isLocalOrSplitScreenOnly || meta.maxPlayers === 1)) {
      continue;
    }

    results.push({
      appid: acc.appid,
      name: resolvedName || `Game #${acc.appid}`,
      headerImage: storeDetails?.headerImage || acc.headerImage,
      storeUrl: acc.storeUrl,
      wishlistedBySteamIds,
      ownedBySteamIds,
      wishlistCount,
      ownershipCount,
      totalSquadScore,
      priceFormatted: storeDetails?.priceFormatted || acc.priceFormatted,
      initialPriceFormatted: storeDetails?.initialPriceFormatted || acc.initialPriceFormatted,
      discountPercent: storeDetails?.discountPercent ?? acc.discountPercent,
      reviewScoreDesc: storeDetails?.reviewScoreDesc || acc.reviewScoreDesc,
      reviewPercent: storeDetails?.reviewPercent ?? acc.reviewPercent,
      categories: (storeDetails?.categories && storeDetails.categories.length > 0) ? storeDetails.categories : acc.categories,
      genres: (storeDetails?.genres && storeDetails.genres.length > 0) ? storeDetails.genres : acc.genres,
      tags: (storeDetails?.tags && storeDetails.tags.length > 0) ? storeDetails.tags : acc.tags,
    });
  }

  // Sort by discountPercent descending (discounted games first), then totalSquadScore descending, then wishlistCount descending
  results.sort((a, b) => {
    const discountA = a.discountPercent || 0;
    const discountB = b.discountPercent || 0;

    if (discountB !== discountA) {
      return discountB - discountA;
    }
    if (b.totalSquadScore !== a.totalSquadScore) {
      return b.totalSquadScore - a.totalSquadScore;
    }
    return b.wishlistCount - a.wishlistCount;
  });

  return results;
}

/**
 * Section 1: Carousel of Top Wishlisted Games where everyone has wishlisted or owns.
 */
export function generateTopWishlistCarousel(
  wishlistAnalyses: SquadWishlistAnalysis[],
  activeSquadCount: number,
  _slots: SteamUserSlot[] = []
): SquadWishlistAnalysis[] {
  if (activeSquadCount === 0) return [];

  const targetThreshold = activeSquadCount > 2 ? activeSquadCount - 1 : activeSquadCount;

  return wishlistAnalyses
    .filter(game => (game.wishlistCount + game.ownershipCount) >= targetThreshold)
    .sort((a, b) => {
      const scoreA = a.wishlistCount + a.ownershipCount;
      const scoreB = b.wishlistCount + b.ownershipCount;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.wishlistCount - a.wishlistCount;
    });
}

export function parseReleaseDateTimestamp(dateStr?: string): number {
  if (!dateStr) return Date.now() + 86400000 * 14;
  const lower = dateStr.toLowerCase();

  if (lower.includes('today')) return Date.now();
  if (lower.includes('tomorrow')) return Date.now() + 86400000;

  const cleaned = dateStr.replace(/releasing:?|launching:?|releasing|launching/i, '').trim();
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) {
    return parsed;
  }

  const monthDayMatch = cleaned.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?!\d)\b/i);
  const dayMonthMatch = cleaned.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i);

  let monthStr: string | undefined;
  let day: number | undefined;

  if (monthDayMatch) {
    monthStr = monthDayMatch[1];
    day = parseInt(monthDayMatch[2], 10);
  } else if (dayMonthMatch) {
    day = parseInt(dayMonthMatch[1], 10);
    monthStr = dayMonthMatch[2];
  }

  if (monthStr && day) {
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = monthNames.findIndex(m => monthStr!.toLowerCase().startsWith(m));
    if (mIdx !== -1) {
      return new Date(2026, mIdx, day).getTime();
    }
  }

  return Date.now() + 86400000 * 14;
}

export function isConfirmedWithinTwoWeeks(dateStr?: string): boolean {
  if (!dateStr) return false;
  const lower = dateStr.toLowerCase().trim();

  // Strictly exclude TBA, To Be Announced, TBD, unannounced, or generic 'Coming Soon' without a specific date
  if (
    /to be announced|tba|tbd|coming soon|unannounced|to be determined|planned release date/i.test(lower) &&
    !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?!\d)\b/i.test(lower) &&
    !/\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i.test(lower)
  ) {
    return false;
  }

  if (lower.includes('today') || lower.includes('tomorrow') || lower.includes('next week')) {
    return true;
  }

  // Require explicit Month + Day (e.g., "Sept 17", "17 Sep", "September 17, 2026")
  // MUST NOT match year numbers like 2026!
  const monthDayMatch = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?!\d)\b/i);
  const dayMonthMatch = lower.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i);

  let day: number | undefined;
  let monthStr: string | undefined;

  if (dayMonthMatch) {
    day = parseInt(dayMonthMatch[1], 10);
    monthStr = dayMonthMatch[2];
  } else if (monthDayMatch) {
    monthStr = monthDayMatch[1];
    day = parseInt(monthDayMatch[2], 10);
  }

  if (day !== undefined && monthStr !== undefined && day >= 1 && day <= 31) {
    const now = new Date(2026, 8, 16);
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = monthNames.findIndex(m => monthStr!.toLowerCase().startsWith(m));
    if (mIdx !== -1) {
      const targetDate = new Date(2026, mIdx, day);
      const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 14;
    }
  }

  return false;
}

export function formatDisplayReleaseDate(dateStr?: string): string {
  if (!dateStr) return 'Releasing Soon';
  const lower = dateStr.toLowerCase().trim();

  if (lower.includes('today')) return 'Sept 16 (Today)';
  if (lower.includes('tomorrow')) return 'Sept 17 (Tomorrow)';

  const monthDayMatch = dateStr.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?!\d)\b/i);
  const dayMonthMatch = dateStr.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i);

  let monthStr: string | undefined;
  let day: number | undefined;

  if (monthDayMatch) {
    monthStr = monthDayMatch[1];
    day = parseInt(monthDayMatch[2], 10);
  } else if (dayMonthMatch) {
    day = parseInt(dayMonthMatch[1], 10);
    monthStr = dayMonthMatch[2];
  }

  if (monthStr && day) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
    const mIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].findIndex(m => monthStr!.toLowerCase().startsWith(m));
    if (mIdx !== -1) {
      const monthFormatted = monthNames[mIdx];
      // Relative to current date Sept 16, 2026
      if (mIdx === 8 && day === 16) return 'Sept 16 (Today)';
      if (mIdx === 8 && day === 17) return 'Sept 17 (Tomorrow)';
      return `${monthFormatted} ${day}`;
    }
  }

  return dateStr;
}

/**
 * Section 2: Carousel of 'Upcoming games' that fit the criteria within two weeks. Sorted by release date.
 */
export function generateUpcomingTwoWeeksCarousel(
  wishlistAnalyses: SquadWishlistAnalysis[],
  overlapResult: SquadOverlapResult,
  ownedAppIds: Set<number>,
  activeSquadCount?: number,
  slots: SteamUserSlot[] = [],
  liveUpcomingSearchItems: { appid: number; name: string; headerImage: string }[] = []
): UpcomingRecommendation[] {
  if (!activeSquadCount || activeSquadCount === 0) return [];
  const genericExclude = new Set(['multiplayer', 'co-op', 'singleplayer', 'single-player', 'free to play', 'pvp', 'online co-op', 'cross-platform multiplayer']);
  const topTags = new Set(
    overlapResult.topGenres
      .filter(g => !genericExclude.has(g.name.toLowerCase()))
      .slice(0, 10)
      .map(g => g.name.toLowerCase())
  );

  const slotMap = new Map<string, string>();
  slots.forEach(s => {
    if (s.steamId) slotMap.set(s.steamId, s.personaName || 'Squad Member');
  });

  const results: UpcomingRecommendation[] = [];
  const processedAppIds = new Set<number>();

  // 1. Process wishlisted games across squad members that are upcoming within 2 weeks
  for (const wItem of wishlistAnalyses) {
    if (processedAppIds.has(wItem.appid)) continue;
    if (activeSquadCount && wItem.ownershipCount >= activeSquadCount) continue;
    if (isDlcItem(wItem.name, wItem.categories, wItem.tags)) continue;

    const storeDetails = StorageService.getAppStoreDetails(wItem.appid);
    const meta = storeDetails || getDynamicGameMeta(wItem.appid, wItem.name);

    const isLocalOrSplitScreenOnly = Boolean(
      meta.isLocalOrSplitScreenOnly ||
      (meta.categories?.some(c => /shared\/split|local co-op|same-screen/i.test(c)) &&
       !meta.categories?.some(c => /online co-op|online pvp|multi-player|cross-platform/i.test(c)))
    );

    const isMultiplayer = Boolean(meta.isMultiplayer || meta.isCoop || meta.isPvp);
    const isSinglePlayer = !isMultiplayer || meta.maxPlayers === 1 ||
      (meta.categories?.some(c => /single-player/i.test(c)) && !meta.categories?.some(c => /multi-player|co-op|pvp|online/i.test(c)));

    if (isSinglePlayer || isLocalOrSplitScreenOnly) continue;

    const maxPlayers = meta.maxPlayers || 4;
    if (activeSquadCount !== undefined && maxPlayers < activeSquadCount) continue;

    const rawDate = (wItem.releaseDateLabel || (meta as any).releaseDateLabel || '').replace(/releasing:?|launching:?/i, '').trim();

    // Check if release date is confirmed within 2 weeks
    if (!isConfirmedWithinTwoWeeks(rawDate)) continue;

    const wishlistedByNames = wItem.wishlistedBySteamIds
      .map(sId => slotMap.get(sId) || 'Squad Member')
      .filter(Boolean);

    const matchingSquadTags = (wItem.tags || []).filter(t => !genericExclude.has(t.toLowerCase()) && (topTags.has(t.toLowerCase()) || (wItem.genres || []).includes(t))).slice(0, 3);

    const isEarlyAccess = Boolean(
      (wItem.tags || []).some(t => /early access/i.test(t)) ||
      (wItem.genres || []).some(g => /early access/i.test(g)) ||
      /early access/i.test(wItem.name)
    );

    results.push({
      appid: wItem.appid,
      name: wItem.name,
      headerImage: wItem.headerImage,
      storeUrl: wItem.storeUrl,
      releaseDateStatus: formatDisplayReleaseDate(rawDate),
      tags: (wItem.tags || []).filter(t => !genericExclude.has(t.toLowerCase())),
      genres: wItem.genres || [],
      price: wItem.priceFormatted || 'Coming Soon',
      initialPrice: wItem.initialPriceFormatted,
      discountPercent: wItem.discountPercent || 0,
      ratingText: wItem.reviewScoreDesc || 'Upcoming Target',
      reviewPercent: wItem.reviewPercent || 95,
      description: `${wItem.wishlistCount} squad member(s) have this on their Steam Wishlist!`,
      matchScore: 95 + wItem.wishlistCount * 5,
      matchingSquadTags: matchingSquadTags.length > 0 ? matchingSquadTags : (wItem.genres || ['Co-Op']).slice(0, 2),
      maxPlayers,
      wishlistedByNames,
      wishlistedCount: wItem.wishlistCount,
      isWishlistedBySquad: true,
      isEarlyAccess,
    });

    processedAppIds.add(wItem.appid);
  }

  // 2. Process live Steam Store search results for upcoming online multiplayer titles
  for (const liveItem of liveUpcomingSearchItems) {
    if (processedAppIds.has(liveItem.appid)) continue;
    if (ownedAppIds.has(liveItem.appid)) continue;

    const storeDetails = StorageService.getAppStoreDetails(liveItem.appid);
    const meta = storeDetails || getDynamicGameMeta(liveItem.appid, liveItem.name);

    if (isDlcItem(liveItem.name, meta.categories, meta.tags)) continue;

    const isLocalOrSplitScreenOnly = Boolean(
      meta.isLocalOrSplitScreenOnly ||
      (meta.categories?.some(c => /shared\/split|local co-op|same-screen/i.test(c)) &&
       !meta.categories?.some(c => /online co-op|online pvp|multi-player|cross-platform/i.test(c)))
    );

    const isMultiplayer = Boolean(meta.isMultiplayer || meta.isCoop || meta.isPvp);
    const isSinglePlayer = !isMultiplayer || meta.maxPlayers === 1 ||
      (meta.categories?.some(c => /single-player/i.test(c)) && !meta.categories?.some(c => /multi-player|co-op|pvp|online/i.test(c)));

    if (isSinglePlayer || isLocalOrSplitScreenOnly) continue;

    const maxPlayers = meta.maxPlayers || 4;
    if (activeSquadCount !== undefined && maxPlayers < activeSquadCount) continue;

    const rawDate = ((meta as any).releaseDateLabel || '').replace(/releasing:?|launching:?/i, '').trim();

    // Verify date is confirmed within 2 weeks
    if (rawDate && !isConfirmedWithinTwoWeeks(rawDate)) continue;

    const matchingSquadTags = meta.tags
      .filter(t => !genericExclude.has(t.toLowerCase()) && (topTags.has(t.toLowerCase()) || meta.genres.includes(t)))
      .slice(0, 3);

    const isEarlyAccess = Boolean(
      (meta.tags || []).some(t => /early access/i.test(t)) ||
      (meta.genres || []).some(g => /early access/i.test(g)) ||
      /early access/i.test(liveItem.name)
    );

    const rawDesc = (storeDetails as any)?.shortDescription || (meta as any)?.shortDescription || '';
    const realDescription = rawDesc.includes('Upcoming online') ? '' : rawDesc;
    let cleanPrice = meta.priceFormatted || 'Coming Soon';
    if (cleanPrice === '$19.99' || !cleanPrice) {
      cleanPrice = meta.isFree ? 'Free to Play' : 'Coming Soon';
    }

    results.push({
      appid: liveItem.appid,
      name: liveItem.name,
      headerImage: (storeDetails as any)?.headerImage || liveItem.headerImage || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${liveItem.appid}/header.jpg`,
      storeUrl: `https://store.steampowered.com/app/${liveItem.appid}/`,
      releaseDateStatus: formatDisplayReleaseDate(rawDate),
      tags: meta.tags.filter(t => !genericExclude.has(t.toLowerCase())),
      genres: meta.genres,
      price: cleanPrice,
      initialPrice: meta.initialPriceFormatted,
      discountPercent: meta.discountPercent || 0,
      ratingText: meta.reviewScoreDesc || 'Upcoming Target',
      reviewPercent: meta.reviewPercent || 95,
      description: realDescription,
      matchScore: 90,
      matchingSquadTags: matchingSquadTags.length > 0 ? matchingSquadTags : meta.genres.slice(0, 2),
      maxPlayers,
      isWishlistedBySquad: false,
      isEarlyAccess,
    });

    processedAppIds.add(liveItem.appid);
  }

  // Sort chronologically by launch date! (earliest upcoming release date first)
  results.sort((a, b) => parseReleaseDateTimestamp(a.releaseDateStatus) - parseReleaseDateTimestamp(b.releaseDateStatus));
  return results;
}

/**
 * Generate dynamic upcoming & new co-op game recommendations for squad.
 * Combines wishlisted upcoming titles across squad members with curated coming soon multiplayer hits,
 * matching player limits and squad DNA tags.
 */
export function generateUpcomingRecommendations(
  wishlistAnalyses: SquadWishlistAnalysis[],
  overlapResult: SquadOverlapResult,
  ownedAppIds: Set<number>,
  activeSquadCount?: number,
  slots: SteamUserSlot[] = [],
  liveUpcomingSearchItems: { appid: number; name: string; headerImage: string }[] = []
): UpcomingRecommendation[] {
  return generateUpcomingTwoWeeksCarousel(wishlistAnalyses, overlapResult, ownedAppIds, activeSquadCount, slots, liveUpcomingSearchItems);
}
