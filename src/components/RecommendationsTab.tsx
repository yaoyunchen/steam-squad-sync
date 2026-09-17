import React, { useState, useMemo, useRef } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Tag, 
  Star, 
  Share2,
  CheckCircle2,
  Flame,
  Heart,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ExternalRecommendation, SquadGameAnalysis, SquadWishlistAnalysis, SteamUserSlot, UpcomingRecommendation } from '../types/steam';
import { StorageService } from '../services/storage';

import { resolveGameDescription } from '../services/intersectionEngine';

interface RecommendationsTabProps {
  topWishlistGames: SquadWishlistAnalysis[];
  upcomingTwoWeeksGames: UpcomingRecommendation[];
  externalRecommendations: ExternalRecommendation[];
  nearOverlapGames: SquadGameAnalysis[];
  topSquadGenres: { name: string; count: number }[];
  slots: SteamUserSlot[];
  onSwitchToMissingTab?: () => void;
}

const CarouselSection: React.FC<{
  title: string;
  subtitle: string;
  badgeText?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, badgeText, icon, children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  React.useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 20) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: 340, behavior: 'smooth' });
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovered]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              {title}
              {badgeText && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/40">
                  {badgeText}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-steam-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleScroll('left')}
            className="p-1.5 rounded-lg bg-steam-card hover:bg-steam-cardHover text-white border border-steam-border/50 transition-colors shadow"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="p-1.5 rounded-lg bg-steam-card hover:bg-steam-cardHover text-white border border-steam-border/50 transition-colors shadow"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
};

const cleanPriceString = (price?: string | null): string => {
  if (!price || price.trim() === '' || price.trim() === '0') {
    return '$ TBD';
  }
  const lower = price.toLowerCase().trim();
  if (lower.includes('free')) {
    return 'Free';
  }
  let cleaned = price
    .replace(/(CDN|USD|CAD|EUR|GBP|AUD)\$\s*/gi, '$')
    .replace(/\s*(CDN|USD|CAD|EUR|GBP|AUD)/gi, '')
    .trim();

  if (!cleaned.startsWith('$') && !cleaned.startsWith('-') && /^\d/.test(cleaned)) {
    cleaned = '$' + cleaned;
  }
  return cleaned;
};

const WishlistCardBanner: React.FC<{
  game: SquadWishlistAnalysis;
  openStore: (url: string) => void;
}> = ({ game, openStore }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const storeDetails = StorageService.getAppStoreDetails(game.appid);
  const imgSrc = storeDetails?.headerImage || game.headerImage;
  const isEarlyAccess = Boolean(
    game.isEarlyAccess ||
    game.tags?.some((t) => /early access/i.test(t)) ||
    game.genres?.some((g) => /early access/i.test(g))
  );

  return (
    <div className="relative aspect-[460/215] w-full bg-slate-950 overflow-hidden group">
      {!imgFailed ? (
        <img
          src={imgSrc}
          alt={game.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-3 text-center group-hover:scale-105 transition-transform duration-500">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mb-1.5 shadow-inner">
            <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
          </div>
          <span className="text-xs font-extrabold text-purple-100 line-clamp-1 px-2">{game.name}</span>
          <span className="text-[9px] font-bold text-purple-300/80 mt-1 uppercase tracking-wider bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
            Unreleased Target
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-steam-card via-transparent to-black/40 pointer-events-none" />

      {/* TOP-LEFT: Wishlist Status Badge */}
      <div className="absolute top-2.5 left-2.5 bg-purple-950/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-purple-500/60 flex items-center gap-1.5 shadow-md pointer-events-none z-10">
        <Heart className="w-3.5 h-3.5 text-purple-300 fill-purple-400 shrink-0" />
        <span className="text-[11px] font-bold text-purple-200 whitespace-nowrap">
          {game.wishlistCount} Wishlisted • {game.ownershipCount} Owned
        </span>
      </div>

      {/* BOTTOM-LEFT: Early Access Label */}
      {isEarlyAccess && (
        <div className="absolute bottom-2.5 left-2.5 bg-cyan-950/90 text-cyan-300 backdrop-blur-md px-2.5 py-1 rounded-md border border-cyan-500/60 font-extrabold text-[10px] z-10 shadow-md whitespace-nowrap pointer-events-none">
          EARLY ACCESS
        </div>
      )}

      {/* BOTTOM-RIGHT: Pricing Label */}
      <div className="absolute bottom-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-steam-border/60 text-[11px] font-bold text-white shadow-md whitespace-nowrap pointer-events-none z-10">
        {cleanPriceString(game.priceFormatted)}
      </div>

      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 z-20">
        <button
          onClick={() => openStore(game.storeUrl)}
          className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-accent flex items-center gap-2 transition-transform hover:scale-105"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View on Steam</span>
        </button>
      </div>
    </div>
  );
};

const UpcomingCardBanner: React.FC<{
  game: UpcomingRecommendation;
  openStore: (url: string) => void;
}> = ({ game, openStore }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const storeDetails = StorageService.getAppStoreDetails(game.appid);
  const imgSrc = storeDetails?.headerImage || game.headerImage;

  const isEarlyAccess = Boolean(
    game.isEarlyAccess ||
    game.tags?.some((t) => /early access/i.test(t)) ||
    game.genres?.some((g) => /early access/i.test(g))
  );

  return (
    <div className="relative aspect-[460/215] w-full bg-slate-950 overflow-hidden group">
      {!imgFailed ? (
        <img
          src={imgSrc}
          alt={game.name}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-3 text-center group-hover:scale-105 transition-transform duration-500">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mb-1.5 shadow-inner">
            <Clock className="w-5 h-5 text-cyan-300 animate-pulse" />
          </div>
          <span className="text-xs font-extrabold text-cyan-100 line-clamp-1 px-2">{game.name}</span>
          <span className="text-[9px] font-bold text-cyan-300 mt-1 uppercase tracking-wider bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30">
            {game.releaseDateStatus || 'Releasing Soon'}
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-black/40 pointer-events-none" />

      {/* TOP-LEFT: Launch Date Event Pill */}
      <div className="absolute top-2.5 left-2.5 bg-cyan-950/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-cyan-400/80 flex items-center gap-1.5 shadow-lg pointer-events-none z-10">
        <Clock className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
        <span className="text-[11px] font-extrabold text-cyan-100 tracking-wide whitespace-nowrap">
          {game.releaseDateStatus || 'Releasing Within 2 Weeks'}
        </span>
      </div>

      {/* BOTTOM-LEFT: Early Access Label */}
      {isEarlyAccess && (
        <div className="absolute bottom-2.5 left-2.5 bg-cyan-950/90 text-cyan-300 backdrop-blur-md px-2.5 py-1 rounded-md border border-cyan-500/60 font-extrabold text-[10px] z-10 shadow-md whitespace-nowrap pointer-events-none">
          EARLY ACCESS
        </div>
      )}

      {/* BOTTOM-RIGHT: Pricing Label */}
      <div className="absolute bottom-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-steam-border/60 text-[11px] font-bold text-white shadow-md whitespace-nowrap pointer-events-none z-10">
        {cleanPriceString(game.price)}
      </div>

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 z-20">
        <button
          onClick={() => openStore(game.storeUrl)}
          className="px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-glow-accent flex items-center gap-2 transition-transform hover:scale-105"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View on Steam</span>
        </button>
      </div>
    </div>
  );
};

export const RecommendationsTab: React.FC<RecommendationsTabProps> = ({
  topWishlistGames,
  upcomingTwoWeeksGames,
  externalRecommendations,
  topSquadGenres,
  slots,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedNotification, setCopiedNotification] = useState(false);

  const activeSlots = useMemo(() => slots.filter((s) => s.steamId), [slots]);

  const openStore = (url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Filter external recommendations for Section 3
  const filteredRecs = useMemo(() => {
    let list = externalRecommendations;

    if (selectedCategory === 'on-sale') {
      list = externalRecommendations.filter(rec => rec.discountPercent > 0);
    } else if (selectedCategory === 'new') {
      list = externalRecommendations.filter(rec => rec.isNewRelease);
    } else if (selectedCategory !== 'all') {
      list = externalRecommendations.filter(rec => 
        rec.tags.some(t => t.toLowerCase() === selectedCategory.toLowerCase()) ||
        rec.genres.some(g => g.toLowerCase() === selectedCategory.toLowerCase())
      );
    }

    // Sort: Discounted & NEW Releases at the TOP!
    return [...list].sort((a, b) => {
      const priorityA = (a.discountPercent > 0 ? 100 : 0) + (a.isNewRelease ? 50 : 0);
      const priorityB = (b.discountPercent > 0 ? 100 : 0) + (b.isNewRelease ? 50 : 0);

      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      return b.matchScore - a.matchScore;
    });
  }, [externalRecommendations, selectedCategory]);

  const onSaleCount = useMemo(() => {
    return externalRecommendations.filter(r => r.discountPercent > 0).length;
  }, [externalRecommendations]);

  const newReleaseCount = useMemo(() => {
    return externalRecommendations.filter(r => r.isNewRelease).length;
  }, [externalRecommendations]);

  // Share summary with friends
  const handleCopySquadSummary = async () => {
    const activePlayerNames = activeSlots.map((s: SteamUserSlot) => s.personaName || 'Player').join(', ');
    
    let summary = `🎮 **Steam Squad Sync — Game Night Briefing**\n`;
    summary += `👥 **Squad (${activeSlots.length} Players):** ${activePlayerNames}\n\n`;

    if (topWishlistGames.length > 0) {
      summary += `❤️ **Top Wishlisted Squad Targets:**\n`;
      topWishlistGames.slice(0, 3).forEach(g => {
        summary += `• **${g.name}** (${g.priceFormatted || '$19.99'}) — Wishlisted by ${g.wishlistCount} players\n  🔗 ${g.storeUrl}\n`;
      });
      summary += `\n`;
    }

    if (upcomingTwoWeeksGames.length > 0) {
      summary += `⏰ **Upcoming Releases (Next 2 Weeks):**\n`;
      upcomingTwoWeeksGames.slice(0, 3).forEach(g => {
        summary += `• **${g.name}** (${g.releaseDateStatus || 'Releasing Soon'})\n  🔗 ${g.storeUrl}\n`;
      });
      summary += `\n`;
    }

    summary += `Sync your squad with Steam Squad Sync!`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-7 pb-12">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-steam-card to-steam-dark border border-purple-500/30 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Squad Suggestions & Next Game Night
            </h2>
            <p className="text-xs text-steam-muted">
              Discover top wishlisted targets, upcoming releases within 2 weeks, and discounted co-op hits tailored to your squad.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCopySquadSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-md hover:scale-105 transition-all"
            title="Copy formatted squad briefing for Discord or Steam chat"
          >
            {copiedNotification ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied Briefing!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Summary with Friends</span>
              </>
            )}
          </button>

          {/* Squad DNA Top Genre Tags */}
          <div className="hidden xl:flex items-center gap-1.5">
            <span className="text-[11px] text-steam-muted flex items-center gap-1">
              <Tag className="w-3 h-3 text-steam-accent" /> DNA:
            </span>
            {topSquadGenres
              .filter(g => !/multiplayer|co-op/i.test(g.name))
              .slice(0, 3)
              .map(g => (
                <span
                  key={g.name}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                >
                  {g.name}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* SECTION 1: Carousel — Top Wishlisted Games (Everyone Wishlisted or Owns) */}
      {topWishlistGames.length > 0 && (
        <CarouselSection
          title="Top Squad Wishlist Targets"
          subtitle="Games wishlisted or already owned by every member of your squad."
          icon={<Heart className="w-4 h-4 text-purple-400 fill-purple-400" />}
        >
          {topWishlistGames.map((game) => (
            <div
              key={game.appid}
              className="w-[310px] flex-shrink-0 steam-glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-purple-500/40 hover:border-purple-400/70 shadow-lg group transition-all duration-300 hover:-translate-y-1"
            >
              <div>
                <WishlistCardBanner game={game} openStore={openStore} />

                {/* Content */}
                <div className="p-3 space-y-2">
                  <h4 className="font-bold text-sm text-white line-clamp-1">{game.name}</h4>

                  {/* Squad Status Breakdown Pills — Sorted: Owned first (top-left), Wishlisted second, Missing third */}
                  <div className="grid grid-cols-2 gap-1">
                    {[...activeSlots]
                      .sort((a, b) => {
                        const aScore = a.steamId && game.ownedBySteamIds.includes(a.steamId) ? 3 : (a.steamId && game.wishlistedBySteamIds.includes(a.steamId) ? 2 : 1);
                        const bScore = b.steamId && game.ownedBySteamIds.includes(b.steamId) ? 3 : (b.steamId && game.wishlistedBySteamIds.includes(b.steamId) ? 2 : 1);
                        return bScore - aScore;
                      })
                      .map((slot: SteamUserSlot) => {
                        const isOwned = slot.steamId && game.ownedBySteamIds.includes(slot.steamId);
                        const isWishlisted = slot.steamId && game.wishlistedBySteamIds.includes(slot.steamId);
                        return (
                          <div
                            key={slot.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center justify-between border ${
                              isOwned
                                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                                : isWishlisted
                                ? 'bg-purple-950/60 border-purple-800/60 text-purple-300'
                                : 'bg-steam-darkest/30 border-steam-border/30 text-steam-muted'
                            }`}
                          >
                            <span className="truncate">{slot.personaName}</span>
                            {isOwned ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                            ) : isWishlisted ? (
                              <Heart className="w-2.5 h-2.5 text-purple-300 fill-current flex-shrink-0" />
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CarouselSection>
      )}

      {/* SECTION 2: Carousel — Upcoming Games Releasing Within Two Weeks */}
      {upcomingTwoWeeksGames.length > 0 && (
        <CarouselSection
          title="Upcoming Games Releasing Within 2 Weeks"
          subtitle="Online co-op releases launching within the next 14 days that fit your squad size."
          badgeText={`${upcomingTwoWeeksGames.length} Launching Soon`}
          icon={<Clock className="w-4 h-4 text-cyan-400" />}
        >
          {upcomingTwoWeeksGames.map((game) => {
            return (
              <div
                key={game.appid}
                className="w-[340px] flex-shrink-0 bg-gradient-to-b from-cyan-950/50 via-steam-card to-slate-950 rounded-2xl overflow-hidden flex flex-col justify-between border border-cyan-500/50 hover:border-cyan-400/90 shadow-xl shadow-cyan-950/30 group transition-all duration-300 hover:-translate-y-1.5"
              >
                <div>
                  <UpcomingCardBanner game={game} openStore={openStore} />

                  {/* Body Content with Real Live Steam Description */}
                  <div className="p-3.5 space-y-2">
                    <h4 className="font-extrabold text-sm text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                      {game.name}
                    </h4>
                    {game.description && game.description.trim() !== '' && (
                      <p className="text-[11px] text-slate-300/90 line-clamp-2 leading-relaxed font-normal">
                        {game.description}
                      </p>
                    )}

                    {/* Squad Tags & Capacity */}
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {game.maxPlayers && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold">
                          👥 Up to {game.maxPlayers} Players
                        </span>
                      )}
                      {game.matchingSquadTags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 font-medium">
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-3 pt-2.5 border-t border-cyan-500/20 bg-slate-950/60 flex items-center justify-center">
                  <button
                    onClick={() => openStore(game.storeUrl)}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Store Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </CarouselSection>
      )}

      {/* SECTION 3: Grid — Existing Squad Suggestions (Discounted & New Releases at Top) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-400 fill-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Curated Squad Recommendations
            </h3>
          </div>

          {/* Tag & Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-steam-card hover:bg-steam-cardHover text-steam-text border border-steam-border/40'
              }`}
            >
              All Genres
            </button>

            {onSaleCount > 0 && (
              <button
                onClick={() => setSelectedCategory('on-sale')}
                className={`text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-colors ${
                  selectedCategory === 'on-sale'
                    ? 'bg-steam-green text-steam-darkest'
                    : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>On Sale ({onSaleCount})</span>
              </button>
            )}

            {newReleaseCount > 0 && (
              <button
                onClick={() => setSelectedCategory('new')}
                className={`text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-colors ${
                  selectedCategory === 'new'
                    ? 'bg-amber-500 text-steam-darkest'
                    : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>New Releases ({newReleaseCount})</span>
              </button>
            )}

            {['Survival', 'Shooter', 'Action', 'RPG', 'Horror', 'Strategy'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-steam-card hover:bg-steam-cardHover text-steam-text border border-steam-border/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid of Suggestions with 4-corner badges and clean description formatting */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRecs.map((rec: ExternalRecommendation) => {
            const isEarlyAccess = Boolean(
              rec.isEarlyAccess || 
              rec.tags?.some(t => /early access/i.test(t)) || 
              rec.genres?.some(g => /early access/i.test(g))
            );

            // Compute ownership count dynamically if not present
            const ownedCount = rec.ownershipCount !== undefined 
              ? rec.ownershipCount 
              : activeSlots.filter(s => s.steamId && StorageService.getCachedLibrary(s.steamId)?.games?.some(g => g.appid === rec.appid)).length;

            const storeDetails = StorageService.getAppStoreDetails(rec.appid);

            return (
              <div
                key={rec.appid}
                className="steam-glass-card rounded-xl overflow-hidden flex flex-col justify-between group border border-steam-border/40 hover:border-purple-500/50 transition-all duration-300"
              >
                <div>
                  {/* Header Image with 4-Corner Badges */}
                  <div className="relative aspect-[460/215] w-full bg-steam-darkest overflow-hidden">
                    <img
                      src={rec.headerImage}
                      alt={rec.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.failed) {
                          target.dataset.failed = 'true';
                          target.src = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${rec.appid}/header.jpg`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-steam-card via-transparent to-black/30 pointer-events-none" />

                    {/* TOP-LEFT: NEW Label */}
                    {rec.isNewRelease && (
                      <div className="absolute top-2.5 left-2.5 bg-amber-500 text-steam-darkest px-2.5 py-1 rounded-md font-extrabold text-[10px] shadow-md flex items-center gap-1 z-10 animate-pulse pointer-events-none">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>NEW</span>
                      </div>
                    )}

                    {/* TOP-RIGHT: Reviews Label */}
                    {rec.ratingText && (
                      <div className="absolute top-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-steam-border/60 flex items-center gap-1 z-10 shadow-md pointer-events-none">
                        <Star className="w-3.5 h-3.5 text-steam-accent fill-steam-accent shrink-0" />
                        <span className="text-[10px] font-bold text-white whitespace-nowrap">{rec.ratingText}</span>
                      </div>
                    )}

                    {/* BOTTOM-LEFT: Early Access Label */}
                    {isEarlyAccess && (
                      <div className="absolute bottom-2.5 left-2.5 bg-cyan-950/90 text-cyan-300 backdrop-blur-md px-2 py-1 rounded-md border border-cyan-500/60 font-extrabold text-[10px] z-10 shadow-md whitespace-nowrap pointer-events-none">
                        EARLY ACCESS
                      </div>
                    )}

                    {/* BOTTOM-RIGHT: Pricing Label */}
                    <div className="absolute bottom-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-steam-border/60 flex items-center gap-1 z-10 text-[11px] font-bold text-white shadow-md whitespace-nowrap pointer-events-none">
                      {rec.discountPercent > 0 && rec.initialPrice && (
                        <span className="line-through text-steam-muted text-[10px] mr-1">
                          {cleanPriceString(rec.initialPrice)}
                        </span>
                      )}
                      {rec.discountPercent > 0 && (
                        <span className="bg-steam-green text-steam-darkest font-extrabold text-[10px] px-1 py-0.2 rounded mr-1">
                          -{rec.discountPercent}%
                        </span>
                      )}
                      <span className={rec.discountPercent > 0 ? 'text-steam-green font-extrabold' : 'text-white'}>
                        {cleanPriceString(rec.price)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3.5 space-y-2">
                    <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                      {rec.name}
                    </h4>

                    {/* Line 1: Squad members ownership */}
                    {ownedCount > 0 && (
                      <p className="text-[11px] font-semibold text-purple-300">
                        {ownedCount} squad member{ownedCount > 1 ? 's' : ''} own this.
                      </p>
                    )}

                    {/* Line 2: Real description paragraph */}
                    <p className="text-xs text-steam-muted line-clamp-2 leading-relaxed">
                      {resolveGameDescription(rec.appid, rec.name, storeDetails, rec)}
                    </p>

                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {rec.maxPlayers && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-semibold">
                          👥 Up to {rec.maxPlayers} Players
                        </span>
                      )}
                      {rec.matchingSquadTags.map((tag: string) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 font-medium">
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-3 pt-2.5 border-t border-steam-border/40 flex items-center justify-between bg-steam-darkest/40">
                  <span className="text-[11px] text-steam-muted font-mono font-bold">{cleanPriceString(rec.price)}</span>
                  <button
                    onClick={() => openStore(rec.storeUrl)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    <span>View on Steam</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
