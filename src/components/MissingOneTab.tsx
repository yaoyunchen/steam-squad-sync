import React, { useState, useMemo } from 'react';
import { Search, UserMinus, ArrowUpDown, ShoppingBag, Gift, ShieldCheck, Users } from 'lucide-react';
import { SquadGameAnalysis, SteamUserSlot } from '../types/steam';
import { GameCard } from './GameCard';

interface MissingOneTabProps {
  games: SquadGameAnalysis[];
  slots: SteamUserSlot[];
  activePlayerCount: number;
  filterMultiplayerOnly?: boolean;
  onToggleFilterMultiplayerOnly?: () => void;
}

export const MissingOneTab: React.FC<MissingOneTabProps> = ({
  games,
  slots,
  activePlayerCount,
  filterMultiplayerOnly = true,
  onToggleFilterMultiplayerOnly,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [missingCountFilter, setMissingCountFilter] = useState<'all' | '1' | '2'>('all');
  const [selectedMissingPlayer, setSelectedMissingPlayer] = useState<string>('all');
  const [fitSquadOnly, setFitSquadOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'playtime' | 'name'>('playtime');

  const activeSlots = slots.filter(s => s.steamId);

  // Filter games
  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        // Search
        const matchesQuery = game.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        // Squad size compatibility filter (if enabled, hide games that cap below squad size)
        if (fitSquadOnly && game.maxPlayers !== undefined && game.maxPlayers < activePlayerCount) {
          return false;
        }

        // Missing Count Filter (1 vs 2)
        const missingCount = activePlayerCount - game.ownershipCount;
        if (missingCountFilter === '1' && missingCount !== 1) return false;
        if (missingCountFilter === '2' && missingCount !== 2) return false;

        // Missing player filter
        if (selectedMissingPlayer !== 'all') {
          return game.missingBySteamIds.includes(selectedMissingPlayer);
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'playtime') {
          return b.totalSquadPlaytimeMinutes - a.totalSquadPlaytimeMinutes;
        }
        return a.name.localeCompare(b.name);
      });
  }, [games, searchQuery, missingCountFilter, selectedMissingPlayer, sortBy, fitSquadOnly, activePlayerCount]);

  const countMissing1 = useMemo(() => games.filter(g => activePlayerCount - g.ownershipCount === 1).length, [games, activePlayerCount]);
  const countMissing2 = useMemo(() => games.filter(g => activePlayerCount - g.ownershipCount === 2).length, [games, activePlayerCount]);

  return (
    <div className="space-y-5 pb-8">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-steam-card to-steam-dark border border-amber-500/30 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <UserMinus className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Almost There: 1 or 2 Persons Missing
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                {games.length} Games
              </span>
            </h2>
            <p className="text-xs text-steam-muted">
              Great squad titles that almost everyone owns. Perfect for Steam gifting, friend requests, or sale pickups!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onToggleFilterMultiplayerOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              filterMultiplayerOnly
                ? 'bg-emerald-950/60 border-steam-green/50 text-emerald-300 hover:bg-emerald-900/60 shadow-sm'
                : 'bg-steam-card hover:bg-steam-cardHover border-steam-border text-steam-muted hover:text-white'
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
                : 'bg-steam-card hover:bg-steam-cardHover border-steam-border text-steam-muted hover:text-white'
            }`}
            title={`Hide games that cannot accommodate all ${activePlayerCount} active squad members`}
          >
            <Users className={`w-3.5 h-3.5 ${fitSquadOnly ? 'text-indigo-400' : 'text-steam-muted'}`} />
            <span>{fitSquadOnly ? `Fits ${activePlayerCount}P Squad Only` : `Fit Squad (${activePlayerCount}P)`}</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
            <Gift className="w-4 h-4" />
            <span>Ranked by squad playtime</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-steam-muted absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search almost-there games..."
              className="w-full bg-steam-card border border-steam-border/60 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-steam-muted focus:outline-none focus:border-steam-accent transition-colors"
            />
          </div>

          {/* Missing Count Selector: All vs 1 Missing vs 2 Missing */}
          <div className="flex items-center gap-1.5 bg-steam-card/80 p-1 rounded-lg border border-steam-border/50">
            <button
              onClick={() => setMissingCountFilter('all')}
              className={`text-xs px-3 py-1 rounded-md font-bold transition-all ${
                missingCountFilter === 'all'
                  ? 'bg-amber-400 text-steam-darkest shadow'
                  : 'text-steam-muted hover:text-white'
              }`}
            >
              All Almost There ({games.length})
            </button>
            <button
              onClick={() => setMissingCountFilter('1')}
              className={`text-xs px-3 py-1 rounded-md font-bold transition-all ${
                missingCountFilter === '1'
                  ? 'bg-amber-400 text-steam-darkest shadow'
                  : 'text-steam-muted hover:text-white'
              }`}
            >
              1 Person Missing ({countMissing1})
            </button>
            {activePlayerCount >= 3 && (
              <button
                onClick={() => setMissingCountFilter('2')}
                className={`text-xs px-3 py-1 rounded-md font-bold transition-all ${
                  missingCountFilter === '2'
                    ? 'bg-amber-400 text-steam-darkest shadow'
                    : 'text-steam-muted hover:text-white'
                }`}
              >
                2 Persons Missing ({countMissing2})
              </button>
            )}
          </div>
        </div>

        {/* Member filter pills & sort */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedMissingPlayer('all')}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedMissingPlayer === 'all'
                  ? 'bg-steam-accent text-steam-darkest font-bold'
                  : 'bg-steam-card hover:bg-steam-cardHover text-steam-muted hover:text-white border border-steam-border/40'
              }`}
            >
              Any Squad Member
            </button>

            {activeSlots.map((slot) => {
              const countForPlayer = games.filter(g => g.missingBySteamIds.includes(slot.steamId!)).length;
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelectedMissingPlayer(slot.steamId!)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    selectedMissingPlayer === slot.steamId
                      ? 'bg-steam-accent text-steam-darkest font-bold'
                      : 'bg-steam-card hover:bg-steam-cardHover text-steam-muted hover:text-white border border-steam-border/40'
                  }`}
                >
                  {slot.avatarUrl && (
                    <img src={slot.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                  )}
                  <span>Needs {slot.personaName || 'Player'} ({countForPlayer})</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setSortBy(sortBy === 'playtime' ? 'name' : 'playtime')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-steam-card hover:bg-steam-cardHover text-steam-muted hover:text-white border border-steam-border/40 transition-colors whitespace-nowrap flex-shrink-0"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-steam-accent" />
            <span>{sortBy === 'playtime' ? 'Playtime' : 'A-Z'}</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredGames.map((game) => (
            <GameCard key={game.appid} game={game} allSlots={slots} mode="missing" />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl bg-steam-card/40 border border-steam-border/40 space-y-3">
          <ShoppingBag className="w-10 h-10 text-steam-muted mx-auto stroke-1" />
          <h3 className="text-sm font-semibold text-white">
            No Almost-There (1–2 Missing) Games Found
          </h3>
          <p className="text-xs text-steam-muted max-w-md mx-auto">
            Either all games are already owned by everyone (check "Ready to Play"), or squad libraries have not been synced yet.
          </p>
        </div>
      )}
    </div>
  );
};
