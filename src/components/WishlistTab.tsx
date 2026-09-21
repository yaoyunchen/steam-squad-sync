import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Users, 
  Search, 
  ExternalLink, 
  Sparkles, 
  Check, 
  Bookmark,
  Tag
} from 'lucide-react';
import { SquadWishlistAnalysis, SteamUserSlot } from '../types/steam';
import { StorageService } from '../services/storage';
import { getDynamicGameMeta } from '../services/intersectionEngine';

interface WishlistTabProps {
  wishlistAnalyses: SquadWishlistAnalysis[];
  wishlists: Record<string, any[]>;
  slots: SteamUserSlot[];
  activePlayerCount?: number;
  filterMultiplayerOnly?: boolean;
}

export const WishlistTab: React.FC<WishlistTabProps> = ({
  wishlistAnalyses,
  wishlists,
  slots,
  filterMultiplayerOnly = true,
}) => {
  const activeSlots = useMemo(() => slots.filter((s) => s.steamId), [slots]);
  const [selectedSteamId, setSelectedSteamId] = useState<string>(activeSlots[0]?.steamId || '');
  const [viewMode, setViewMode] = useState<'overlaps' | 'individual'>('overlaps');
  const [searchQuery, setSearchQuery] = useState('');
  const [onSaleOnly, setOnSaleOnly] = useState(false);

  const saleAlertGames = useMemo(() => {
    return wishlistAnalyses.filter(
      (g) => (g.discountPercent && g.discountPercent > 0) || (g.priceFormatted && g.priceFormatted.toLowerCase().includes('free'))
    );
  }, [wishlistAnalyses]);

  const maxDiscount = useMemo(() => {
    return Math.max(...saleAlertGames.map((g) => g.discountPercent || 0), 0);
  }, [saleAlertGames]);

  const getResolvedGameName = (game: { appid: number; name?: string }) => {
    if (game.name && !game.name.startsWith('App ') && !game.name.startsWith('App #')) {
      return game.name;
    }
    const storeDetails = StorageService.getAppStoreDetails(game.appid);
    if (storeDetails?.name && !storeDetails.name.startsWith('App ')) {
      return storeDetails.name;
    }
    for (const slot of activeSlots) {
      if (!slot.steamId) continue;
      const lib = StorageService.getCachedLibrary(slot.steamId);
      const owned = lib?.games?.find((g) => g.appid === game.appid);
      if (owned?.name && !owned.name.startsWith('App ') && !owned.name.startsWith('App #')) {
        return owned.name;
      }
    }
    return game.name || `App ${game.appid}`;
  };

  // Overlap items (wishlisted by 2+ members OR wishlisted by 1+ and owned by 1+)
  const overlapGames = useMemo(() => {
    return wishlistAnalyses
      .filter((game) => {
        const displayName = getResolvedGameName(game);
        const matchesQuery = displayName.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        if (onSaleOnly && !(game.discountPercent && game.discountPercent > 0)) {
          return false;
        }

        // Require either 2+ wishlisted OR (1+ wishlisted AND 1+ owned)
        return game.wishlistCount >= 2 || (game.wishlistCount >= 1 && game.ownershipCount >= 1);
      })
      .sort((a, b) => {
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
  }, [wishlistAnalyses, searchQuery, activeSlots]);

  // Individual wishlist games for selected user
  const currentIndividualWishlist = useMemo(() => {
    if (!selectedSteamId) return [];
    const list = wishlists[selectedSteamId] || [];
    return list
      .map((game) => ({
        ...game,
        name: getResolvedGameName(game),
      }))
      .filter((game) => {
        const matchesQuery = game.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        if (filterMultiplayerOnly) {
          const storeDetails = StorageService.getAppStoreDetails(game.appid);
          const meta = storeDetails || getDynamicGameMeta(game.appid, game.name);

          const isLocalOrSplitScreenOnly = Boolean(
            meta.isLocalOrSplitScreenOnly ||
            (meta.categories?.some((c: string) => /shared\/split|local co-op|same-screen/i.test(c)) &&
             !meta.categories?.some((c: string) => /online co-op|online pvp|multi-player|cross-platform/i.test(c)))
          );

          const isMultiplayer = Boolean(meta.isMultiplayer || meta.isCoop || meta.isPvp);
          const isSinglePlayer = !isMultiplayer || meta.maxPlayers === 1 ||
            (meta.categories?.some((c: string) => /single-player/i.test(c)) && !meta.categories?.some((c: string) => /multi-player|co-op|pvp|online/i.test(c)));

          if (isSinglePlayer || isLocalOrSplitScreenOnly) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const discountA = a.discountPercent || 0;
        const discountB = b.discountPercent || 0;
        if (discountB !== discountA) {
          return discountB - discountA;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [selectedSteamId, wishlists, searchQuery, activeSlots, filterMultiplayerOnly]);

  const openStore = (url?: string, appid?: number) => {
    const finalUrl = url || `https://store.steampowered.com/app/${appid}/`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(finalUrl);
    } else {
      window.open(finalUrl, '_blank');
    }
  };

  const selectedSlot = activeSlots.find((s) => s.steamId === selectedSteamId) || activeSlots[0];

  return (
    <div className="space-y-5 pb-8">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-steam-card via-purple-950/30 to-steam-card border border-purple-500/40 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
            <Heart className="w-5 h-5 text-purple-400 fill-purple-500/30" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Squad Wishlist Comparison
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                {wishlistAnalyses.length} Games Wishlisted
              </span>
            </h2>
            <p className="text-xs text-steam-muted">
              Compare games wishlisted by squad members, discover group buy targets, and view individual member wishlists.
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-steam-darkest/70 p-1 rounded-lg border border-steam-border/50">
          <button
            onClick={() => setViewMode('overlaps')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'overlaps'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-steam-muted hover:text-white hover:bg-steam-card/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Squad Overlaps ({overlapGames.length})</span>
          </button>
          <button
            onClick={() => setViewMode('individual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'individual'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-steam-muted hover:text-white hover:bg-steam-card/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Individual Wishlists</span>
          </button>
        </div>
      </div>

      {/* Steam Sale Alert Banner */}
      {saleAlertGames.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/70 via-purple-950/50 to-steam-card border border-rose-500/50 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
              <Tag className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                🔥 Steam Sale Alert! Up to -{maxDiscount}% OFF
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 font-extrabold border border-rose-400/40">
                  {saleAlertGames.length} Wishlist Games Discounted
                </span>
              </h3>
              <p className="text-xs text-rose-200/80">
                Great time for squad group buys! Squad member wishlist titles are currently on sale on the Steam Store.
              </p>
            </div>
          </div>

          <button
            onClick={() => setOnSaleOnly(!onSaleOnly)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
              onSaleOnly
                ? 'bg-rose-600 text-white border-rose-400 shadow-glow-accent'
                : 'bg-rose-950/80 border-rose-500/60 text-rose-200 hover:bg-rose-900/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{onSaleOnly ? 'Showing On Sale Only' : `Filter: ${saleAlertGames.length} On Sale`}</span>
          </button>
        </div>
      )}

      {/* View Sub-header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewMode === 'individual' ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-steam-muted font-semibold">Select Squad Member:</span>
            {activeSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSteamId(slot.steamId || '')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  selectedSteamId === slot.steamId
                    ? 'bg-purple-600 border-purple-400 text-white shadow-glow-accent'
                    : 'bg-steam-card hover:bg-steam-cardHover border-steam-border/60 text-steam-muted hover:text-white'
                }`}
              >
                {slot.avatarUrl ? (
                  <img src={slot.avatarUrl} alt={slot.personaName} className="w-4 h-4 rounded-full" />
                ) : (
                  <Users className="w-3.5 h-3.5" />
                )}
                <span>{slot.personaName || 'Unknown Player'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950/80 text-purple-300 font-mono">
                  {(wishlists[slot.steamId || ''] || []).length}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-steam-muted">
              Showing games wishlisted by multiple squad members or wishlisted + owned combinations:
            </span>
          </div>
        )}
      </div>

      {/* Global Wishlist Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-steam-muted absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search wishlisted games...`}
          className="w-full bg-steam-card border border-steam-border/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-steam-muted focus:outline-none focus:border-purple-400 transition-colors shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-steam-muted hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Overlaps View */}
      {viewMode === 'overlaps' && (
        <>
          {overlapGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {overlapGames.map((game) => {
                const isDiscounted = (game.discountPercent || 0) > 0;

                return (
                  <div
                    key={game.appid}
                    className="steam-glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-purple-500/30 hover:border-purple-400/60 shadow-lg group transition-all duration-300 hover:-translate-y-1"
                  >
                    <div>
                      {/* Header Art */}
                      <div className="relative aspect-[460/215] w-full bg-steam-darkest overflow-hidden">
                        <img
                          src={game.headerImage}
                          alt={game.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-steam-card via-transparent to-black/40 pointer-events-none" />

                        {/* Badges */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <div className="bg-purple-950/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-purple-500/60 flex items-center gap-1 shadow-md">
                            <Heart className="w-3 h-3 text-purple-300 fill-purple-400" />
                            <span className="text-[11px] font-bold text-purple-200">
                              {game.wishlistCount} Wishlisted
                            </span>
                          </div>

                          {game.ownershipCount > 0 && (
                            <div className="bg-emerald-950/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-emerald-500/60 flex items-center gap-1 shadow-md">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-[11px] font-bold text-emerald-300">
                                {game.ownershipCount} Owned
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Price Tag */}
                        {game.priceFormatted && (
                          <div className="absolute top-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2 py-1 rounded-md border border-steam-border/60 text-xs font-bold text-white shadow-md">
                            {isDiscounted ? (
                              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                                <span className="bg-emerald-500 text-steam-darkest px-1 py-0.2 rounded text-[10px]">
                                  -{game.discountPercent}%
                                </span>
                                {game.priceFormatted.replace(/CDN\$\s*/gi, '$').replace(/USD\$\s*/gi, '$')}
                              </span>
                            ) : (
                              game.priceFormatted.replace(/CDN\$\s*/gi, '$').replace(/USD\$\s*/gi, '$')
                            )}
                          </div>
                        )}

                        {/* Store hover button */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                          <button
                            onClick={() => openStore(game.storeUrl, game.appid)}
                            className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-accent flex items-center gap-2 transition-transform hover:scale-105"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View on Steam Store</span>
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3.5 space-y-3">
                        <h3 className="font-bold text-sm text-white line-clamp-1">{getResolvedGameName(game)}</h3>

                        {/* Squad Member Breakdown Pills */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-steam-muted font-semibold block">
                            Squad Status:
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {activeSlots.map((slot) => {
                              const isWishlisted = slot.steamId && game.wishlistedBySteamIds.includes(slot.steamId);
                              const isOwned = slot.steamId && game.ownedBySteamIds.includes(slot.steamId);

                              return (
                                <div
                                  key={slot.id}
                                  className={`px-2 py-1 rounded border text-[11px] flex items-center justify-between gap-1.5 ${
                                    isOwned
                                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
                                      : isWishlisted
                                      ? 'bg-purple-950/60 border-purple-800/60 text-purple-200'
                                      : 'bg-steam-darkest/40 border-steam-border/30 text-steam-muted opacity-60'
                                  }`}
                                >
                                  <span className="truncate">{slot.personaName}</span>
                                  {isOwned ? (
                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Owned
                                    </span>
                                  ) : isWishlisted ? (
                                    <span className="text-[10px] font-bold text-purple-300 flex items-center gap-0.5">
                                      <Heart className="w-3 h-3 fill-current" /> Wishlist
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-steam-muted">–</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-steam-card/40 border border-steam-border/40 space-y-3">
              <Heart className="w-10 h-10 text-purple-400/50 mx-auto stroke-1" />
              <h3 className="text-sm font-semibold text-white">No Wishlist Overlaps Found</h3>
              <p className="text-xs text-steam-muted max-w-md mx-auto">
                No games are currently wishlisted by multiple squad members. Switch to "Individual Wishlists" above to inspect each player's wishlist!
              </p>
            </div>
          )}
        </>
      )}

      {/* Individual View */}
      {viewMode === 'individual' && (
        <>
          {currentIndividualWishlist.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentIndividualWishlist.map((game) => (
                <div
                  key={game.appid}
                  className="steam-glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-steam-border/50 hover:border-purple-400/50 shadow-lg group transition-all duration-300 hover:-translate-y-1"
                >
                  <div>
                    {/* Header Image */}
                    <div className="relative aspect-[460/215] w-full bg-steam-darkest overflow-hidden">
                      <img
                        src={game.headerImage}
                        alt={game.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-steam-card via-transparent to-black/40 pointer-events-none" />

                      <div className="absolute top-2.5 left-2.5 bg-purple-950/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-purple-500/60 flex items-center gap-1 shadow-md">
                        <Heart className="w-3 h-3 text-purple-300 fill-purple-400" />
                        <span className="text-[11px] font-bold text-purple-200">
                          {selectedSlot?.personaName}'s Wishlist
                        </span>
                      </div>

                      {game.priceFormatted && (
                        <div className="absolute top-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2 py-1 rounded-md border border-steam-border/60 text-xs font-bold text-white shadow-md">
                          {game.priceFormatted}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                        <button
                          onClick={() => openStore(game.storeUrl, game.appid)}
                          className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-accent flex items-center gap-2 transition-transform hover:scale-105"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View on Steam Store</span>
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3.5 space-y-2">
                      <h3 className="font-bold text-sm text-white line-clamp-1">{game.name}</h3>

                      {game.tags && game.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {game.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-steam-darkest/60 text-steam-muted border border-steam-border/30">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-steam-card/40 border border-steam-border/40 space-y-3">
              <Bookmark className="w-10 h-10 text-steam-muted mx-auto stroke-1" />
              <h3 className="text-sm font-semibold text-white">No Wishlisted Games for {selectedSlot?.personaName}</h3>
              <p className="text-xs text-steam-muted max-w-md mx-auto">
                This squad member has no wishlisted games recorded or their Steam Wishlist privacy settings are restricted.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
