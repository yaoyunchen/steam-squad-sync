import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trophy, 
  Gamepad2, 
  ArrowUpDown, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Zap, 
  Info
} from 'lucide-react';
import { SquadGameAnalysis, SteamUserSlot } from '../types/steam';
import { GameCard } from './GameCard';

interface ReadyToPlayTabProps {
  games: SquadGameAnalysis[];
  allSquadGames?: SquadGameAnalysis[];
  nearOverlapGames?: SquadGameAnalysis[];
  twoPlayerGames?: SquadGameAnalysis[];
  slots: SteamUserSlot[];
  activePlayerCount: number;
  filterMultiplayerOnly?: boolean;
  onToggleFilterMultiplayerOnly?: () => void;
  squadOverrides?: number[];
  onToggleOverride?: (appid: number) => void;
  hiddenAppIds?: number[];
  onToggleHide?: (appid: number) => void;
}

const COMMON_TAGS = ['All', 'Co-Op', 'PvP', 'Survival', 'Casual', 'Shooter', 'Action', 'RPG'];

export const ReadyToPlayTab: React.FC<ReadyToPlayTabProps> = ({
  games,
  allSquadGames = [],
  nearOverlapGames = [],
  twoPlayerGames = [],
  slots,
  activePlayerCount,
  filterMultiplayerOnly = true,
  onToggleFilterMultiplayerOnly,
  squadOverrides = [],
  onToggleOverride,
  hiddenAppIds = [],
  onToggleHide,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [sortBy, setSortBy] = useState<'playtime_desc' | 'playtime_asc' | 'name_asc'>('playtime_desc');
  const [ownershipTier, setOwnershipTier] = useState<'ready' | 'missing' | 'half' | 'all'>('ready');
  const [fitSquadOnly, setFitSquadOnly] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorSearch, setInspectorSearch] = useState('');

  // Active pool of games depending on selected ownership tier
  const activePool = useMemo(() => {
    switch (ownershipTier) {
      case 'ready':
        return games;
      case 'missing':
        return nearOverlapGames;
      case 'half':
        return twoPlayerGames;
      case 'all':
        return allSquadGames.length > 0 ? allSquadGames : games;
      default:
        return games;
    }
  }, [ownershipTier, games, nearOverlapGames, twoPlayerGames, allSquadGames]);

  // Primary filtered games matching query, tag, and hidden filter in active tier
  const filteredGames = useMemo(() => {
    return activePool
      .filter((game) => {
        // Exclude hidden games
        if (hiddenAppIds.includes(game.appid)) {
          return false;
        }

        // Text search
        const matchesQuery = game.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        // Squad size compatibility filter (if enabled, hide games that cap below squad size)
        if (fitSquadOnly && game.maxPlayers !== undefined && game.maxPlayers < activePlayerCount) {
          return false;
        }

        // Tag filter
        if (selectedTag === 'All') return true;
        if (selectedTag === 'Co-Op') return game.isCoop;
        if (selectedTag === 'PvP') return game.isPvp;

        const tagMatch =
          game.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()) ||
          game.genres.some((g) => g.toLowerCase() === selectedTag.toLowerCase()) ||
          game.categories.some((c) => c.toLowerCase() === selectedTag.toLowerCase());

        return tagMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'playtime_desc') {
          return b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes;
        }
        if (sortBy === 'playtime_asc') {
          return a.totalSquadPlaytimeMinutes - b.totalSquadPlaytimeMinutes;
        }
        return a.name.localeCompare(b.name);
      });
  }, [activePool, searchQuery, selectedTag, sortBy, fitSquadOnly, activePlayerCount, hiddenAppIds]);

  // Cross-tier search matches: if the user searched for something, find matches across other tiers
  const crossTierMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const cleanQuery = searchQuery.trim().toLowerCase();
    const primaryAppIds = new Set(filteredGames.map((g) => g.appid));

    return allSquadGames
      .filter((g) => !hiddenAppIds.includes(g.appid) && !primaryAppIds.has(g.appid) && g.name.toLowerCase().includes(cleanQuery))
      .sort((a, b) => b.ownershipCount - a.ownershipCount || b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes);
  }, [searchQuery, filteredGames, allSquadGames, hiddenAppIds]);

  const totalSquadHours = useMemo(() => {
    return Math.round(games.reduce((acc, g) => acc + g.totalSquadPlaytimeMinutes, 0) / 60);
  }, [games]);

  // Inspector search game results
  const inspectorResults = useMemo(() => {
    if (!inspectorSearch.trim()) {
      return allSquadGames.slice(0, 5);
    }
    const clean = inspectorSearch.trim().toLowerCase();
    return allSquadGames.filter(
      (g) => g.name.toLowerCase().includes(clean) || g.appid.toString() === clean
    );
  }, [inspectorSearch, allSquadGames]);

  const activeSlots = slots.filter((s) => s.steamId);

  return (
    <div className="space-y-5 pb-8">
      {/* Header Stat Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-steam-card via-steam-dark to-steam-card border border-steam-border/60 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-steam-green/20 border border-steam-green/40 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-steam-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-steam-text flex items-center gap-2">
              Ready to Play ({activePlayerCount}/{activePlayerCount} Owned)
              <span className="text-xs px-2 py-0.5 rounded-full bg-steam-green/20 text-steam-green font-semibold">
                {games.length} Games
              </span>
            </h2>
            <p className="text-xs text-steam-muted">
              Games owned by all active squad members. Launch and play together right now!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Group Play Filter Toggle */}
          <button
            onClick={onToggleFilterMultiplayerOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              filterMultiplayerOnly
                ? 'bg-emerald-950/60 border-steam-green/50 text-emerald-300 hover:bg-emerald-900/60 shadow-sm'
                : 'bg-steam-card hover:bg-steam-cardHover border-steam-border text-steam-muted hover:text-steam-text'
            }`}
            title="Click to toggle: Show only Multiplayer/Co-Op games vs All shared games"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${filterMultiplayerOnly ? 'text-steam-green' : 'text-steam-muted'}`} />
            <span>{filterMultiplayerOnly ? 'Filter: Group Play Only' : 'Filter: Showing All Shared Games'}</span>
          </button>

          {/* Fit Squad Size Toggle */}
          <button
            onClick={() => setFitSquadOnly(!fitSquadOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              fitSquadOnly
                ? 'bg-indigo-950/70 border-indigo-500/60 text-indigo-300 hover:bg-indigo-900/70 shadow-sm'
                : 'bg-steam-card hover:bg-steam-cardHover border-steam-border text-steam-muted hover:text-steam-text'
            }`}
            title={`Hide games that cannot accommodate all ${activePlayerCount} active squad members`}
          >
            <Users className={`w-3.5 h-3.5 ${fitSquadOnly ? 'text-indigo-400' : 'text-steam-muted'}`} />
            <span>{fitSquadOnly ? `Fits ${activePlayerCount}P Squad Only` : `Fit Squad (${activePlayerCount}P)`}</span>
          </button>

          {/* Squad Game Inspector Button */}
          <button
            onClick={() => setShowInspector(!showInspector)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              showInspector
                ? 'bg-steam-accent text-steam-darkest font-bold shadow-glow-accent border-steam-accent'
                : 'bg-steam-card hover:bg-steam-cardHover text-steam-muted hover:text-steam-text border-steam-border/60'
            }`}
            title="Inspect squad library ownership per player for any game"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Squad Game Inspector</span>
          </button>

          {/* Squad Hours Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-steam-darkest/60 border border-steam-border/40">
            <Trophy className="w-4 h-4 text-steam-accent" />
            <span className="text-xs text-steam-muted">Squad Playtime:</span>
            <span className="text-xs font-bold text-steam-text">{totalSquadHours.toLocaleString()} Hours</span>
          </div>
        </div>
      </div>

      {/* Squad Game Inspector Panel (Expandable) */}
      {showInspector && (
        <div className="p-4 rounded-xl bg-steam-card/80 border border-steam-accent/40 shadow-xl space-y-3 transition-all animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-steam-accent" />
              <h3 className="text-xs font-bold text-steam-text uppercase tracking-wider">
                Squad Library Ownership Inspector
              </h3>
            </div>
            <span className="text-[11px] text-steam-muted">
              Check real-time ownership & playtime for any game across all {activeSlots.length} players
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-steam-muted absolute left-3 top-3" />
            <input
              type="text"
              value={inspectorSearch}
              onChange={(e) => setInspectorSearch(e.target.value)}
              placeholder="Search any game in squad libraries (e.g. Deadlock, CS2, Stardew Valley)..."
              className="w-full bg-steam-darkest border border-steam-border/60 rounded-lg pl-9 pr-3 py-2 text-xs text-steam-text placeholder-steam-muted focus:outline-none focus:border-steam-accent"
            />
          </div>

          {inspectorResults.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {inspectorResults.map((game) => {
                const isOverridden = squadOverrides.includes(game.appid);
                const isFree =
                  game.genres.includes('Free to Play') ||
                  game.tags.includes('Free to Play');

                return (
                  <div
                    key={game.appid}
                    className="p-3 rounded-lg bg-steam-darkest/70 border border-steam-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <img
                        src={game.headerImage}
                        alt={game.name}
                        className="w-16 h-8 object-cover rounded border border-steam-border/40 flex-shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-steam-text">{game.name}</h4>
                          {isFree && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-semibold">
                              Free to Play
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-steam-muted">
                          AppID: {game.appid} • {game.ownershipCount}/{activeSlots.length} Squad Members Own This
                        </span>
                      </div>
                    </div>

                    {/* Member Ownership Grid */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {activeSlots.map((slot) => {
                        const owns = slot.steamId && game.ownedBySteamIds.includes(slot.steamId);
                        const playtime = slot.steamId ? game.playerPlaytimes[slot.steamId] || 0 : 0;

                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border ${
                              owns
                                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                                : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                            }`}
                          >
                            {owns ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-400" />
                            )}
                            <span className="font-semibold">{slot.personaName || 'Player'}:</span>
                            <span>{owns ? `${playtime}h` : 'Missing'}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {onToggleOverride && (
                        <button
                          onClick={() => onToggleOverride(game.appid)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                            isOverridden
                              ? 'bg-steam-accent text-steam-darkest border-steam-accent'
                              : 'bg-steam-card hover:bg-steam-cardHover text-steam-text border-steam-border/60'
                          }`}
                          title="Treat as owned by all squad members (useful for Free-to-Play games)"
                        >
                          <Zap className="w-3 h-3" />
                          <span>{isOverridden ? 'Squad Forced' : 'Treat as Squad-Owned'}</span>
                        </button>
                      )}
                      <a
                        href={game.storeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-steam-card hover:bg-steam-cardHover text-steam-muted hover:text-steam-text border border-steam-border/40"
                        title="View on Steam Store"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-steam-muted">
              No games found matching "{inspectorSearch}".
            </div>
          )}

          <div className="flex items-center gap-2 p-2 rounded bg-steam-darkest/50 border border-steam-border/30 text-[11px] text-steam-muted">
            <Info className="w-3.5 h-3.5 text-steam-accent flex-shrink-0" />
            <span>
              <strong>Note on Free-to-Play games:</strong> Valve only returns F2P games for an account if the player has launched it at least once (playtime &gt; 0) or activated a free license. If anyone in your squad is missing a Free-to-Play title, they can launch it once, or you can click "Treat as Squad-Owned" above!
            </span>
          </div>
        </div>
      )}

      {/* Ownership Tier Tabs & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Ownership Tier Pills */}
        <div className="flex items-center gap-1.5 bg-steam-card/70 p-1 rounded-lg border border-steam-border/40">
          <button
            onClick={() => setOwnershipTier('ready')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              ownershipTier === 'ready'
                ? 'bg-steam-green text-steam-darkest shadow-glow-green'
                : 'text-steam-muted hover:text-steam-text hover:bg-steam-card/40'
            }`}
          >
            {activePlayerCount > 0 ? `${activePlayerCount}/${activePlayerCount}` : 'All'} Ready ({games.length})
          </button>
          <button
            onClick={() => setOwnershipTier('missing')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              ownershipTier === 'missing'
                ? 'bg-amber-400 text-steam-darkest shadow-md'
                : 'text-steam-muted hover:text-steam-text hover:bg-steam-card/40'
            }`}
          >
            Almost There (1–2 Missing) ({nearOverlapGames.length})
          </button>
          {twoPlayerGames.length > 0 && (
            <button
              onClick={() => setOwnershipTier('half')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                ownershipTier === 'half'
                  ? 'bg-sky-400 text-steam-darkest shadow-md'
                  : 'text-steam-muted hover:text-steam-text hover:bg-steam-card/40'
              }`}
            >
              Partial Overlap ({twoPlayerGames.length})
            </button>
          )}
          <button
            onClick={() => setOwnershipTier('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              ownershipTier === 'all'
                ? 'bg-purple-400 text-steam-darkest shadow-md'
                : 'text-steam-muted hover:text-steam-text hover:bg-steam-card/40'
            }`}
          >
            All Squad Games ({allSquadGames.length})
          </button>
        </div>

        {/* Sort & Tag Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {COMMON_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedTag === tag
                  ? 'bg-steam-accent text-steam-darkest font-bold shadow-glow-accent'
                  : 'bg-steam-card hover:bg-steam-cardHover text-steam-text border border-steam-border/40'
              }`}
            >
              {tag}
            </button>
          ))}

          {/* Sort dropdown */}
          <div className="flex items-center gap-1 bg-steam-card px-2 py-1 rounded-lg border border-steam-border/40 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-steam-accent flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-steam-text focus:outline-none cursor-pointer font-medium"
            >
              <option value="playtime_desc" className="bg-steam-card text-steam-text">Highest Squad Playtime</option>
              <option value="playtime_asc" className="bg-steam-card text-steam-text">Lowest Squad Playtime</option>
              <option value="name_asc" className="bg-steam-card text-steam-text">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-steam-muted absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search games in ${ownershipTier === 'ready' ? 'Ready to Play' : ownershipTier === 'missing' ? 'One Missing' : ownershipTier === 'half' ? 'Half Squad' : 'All Squad Games'}...`}
          className="w-full bg-steam-card border border-steam-border/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-steam-text placeholder-steam-muted focus:outline-none focus:border-steam-accent transition-colors shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-steam-muted hover:text-steam-text"
          >
            ✕
          </button>
        )}
      </div>

      {/* Game Cards Grid for Active Tier */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredGames.map((game) => (
            <GameCard
              key={game.appid}
              game={game}
              allSlots={slots}
              mode={game.ownershipCount === activePlayerCount ? 'full' : 'missing'}
              isHidden={hiddenAppIds.includes(game.appid)}
              onToggleHide={onToggleHide}
            />
          ))}
        </div>

      ) : (
        <div className="p-8 text-center rounded-xl bg-steam-card/40 border border-steam-border/40 space-y-3">
          <Gamepad2 className="w-10 h-10 text-steam-muted mx-auto stroke-1" />
          <h3 className="text-sm font-semibold text-white">
            {searchQuery
              ? `No games found matching "${searchQuery}" in ${ownershipTier === 'ready' ? `${activePlayerCount}/${activePlayerCount} Ready` : ownershipTier} tier`
              : 'No games in this category'}
          </h3>
          <p className="text-xs text-steam-muted max-w-md mx-auto">
            Try switching the ownership tier pill above to "All Squad Games" or check cross-tier matches below.
          </p>
        </div>
      )}

      {/* Cross-Tier Search Matches Section */}
      {searchQuery.trim() && crossTierMatches.length > 0 && (
        <div className="pt-4 space-y-4 border-t border-steam-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Matches Found In Other Squad Tiers ({crossTierMatches.length})
              </h3>
            </div>
            <span className="text-[11px] text-steam-muted">
              Games matching "{searchQuery}" owned by some (not all) squad members
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {crossTierMatches.map((game) => (
              <div key={game.appid} className="relative flex flex-col">
                <GameCard game={game} allSlots={slots} mode="missing" />
                {onToggleOverride && (
                  <div className="mt-2 p-2 rounded-lg bg-steam-card/80 border border-steam-border/60 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-steam-muted">
                      {game.ownershipCount}/{activePlayerCount} squad members own this
                    </span>
                    <button
                      onClick={() => onToggleOverride(game.appid)}
                      className="px-2 py-1 rounded bg-steam-accent/20 hover:bg-steam-accent/30 text-steam-accent border border-steam-accent/40 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                      title={`Force game to appear in ${activePlayerCount}/${activePlayerCount} Ready to Play for the squad`}
                    >
                      <Zap className="w-3 h-3" />
                      <span>Treat as Squad-Owned</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
