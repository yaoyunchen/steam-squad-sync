export interface SteamUserSlot {
  id: string; // "slot-1", "slot-2", etc.
  input: string; // SteamID64, vanity URL or profile link
  steamId?: string; // Resolved 64-bit SteamID
  personaName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  isPrivate?: boolean;
  error?: string;
  isLoading?: boolean;
  gameCount?: number;
}

export interface OwnedGame {
  appid: number;
  name: string;
  playtime_forever: number; // minutes
  img_icon_url?: string;
  playtime_windows_forever?: number;
}

export interface CachedLibrary {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  isPrivate: boolean;
  timestamp: number;
  games: OwnedGame[];
}

export interface GameMetadata {
  appid: number;
  name: string;
  header_image?: string;
  is_multiplayer: boolean;
  is_coop: boolean;
  is_pvp?: boolean;
  categories: string[];
  genres: string[];
  tags: string[];
  store_url: string;
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    final_formatted: string;
  };
  short_description?: string;
  isLocalOrSplitScreenOnly?: boolean;
}

export interface WishlistGame {
  appid: number;
  name: string;
  headerImage: string;
  storeUrl: string;
  addedTimestamp?: number;
  priceFormatted?: string;
  initialPriceFormatted?: string;
  discountPercent?: number;
  reviewScoreDesc?: string;
  reviewPercent?: number;
  categories?: string[];
  genres?: string[];
  tags?: string[];
}

export interface SquadWishlistAnalysis {
  appid: number;
  name: string;
  headerImage: string;
  storeUrl: string;
  wishlistedBySteamIds: string[];
  ownedBySteamIds: string[];
  wishlistCount: number;
  ownershipCount: number;
  totalSquadScore: number; // Combined wishlist + ownership score
  priceFormatted?: string;
  initialPriceFormatted?: string;
  discountPercent?: number;
  reviewScoreDesc?: string;
  reviewPercent?: number;
  categories?: string[];
  genres?: string[];
  tags?: string[];
  isEarlyAccess?: boolean;
  releaseDateLabel?: string;
}

export interface SquadGameAnalysis {
  appid: number;
  name: string;
  headerImage: string;
  storeUrl: string;
  ownedBySteamIds: string[]; // List of steamids that own it
  missingBySteamIds: string[]; // List of steamids that DON'T own it
  ownershipCount: number; // e.g. 4 or 3
  totalSquadPlaytimeMinutes: number;
  totalSquadPlaytimeHours: number;
  playerPlaytimes: Record<string, number>; // steamId -> playtime in hours
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
}

export interface SquadOverlapResult {
  fullSquadGames: SquadGameAnalysis[]; // Tier 1: Full Squad Ready
  nearOverlapGames: SquadGameAnalysis[]; // Tier 2: Almost There (1-2 Missing)
  twoPlayerGames: SquadGameAnalysis[]; // Tier 3: Partial Overlap
  allSharedMultiplayerGames: SquadGameAnalysis[];
  allSquadGames: SquadGameAnalysis[]; // All games owned by ANY squad member
  topGenres: { name: string; count: number }[];
  topCategories: { name: string; count: number }[];
  totalSquadPlaytimeHours: number;
}

export interface ExternalRecommendation {
  appid: number;
  name: string;
  headerImage: string;
  storeUrl: string;
  tags: string[];
  genres: string[];
  price: string;
  initialPrice?: string;
  discountPercent: number;
  ratingText: string;
  reviewPercent?: number;
  description: string;
  matchScore: number;
  matchingSquadTags: string[];
  isFree?: boolean;
  isAvailableOnSteam?: boolean;
  maxPlayers?: number;
  isNewRelease?: boolean;
  releaseDateLabel?: string;
  isEarlyAccess?: boolean;
  ownershipCount?: number;
}

export interface UpcomingRecommendation extends ExternalRecommendation {
  releaseDateStatus?: string;
  wishlistedByNames?: string[];
  wishlistedCount?: number;
  isWishlistedBySquad?: boolean;
}

export type ActiveTab = 'ready' | 'missing' | 'wishlist' | 'recommendations' | 'schedule' | 'hidden';

export type AppTheme = 'dark' | 'light' | 'toast' | 'reysol';

export type ScheduleBlockId = 'daybreak' | 'morning' | 'afternoon' | 'evening' | 'night' | 'graveyard';

export interface ScheduleBlockInfo {
  id: ScheduleBlockId;
  label: string;
  timeRange: string;
  startHour: number;
  endHour: number;
}

export interface PlayerAvailability {
  slotId: string;
  personaName?: string;
  timezone: string;
  // Map of "YYYY-MM-DD-blockId" or "Day-blockId" -> boolean
  grid: Record<string, boolean>;
}

export interface BlockOverlapSlot {
  dateStr: string; // "2026-09-21"
  dayName: string; // "Mon"
  dayFormatted: string; // "Mon Sep 21"
  blockId: ScheduleBlockId;
  blockLabel: string;
  timeRange: string;
  availableSteamIds: string[];
  availableNames: string[];
  missingNames: string[];
  count: number;
  percentage: number;
  isFullSquad: boolean;
}

export interface GameNightEvent {
  id: string;
  appid: number;
  gameName: string;
  headerImage?: string;
  dayName: string; // "Friday"
  dateString: string; // "2026-09-25"
  startTimeLabel: string; // "8:00 PM"
  endTimeLabel: string; // "11:00 PM"
  startIso: string;
  endIso: string;
  attendingNames: string[];
  note?: string;
  createdAt: number;
}

