import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gamepad2, 
  UserMinus, 
  Sparkles,
  Users, 
  AlertTriangle, 
  Info, 
  Clock,
  CheckCircle2,
  RefreshCw,
  Heart,
  EyeOff,
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  ActiveTab, 
  AppTheme,
  CachedLibrary, 
  SteamUserSlot 
} from './types/steam';
import { StorageService } from './services/storage';
import { SteamApiService } from './services/steamApi';
import { computeSquadOverlap, computeSquadWishlistOverlap, generateSquadRecommendations, generateTopWishlistCarousel, generateUpcomingTwoWeeksCarousel, getPrioritizedStoreResolutionAppIds } from './services/intersectionEngine';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { CloudSyncService, generateDeterministicSquadKey, sanitizeSchedulesForCloud, sanitizeGamesForCloud, sanitizeSlotsForCloud } from './services/cloudSync';
import { ReadyToPlayTab } from './components/ReadyToPlayTab';
import { MissingOneTab } from './components/MissingOneTab';
import { RecommendationsTab } from './components/RecommendationsTab';
import { WishlistTab } from './components/WishlistTab';
import { HiddenTab } from './components/HiddenTab';
import { ScheduleTab } from './components/ScheduleTab';



const DEFAULT_SLOTS: SteamUserSlot[] = [
  { id: 'slot-1', input: '', steamId: '', personaName: '' },
  { id: 'slot-2', input: '', steamId: '', personaName: '' },
];

const DEFAULT_API_KEY = (import.meta as any).env?.VITE_STEAM_API_KEY || '';

export const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(() => {
    const saved = StorageService.getApiKey();
    return (saved && saved.trim().length > 0) ? saved : DEFAULT_API_KEY;
  });

  const [slots, setSlots] = useState<SteamUserSlot[]>(() => {
    const saved = StorageService.getSavedSlots();
    if (saved && saved.length >= 2 && saved.some(s => s.input && s.input.trim().length > 0)) {
      return saved;
    }
    return DEFAULT_SLOTS;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('ready');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [libraries, setLibraries] = useState<Record<string, CachedLibrary>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [filterMultiplayerOnly, setFilterMultiplayerOnly] = useState<boolean>(true);
  const [metadataVersion, setMetadataVersion] = useState<number>(0);
  const [squadOverrides, setSquadOverrides] = useState<number[]>(() => {
    const saved = StorageService.getSquadOverrides();
    return saved ? saved : [];
  });
  const [theme, setThemeState] = useState<AppTheme>(() => StorageService.getTheme());
  const [hiddenAppIds, setHiddenAppIds] = useState<number[]>(() => StorageService.getHiddenAppIds());
  const [roomCode, setRoomCode] = useState('');

  const activeSquadKey = useMemo(() => {
    return generateDeterministicSquadKey(slots);
  }, [slots]);

  useEffect(() => {
    if (activeSquadKey) {
      setRoomCode(activeSquadKey);
      const config = StorageService.getSupabaseConfig();
      StorageService.setSupabaseConfig(config.url, config.anonKey, activeSquadKey);
    }
  }, [activeSquadKey]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleThemeChange = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    StorageService.setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  const [wishlists, setWishlists] = useState<Record<string, any[]>>({});

  const [resolvingProgress, setResolvingProgress] = useState<{ current: number; total: number } | null>(null);

  const handleToggleOverride = (appid: number) => {
    const updated = StorageService.toggleSquadOverride(appid);
    setSquadOverrides([...updated]);
  };

  const handleToggleHideGame = (appid: number) => {
    const updated = StorageService.toggleHideAppId(appid);
    setHiddenAppIds([...updated]);
  };

  const handleJoinSquadRoom = async (code: string) => {
    const config = StorageService.getSupabaseConfig();
    const url = config.url;
    const anonKey = config.anonKey;
    const targetRoomCode = code.trim().toUpperCase() || config.roomCode;

    if (!url || !anonKey || !targetRoomCode) {
      setStatusMessage({ type: 'error', text: 'Supabase URL & Anon Key must be configured to join squad room.' });
      return;
    }

    setIsSyncing(true);
    setStatusMessage({ type: 'info', text: `Joining Squad Room ${targetRoomCode}...` });

    try {
      const payload = await CloudSyncService.fetchSquadPayload(url, anonKey, targetRoomCode);
      if (!payload) {
        setStatusMessage({ type: 'error', text: `No squad room data found for ${targetRoomCode}.` });
        return;
      }

      let loadedSlots = slots;
      if (payload.slots && payload.slots.length >= 2) {
        loadedSlots = payload.slots.map(s => ({
          id: s.id,
          input: s.input,
          steamId: s.steamId,
          personaName: s.personaName,
          avatarUrl: s.avatarUrl,
        }));
        setSlots(loadedSlots);
        StorageService.saveSlots(loadedSlots);
      }

      if (payload.schedules) {
        const currentScheds = StorageService.getSquadSchedules();
        const mergedScheds = { ...currentScheds, ...payload.schedules };
        StorageService.saveSquadSchedules(mergedScheds);
      }

      StorageService.setSupabaseConfig(url, anonKey, targetRoomCode);
      setRoomCode(targetRoomCode);

      // Restore libraries from saved local cache for each player slot
      const restoredLibs: Record<string, CachedLibrary> = { ...libraries };
      let missingCacheCount = 0;
      loadedSlots.forEach(s => {
        if (s.steamId) {
          const cached = StorageService.getCachedLibrary(s.steamId);
          if (cached) {
            restoredLibs[s.steamId] = cached;
          } else {
            missingCacheCount++;
          }
        }
      });
      setLibraries(restoredLibs);

      if (missingCacheCount > 0 && apiKey.trim()) {
        setStatusMessage({ type: 'success', text: `Joined Squad Room ${targetRoomCode}! Fetching libraries for new players...` });
        setTimeout(() => {
          handleSyncSquad();
        }, 300);
      } else {
        setStatusMessage({ type: 'success', text: `Joined Squad Room ${targetRoomCode}! Loaded ${loadedSlots.length} players & saved game data.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to join squad room: ' + (err.message || 'Unknown error') });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllHidden = () => {
    StorageService.clearAllHiddenAppIds();
    setHiddenAppIds([]);
  };

  const runBackgroundStoreResolution = (appIds: number[]) => {
    const unCached = appIds.filter(id => !StorageService.getAppStoreDetails(id));
    if (unCached.length === 0) return;

    setResolvingProgress({ current: 0, total: unCached.length });
    SteamApiService.resolveMissingCategories(unCached, (count) => {
      setResolvingProgress({ current: count, total: unCached.length });
      // Batch re-renders every 3 games or when finished to keep UI smooth
      if (count % 3 === 0 || count >= unCached.length) {
        setMetadataVersion(v => v + 1);
      }
      if (count >= unCached.length) {
        setTimeout(() => setResolvingProgress(null), 2500);
      }
    });
  };

  const [liveUpcomingItems, setLiveUpcomingItems] = useState<{ appid: number; name: string; headerImage: string }[]>([]);

  // Initialize from storage or defaults on load
  useEffect(() => {
    const savedKey = StorageService.getApiKey();
    const effectiveKey = (savedKey && savedKey.trim().length > 0) ? savedKey : DEFAULT_API_KEY;
    setApiKey(effectiveKey);

    const savedSlots = StorageService.getSavedSlots();
    const activeSlots = (savedSlots && savedSlots.length >= 2 && savedSlots.length <= 8)
      ? savedSlots
      : DEFAULT_SLOTS;

    setSlots(activeSlots);

    // Fetch live upcoming online multiplayer games directly from Steam search API
    SteamApiService.fetchLiveUpcomingGames().then(items => {
      if (items && items.length > 0) {
        setLiveUpcomingItems(items);
        const liveAppIds = items.map(i => i.appid);
        runBackgroundStoreResolution(liveAppIds);
      }
    });

    // Restore libraries & wishlists from local cache if present
    const loadedLibs: Record<string, CachedLibrary> = {};
    activeSlots.forEach(s => {
      if (s.steamId) {
        const cached = StorageService.getCachedLibrary(s.steamId);
        if (cached) {
          loadedLibs[s.steamId] = cached;
        }
        SteamApiService.getUserWishlist(savedKey, s.steamId).then(wList => {
          if (wList && wList.length > 0) {
            setWishlists(prev => ({ ...prev, [s.steamId!]: wList }));
          }
        });
      }
    });

    if (Object.keys(loadedLibs).length > 0) {
      setLibraries(loadedLibs);
      const activeSteamIds = activeSlots.filter(s => s.steamId).map(s => s.steamId!);
      const prioritizedAppIds = getPrioritizedStoreResolutionAppIds(loadedLibs, activeSteamIds);
      runBackgroundStoreResolution(prioritizedAppIds);
    }
  }, []);

  // Update API key
  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    StorageService.setApiKey(newKey);
  };

  // Update input text of a slot
  const handleSlotChange = (slotId: string, input: string) => {
    setSlots(prev => {
      const updated = prev.map(s => (s.id === slotId ? { ...s, input, error: undefined } : s));
      StorageService.saveSlots(updated);
      return updated;
    });
  };

  // Add a single player slot (up to 8)
  const handleAddSlot = () => {
    setRoomCode('');
    setSlots(prev => {
      if (prev.length >= 8) return prev;
      const newSlot: SteamUserSlot = {
        id: `slot-${Date.now()}`,
        input: '',
      };
      const updated = [...prev, newSlot];
      StorageService.saveSlots(updated);
      return updated;
    });
  };

  // Remove a player slot (minimum 2)
  const handleRemoveSlot = (slotId: string) => {
    setRoomCode('');
    setSlots(prev => {
      if (prev.length <= 2) return prev;
      const updated = prev.filter(s => s.id !== slotId);
      StorageService.saveSlots(updated);
      return updated;
    });
  };

  // Adjust squad size directly between 2 and 8
  const handleSetSquadSize = (targetSize: number) => {
    const size = Math.max(2, Math.min(8, targetSize));
    setRoomCode('');
    setSlots(prev => {
      if (prev.length === size) return prev;
      let updated: SteamUserSlot[];
      if (prev.length > size) {
        updated = prev.slice(0, size);
      } else {
        updated = [...prev];
        while (updated.length < size) {
          updated.push({
            id: `slot-${Date.now()}-${updated.length + 1}`,
            input: '',
          });
        }
      }
      StorageService.saveSlots(updated);
      return updated;
    });
  };

  // Resolve individual slot vanity URL or SteamID
  const handleResolveSlot = async (slotId: string) => {
    const targetSlot = slots.find(s => s.id === slotId);
    if (!targetSlot || !targetSlot.input.trim()) return;

    if (!apiKey.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter your Valve Steam Web API key to resolve live accounts.',
      });
      return;
    }

    setSlots(prev => prev.map(s => (s.id === slotId ? { ...s, isLoading: true, error: undefined } : s)));

    try {
      const resolved = await SteamApiService.resolveSquadSlot(apiKey, targetSlot);
      setSlots(prev => {
        const updated = prev.map(s => (s.id === slotId ? resolved : s));
        StorageService.saveSlots(updated);
        return updated;
      });
      setStatusMessage({
        type: 'success',
        text: `Resolved: ${resolved.personaName} (${resolved.steamId})`,
      });
    } catch (err: any) {
      setSlots(prev =>
        prev.map(s =>
          s.id === slotId
            ? { ...s, isLoading: false, error: err.message || 'Failed to resolve' }
            : s
        )
      );
    }
  };

  // Sync squad libraries
  const handleSyncSquad = async () => {
    const activeSlots = slots.filter(s => s.steamId);
    if (activeSlots.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Configure and verify at least one SteamID with a public profile.',
      });
      return;
    }

    setIsSyncing(true);
    setStatusMessage({
      type: 'info',
      text: `Syncing libraries for ${activeSlots.length} squad members...`,
    });

    // Refresh live upcoming search items
    SteamApiService.fetchLiveUpcomingGames().then(items => {
      if (items && items.length > 0) {
        setLiveUpcomingItems(items);
        const liveAppIds = items.map(i => i.appid);
        runBackgroundStoreResolution(liveAppIds);
      }
    });

    const newLibraries: Record<string, CachedLibrary> = { ...libraries };
    let hasErrors = false;
    let privateCount = 0;

    for (const slot of activeSlots) {
      if (!slot.steamId) continue;

      try {
        setSlots(prev =>
          prev.map(s => (s.id === slot.id ? { ...s, isLoading: true } : s))
        );

        // If no API key is set, check if we have cached library
        if (!apiKey.trim()) {
          const cached = StorageService.getCachedLibrary(slot.steamId);
          if (cached) {
            newLibraries[slot.steamId] = cached;
          } else {
            throw new Error('Steam Web API key is required to query live libraries.');
          }
        } else {
          const lib = await SteamApiService.fetchLibraryWithCache(
            apiKey,
            slot.steamId,
            slot.personaName,
            slot.avatarUrl,
            true // force refresh on explicit sync
          );
          newLibraries[slot.steamId] = lib;

          if (lib.isPrivate) {
            privateCount++;
          }

          // Update slot with game count & privacy state
          setSlots(prev =>
            prev.map(s =>
              s.id === slot.id
                ? {
                    ...s,
                    isPrivate: lib.isPrivate,
                    gameCount: lib.games.length,
                    isLoading: false,
                  }
                : s
            )
          );
        }
      } catch (err: any) {
        hasErrors = true;
        setSlots(prev =>
          prev.map(s =>
            s.id === slot.id
              ? { ...s, isLoading: false, error: err.message || 'Failed to fetch library' }
              : s
          )
        );
      }
    }

    // Fetch wishlists for active squad slots
    const newWishlists: Record<string, any[]> = { ...wishlists };
    const wishlistedAppIds = new Set<number>();
    for (const slot of activeSlots) {
      if (!slot.steamId) continue;
      try {
        const wList = await SteamApiService.getUserWishlist(apiKey, slot.steamId);
        newWishlists[slot.steamId] = wList;
        wList.forEach(g => { if (g.appid) wishlistedAppIds.add(g.appid); });
      } catch {
        // Fallback
      }
    }
    setWishlists(newWishlists);

    setLibraries(newLibraries);
    setIsSyncing(false);
    setLastSyncedTime(new Date().toLocaleTimeString());

    // Resolve live Steam Store categories for prioritized shared & F2P candidate & wishlisted games
    const prioritizedAppIds = getPrioritizedStoreResolutionAppIds(newLibraries, activeSlots.map(s => s.steamId!));
    const allAppIdsToResolve = Array.from(new Set([...prioritizedAppIds, ...Array.from(wishlistedAppIds)]));
    runBackgroundStoreResolution(allAppIdsToResolve);

    // Auto-save updated squad slots & availability to cloud room code if configured
    const cloudConfig = StorageService.getSupabaseConfig();
    if (cloudConfig.url && cloudConfig.anonKey && roomCode) {
      try {
        const currentScheds = StorageService.getSquadSchedules();
        const cleanedSchedules = sanitizeSchedulesForCloud(currentScheds);
        const cleanedReady = sanitizeGamesForCloud(overlapResult.fullSquadGames);
        const cleanedNear = sanitizeGamesForCloud(overlapResult.nearOverlapGames);
        const cleanedSlots = sanitizeSlotsForCloud(activeSlots);

        CloudSyncService.pushSquadPayload(cloudConfig.url, cloudConfig.anonKey, roomCode, {
          slots: cleanedSlots,
          schedules: cleanedSchedules,
          sharedGames: {
            readyGames: cleanedReady,
            nearOverlapGames: cleanedNear,
            updatedAt: Date.now(),
          },
        });
      } catch (cloudErr) {
        console.warn('Auto cloud sync push warning:', cloudErr);
      }
    }

    if (privateCount > 0) {
      setStatusMessage({
        type: 'error',
        text: `${privateCount} profile(s) have their game details set to Private in Steam Privacy Settings.`,
      });
    } else if (hasErrors) {
      setStatusMessage({
        type: 'error',
        text: 'Some libraries could not be retrieved. Please check API Key or network status.',
      });
    } else {
      setStatusMessage({
        type: 'success',
        text: `Successfully synced libraries for all ${activeSlots.length} squad members & updated Cloud Room ${roomCode.toUpperCase()}!`,
      });
    }
  };

  // Clear cache
  const handleClearCache = () => {
    StorageService.clearAllCache();
    setStatusMessage({
      type: 'info',
      text: 'Local library cache has been cleared.',
    });
  };

  // Wipe all app data, storage, hidden games, and custom squad slots
  const handleResetAllData = () => {
    StorageService.clearAllCache();
    StorageService.clearAllHiddenAppIds();
    StorageService.saveSlots(DEFAULT_SLOTS);
    StorageService.setApiKey('');
    setApiKey('');
    setSlots(DEFAULT_SLOTS);
    setHiddenAppIds([]);
    setLibraries({});
    setWishlists({});
    setStatusMessage({
      type: 'info',
      text: 'All app data, storage, hidden games, and squad slots have been reset to a clean state.',
    });
  };

  // Active valid Steam IDs
  const validSteamIds = useMemo(() => {
    return slots
      .filter(s => s.steamId && !s.isPrivate && libraries[s.steamId])
      .map(s => s.steamId!);
  }, [slots, libraries]);

  // Compute set intersections
  const overlapResult = useMemo(() => {
    return computeSquadOverlap(libraries, validSteamIds, filterMultiplayerOnly, squadOverrides);
  }, [libraries, validSteamIds, filterMultiplayerOnly, metadataVersion, squadOverrides]);

  // Compute squad wishlist analysis
  const wishlistAnalyses = useMemo(() => {
    if (validSteamIds.length === 0) return [];
    return computeSquadWishlistOverlap(wishlists, validSteamIds, libraries, filterMultiplayerOnly);
  }, [wishlists, validSteamIds, libraries, filterMultiplayerOnly, metadataVersion]);

  // Owned app IDs for recommendations filter
  const ownedAppIdsSet = useMemo(() => {
    const set = new Set<number>();
    overlapResult.fullSquadGames.forEach(g => set.add(g.appid));
    return set;
  }, [overlapResult]);

  // Section 1: Top Wishlist Carousel (100% owned/wishlisted by squad)
  const topWishlistCarousel = useMemo(() => {
    if (validSteamIds.length === 0) return [];
    return generateTopWishlistCarousel(wishlistAnalyses, validSteamIds.length, slots);
  }, [wishlistAnalyses, validSteamIds.length, slots]);

  // Section 2: Upcoming Games (within two weeks)
  const upcomingTwoWeeksCarousel = useMemo(() => {
    if (validSteamIds.length === 0) return [];
    return generateUpcomingTwoWeeksCarousel(
      wishlistAnalyses,
      overlapResult,
      ownedAppIdsSet,
      validSteamIds.length,
      slots,
      liveUpcomingItems
    );
  }, [wishlistAnalyses, overlapResult, ownedAppIdsSet, validSteamIds.length, slots, liveUpcomingItems, metadataVersion]);

  // Recommendations (Section 3: Grid with Discounted & NEW games at top)
  const externalRecommendations = useMemo(() => {
    if (validSteamIds.length === 0) return [];
    return generateSquadRecommendations(overlapResult, ownedAppIdsSet, validSteamIds.length);
  }, [overlapResult, ownedAppIdsSet, validSteamIds.length]);

  // Hidden games currently present in active squad libraries
  const activeHiddenGames = useMemo(() => {
    if (validSteamIds.length === 0) return [];
    return overlapResult.allSquadGames.filter(g => hiddenAppIds.includes(g.appid));
  }, [overlapResult.allSquadGames, hiddenAppIds, validSteamIds.length]);

  const unhiddenFullSquadGames = useMemo(
    () => overlapResult.fullSquadGames.filter(g => !hiddenAppIds.includes(g.appid)),
    [overlapResult.fullSquadGames, hiddenAppIds]
  );

  const unhiddenNearOverlapGames = useMemo(
    () => overlapResult.nearOverlapGames.filter(g => !hiddenAppIds.includes(g.appid)),
    [overlapResult.nearOverlapGames, hiddenAppIds]
  );

  const unhiddenTwoPlayerGames = useMemo(
    () => overlapResult.twoPlayerGames.filter(g => !hiddenAppIds.includes(g.appid)),
    [overlapResult.twoPlayerGames, hiddenAppIds]
  );

  const unhiddenAllSquadGames = useMemo(
    () => overlapResult.allSquadGames.filter(g => !hiddenAppIds.includes(g.appid)),
    [overlapResult.allSquadGames, hiddenAppIds]
  );

  const activePlayerCount = validSteamIds.length;

  return (
    <div className="flex flex-col h-screen w-screen bg-steam-darkest text-steam-text overflow-hidden select-none">
      {/* Windows 11 Fluent Titlebar */}
      <TitleBar onRefreshAll={handleSyncSquad} isSyncing={isSyncing} theme={theme} onThemeChange={handleThemeChange} />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Left Sidebar */}
        <Sidebar
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
          slots={slots}
          onSlotChange={handleSlotChange}
          onResolveSlot={handleResolveSlot}
          onAddSlot={handleAddSlot}
          onRemoveSlot={handleRemoveSlot}
          onSetSquadSize={handleSetSquadSize}
          onJoinSquadRoom={handleJoinSquadRoom}
          roomCode={roomCode}
          onRoomCodeChange={setRoomCode}
          onSyncSquad={handleSyncSquad}
          onClearCache={handleClearCache}
          onResetAllData={handleResetAllData}
          isSyncing={isSyncing}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Central Dashboard & Tab Panel */}
        <main className="flex-1 flex flex-col overflow-hidden bg-steam-darkest transition-colors duration-200">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between border-b transition-all ${
                statusMessage.type === 'error'
                  ? 'bg-rose-950/70 border-rose-800 text-rose-200'
                  : statusMessage.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                  : 'bg-steam-card/80 border-steam-border text-steam-text'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'error' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                ) : statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-steam-accent flex-shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-steam-muted hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Navigation Bar & Tab Bar */}
          <div className="border-b border-steam-border/40 px-6 pt-4 pb-0 bg-steam-darker/60 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('ready')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'ready'
                    ? 'border-steam-green text-steam-green bg-steam-card/40 rounded-t-lg'
                    : 'border-transparent text-steam-muted hover:text-steam-text hover:bg-steam-card/20 rounded-t-lg'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Ready to Play ({activePlayerCount}/{activePlayerCount})</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-steam-green/20 text-steam-green font-mono">
                  {overlapResult.fullSquadGames.filter(g => !hiddenAppIds.includes(g.appid)).length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('missing')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'missing'
                    ? 'border-amber-400 text-amber-300 bg-steam-card/40 rounded-t-lg'
                    : 'border-transparent text-steam-muted hover:text-steam-text hover:bg-steam-card/20 rounded-t-lg'
                }`}
              >
                <UserMinus className="w-4 h-4" />
                <span>Almost There (1–2 Missing)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {overlapResult.nearOverlapGames.filter(g => !hiddenAppIds.includes(g.appid)).length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('wishlist')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'wishlist'
                    ? 'border-purple-400 text-purple-300 bg-steam-card/40 rounded-t-lg'
                    : 'border-transparent text-steam-muted hover:text-steam-text hover:bg-steam-card/20 rounded-t-lg'
                }`}
              >
                <Heart className="w-4 h-4 text-purple-400 fill-purple-400/20" />
                <span>Wishlists</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {wishlistAnalyses.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('recommendations')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'recommendations'
                    ? 'border-purple-400 text-purple-300 bg-steam-card/40 rounded-t-lg'
                    : 'border-transparent text-steam-muted hover:text-steam-text hover:bg-steam-card/20 rounded-t-lg'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Squad Suggestions</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {externalRecommendations.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('schedule')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'schedule'
                    ? 'border-indigo-400 text-indigo-300 bg-steam-card/40 rounded-t-lg'
                    : 'border-transparent text-steam-muted hover:text-steam-text hover:bg-steam-card/20 rounded-t-lg'
                }`}
              >
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                <span>Squad Schedule</span>
              </button>

              <button
                onClick={() => setActiveTab('hidden')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'hidden'
                    ? 'border-slate-400 text-slate-200 bg-steam-card/40 rounded-t-lg'
                    : 'border-transparent text-steam-muted hover:text-steam-text hover:bg-steam-card/20 rounded-t-lg'
                }`}
              >
                <EyeOff className="w-4 h-4" />
                <span>Hidden ({activeHiddenGames.length})</span>
              </button>
            </div>

            {/* Live Steam Store & F2P metadata progress indicator */}
            {resolvingProgress ? (
              <div className="flex items-center gap-2 text-[11px] text-steam-accent bg-steam-accent/10 border border-steam-accent/30 px-2.5 py-1 rounded-full pb-1 mb-2 shadow-glow-accent animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking Live Steam Store & F2P Tags ({resolvingProgress.current}/{resolvingProgress.total})...</span>
              </div>
            ) : lastSyncedTime ? (
              <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-steam-muted pb-3">
                <Clock className="w-3 h-3 text-steam-accent" />
                <span>Synced at {lastSyncedTime}</span>
              </div>
            ) : null}
          </div>

          {/* Active Tab Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activePlayerCount === 0 ? (
              <div className="max-w-lg mx-auto mt-16 text-center p-8 rounded-2xl bg-steam-card/60 border border-steam-border/60 shadow-xl space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-steam-accent/10 border border-steam-accent/30 flex items-center justify-center mx-auto text-steam-accent shadow-glow-accent">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Assemble Your Steam Squad</h3>
                <p className="text-xs text-steam-muted leading-relaxed">
                  Enter 2 to 8 SteamIDs, vanity names, or full profile URLs in the left sidebar to analyze multiplayer overlap and find games to play together!
                </p>
              </div>
            ) : (
              <>
                {activeTab === 'ready' && (
                  <ReadyToPlayTab
                    games={unhiddenFullSquadGames}
                    allSquadGames={unhiddenAllSquadGames}
                    nearOverlapGames={unhiddenNearOverlapGames}
                    twoPlayerGames={unhiddenTwoPlayerGames}
                    slots={slots}
                    activePlayerCount={activePlayerCount}
                    filterMultiplayerOnly={filterMultiplayerOnly}
                    onToggleFilterMultiplayerOnly={() => setFilterMultiplayerOnly(!filterMultiplayerOnly)}
                    squadOverrides={squadOverrides}
                    onToggleOverride={handleToggleOverride}
                    hiddenAppIds={hiddenAppIds}
                    onToggleHide={handleToggleHideGame}
                  />
                )}

                {activeTab === 'missing' && (
                  <MissingOneTab
                    games={unhiddenNearOverlapGames}
                    slots={slots}
                    activePlayerCount={activePlayerCount}
                    filterMultiplayerOnly={filterMultiplayerOnly}
                    onToggleFilterMultiplayerOnly={() => setFilterMultiplayerOnly(!filterMultiplayerOnly)}
                  />
                )}

                {activeTab === 'wishlist' && (
                  <WishlistTab
                    wishlistAnalyses={wishlistAnalyses}
                    wishlists={wishlists}
                    slots={slots}
                    activePlayerCount={activePlayerCount}
                    filterMultiplayerOnly={filterMultiplayerOnly}
                  />
                )}

                {activeTab === 'recommendations' && (
                  <RecommendationsTab
                    topWishlistGames={topWishlistCarousel}
                    upcomingTwoWeeksGames={upcomingTwoWeeksCarousel}
                    externalRecommendations={externalRecommendations}
                    nearOverlapGames={unhiddenNearOverlapGames}
                    topSquadGenres={overlapResult.topGenres}
                    slots={slots}
                    onSwitchToMissingTab={() => setActiveTab('missing')}
                  />
                )}

                {activeTab === 'schedule' && (
                  <ScheduleTab
                    slots={slots}
                    readyGames={unhiddenFullSquadGames}
                    nearOverlapGames={unhiddenNearOverlapGames}
                  />
                )}

                {activeTab === 'hidden' && (
                  <HiddenTab
                    allSquadGames={overlapResult.allSquadGames}
                    hiddenAppIds={hiddenAppIds}
                    slots={slots}
                    onToggleHide={handleToggleHideGame}
                    onClearAllHidden={handleClearAllHidden}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
