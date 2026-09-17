import React, { useState } from 'react';
import { Minus, Square, X, Users, RefreshCw, RotateCcw } from 'lucide-react';

interface TitleBarProps {
  onRefreshAll?: () => void;
  isSyncing?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onRefreshAll, isSyncing }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximizeWindow) {
      window.electronAPI.maximizeWindow();
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  return (
    <div className="h-10 w-full bg-steam-darkest border-b border-steam-border/40 flex items-center justify-between px-3 select-none titlebar-drag-region z-50">
      {/* App branding */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-steam-accentHover to-steam-accent flex items-center justify-center shadow-glow-accent">
          <Users className="w-3.5 h-3.5 text-steam-darkest stroke-[2.5]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider uppercase text-white">
            Steam Squad Sync
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-steam-border/50 text-steam-accent font-medium">
            v1.0
          </span>
        </div>
      </div>

      {/* Center status text */}
      <div className="hidden md:flex items-center text-xs text-steam-muted gap-2">
        <span>Windows 11 Squad Library Overlap Engine</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        {onRefreshAll && (
          <button
            onClick={onRefreshAll}
            disabled={isSyncing}
            title="Sync squad libraries from Steam API"
            className="p-1.5 rounded hover:bg-steam-card text-steam-muted hover:text-steam-accent transition-colors disabled:opacity-40 mr-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-steam-accent' : ''}`} />
          </button>
        )}

        <button
          onClick={() => window.location.reload()}
          title="Reload Window (Refresh latest code)"
          className="p-1.5 rounded hover:bg-steam-card text-steam-muted hover:text-steam-accent transition-colors mr-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMinimize}
          className="w-8 h-7 flex items-center justify-center text-steam-muted hover:text-white hover:bg-steam-card rounded transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="w-8 h-7 flex items-center justify-center text-steam-muted hover:text-white hover:bg-steam-card rounded transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>

        <button
          onClick={handleClose}
          className="w-8 h-7 flex items-center justify-center text-steam-muted hover:text-white hover:bg-red-600 rounded transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
