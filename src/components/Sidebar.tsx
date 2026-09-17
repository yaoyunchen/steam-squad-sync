import React, { useState } from 'react';
import { 
  Key, 
  Users, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ExternalLink,
  Loader2,
  RefreshCw,
  Plus,
  X
} from 'lucide-react';
import { SteamUserSlot } from '../types/steam';

interface SidebarProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  slots: SteamUserSlot[];
  onSlotChange: (slotId: string, input: string) => void;
  onResolveSlot: (slotId: string) => void;
  onAddSlot: () => void;
  onRemoveSlot: (slotId: string) => void;
  onSetSquadSize: (size: number) => void;

  onSyncSquad: () => void;
  onClearCache: () => void;
  onResetAllData?: () => void;
  isSyncing: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  apiKey,
  onApiKeyChange,
  slots,
  onSlotChange,
  onResolveSlot,
  onAddSlot,
  onRemoveSlot,
  onSetSquadSize,

  onSyncSquad,
  onClearCache,
  onResetAllData,
  isSyncing,
  collapsed,
  onToggleCollapse,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);

  const openLink = (url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const validSlotsCount = slots.filter(s => s.steamId && !s.isPrivate).length;

  if (collapsed) {
    return (
      <div className="w-14 h-full bg-steam-darker border-r border-steam-border/40 flex flex-col items-center py-4 justify-between transition-all duration-300">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg bg-steam-card hover:bg-steam-cardHover text-steam-accent transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="w-8 h-[1px] bg-steam-border/50" />

          {/* Slots mini icons */}
          <div className="flex flex-col items-center gap-2 max-h-[calc(100vh-220px)] overflow-y-auto px-1 py-1">
            {slots.map((slot, index) => (
              <div key={slot.id} className="relative group">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-steam-border bg-steam-card flex items-center justify-center">
                  {slot.avatarUrl ? (
                    <img src={slot.avatarUrl} alt={slot.personaName || `Slot ${index + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold text-steam-muted">#{index + 1}</span>
                  )}
                </div>
                {slot.steamId && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-steam-darkest ${slot.isPrivate ? 'bg-amber-500' : 'bg-steam-green'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onSyncSquad}
          disabled={isSyncing}
          className="w-10 h-10 rounded-full bg-steam-accent hover:bg-steam-accentHover text-steam-darkest flex items-center justify-center shadow-glow-accent transition-all"
          title="Sync Squad Libraries"
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 h-full bg-steam-darker border-r border-steam-border/40 flex flex-col justify-between transition-all duration-300 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header & Collapse Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-steam-accent" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Squad Configuration
            </h2>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-steam-card text-steam-muted hover:text-steam-text transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Valve Web API Key Input */}
        <div className="bg-steam-dark p-3 rounded-lg border border-steam-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-steam-text flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-steam-accent" />
              Steam Web API Key
            </label>
            <button
              onClick={() => openLink('https://steamcommunity.com/dev/apikey')}
              className="text-[11px] text-steam-accent hover:underline flex items-center gap-1"
              title="Get your Steam Web API key"
            >
              Get Key <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>

          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Paste 32-char Valve API Key..."
              className="w-full bg-steam-darkest border border-steam-border/60 rounded px-2.5 py-1.5 text-xs text-white placeholder-steam-muted/60 focus:outline-none focus:border-steam-accent pr-8 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-2 text-steam-muted hover:text-white transition-colors"
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-steam-muted">
            <Lock className="w-2.5 h-2.5 text-steam-green" />
            <span>Encrypted in local client storage</span>
          </div>
        </div>



        {/* Squad Size Selector (2 - 8 Players) */}
        <div className="bg-steam-dark/90 p-2.5 rounded-lg border border-steam-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-steam-text flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-steam-accent" />
              Squad Size ({slots.length} Players)
            </span>
            <span className="text-[10px] text-steam-accent font-mono font-bold">
              {validSlotsCount} of {slots.length} Active
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[2, 3, 4, 5, 6, 7, 8].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onSetSquadSize(size)}
                className={`py-1 text-xs font-bold rounded transition-all ${
                  slots.length === size
                    ? 'bg-steam-accent text-steam-darkest shadow-glow-accent ring-1 ring-steam-accent'
                    : 'bg-steam-darkest hover:bg-steam-card text-steam-muted hover:text-white border border-steam-border/40'
                }`}
                title={`Set squad capacity to ${size} players`}
              >
                {size}P
              </button>
            ))}
          </div>
        </div>

        {/* User Slots List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-steam-muted px-0.5">
            <span className="font-semibold text-white">Player Accounts ({slots.length})</span>
            <span className="text-[11px] text-steam-accent font-medium">
              {validSlotsCount} Verified
            </span>
          </div>

          {slots.map((slot, idx) => (
            <div
              key={slot.id}
              className={`p-2.5 rounded-lg border transition-all relative ${
                slot.steamId 
                  ? 'bg-steam-card/80 border-steam-border/80' 
                  : 'bg-steam-dark/60 border-steam-border/30 hover:border-steam-border/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-steam-muted tracking-wider uppercase">
                  Player #{idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  {slot.isLoading && (
                    <Loader2 className="w-3 h-3 text-steam-accent animate-spin" />
                  )}
                  {slot.steamId && !slot.isLoading && !slot.isPrivate && (
                    <span className="flex items-center gap-1 text-[10px] text-steam-green font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  )}
                  {slots.length > 2 && (
                    <button
                      type="button"
                      onClick={() => onRemoveSlot(slot.id)}
                      className="p-1 rounded text-steam-muted hover:text-rose-400 hover:bg-steam-darkest/60 transition-colors"
                      title={`Remove Player #${idx + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Input field */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={slot.input}
                  onChange={(e) => onSlotChange(slot.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onResolveSlot(slot.id)}
                  placeholder="SteamID64, vanity name or URL..."
                  className="flex-1 bg-steam-darkest border border-steam-border/60 rounded px-2 py-1 text-xs text-white placeholder-steam-muted/50 focus:outline-none focus:border-steam-accent"
                />
                <button
                  onClick={() => onResolveSlot(slot.id)}
                  disabled={!slot.input.trim() || slot.isLoading}
                  className="px-2 py-1 bg-steam-card hover:bg-steam-cardHover border border-steam-border/80 rounded text-[11px] text-steam-text hover:text-white disabled:opacity-40 transition-colors"
                >
                  Verify
                </button>
              </div>

              {/* Resolved User Card Mini Preview */}
              {slot.steamId && (
                <div className="mt-2 pt-2 border-t border-steam-border/40 flex items-center gap-2">
                  <img
                    src={slot.avatarUrl || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'}
                    alt={slot.personaName}
                    className="w-7 h-7 rounded-md border border-steam-border object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white truncate">
                        {slot.personaName || 'Steam User'}
                      </p>
                      {slot.gameCount !== undefined && (
                        <span className="text-[10px] text-steam-muted">
                          {slot.gameCount} games
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-steam-muted truncate">
                      {slot.steamId}
                    </p>
                  </div>
                </div>
              )}

              {/* Privacy Warning Badge */}
              {slot.isPrivate && (
                <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                  <span>Library is private or hidden</span>
                </div>
              )}

              {/* Error message */}
              {slot.error && (
                <div className="mt-1.5 text-[10px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{slot.error}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add Player Slot Button (up to 8) */}
          {slots.length < 8 && (
            <button
              type="button"
              onClick={onAddSlot}
              className="w-full py-2.5 border border-dashed border-steam-border/70 hover:border-steam-accent/80 rounded-lg text-xs font-semibold text-steam-muted hover:text-steam-accent hover:bg-steam-card/40 flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Player Slot ({slots.length}/8)</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-steam-border/40 space-y-2 bg-steam-dark/40">
        <button
          onClick={onSyncSquad}
          disabled={isSyncing || validSlotsCount < 1}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-steam-accentHover to-steam-accent hover:from-steam-accent hover:to-[#8ed2fa] text-steam-darkest font-bold text-xs rounded-lg shadow-glow-accent disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing Libraries...' : `Sync Squad (${validSlotsCount} Players)`}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onClearCache}
            className="flex-1 py-1.5 px-2 rounded hover:bg-steam-card text-steam-muted hover:text-steam-missing text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
            title="Clear local library cache"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Cache</span>
          </button>
          {onResetAllData && (
            <button
              onClick={onResetAllData}
              className="flex-1 py-1.5 px-2 rounded hover:bg-rose-950/40 text-steam-muted hover:text-rose-400 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors border border-transparent hover:border-rose-900/50"
              title="Wipe all local app storage, hidden games, and squad data"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Reset All Data</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
