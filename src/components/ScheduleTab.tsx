import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Plus, 
  Download, 
  ExternalLink, 
  Copy, 
  Trash2, 
  Globe, 
  CheckCircle2
} from 'lucide-react';
import { GameNightEvent, PlayerAvailability, SquadGameAnalysis, SteamUserSlot } from '../types/steam';
import { StorageService } from '../services/storage';
import { DAYS_OF_WEEK, computeScheduleOverlap, findBestSquadWindows, formatHourLabel, generateDiscordInviteText, generateGoogleCalendarUrl, generateIcsPayload } from '../services/scheduleEngine';

interface ScheduleTabProps {
  slots: SteamUserSlot[];
  readyGames: SquadGameAnalysis[];
  nearOverlapGames: SquadGameAnalysis[];
}

const COMMON_TIMEZONES = [
  { label: 'US Pacific (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'US Mountain (MST/MDT)', value: 'America/Denver' },
  { label: 'US Central (CST/CDT)', value: 'America/Chicago' },
  { label: 'US Eastern (EST/EDT)', value: 'America/New_York' },
  { label: 'London / UK (GMT/BST)', value: 'Europe/London' },
  { label: 'Central Europe (CET/CEST)', value: 'Europe/Berlin' },
  { label: 'Tokyo / Japan (JST)', value: 'Asia/Tokyo' },
  { label: 'Sydney / Australia (AEST)', value: 'Australia/Sydney' },
];

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ slots, readyGames, nearOverlapGames }) => {
  const activeSlots = useMemo(() => slots.filter(s => s.input.trim().length > 0 || s.personaName), [slots]);

  const [schedules, setSchedules] = useState<Record<string, PlayerAvailability>>(() => {
    return StorageService.getSquadSchedules();
  });

  const [events, setEvents] = useState<GameNightEvent[]>(() => {
    return StorageService.getGameNightEvents();
  });

  const [activeSlotId, setActiveSlotId] = useState<string>(activeSlots[0]?.id || 'slot-1');
  const [activeSubTab, setActiveSubTab] = useState<'heatmap' | 'edit' | 'events'>('heatmap');
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  );

  // Modal State for Game Night Event Creation
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [modalGameName, setModalGameName] = useState('');
  const [modalAppId, setModalAppId] = useState<number>(0);
  const [modalDayName, setModalDayName] = useState('Friday');
  const [modalStartTime, setModalStartTime] = useState('20:00');
  const [modalEndTime, setModalEndTime] = useState('23:00');
  const [modalNote, setModalNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute Heatmap Matrix
  const overlapMatrix = useMemo(() => {
    return computeScheduleOverlap(schedules, activeSlots);
  }, [schedules, activeSlots]);

  // Compute Recommended Windows
  const recommendedWindows = useMemo(() => {
    return findBestSquadWindows(overlapMatrix);
  }, [overlapMatrix]);

  // Current Player's Grid
  const currentGrid = useMemo(() => {
    return schedules[activeSlotId]?.grid || {};
  }, [schedules, activeSlotId]);

  // Toggle hour slot for active player
  const handleToggleSlot = (dayName: string, hour: number) => {
    const key = `${dayName}-${hour}`;
    const updatedGrid = { ...currentGrid, [key]: !currentGrid[key] };
    const updatedPlayerSched: PlayerAvailability = {
      slotId: activeSlotId,
      personaName: activeSlots.find(s => s.id === activeSlotId)?.personaName,
      timezone: selectedTimezone,
      grid: updatedGrid,
    };

    const newSchedules = { ...schedules, [activeSlotId]: updatedPlayerSched };
    setSchedules(newSchedules);
    StorageService.savePlayerSchedule(activeSlotId, updatedPlayerSched);
  };

  // Presets
  const applyPreset = (type: 'evenings' | 'weekends' | 'clear') => {
    const newGrid: Record<string, boolean> = { ...currentGrid };

    if (type === 'clear') {
      DAYS_OF_WEEK.forEach(day => {
        for (let h = 0; h < 24; h++) {
          newGrid[`${day}-${h}`] = false;
        }
      });
    } else if (type === 'evenings') {
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
        for (let h = 19; h <= 23; h++) {
          newGrid[`${day}-${h}`] = true;
        }
      });
    } else if (type === 'weekends') {
      ['Sat', 'Sun'].forEach(day => {
        for (let h = 14; h <= 23; h++) {
          newGrid[`${day}-${h}`] = true;
        }
      });
    }

    const updatedPlayerSched: PlayerAvailability = {
      slotId: activeSlotId,
      personaName: activeSlots.find(s => s.id === activeSlotId)?.personaName,
      timezone: selectedTimezone,
      grid: newGrid,
    };

    const newSchedules = { ...schedules, [activeSlotId]: updatedPlayerSched };
    setSchedules(newSchedules);
    StorageService.savePlayerSchedule(activeSlotId, updatedPlayerSched);
    showToast(`Preset "${type}" applied to player schedule!`);
  };

  // Open Event Modal
  const openCreateEventModal = (gameName?: string, appid?: number, dayName?: string, startHour?: number) => {
    const defaultGame = gameName || readyGames[0]?.name || nearOverlapGames[0]?.name || 'Co-Op Squad Session';
    const defaultAppId = appid || readyGames[0]?.appid || 0;
    
    setModalGameName(defaultGame);
    setModalAppId(defaultAppId);
    if (dayName) setModalDayName(dayName);
    if (startHour !== undefined) {
      const startH = startHour < 10 ? `0${startHour}:00` : `${startHour}:00`;
      const endH = (startHour + 3) <= 23 ? (startHour + 3 < 10 ? `0${startHour + 3}:00` : `${startHour + 3}:00`) : '23:59';
      setModalStartTime(startH);
      setModalEndTime(endH);
    }
    setIsEventModalOpen(true);
  };

  // Save Event
  const handleSaveEvent = () => {
    if (!modalGameName.trim()) return;

    const newEvent: GameNightEvent = {
      id: `evt-${Date.now()}`,
      appid: modalAppId,
      gameName: modalGameName,
      dayName: modalDayName,
      dateString: new Date().toISOString().split('T')[0],
      startTimeLabel: modalStartTime,
      endTimeLabel: modalEndTime,
      startIso: new Date().toISOString(),
      endIso: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      attendingNames: activeSlots.map(s => s.personaName || s.input || `Player ${s.id}`),
      note: modalNote,
      createdAt: Date.now(),
    };

    const updatedEvents = [newEvent, ...events];
    setEvents(updatedEvents);
    StorageService.saveGameNightEvents(updatedEvents);
    setIsEventModalOpen(false);
    setActiveSubTab('events');
    showToast(`Scheduled Game Night for "${modalGameName}"!`);
  };

  // Delete Event
  const handleDeleteEvent = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    StorageService.saveGameNightEvents(updated);
    showToast('Event deleted.');
  };

  // Copy Discord Invite
  const handleCopyDiscord = (evt: GameNightEvent) => {
    const text = generateDiscordInviteText(evt);
    navigator.clipboard.writeText(text);
    showToast('Discord invite text copied to clipboard!');
  };

  // Download ICS File
  const handleDownloadIcs = (evt: GameNightEvent) => {
    const icsData = generateIcsPayload(evt);
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${evt.gameName.replace(/[^a-z0-9]/gi, '_')}_GameNight.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center space-x-3 border border-emerald-400 animate-slideUp">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/40 p-6 rounded-xl border border-slate-700/60 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Squad Availability & Gaming Scheduler</h2>
              <p className="text-sm text-slate-400">
                Find 100% squad free windows, set availability, and export Game Night calendar invites.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => openCreateEventModal()}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-950/30 transition border border-emerald-500/40"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Game Night</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('heatmap')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeSubTab === 'heatmap'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Squad Overlap Heatmap</span>
          </button>

          <button
            onClick={() => setActiveSubTab('edit')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeSubTab === 'edit'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Edit My Availability</span>
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeSubTab === 'events'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Scheduled Sessions ({events.length})</span>
          </button>
        </div>

        {/* Timezone Selector */}
        <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Globe className="w-4 h-4 text-indigo-400" />
          <span className="text-xs text-slate-400 font-medium">Timezone:</span>
          <select
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
            className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            {COMMON_TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value} className="bg-slate-900 text-slate-200">
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW 1: HEATMAP OVERLAP VIEW */}
      {activeSubTab === 'heatmap' && (
        <div className="space-y-6">
          {/* Recommended Best Gaming Windows */}
          {recommendedWindows.length > 0 && (
            <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-semibold text-white">Top Recommended Squad Gaming Windows</h3>
                </div>
                <span className="text-xs text-slate-400">Ranked by squad availability %</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedWindows.slice(0, 3).map((win, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition ${
                      win.isFullSquad
                        ? 'bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                        : 'bg-slate-800/40 border-slate-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          win.isFullSquad ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {win.isFullSquad ? '🎯 100% Full Squad' : `🟡 ${win.count} Players Free`}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">{win.durationHours} hrs</span>
                    </div>

                    <h4 className="text-base font-bold text-white mb-1">
                      {win.dayName} ({win.startLabel} – {win.endLabel})
                    </h4>

                    <p className="text-xs text-slate-300 mb-3">
                      Available: <span className="text-emerald-400 font-medium">{win.availableNames.join(', ')}</span>
                      {win.missingNames.length > 0 && (
                        <span> | Missing: <span className="text-rose-400">{win.missingNames.join(', ')}</span></span>
                      )}
                    </p>

                    <button
                      onClick={() => openCreateEventModal(undefined, undefined, win.dayName, win.startHour)}
                      className="w-full py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium rounded border border-indigo-500/40 transition flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Game Night</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Combined Squad Heatmap Grid */}
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="font-semibold text-white">Squad Overlap Heatmap (Weekly View)</h3>
                <p className="text-xs text-slate-400">
                  Green indicates times when all squad members are free simultaneously.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-emerald-500/30 border border-emerald-400"></div>
                  <span className="text-slate-300">Full Squad (4/4)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-amber-500/30 border border-amber-400"></div>
                  <span className="text-slate-300">Near (3/4)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700"></div>
                  <span className="text-slate-400">Partial / None</span>
                </div>
              </div>
            </div>

            {/* Heatmap Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-slate-400 w-24">Time</th>
                    {DAYS_OF_WEEK.map(day => (
                      <th key={day} className="py-2 px-2 text-xs font-semibold text-slate-300">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <tr key={hour} className="hover:bg-slate-800/20">
                      <td className="py-1.5 px-2 text-left font-mono text-xs text-slate-400 whitespace-nowrap">
                        {formatHourLabel(hour)}
                      </td>
                      {DAYS_OF_WEEK.map((dayName, dayIdx) => {
                        const slot = overlapMatrix[dayIdx][hour];
                        const isFull = slot.isFullSquad;
                        const isNear = !isFull && slot.count >= 2;

                        return (
                          <td key={dayName} className="p-1">
                            <div
                              title={`${slot.dayName} ${slot.timeLabel}: ${slot.count} Players Free (${slot.availableNames.join(', ')})`}
                              className={`h-8 rounded flex items-center justify-center text-xs font-bold transition border ${
                                isFull
                                  ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-950/40'
                                  : isNear
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : slot.count > 0
                                  ? 'bg-slate-800/60 border-slate-700/40 text-slate-400'
                                  : 'bg-slate-900/40 border-slate-800/30 text-slate-600'
                              }`}
                            >
                              {slot.count > 0 ? `${slot.count}/${activeSlots.length}` : '-'}
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
        </div>
      )}

      {/* VIEW 2: EDIT MY AVAILABILITY GRID */}
      {activeSubTab === 'edit' && (
        <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-semibold text-white">Edit Player Availability Grid</h3>
              <p className="text-xs text-slate-400">
                Click any slot to toggle your free gaming hours. Your input saves automatically.
              </p>
            </div>

            {/* Active Player Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Editing Profile:</span>
              <select
                value={activeSlotId}
                onChange={(e) => setActiveSlotId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-sm text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {activeSlots.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    {s.personaName || s.input || `Player #${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center space-x-3 gap-y-2 text-xs">
            <span className="text-slate-400 font-medium">Quick Presets:</span>
            <button
              onClick={() => applyPreset('evenings')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
            >
              🌙 Mark Weeknights (7–11 PM)
            </button>
            <button
              onClick={() => applyPreset('weekends')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
            >
              🎮 Mark Weekends (2–11 PM)
            </button>
            <button
              onClick={() => applyPreset('clear')}
              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 rounded border border-rose-800/40 transition"
            >
              🗑️ Clear All
            </button>
          </div>

          {/* Interactive Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr>
                  <th className="py-2 px-2 text-left text-xs font-semibold text-slate-400 w-24">Time</th>
                  {DAYS_OF_WEEK.map(day => (
                    <th key={day} className="py-2 px-2 text-xs font-semibold text-slate-300">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {Array.from({ length: 24 }).map((_, hour) => (
                  <tr key={hour} className="hover:bg-slate-800/20">
                    <td className="py-1.5 px-2 text-left font-mono text-xs text-slate-400 whitespace-nowrap">
                      {formatHourLabel(hour)}
                    </td>
                    {DAYS_OF_WEEK.map(dayName => {
                      const key = `${dayName}-${hour}`;
                      const isFree = Boolean(currentGrid[key]);

                      return (
                        <td key={dayName} className="p-1">
                          <button
                            onClick={() => handleToggleSlot(dayName, hour)}
                            className={`w-full h-8 rounded flex items-center justify-center text-xs font-medium transition border cursor-pointer ${
                              isFree
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/40'
                                : 'bg-slate-900/60 border-slate-800/50 text-slate-600 hover:bg-slate-800/60 hover:text-slate-400'
                            }`}
                          >
                            {isFree ? 'Free' : '-'}
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

      {/* VIEW 3: SCHEDULED GAME NIGHT SESSIONS */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="bg-slate-900/60 p-12 text-center rounded-xl border border-slate-800 space-y-4">
              <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Game Night Sessions Scheduled Yet</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Schedule your next squad gaming session, export calendar pings, or send Discord invites to your friends.
              </p>
              <button
                onClick={() => openCreateEventModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition"
              >
                + Schedule First Game Night
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(evt => (
                <div
                  key={evt.id}
                  className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 shadow-lg space-y-4 relative group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        🎮 Game Night Event
                      </span>
                      <h4 className="text-lg font-bold text-white mt-1">{evt.gameName}</h4>
                      <p className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{evt.dayName} ({evt.startTimeLabel} – {evt.endTimeLabel})</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {evt.attendingNames.length > 0 && (
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold text-slate-400">Squad Attending:</span>{' '}
                      <span className="text-emerald-400">{evt.attendingNames.join(', ')}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                    <a
                      href={generateGoogleCalendarUrl(evt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium rounded border border-indigo-500/40 transition flex items-center space-x-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Google Calendar</span>
                    </a>

                    <button
                      onClick={() => handleDownloadIcs(evt)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .ics</span>
                    </button>

                    <button
                      onClick={() => handleCopyDiscord(evt)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition flex items-center space-x-1"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Copy Discord Invite</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE GAME NIGHT EVENT MODAL */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              <span>Schedule Squad Game Night</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Game Name</label>
                <input
                  type="text"
                  value={modalGameName}
                  onChange={(e) => setModalGameName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Helldivers 2, Valheim..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Day</label>
                  <select
                    value={modalDayName}
                    onChange={(e) => setModalDayName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Time</label>
                  <input
                    type="text"
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="20:00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes / Objectives</label>
                <textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="e.g. Campaign progression, Boss raid, Casual..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg transition"
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
