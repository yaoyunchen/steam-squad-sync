import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Check, 
  ExternalLink, 
  Play, 
  Users, 
  ShoppingBag,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { SquadGameAnalysis, SteamUserSlot } from '../types/steam';

interface GameCardProps {
  game: SquadGameAnalysis;
  allSlots: SteamUserSlot[];
  mode?: 'full' | 'missing' | 'hidden';
  isHidden?: boolean;
  onToggleHide?: (appid: number) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ 
  game, 
  allSlots, 
  mode = 'full', 
  isHidden = false, 
  onToggleHide 
}) => {
  const [imageError, setImageError] = useState(false);

  const openStore = () => {
    const url = game.storeUrl || `https://store.steampowered.com/app/${game.appid}/`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const launchInSteam = () => {
    const steamProtocolUrl = `steam://run/${game.appid}`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(steamProtocolUrl);
    } else {
      window.location.href = steamProtocolUrl;
    }
  };

  const activeSlots = useMemo(() => allSlots.filter(s => s.steamId), [allSlots]);
  const missingSlots = useMemo(
    () => activeSlots.filter(s => s.steamId && game.missingBySteamIds.includes(s.steamId)),
    [activeSlots, game.missingBySteamIds]
  );

  const isFree = Boolean(
    game.isFree || 
    game.genres?.includes('Free to Play') || 
    game.tags?.includes('Free to Play')
  );

  // Clean, deduplicated gameplay/genre tags (filter out generic labels)
  const cleanTags = useMemo(() => {
    const generic = new Set(['co-op', 'multiplayer', 'pvp', 'singleplayer', 'single-player', 'free to play', 'online co-op', 'cross-platform multiplayer']);
    const combined = [...(game.genres || []), ...(game.tags || [])];
    const unique = new Set<string>();

    for (const tag of combined) {
      if (!tag) continue;
      const lower = tag.trim().toLowerCase();
      if (!generic.has(lower) && !unique.has(tag)) {
        unique.add(tag);
      }
    }
    return Array.from(unique).slice(0, 3);
  }, [game.genres, game.tags]);

  // Sort squad members descending by individual playtime (highest played on top)
  const sortedSquadMembers = useMemo(() => {
    return [...activeSlots].sort((a, b) => {
      const hoursA = (a.steamId && game.playerPlaytimes[a.steamId]) || 0;
      const hoursB = (b.steamId && game.playerPlaytimes[b.steamId]) || 0;
      const ownsA = a.steamId && game.ownedBySteamIds.includes(a.steamId);
      const ownsB = b.steamId && game.ownedBySteamIds.includes(b.steamId);

      // Owned players come first
      if (ownsA && !ownsB) return -1;
      if (!ownsA && ownsB) return 1;
      // Highest playtime first
      return hoursB - hoursA;
    });
  }, [activeSlots, game.ownedBySteamIds, game.playerPlaytimes]);

  const maxMemberHours = useMemo(() => {
    const hoursArr = sortedSquadMembers
      .filter(s => s.steamId && game.ownedBySteamIds.includes(s.steamId))
      .map(s => (s.steamId && game.playerPlaytimes[s.steamId]) || 0);
    return Math.max(1, ...hoursArr);
  }, [sortedSquadMembers, game.ownedBySteamIds, game.playerPlaytimes]);

  return (
    <div className="steam-glass-card rounded-xl overflow-hidden flex flex-col group transition-all duration-300 hover:-translate-y-1 border border-steam-border/50 hover:border-steam-accent/40 shadow-lg">
      {/* Box art / Header image */}
      <div className="relative aspect-[460/215] w-full bg-steam-darkest overflow-hidden">
        <img
          src={imageError ? 'https://via.placeholder.com/460x215/17202d/66c0f4?text=Steam+Game' : game.headerImage}
          alt={game.name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-steam-card via-transparent to-black/40 pointer-events-none" />

        {/* Top-Left Badge: Non-redundant & matching squad hours badge size! */}
        {mode === 'full' ? (
          isFree ? (
            <div className="absolute top-2.5 left-2.5 bg-emerald-950/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-emerald-500/60 flex items-center gap-1.5 shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-300">Free to Play</span>
            </div>
          ) : (
            <div className="absolute top-2.5 left-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-steam-green/50 flex items-center gap-1.5 shadow-md">
              <Check className="w-3.5 h-3.5 text-steam-green stroke-[3]" />
              <span className="text-[11px] font-bold text-steam-green">Squad Ready</span>
            </div>
          )
        ) : mode === 'hidden' ? (
          <div className="absolute top-2.5 left-2.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1.5 shadow-md">
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-300">Hidden</span>
          </div>
        ) : (
          <div className="absolute top-2.5 left-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-amber-500/50 flex items-center gap-1.5 shadow-md">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-300">
              {game.ownershipCount}/{activeSlots.length} Owned
            </span>
          </div>
        )}

        {/* Combined Squad Playtime Badge */}
        <div className="absolute top-2.5 right-2.5 bg-steam-darkest/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-steam-border/60 flex items-center gap-1.5 shadow-md">
          <Clock className="w-3.5 h-3.5 text-steam-accent" />
          <span className="text-[11px] font-bold text-white">
            {game.totalSquadPlaytimeHours.toLocaleString()}h squad
          </span>
        </div>

        {/* Quick action buttons on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2.5 transition-opacity duration-200">
          <button
            onClick={launchInSteam}
            className="p-2.5 rounded-full bg-steam-green hover:bg-[#b7e80a] text-steam-darkest shadow-glow-green transition-transform hover:scale-110"
            title="Launch in Steam Client"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </button>
          <button
            onClick={openStore}
            className="p-2.5 rounded-full bg-steam-accent hover:bg-steam-accentHover text-steam-darkest shadow-glow-accent transition-transform hover:scale-110"
            title="View Store Page"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Hide/Unhide Button */}
          {onToggleHide && (
            <button
              onClick={() => onToggleHide(game.appid)}
              className={`p-2.5 rounded-full shadow-lg transition-transform hover:scale-110 ${
                isHidden 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
              }`}
              title={isHidden ? 'Unhide Game' : 'Hide from results'}
            >
              {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>


      {/* Card Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Title & Price Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm text-white group-hover:text-steam-accent transition-colors line-clamp-1" title={game.name}>
              {game.name}
            </h3>
            {game.priceFormatted && (
              <span className={`text-[11px] font-semibold flex-shrink-0 ${isFree ? 'text-emerald-400' : 'text-steam-text'}`}>
                {game.priceFormatted.replace(/CDN\$\s*/gi, '$').replace(/USD\$\s*/gi, '$')}
              </span>
            )}
          </div>

          {/* Feature Badges & Deduplicated Genre Tags (Fixed min-height for horizontal alignment across grid rows!) */}
          <div className="flex flex-wrap items-start content-start gap-1 mt-1.5 min-h-[48px]">
            {/* F2P Label on every F2P game */}
            {isFree && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-600/50">
                F2P
              </span>
            )}

            {/* Co-Op (appears only ONCE) */}
            {game.isCoop && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                Co-Op
              </span>
            )}

            {/* PvP */}
            {game.isPvp && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                PvP
              </span>
            )}

            {/* Max Players Support Badge */}
            {game.maxPlayers && (
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30"
                title={`Max supported players: ${game.maxPlayers}`}
              >
                👥 {game.maxPlayers >= 64 ? 'Massive' : game.maxPlayers >= 32 ? '32+ P' : `Max ${game.maxPlayers}`}
              </span>
            )}

            {/* Warning if squad members exceed capacity */}
            {game.maxPlayers && activeSlots.length > game.maxPlayers && (
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 font-bold border border-amber-500/50 flex items-center gap-0.5"
                title={`Active squad has ${activeSlots.length} players, but this game only supports up to ${game.maxPlayers} players`}
              >
                ⚠️ Party Limit ({game.maxPlayers} max)
              </span>
            )}

            {/* Specific Genre / Theme Tags */}
            {cleanTags.map(tag => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-steam-darkest text-steam-muted border border-steam-border/40 font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Missing Member Callout (supports 1 or multiple missing players) */}
        {mode === 'missing' && missingSlots.length > 0 && (
          <div className="bg-rose-950/30 border border-rose-800/40 rounded-lg p-2 flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex -space-x-1.5 overflow-hidden flex-shrink-0">
                {missingSlots.map(s => (
                  <img
                    key={s.id}
                    src={s.avatarUrl || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'}
                    alt={s.personaName}
                    className="w-5 h-5 rounded-full border border-rose-600/60 object-cover"
                    title={`Missing: ${s.personaName}`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-rose-300 truncate">
                Missing ({missingSlots.length}): <strong className="text-white font-medium">{missingSlots.map(s => s.personaName).join(', ')}</strong>
              </span>
            </div>
            <button
              onClick={openStore}
              className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
              title="View on Steam Store to buy or gift"
            >
              <ShoppingBag className="w-3 h-3" />
              <span>Store</span>
            </button>
          </div>
        )}

        {/* Individual Playtimes: Horizontal Bar Chart Sorted Highest to Lowest */}
        <div className="pt-2 border-t border-steam-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-steam-muted">
            <span className="font-semibold uppercase tracking-wider text-steam-muted/80">Squad Playtimes</span>
            <span className="text-[10px] font-mono text-steam-accent">{game.totalSquadPlaytimeHours}h total</span>
          </div>

          <div className="space-y-1">
            {sortedSquadMembers.map(slot => {
              const isOwned = slot.steamId && game.ownedBySteamIds.includes(slot.steamId);
              const hours = (slot.steamId && game.playerPlaytimes[slot.steamId]) || 0;
              const barPercent = isOwned ? Math.max(8, Math.round((hours / maxMemberHours) * 100)) : 0;

              return (
                <div
                  key={slot.id}
                  className={`relative overflow-hidden rounded-md p-1.5 flex items-center justify-between border transition-all ${
                    isOwned
                      ? 'bg-steam-darkest/70 border-steam-border/40'
                      : 'bg-rose-950/20 border-rose-900/30'
                  }`}
                  title={`${slot.personaName || 'Player'}: ${isOwned ? `${hours}h played` : 'Does not own'}`}
                >
                  {/* Horizontal Bar Chart fill proportional to leader */}
                  {isOwned && hours > 0 && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-steam-accent/20 via-steam-green/20 to-steam-accent/30 rounded-l transition-all duration-500"
                      style={{ width: `${barPercent}%` }}
                    />
                  )}

                  {/* Left: Player Avatar + Name */}
                  <div className="relative flex items-center gap-1.5 min-w-0 z-10">
                    <img
                      src={slot.avatarUrl || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'}
                      alt=""
                      className={`w-4 h-4 rounded-full object-cover flex-shrink-0 ${!isOwned ? 'opacity-50' : ''}`}
                    />
                    <span className={`text-[11px] font-medium truncate ${isOwned ? 'text-white' : 'text-rose-300/80'}`}>
                      {slot.personaName || 'Player'}
                    </span>
                  </div>

                  {/* Right: Hours or Unowned Tag */}
                  <div className="relative flex items-center gap-1 z-10 flex-shrink-0">
                    {isOwned ? (
                      <span className="text-[11px] font-mono font-bold text-steam-accent">
                        {hours}h
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-rose-400 bg-rose-950/50 px-1 py-0.2 rounded border border-rose-800/40">
                        Unowned
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

