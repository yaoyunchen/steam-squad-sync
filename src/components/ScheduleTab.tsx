import React, { useState, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Plus, 
  Download, 
  Upload, 
  Copy, 
  Trash2, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Share2,
  CalendarDays,
  Sun,
  Moon,
  Sunset,
  Sunrise,
  Coffee,
  Check,
  RefreshCw,
  Cloud
} from 'lucide-react';
import { GameNightEvent, PlayerAvailability, SquadGameAnalysis, SteamUserSlot, ScheduleBlockId } from '../types/steam';
import { StorageService } from '../services/storage';
import { CloudSyncService, sanitizeSchedulesForCloud, sanitizeGamesForCloud } from '../services/cloudSync';
import { 
  DAYS_OF_WEEK, 
  SCHEDULE_BLOCKS, 
  computeBlockScheduleOverlap, 
  findBestSquadBlockWindows, 
  formatDateStr, 
  formatDateLabel, 
  getDayNameFromDateStr,
  getStartOfWeek,
  getWeekDates,
  getMonthCalendarGrid, 
  generateDiscordInviteText, 
  generateGoogleCalendarUrl, 
  generateIcsPayload,
  exportSquadSchedulesToJson,
  parseSquadSchedulesFromJson
} from '../services/scheduleEngine';

interface ScheduleTabProps {
  slots: SteamUserSlot[];
  readyGames: SquadGameAnalysis[];
  nearOverlapGames: SquadGameAnalysis[];
}

type QuickScope = 'all' | 'weekdays' | 'weekends';

const BLOCK_ICONS: Record<ScheduleBlockId, React.ReactNode> = {
  daybreak: <Sunrise className="w-3.5 h-3.5 text-amber-400" />,
  morning: <Sun className="w-3.5 h-3.5 text-yellow-400" />,
  afternoon: <Coffee className="w-3.5 h-3.5 text-orange-400" />,
  evening: <Sunset className="w-3.5 h-3.5 text-purple-400" />,
  night: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
  graveyard: <Clock className="w-3.5 h-3.5 text-slate-400" />,
};

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ slots, readyGames, nearOverlapGames = [] }) => {
  const activeSlots = useMemo(() => slots.filter(s => s.input.trim().length > 0 || s.personaName), [slots]);

  const [schedules, setSchedules] = useState<Record<string, PlayerAvailability>>(() => {
    return StorageService.getSquadSchedules();
  });

  const [events, setEvents] = useState<GameNightEvent[]>(() => {
    return StorageService.getGameNightEvents();
  });

  // Re-sync schedules and Supabase config from StorageService whenever slots change
  React.useEffect(() => {
    const config = StorageService.getSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseAnonKey(config.anonKey);
    setRoomCode(config.roomCode);
    setSchedules(StorageService.getSquadSchedules());
  }, [slots]);

  const [activeSlotId, setActiveSlotId] = useState<string>(activeSlots[0]?.id || 'slot-1');
  const [activeSubTab, setActiveSubTab] = useState<'heatmap' | 'edit' | 'events'>('heatmap');
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

  const [currentWeekRef, setCurrentWeekRef] = useState<Date>(() => new Date());
  const [currentMonthRef, setCurrentMonthRef] = useState<Date>(() => new Date());

  const [quickScope, setQuickScope] = useState<QuickScope>('all');

  // Sync / Import Modal state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');

  // Cloud Sync state
  const [supabaseUrl, setSupabaseUrl] = useState(() => StorageService.getSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => StorageService.getSupabaseConfig().anonKey);
  const [roomCode, setRoomCode] = useState(() => StorageService.getSupabaseConfig().roomCode);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [showAdvancedDbConfig, setShowAdvancedDbConfig] = useState(false);

  // Event Modal State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [modalGameName, setModalGameName] = useState('');
  const [modalAppId, setModalAppId] = useState<number>(0);
  const [modalDateStr, setModalDateStr] = useState(formatDateStr(new Date()));
  const [modalTimeRange, setModalTimeRange] = useState('8:00 PM - 12:00 AM');
  const [modalNote, setModalNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => formatDateStr(new Date()), []);
  const startOfCurrentWeek = useMemo(() => getStartOfWeek(new Date()), []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Week Dates calculation (filtered to omit past dates)
  const weekDates = useMemo(() => {
    return getWeekDates(currentWeekRef);
  }, [currentWeekRef]);

  const displayWeekDates = useMemo(() => {
    return weekDates.filter((d) => formatDateStr(d) >= todayStr);
  }, [weekDates, todayStr]);

  // Month Grid calculation
  const monthCalendarData = useMemo(() => {
    const year = currentMonthRef.getFullYear();
    const monthIdx = currentMonthRef.getMonth();
    return getMonthCalendarGrid(year, monthIdx);
  }, [currentMonthRef]);

  // Compute Heatmap Matrix for Weekly View (only active future dates)
  const weeklyOverlapMatrix = useMemo(() => {
    return computeBlockScheduleOverlap(schedules, activeSlots, displayWeekDates);
  }, [schedules, activeSlots, displayWeekDates]);

  // Compute Heatmap Matrix for Monthly View
  const monthlyOverlapMatrix = useMemo(() => {
    return computeBlockScheduleOverlap(schedules, activeSlots, monthCalendarData.daysInMonth);
  }, [schedules, activeSlots, monthCalendarData.daysInMonth]);

  // Compute Best Squad Block Windows (Exclude past dates)
  const recommendedWindows = useMemo(() => {
    return findBestSquadBlockWindows(weeklyOverlapMatrix).filter((win) => win.dateStr >= todayStr);
  }, [weeklyOverlapMatrix, todayStr]);

  // Upcoming scheduled sessions (exclude past events)
  const upcomingEvents = useMemo(() => {
    return events.filter((e) => e.dateString >= todayStr);
  }, [events, todayStr]);

  // Active Player Grid
  const currentGrid = useMemo(() => {
    return schedules[activeSlotId]?.grid || {};
  }, [schedules, activeSlotId]);

  // Update schedule for active player
  const updateActivePlayerGrid = (newGrid: Record<string, boolean>) => {
    const updatedPlayerSched: PlayerAvailability = {
      slotId: activeSlotId,
      personaName: activeSlots.find(s => s.id === activeSlotId)?.personaName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
      grid: newGrid,
    };

    const newSchedules = { ...schedules, [activeSlotId]: updatedPlayerSched };
    setSchedules(newSchedules);
    StorageService.savePlayerSchedule(activeSlotId, updatedPlayerSched);
  };

  // Single Click Cell Toggle (Guarded against past dates)
  const handleToggleCell = (dateStr: string, blockId: ScheduleBlockId) => {
    if (dateStr < todayStr) return; // Disallow editing past dates!

    const keyWithDate = `${dateStr}-${blockId}`;
    const dayName = getDayNameFromDateStr(dateStr);
    const keyWithDay = `${dayName}-${blockId}`;

    const currentVal = !!(currentGrid[keyWithDate] || currentGrid[keyWithDay]);
    const newVal = !currentVal;

    const updated = { ...currentGrid, [keyWithDate]: newVal, [keyWithDay]: newVal };
    updateActivePlayerGrid(updated);
  };

  // Filter dates based on scope and exclude past dates
  const filterDatesByScope = (dates: Date[]) => {
    return dates.filter((d) => {
      const dateStr = formatDateStr(d);
      if (dateStr < todayStr) return false; // Exclude past dates!

      const day = d.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = day === 0 || day === 6;
      if (quickScope === 'weekdays') return !isWeekend;
      if (quickScope === 'weekends') return isWeekend;
      return true;
    });
  };

  // Quick Action: Available / Unavailable for all 6 blocks across scoped future dates
  const setBulkAllDayAvailability = (available: boolean) => {
    const targetDates = filterDatesByScope(displayWeekDates);
    const updated = { ...currentGrid };
    targetDates.forEach((d) => {
      const dateStr = formatDateStr(d);
      const dayName = getDayNameFromDateStr(dateStr);
      SCHEDULE_BLOCKS.forEach((block) => {
        updated[`${dateStr}-${block.id}`] = available;
        updated[`${dayName}-${block.id}`] = available;
      });
    });
    updateActivePlayerGrid(updated);
    showToast(`Set all blocks to ${available ? 'Free' : 'Busy'} (${quickScope === 'all' ? 'All Days' : quickScope === 'weekdays' ? 'Weekdays' : 'Weekends'})`);
  };

  // Quick Action: Toggle specific block across scoped future dates
  const setBulkBlockAvailability = (blockId: ScheduleBlockId, available: boolean) => {
    const targetDates = filterDatesByScope(displayWeekDates);
    const updated = { ...currentGrid };
    targetDates.forEach((d) => {
      const dateStr = formatDateStr(d);
      const dayName = getDayNameFromDateStr(dateStr);
      updated[`${dateStr}-${blockId}`] = available;
      updated[`${dayName}-${blockId}`] = available;
    });
    updateActivePlayerGrid(updated);
    const blockLabel = SCHEDULE_BLOCKS.find(b => b.id === blockId)?.label || blockId;
    showToast(`Set ${blockLabel} to ${available ? 'Free' : 'Busy'} (${quickScope === 'all' ? 'All Days' : quickScope === 'weekdays' ? 'Weekdays' : 'Weekends'})`);
  };

  // Save current week's availability as default recurring pattern
  const handleSaveWeeklyPattern = () => {
    const pattern: Record<string, boolean> = {};
    DAYS_OF_WEEK.forEach((dayName) => {
      SCHEDULE_BLOCKS.forEach((block) => {
        const key = `${dayName}-${block.id}`;
        if (currentGrid[key] !== undefined) {
          pattern[key] = !!currentGrid[key];
        }
      });
    });
    displayWeekDates.forEach((d) => {
      const dateStr = formatDateStr(d);
      const dayName = getDayNameFromDateStr(dateStr);
      SCHEDULE_BLOCKS.forEach((block) => {
        const dateKey = `${dateStr}-${block.id}`;
        if (currentGrid[dateKey] !== undefined) {
          pattern[`${dayName}-${block.id}`] = !!currentGrid[dateKey];
        }
      });
    });

    StorageService.savePlayerRecurringPattern(activeSlotId, pattern);
    showToast('Saved default weekly recurring pattern for player!');
  };

  // Apply default recurring pattern to upcoming dates in view
  const handleApplyWeeklyPattern = () => {
    const allPatterns = StorageService.getRecurringPatterns();
    const pattern = allPatterns[activeSlotId];
    if (!pattern || Object.keys(pattern).length === 0) {
      showToast('No saved recurring pattern found. Set your grid and click "Save Current Week as Default".');
      return;
    }

    const updated = { ...currentGrid };
    displayWeekDates.forEach((d) => {
      const dateStr = formatDateStr(d);
      const dayName = getDayNameFromDateStr(dateStr);
      SCHEDULE_BLOCKS.forEach((block) => {
        const patternVal = pattern[`${dayName}-${block.id}`];
        if (patternVal !== undefined) {
          updated[`${dateStr}-${block.id}`] = patternVal;
          updated[`${dayName}-${block.id}`] = patternVal;
        }
      });
    });

    updateActivePlayerGrid(updated);
    showToast('Applied saved default weekly recurring pattern!');
  };

  // Navigation Guard logic (Current Month & Next Month at most)
  const canGoPrev = useMemo(() => {
    if (viewMode === 'weekly') {
      const startOfRefWeek = getStartOfWeek(currentWeekRef);
      return startOfRefWeek > startOfCurrentWeek;
    } else {
      const year = currentMonthRef.getFullYear();
      const month = currentMonthRef.getMonth();
      const todayYear = new Date().getFullYear();
      const todayMonth = new Date().getMonth();
      return year > todayYear || (year === todayYear && month > todayMonth);
    }
  }, [viewMode, currentWeekRef, currentMonthRef, startOfCurrentWeek]);

  const canGoNext = useMemo(() => {
    const today = new Date();
    const nextMonthYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const nextMonthIdx = today.getMonth() === 11 ? 0 : today.getMonth() + 1;

    if (viewMode === 'weekly') {
      const nextWeek = new Date(currentWeekRef);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const startOfNextWeek = getStartOfWeek(nextWeek);
      const lastDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return startOfNextWeek <= lastDayOfNextMonth;
    } else {
      const refYear = currentMonthRef.getFullYear();
      const refMonth = currentMonthRef.getMonth();
      return refYear < nextMonthYear || (refYear === nextMonthYear && refMonth < nextMonthIdx);
    }
  }, [viewMode, currentWeekRef, currentMonthRef]);

  // Navigation handlers
  const handlePrev = () => {
    if (!canGoPrev) return;
    if (viewMode === 'weekly') {
      const prev = new Date(currentWeekRef);
      prev.setDate(prev.getDate() - 7);
      setCurrentWeekRef(prev);
    } else {
      const prev = new Date(currentMonthRef);
      prev.setMonth(prev.getMonth() - 1);
      setCurrentMonthRef(prev);
    }
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (viewMode === 'weekly') {
      const next = new Date(currentWeekRef);
      next.setDate(next.getDate() + 7);
      setCurrentWeekRef(next);
    } else {
      const next = new Date(currentMonthRef);
      next.setMonth(next.getMonth() + 1);
      setCurrentMonthRef(next);
    }
  };

  const handleToday = () => {
    setCurrentWeekRef(new Date());
    setCurrentMonthRef(new Date());
  };

  // Export / Import Squad Schedule JSON
  const handleExportJson = () => {
    const jsonStr = exportSquadSchedulesToJson(schedules);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `squad_schedule_${formatDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported Squad Schedule JSON file!');
  };

  const handleCopyJsonPayload = () => {
    const jsonStr = exportSquadSchedulesToJson(schedules);
    navigator.clipboard.writeText(jsonStr);
    showToast('Copied Squad Schedule JSON payload to clipboard!');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseSquadSchedulesFromJson(text);
        const merged = { ...schedules, ...parsed };
        setSchedules(merged);
        StorageService.saveSquadSchedules(merged);
        showToast('Successfully imported & synced squad schedules!');
        setIsSyncModalOpen(false);
      } catch (err: any) {
        showToast('Failed to import JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImportJsonText = () => {
    try {
      const parsed = parseSquadSchedulesFromJson(jsonImportText);
      const merged = { ...schedules, ...parsed };
      setSchedules(merged);
      StorageService.saveSquadSchedules(merged);
      showToast('Successfully imported & synced squad schedules!');
      setIsSyncModalOpen(false);
      setJsonImportText('');
    } catch (err: any) {
      showToast('Invalid JSON payload: ' + err.message);
    }
  };

  const handlePushToCloud = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim() || !roomCode.trim()) {
      showToast('Please enter Supabase URL, Anon Key, and Room Code');
      return;
    }

    setIsCloudSyncing(true);
    StorageService.setSupabaseConfig(supabaseUrl, supabaseAnonKey, roomCode);

    try {
      const cleanedSchedules = sanitizeSchedulesForCloud(schedules);
      const cleanedReady = sanitizeGamesForCloud(readyGames);
      const cleanedNear = sanitizeGamesForCloud(nearOverlapGames);

      const payload = {
        schedules: cleanedSchedules,
        sharedGames: {
          readyGames: cleanedReady,
          nearOverlapGames: cleanedNear,
          updatedAt: Date.now(),
        },
      };

      await CloudSyncService.pushSquadPayload(supabaseUrl, supabaseAnonKey, roomCode, payload);
      showToast(`Pushed schedule & shared game data to ${roomCode.toUpperCase()}! (Saved size & API calls)`);
    } catch (err: any) {
      showToast('Cloud push failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim() || !roomCode.trim()) {
      showToast('Please enter Supabase URL, Anon Key, and Room Code');
      return;
    }

    setIsCloudSyncing(true);
    StorageService.setSupabaseConfig(supabaseUrl, supabaseAnonKey, roomCode);

    try {
      const payload = await CloudSyncService.fetchSquadPayload(supabaseUrl, supabaseAnonKey, roomCode);
      if (!payload) {
        showToast(`No cloud payload found for room ${roomCode.toUpperCase()}`);
        return;
      }

      if (payload.schedules) {
        const merged = { ...schedules, ...payload.schedules };
        setSchedules(merged);
        StorageService.saveSquadSchedules(merged);
      }

      showToast(`Loaded payload for ${roomCode.toUpperCase()}! Saved Steam API queries.`);
    } catch (err: any) {
      showToast('Cloud pull failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Event creation
  const handleCreateEvent = () => {
    if (!modalGameName.trim()) {
      showToast('Please select or enter a game name');
      return;
    }
    if (modalDateStr < todayStr) {
      showToast('Cannot schedule sessions for past dates');
      return;
    }

    const newEvent: GameNightEvent = {
      id: `evt-${Date.now()}`,
      appid: modalAppId,
      gameName: modalGameName,
      dayName: formatDateLabel(new Date(modalDateStr)),
      dateString: modalDateStr,
      startTimeLabel: modalTimeRange.split(' - ')[0],
      endTimeLabel: modalTimeRange.split(' - ')[1] || 'Late',
      startIso: `${modalDateStr}T20:00:00`,
      endIso: `${modalDateStr}T23:00:00`,
      attendingNames: activeSlots.map(s => s.personaName || s.input),
      note: modalNote,
      createdAt: Date.now(),
    };

    const updatedEvents = [newEvent, ...events];
    setEvents(updatedEvents);
    StorageService.saveGameNightEvents(updatedEvents);

    setIsEventModalOpen(false);
    showToast(`Scheduled Game Night for ${modalGameName}!`);
  };

  const handleDeleteEvent = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    StorageService.saveGameNightEvents(updated);
    showToast('Event removed');
  };

  const currentMonthLabel = useMemo(() => {
    return currentMonthRef.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [currentMonthRef]);

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-steam-accent text-steam-darkest font-bold px-4 py-3 rounded-lg shadow-xl flex items-center space-x-2 border border-steam-accent animate-slideUp">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-steam-card border border-steam-border/60 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-steam-accent/20 border border-steam-accent/40 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-steam-accent" />
          </div>
          <div>
            <h2 className="text-base font-bold text-steam-text tracking-wide flex items-center gap-2">
              Squad Availability & Gaming Scheduler
              <span className="text-xs px-2 py-0.5 rounded-full bg-steam-accent/20 text-steam-accent font-semibold">
                Current & Next Month Only
              </span>
            </h2>
            <p className="text-xs text-steam-muted">
              Coordinate gaming sessions with actual calendar dates, 4-hour time windows & local squad JSON sync
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-steam-darkest p-1 rounded-lg border border-steam-border/60">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                viewMode === 'weekly'
                  ? 'bg-steam-accent text-steam-darkest shadow-glow-accent'
                  : 'text-steam-muted hover:text-steam-text'
              }`}
            >
              Weekly View
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                viewMode === 'monthly'
                  ? 'bg-steam-accent text-steam-darkest shadow-glow-accent'
                  : 'text-steam-muted hover:text-steam-text'
              }`}
            >
              Monthly View
            </button>
          </div>

          {/* Sync / Export JSON button */}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-steam-card hover:bg-steam-cardHover text-steam-text text-xs font-semibold rounded-lg border border-steam-border/80 transition shadow"
            title="Sync squad schedule via JSON file or payload"
          >
            <Share2 className="w-3.5 h-3.5 text-steam-accent" />
            <span>Sync Squad Schedule</span>
          </button>

          {/* Schedule Game Night Button */}
          <button
            onClick={() => setIsEventModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-steam-accent hover:bg-steam-accentHover text-steam-darkest text-xs font-bold rounded-lg shadow-glow-accent transition border border-steam-accent"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Game Night</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Bar & Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-steam-border/40 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('heatmap')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeSubTab === 'heatmap'
                ? 'bg-steam-card text-steam-accent border border-steam-border/60 shadow'
                : 'text-steam-muted hover:text-steam-text'
            }`}
          >
            🔥 Squad Overlap Heatmap
          </button>
          <button
            onClick={() => setActiveSubTab('edit')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeSubTab === 'edit'
                ? 'bg-steam-card text-steam-accent border border-steam-border/60 shadow'
                : 'text-steam-muted hover:text-steam-text'
            }`}
          >
            ✏️ Edit My Availability Grid
          </button>
          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeSubTab === 'events'
                ? 'bg-steam-card text-steam-accent border border-steam-border/60 shadow'
                : 'text-steam-muted hover:text-steam-text'
            }`}
          >
            🎮 Scheduled Sessions ({upcomingEvents.length})
          </button>
        </div>

        {/* Date / Month Navigator (Restricted to Current & Next Month) */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrev}
            disabled={!canGoPrev}
            className="p-1.5 rounded bg-steam-card hover:bg-steam-cardHover text-steam-text border border-steam-border/60 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition"
            title={viewMode === 'weekly' ? 'Previous Week' : 'Previous Month'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-2.5 py-1.5 rounded bg-steam-card hover:bg-steam-cardHover text-steam-text border border-steam-border/60 text-xs font-bold flex items-center gap-1.5"
          >
            <span>{viewMode === 'weekly' ? `Week of ${formatDateLabel(weekDates[0])}` : currentMonthLabel}</span>
            <span className="px-1.5 py-0.5 rounded bg-steam-accent/20 text-steam-accent text-[10px]">Today</span>
          </button>
          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="p-1.5 rounded bg-steam-card hover:bg-steam-cardHover text-steam-text border border-steam-border/60 text-xs disabled:opacity-30 disabled:cursor-not-allowed transition"
            title={viewMode === 'weekly' ? 'Next Week' : 'Next Month'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: HEATMAP */}
      {activeSubTab === 'heatmap' && (
        <div className="space-y-6">
          {/* Top Recommended Squad Gaming Windows */}
          <div className="p-4 rounded-xl bg-steam-card border border-steam-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-steam-accent" />
                <h3 className="font-bold text-sm text-steam-text">Top Recommended Squad Gaming Windows</h3>
              </div>
              <span className="text-xs text-steam-muted">Upcoming 4-Hour Overlaps</span>
            </div>

            {recommendedWindows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendedWindows.slice(0, 6).map((win, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-all ${
                      win.isFullSquad
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                        : 'bg-steam-darkest/70 border-steam-border/50 text-steam-text'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{win.dayFormatted}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${win.isFullSquad ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {win.isFullSquad ? '100% Full Squad Free' : `${win.count}/${activeSlots.length} Free`}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-steam-accent font-semibold mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{win.blockLabel} ({win.timeRange})</span>
                    </div>

                    <div className="text-[11px] text-steam-muted space-y-0.5">
                      <div><strong className="text-steam-text">Free:</strong> {win.availableNames.join(', ')}</div>
                      {win.missingNames.length > 0 && (
                        <div><strong className="text-rose-300">Missing:</strong> {win.missingNames.join(', ')}</div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setModalDateStr(win.dateStr);
                        setModalTimeRange(win.timeRange);
                        setIsEventModalOpen(true);
                      }}
                      className="mt-3 w-full py-1 rounded bg-steam-accent/20 hover:bg-steam-accent/40 text-steam-accent text-[11px] font-bold border border-steam-accent/30 transition flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Schedule Session</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-steam-muted">
                No overlapping future availability marked yet. Go to "Edit My Availability Grid" to set your upcoming gaming times!
              </div>
            )}
          </div>

          {/* WEEKLY VIEW MATRIX */}
          {viewMode === 'weekly' && (
            <div className="p-4 rounded-xl bg-steam-card border border-steam-border/60 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-steam-text flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-steam-accent" />
                  <span>Squad Overlap Heatmap (Weekly View)</span>
                </h3>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-steam-muted">100% Squad</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500" />
                    <span className="text-steam-muted">Partial</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3 h-3 rounded bg-steam-darkest border border-steam-border/60" />
                    <span className="text-steam-muted">None</span>
                  </div>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-steam-border/60 text-xs text-steam-muted">
                      <th className="py-2.5 px-3 min-w-[140px]">4-Hour Time Block</th>
                      {displayWeekDates.map((dateObj) => {
                        const dateStr = formatDateStr(dateObj);
                        const isToday = dateStr === todayStr;

                        return (
                          <th
                            key={dateStr}
                            className={`py-2.5 px-3 font-semibold min-w-[125px] text-center rounded-t-lg transition-all ${
                              isToday
                                ? 'bg-steam-accent/20 border-t-2 border-steam-accent text-steam-accent font-bold shadow-glow-accent'
                                : 'text-steam-text'
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span>{formatDateLabel(dateObj)}</span>
                              {isToday && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-steam-accent text-steam-darkest font-extrabold uppercase tracking-wider mt-0.5">
                                  TODAY
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steam-border/30">
                    {SCHEDULE_BLOCKS.map((block, blockIdx) => (
                      <tr key={block.id} className="hover:bg-steam-cardHover/50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-steam-text">
                            {BLOCK_ICONS[block.id]}
                            <span>{block.label}</span>
                          </div>
                          <div className="text-[10px] text-steam-muted font-mono">{block.timeRange}</div>
                        </td>
                        {displayWeekDates.map((dateObj, dayIdx) => {
                          const dateStr = formatDateStr(dateObj);
                          const isToday = dateStr === todayStr;
                          const slot = weeklyOverlapMatrix[dayIdx]?.[blockIdx];
                          if (!slot) return <td key={dayIdx} />;

                          const isFull = slot.isFullSquad;
                          const hasPartial = slot.count > 0;

                          return (
                            <td key={dateStr} className={`p-2 text-center ${isToday ? 'bg-steam-accent/5' : ''}`}>
                              <div
                                className={`p-2.5 rounded-lg border text-xs transition-all ${
                                  isFull
                                    ? 'bg-emerald-600 text-white font-bold border-emerald-400 shadow-md'
                                    : hasPartial
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-steam-darkest/60 text-steam-muted/40 border-steam-border/30'
                                } ${isToday ? 'ring-1 ring-steam-accent/40' : ''}`}
                                title={`Available: ${slot.availableNames.join(', ') || 'None'}`}
                              >
                                <div className="font-bold">{`${slot.count} / ${activeSlots.length} Free`}</div>
                                <div className="text-[10px] opacity-80">{`${slot.percentage}%`}</div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MONTHLY VIEW GRID */}
          {viewMode === 'monthly' && (
            <div className="p-4 rounded-xl bg-steam-card border border-steam-border/60 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-steam-text flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-steam-accent" />
                  <span>Squad Monthly Overview ({currentMonthLabel})</span>
                </h3>
                <span className="text-xs text-steam-muted">Current & Next Month Only</span>
              </div>

              {/* Monthly Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-steam-muted py-2 uppercase tracking-wider">
                    {day}
                  </div>
                ))}

                {/* Padding cells before 1st of month */}
                {Array.from({ length: monthCalendarData.paddingBefore }).map((_, i) => (
                  <div key={`pad-prev-${i}`} className="h-28 rounded-lg bg-steam-darkest/20 border border-steam-border/10 opacity-30" />
                ))}

                {/* Days of Month */}
                {monthCalendarData.daysInMonth.map((dateObj, dayIdx) => {
                  const dateStr = formatDateStr(dateObj);
                  const isToday = dateStr === todayStr;
                  const isPast = dateStr < todayStr;

                  if (isPast) {
                    return (
                      <div
                        key={dateStr}
                        className="h-28 p-2 rounded-lg bg-steam-darkest/10 border border-transparent opacity-0 pointer-events-none select-none"
                      />
                    );
                  }

                  const dayNum = dateObj.getDate();
                  const daySlots = monthlyOverlapMatrix[dayIdx] || [];
                  const fullSquadBlocks = daySlots.filter((s) => s.isFullSquad).length;
                  const partialBlocks = daySlots.filter((s) => s.count > 0).length;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        setModalDateStr(dateStr);
                        setIsEventModalOpen(true);
                      }}
                      className={`h-28 p-2 rounded-lg border flex flex-col justify-between transition-all ${
                        isToday
                          ? 'bg-steam-accent/15 border-2 border-steam-accent shadow-glow-accent ring-1 ring-steam-accent cursor-pointer hover:scale-[1.02]'
                          : fullSquadBlocks > 0
                          ? 'bg-emerald-950/40 border-emerald-500/50 hover:bg-emerald-900/50 cursor-pointer hover:scale-[1.02]'
                          : partialBlocks > 0
                          ? 'bg-steam-darkest/90 border-steam-border/60 hover:border-steam-accent/50 cursor-pointer hover:scale-[1.02]'
                          : 'bg-steam-darkest/40 border-steam-border/20 hover:border-steam-border/40 cursor-pointer hover:scale-[1.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-extrabold ${isToday ? 'text-steam-accent' : 'text-steam-text'}`}>
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-steam-accent text-steam-darkest font-bold">
                            TODAY
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {fullSquadBlocks > 0 ? (
                          <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate">
                            {fullSquadBlocks} Full Squad
                          </div>
                        ) : partialBlocks > 0 ? (
                          <div className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 truncate">
                            {partialBlocks} Partial
                          </div>
                        ) : (
                          <div className="text-[10px] text-steam-muted/50 truncate">No Overlap</div>
                        )}
                      </div>

                      <div className="text-[9px] text-steam-muted text-right font-mono">
                        + Schedule
                      </div>
                    </div>
                  );
                })}

                {/* Padding cells after end of month */}
                {Array.from({ length: monthCalendarData.paddingAfter }).map((_, i) => (
                  <div key={`pad-next-${i}`} className="h-28 rounded-lg bg-steam-darkest/20 border border-steam-border/10 opacity-30" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: EDIT AVAILABILITY */}
      {activeSubTab === 'edit' && (
        <div className="p-4 rounded-xl bg-steam-card border border-steam-border/60 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-steam-border/40 pb-4">
            <div>
              <h3 className="font-bold text-sm text-steam-text">Edit Player Availability Grid</h3>
              <p className="text-xs text-steam-muted">Click any upcoming 4-hour block to toggle availability. Past dates cannot be modified.</p>
            </div>

            <div className="flex items-center space-x-3">
              <label className="text-xs font-semibold text-steam-muted">Editing Player:</label>
              <select
                value={activeSlotId}
                onChange={(e) => setActiveSlotId(e.target.value)}
                className="bg-steam-darkest border border-steam-border/80 text-xs text-steam-text px-3 py-1.5 rounded-lg focus:outline-none focus:border-steam-accent cursor-pointer font-bold"
              >
                {activeSlots.map((s) => (
                  <option key={s.id} value={s.id} className="bg-steam-card text-steam-text">
                    {s.personaName || s.input || `Player ${s.id}`}
                  </option>
                ))}
              </select>
              <button
                onClick={handlePushToCloud}
                disabled={isCloudSyncing}
                className="px-3 py-1.5 bg-steam-accent hover:bg-steam-accentHover text-steam-darkest text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow"
                title="Push your updated availability grid to squad cloud (Manual Sync)"
              >
                <Cloud className="w-4 h-4" />
                <span>Push to Cloud</span>
              </button>
            </div>
          </div>

          {/* Quick Availability Controls with Scope Filters */}
          <div className="bg-steam-darkest p-4 rounded-xl border border-steam-border/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-steam-text flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-steam-accent" />
                <span>Quick Availability Controls</span>
              </span>

              {/* Scope Filters */}
              <div className="flex items-center bg-steam-card p-1 rounded-lg border border-steam-border/60 text-xs">
                <button
                  onClick={() => setQuickScope('all')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                    quickScope === 'all'
                      ? 'bg-steam-accent text-steam-darkest shadow-glow-accent'
                      : 'text-steam-muted hover:text-steam-text'
                  }`}
                >
                  All Days
                </button>
                <button
                  onClick={() => setQuickScope('weekdays')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                    quickScope === 'weekdays'
                      ? 'bg-steam-accent text-steam-darkest shadow-glow-accent'
                      : 'text-steam-muted hover:text-steam-text'
                  }`}
                >
                  Weekdays Only (Mon-Fri)
                </button>
                <button
                  onClick={() => setQuickScope('weekends')}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                    quickScope === 'weekends'
                      ? 'bg-steam-accent text-steam-darkest shadow-glow-accent'
                      : 'text-steam-muted hover:text-steam-text'
                  }`}
                >
                  Weekends Only (Sat-Sun)
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setBulkAllDayAvailability(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Available All Day</span>
              </button>
              <button
                onClick={() => setBulkAllDayAvailability(false)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Day</span>
              </button>

              <div className="h-4 w-[1px] bg-steam-border/60 mx-1 hidden sm:block" />

              {/* Block Specific Controls */}
              {SCHEDULE_BLOCKS.map((block) => (
                <button
                  key={block.id}
                  onClick={() => setBulkBlockAvailability(block.id, true)}
                  className="px-2.5 py-1.5 bg-steam-card hover:bg-steam-cardHover border border-steam-border/60 text-steam-text text-xs font-semibold rounded-lg transition flex items-center gap-1"
                  title={`Mark ${block.label} free for future ${quickScope}`}
                >
                  {BLOCK_ICONS[block.id]}
                  <span>Available all {block.label}</span>
                </button>
              ))}
            </div>

            {/* Recurring Pattern Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-steam-border/40">
              <span className="text-xs font-bold text-steam-text flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-steam-accent" />
                <span>Default Weekly Recurring Pattern</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveWeeklyPattern}
                  className="px-3 py-1 bg-steam-card hover:bg-steam-cardHover border border-steam-border/80 text-steam-accent text-xs font-bold rounded-lg transition flex items-center gap-1"
                  title="Save your current week's availability grid as your default recurring weekly pattern"
                >
                  <span>💾 Save Current Week as Default</span>
                </button>
                <button
                  onClick={handleApplyWeeklyPattern}
                  className="px-3 py-1 bg-steam-accent hover:bg-steam-accentHover text-steam-darkest text-xs font-bold rounded-lg transition shadow flex items-center gap-1"
                  title="Apply your saved default recurring pattern to all upcoming dates in view"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Apply Default Weekly Pattern</span>
                </button>
              </div>
            </div>
          </div>

          {/* Editable Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-steam-border/60 text-xs text-steam-muted">
                  <th className="py-2.5 px-3 min-w-[140px]">Block</th>
                  {displayWeekDates.map((dateObj) => {
                    const dateStr = formatDateStr(dateObj);
                    const isToday = dateStr === todayStr;

                    return (
                      <th
                        key={dateStr}
                        className={`py-2.5 px-3 min-w-[130px] text-center rounded-t-lg transition-all ${
                          isToday
                            ? 'bg-steam-accent/20 border-t-2 border-steam-accent text-steam-accent font-bold shadow-glow-accent'
                            : 'text-steam-text'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span>{formatDateLabel(dateObj)}</span>
                          {isToday && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-steam-accent text-steam-darkest font-extrabold uppercase tracking-wider mt-0.5">
                              TODAY
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-steam-border/30">
                {SCHEDULE_BLOCKS.map((block) => (
                  <tr key={block.id} className="hover:bg-steam-cardHover/30">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-steam-text">
                        {BLOCK_ICONS[block.id]}
                        <span>{block.label}</span>
                      </div>
                      <div className="text-[10px] text-steam-muted font-mono">{block.timeRange}</div>
                    </td>
                    {displayWeekDates.map((dateObj) => {
                      const dateStr = formatDateStr(dateObj);
                      const isToday = dateStr === todayStr;
                      const dayName = getDayNameFromDateStr(dateStr);
                      const keyWithDate = `${dateStr}-${block.id}`;
                      const keyWithDay = `${dayName}-${block.id}`;
                      const isChecked = !!(currentGrid[keyWithDate] || currentGrid[keyWithDay]);

                      return (
                        <td key={dateStr} className={`p-2 text-center ${isToday ? 'bg-steam-accent/5' : ''}`}>
                          <button
                            type="button"
                            onClick={() => handleToggleCell(dateStr, block.id)}
                            className={`w-full p-3 rounded-lg border text-xs font-bold transition-all ${
                              isChecked
                                ? 'bg-steam-accent text-steam-darkest border-steam-accent shadow-glow-accent hover:opacity-90'
                                : 'bg-steam-darkest hover:bg-steam-cardHover text-steam-muted border-steam-border/40'
                            } ${isToday ? 'ring-1 ring-steam-accent/40' : ''}`}
                          >
                            {isChecked ? 'FREE' : 'BUSY'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SCHEDULED EVENTS */}
      {activeSubTab === 'events' && (
        <div className="p-4 rounded-xl bg-steam-card border border-steam-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-steam-text">Scheduled Game Night Sessions</h3>
            <button
              onClick={() => setIsEventModalOpen(true)}
              className="px-3 py-1.5 bg-steam-accent hover:bg-steam-accentHover text-steam-darkest font-bold text-xs rounded-lg shadow transition"
            >
              + Add Game Session
            </button>
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingEvents.map((evt) => (
                <div key={evt.id} className="p-4 rounded-xl bg-steam-darkest border border-steam-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-steam-accent font-bold">{evt.dayName} ({evt.startTimeLabel} - {evt.endTimeLabel})</span>
                      <h4 className="text-sm font-bold text-steam-text">{evt.gameName}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      className="p-1.5 rounded hover:bg-rose-950/60 text-steam-muted hover:text-rose-400 transition"
                      title="Remove Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs text-steam-muted">
                    <strong>Attending:</strong> {evt.attendingNames.join(', ')}
                  </div>

                  {evt.note && (
                    <div className="text-xs italic text-steam-muted/80 bg-steam-card p-2 rounded border border-steam-border/40">
                      "{evt.note}"
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-2 border-t border-steam-border/40">
                    <a
                      href={generateGoogleCalendarUrl(evt)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-steam-card hover:bg-steam-cardHover border border-steam-border/60 rounded text-xs text-steam-text font-semibold flex items-center space-x-1"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-steam-accent" />
                      <span>Google Calendar</span>
                    </a>
                    <button
                      onClick={() => {
                        const payload = generateIcsPayload(evt);
                        const blob = new Blob([payload], { type: 'text/calendar' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${evt.gameName}_gamenight.ics`;
                        a.click();
                        showToast('Downloaded .ics calendar file');
                      }}
                      className="px-3 py-1.5 bg-steam-card hover:bg-steam-cardHover border border-steam-border/60 rounded text-xs text-steam-text font-semibold flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5 text-steam-accent" />
                      <span>Download .ics</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generateDiscordInviteText(evt));
                        showToast('Copied Discord invite text!');
                      }}
                      className="px-3 py-1.5 bg-steam-card hover:bg-steam-cardHover border border-steam-border/60 rounded text-xs text-steam-text font-semibold flex items-center space-x-1"
                    >
                      <Copy className="w-3.5 h-3.5 text-steam-accent" />
                      <span>Discord Invite</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-steam-muted space-y-2">
              <p>No Game Night sessions scheduled yet.</p>
              <button
                onClick={() => setIsEventModalOpen(true)}
                className="px-4 py-2 bg-steam-accent text-steam-darkest font-bold rounded-lg shadow"
              >
                Schedule First Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: SQUAD SYNC & JSON IMPORT/EXPORT */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-steam-card border border-steam-border/80 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-steam-border/60 pb-3">
              <h3 className="text-base font-bold text-steam-text flex items-center gap-2">
                <Share2 className="w-5 h-5 text-steam-accent" />
                <span>Sync Squad Availability Between Users</span>
              </h3>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="text-steam-muted hover:text-steam-text text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-steam-muted">
              Since Steam Squad Sync is running locally, you can easily share and sync schedules across 4 players using file export/import or JSON payload copying!
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-steam-darkest border border-steam-border/60 space-y-2">
                <span className="text-xs font-bold text-steam-text">1. File Sharing (Recommended)</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportJson}
                    className="flex-1 py-2 bg-steam-accent hover:bg-steam-accentHover text-steam-darkest text-xs font-bold rounded flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Schedule (.json)</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 bg-steam-card hover:bg-steam-cardHover border border-steam-border text-steam-text text-xs font-bold rounded flex items-center justify-center gap-1.5 transition"
                  >
                    <Upload className="w-4 h-4 text-steam-accent" />
                    <span>Import Schedule File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportJsonFile}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-steam-darkest border border-steam-border/60 space-y-2">
                <span className="text-xs font-bold text-steam-text">2. Copy & Paste JSON Payload</span>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={handleCopyJsonPayload}
                    className="w-full py-1.5 bg-steam-card hover:bg-steam-cardHover border border-steam-border text-steam-text text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-steam-accent" />
                    <span>Copy My Schedule Payload</span>
                  </button>
                </div>
                <textarea
                  value={jsonImportText}
                  onChange={(e) => setJsonImportText(e.target.value)}
                  placeholder="Paste JSON schedule payload from teammate here..."
                  className="w-full bg-steam-card border border-steam-border/60 rounded p-2 text-xs text-steam-text font-mono h-20 focus:outline-none focus:border-steam-accent"
                />
                <button
                  onClick={handleImportJsonText}
                  disabled={!jsonImportText.trim()}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded transition"
                >
                  Import & Merge Payload
                </button>
              </div>

              {/* 3. Realtime Squad Cloud Sync */}
              <div className="p-3.5 rounded-lg bg-steam-darkest border border-steam-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-steam-text flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-steam-accent" />
                    <span>3. Realtime Squad Cloud Sync</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-steam-accent/20 text-steam-accent font-semibold">
                    1-Click Room Code Sync
                  </span>
                </div>

                {/* Squad Room Code Input (Prominent) */}
                <div>
                  <label className="text-xs font-bold text-steam-text block mb-1">Squad Room Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="982104"
                      className="flex-1 bg-steam-card border border-steam-border/80 rounded-lg px-3 py-2 text-sm text-steam-accent focus:outline-none focus:border-steam-accent font-mono tracking-widest font-extrabold uppercase shadow-inner"
                    />
                    <button
                      onClick={handlePushToCloud}
                      disabled={isCloudSyncing}
                      className="px-4 py-2 bg-steam-accent hover:bg-steam-accentHover disabled:opacity-40 text-steam-darkest text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow"
                      title="Upload your availability & shared games to this squad room code"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>Push to Cloud</span>
                    </button>
                    <button
                      onClick={handlePullFromCloud}
                      disabled={isCloudSyncing}
                      className="px-4 py-2 bg-steam-card hover:bg-steam-cardHover border border-steam-border text-steam-text text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow"
                      title="Download latest availability & shared games from squad room code"
                    >
                      <Download className="w-4 h-4 text-steam-accent" />
                      <span>Pull Cloud</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-steam-muted mt-1.5">
                    Teammates type the same room code (e.g. <span className="text-steam-accent font-mono font-bold">SQUAD-9821</span>) to push & pull live schedules and game data.
                  </p>
                </div>

                {/* Advanced Supabase Config Toggle */}
                <div className="pt-2 border-t border-steam-border/40">
                  <button
                    onClick={() => setShowAdvancedDbConfig(!showAdvancedDbConfig)}
                    className="text-[11px] font-semibold text-steam-muted hover:text-steam-text flex items-center gap-1 transition"
                  >
                    <span>{showAdvancedDbConfig ? '▲ Hide Advanced Database Credentials' : '⚙️ Advanced Database Credentials (Optional)'}</span>
                  </button>

                  {showAdvancedDbConfig && (
                    <div className="mt-2.5 p-3 rounded bg-steam-card/60 border border-steam-border/40 space-y-2 animate-fadeIn">
                      <div>
                        <label className="text-[10px] font-bold text-steam-muted block mb-0.5">Supabase Project URL</label>
                        <input
                          type="text"
                          value={supabaseUrl}
                          onChange={(e) => setSupabaseUrl(e.target.value)}
                          placeholder="https://xyz.supabase.co"
                          className="w-full bg-steam-darkest border border-steam-border/60 rounded p-1.5 text-xs text-steam-text focus:outline-none focus:border-steam-accent font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-steam-muted block mb-0.5">Supabase Anon Key</label>
                        <input
                          type="password"
                          value={supabaseAnonKey}
                          onChange={(e) => setSupabaseAnonKey(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1Ni..."
                          className="w-full bg-steam-darkest border border-steam-border/60 rounded p-1.5 text-xs text-steam-text focus:outline-none focus:border-steam-accent font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE GAME NIGHT */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-steam-card border border-steam-border/80 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-steam-border/60 pb-3">
              <h3 className="text-base font-bold text-steam-text flex items-center space-x-2">
                <Plus className="w-5 h-5 text-steam-accent" />
                <span>Schedule Squad Game Night</span>
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-steam-muted hover:text-steam-text text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-steam-muted block mb-1">Select Game</label>
                <select
                  value={modalGameName}
                  onChange={(e) => {
                    setModalGameName(e.target.value);
                    const found = readyGames.find(g => g.name === e.target.value);
                    if (found) setModalAppId(found.appid);
                  }}
                  className="w-full bg-steam-darkest border border-steam-border/60 rounded-lg px-3 py-2 text-xs text-steam-text focus:outline-none focus:border-steam-accent cursor-pointer font-bold"
                >
                  <option value="">-- Choose Ready to Play Game --</option>
                  {readyGames.map((g) => (
                    <option key={g.appid} value={g.name} className="bg-steam-card text-steam-text">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-steam-muted block mb-1">Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={modalDateStr}
                    onChange={(e) => setModalDateStr(e.target.value)}
                    className="w-full bg-steam-darkest border border-steam-border/60 rounded-lg px-3 py-2 text-xs text-steam-text focus:outline-none focus:border-steam-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-steam-muted block mb-1">Time Block</label>
                  <select
                    value={modalTimeRange}
                    onChange={(e) => setModalTimeRange(e.target.value)}
                    className="w-full bg-steam-darkest border border-steam-border/60 rounded-lg px-3 py-2 text-xs text-steam-text focus:outline-none focus:border-steam-accent cursor-pointer"
                  >
                    {SCHEDULE_BLOCKS.map((b) => (
                      <option key={b.id} value={b.timeRange} className="bg-steam-card text-steam-text">
                        {b.label} ({b.timeRange})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-steam-muted block mb-1">Notes / Message (Optional)</label>
                <textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="e.g. Bring voice chat on Discord!"
                  className="w-full bg-steam-darkest border border-steam-border/60 rounded-lg px-3 py-2 text-xs text-steam-text focus:outline-none focus:border-steam-accent resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-steam-border/40">
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="px-4 py-2 bg-steam-darkest hover:bg-steam-cardHover border border-steam-border/60 text-steam-muted text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                className="px-4 py-2 bg-steam-accent hover:bg-steam-accentHover text-steam-darkest font-bold text-xs rounded-lg shadow-glow-accent"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
