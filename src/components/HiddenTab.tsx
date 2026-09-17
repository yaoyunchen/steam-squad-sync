import React, { useState, useMemo } from 'react';
import { EyeOff, Eye, RotateCcw, Search } from 'lucide-react';
import { SquadGameAnalysis, SteamUserSlot } from '../types/steam';
import { GameCard } from './GameCard';

interface HiddenTabProps {
  allSquadGames: SquadGameAnalysis[];
  hiddenAppIds: number[];
  slots: SteamUserSlot[];
  onToggleHide: (appid: number) => void;
  onClearAllHidden: () => void;
}

export const HiddenTab: React.FC<HiddenTabProps> = ({
  allSquadGames,
  hiddenAppIds,
  slots,
  onToggleHide,
  onClearAllHidden,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const hiddenGames = useMemo(() => {
    const hiddenSet = new Set(hiddenAppIds);
    return allSquadGames
      .filter((g) => hiddenSet.has(g.appid) && g.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSquadGames, hiddenAppIds, searchQuery]);

  return (
    <div className="space-y-5 pb-8">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-steam-card via-slate-900/60 to-steam-card border border-slate-700/60 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center">
            <EyeOff className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Hidden Games
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-600">
                {hiddenAppIds.length} Hidden
              </span>
            </h2>
            <p className="text-xs text-steam-muted">
              Games you have hidden from Ready to Play and result tabs. Click "Unhide" to restore any game.
            </p>
          </div>
        </div>

        {hiddenAppIds.length > 0 && (
          <button
            onClick={onClearAllHidden}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs shadow-md transition-all hover:scale-105"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore All Hidden Games</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      {hiddenAppIds.length > 0 && (
        <div className="relative w-full">
          <Search className="w-4 h-4 text-steam-muted absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hidden games..."
            className="w-full bg-steam-card border border-steam-border/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-steam-muted focus:outline-none focus:border-slate-500 transition-colors shadow-inner"
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
      )}

      {/* Hidden Games Grid */}
      {hiddenGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {hiddenGames.map((game) => (
            <div key={game.appid} className="relative flex flex-col">
              <GameCard
                game={game}
                allSlots={slots}
                mode="hidden"
                isHidden={true}
                onToggleHide={onToggleHide}
              />
              <button
                onClick={() => onToggleHide(game.appid)}
                className="mt-2 w-full py-1.5 px-3 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Unhide and Restore to Results</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center rounded-xl bg-steam-card/40 border border-steam-border/40 space-y-3">
          <Eye className="w-10 h-10 text-slate-500 mx-auto stroke-1" />
          <h3 className="text-sm font-semibold text-white">
            {hiddenAppIds.length === 0 ? 'No Hidden Games' : `No hidden games matching "${searchQuery}"`}
          </h3>
          <p className="text-xs text-steam-muted max-w-md mx-auto">
            {hiddenAppIds.length === 0
              ? 'When you click the "Hide" button on any game card in Ready to Play or other tabs, it will move here so you can easily manage or restore it later.'
              : 'Try clearing your search query.'}
          </p>
        </div>
      )}
    </div>
  );
};
