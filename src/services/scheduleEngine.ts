import { GameNightEvent, HourlyOverlapSlot, PlayerAvailability, SteamUserSlot } from '../types/steam';

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
}

export function computeScheduleOverlap(
  schedules: Record<string, PlayerAvailability>,
  activeSlots: SteamUserSlot[]
): HourlyOverlapSlot[][] {
  const validSlots = activeSlots.filter(s => s.input.trim().length > 0 || s.personaName);
  const activeCount = validSlots.length;

  // Build 7 x 24 grid
  const matrix: HourlyOverlapSlot[][] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayName = DAYS_OF_WEEK[dayIndex];
    const dayRow: HourlyOverlapSlot[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const slotKey = `${dayName}-${hour}`;
      const availableSteamIds: string[] = [];
      const availableNames: string[] = [];
      const missingNames: string[] = [];

      validSlots.forEach(slot => {
        const pSched = schedules[slot.id] || schedules[slot.steamId || ''];
        const name = slot.personaName || slot.input || `Player ${slot.id}`;
        if (pSched && pSched.grid && pSched.grid[slotKey]) {
          availableSteamIds.push(slot.id);
          availableNames.push(name);
        } else {
          missingNames.push(name);
        }
      });

      const count = availableSteamIds.length;
      const percentage = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;
      const isFullSquad = activeCount > 0 && count === activeCount;

      dayRow.push({
        day: dayIndex,
        dayName,
        hour,
        timeLabel: formatHourLabel(hour),
        availableSteamIds,
        availableNames,
        missingNames,
        count,
        percentage,
        isFullSquad,
      });
    }

    matrix.push(dayRow);
  }

  return matrix;
}

export interface RecommendedWindow {
  dayName: string;
  startHour: number;
  endHour: number;
  startLabel: string;
  endLabel: string;
  durationHours: number;
  availableNames: string[];
  missingNames: string[];
  count: number;
  percentage: number;
  isFullSquad: boolean;
}

export function findBestSquadWindows(matrix: HourlyOverlapSlot[][]): RecommendedWindow[] {
  const windows: RecommendedWindow[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayRow = matrix[dayIndex];
    let currentStart: number | null = null;
    let currentCount = 0;
    let currentAvailable: string[] = [];
    let currentMissing: string[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const slot = dayRow[hour];

      // Consider window active if at least 50% or 2+ players free
      if (slot.count >= 2) {
        if (currentStart === null) {
          currentStart = hour;
          currentCount = slot.count;
          currentAvailable = slot.availableNames;
          currentMissing = slot.missingNames;
        } else if (slot.count !== currentCount) {
          // Finish previous block and start new block
          const duration = hour - currentStart;
          if (duration >= 1) {
            windows.push({
              dayName: DAYS_OF_WEEK[dayIndex],
              startHour: currentStart,
              endHour: hour,
              startLabel: formatHourLabel(currentStart),
              endLabel: formatHourLabel(hour),
              durationHours: duration,
              availableNames: currentAvailable,
              missingNames: currentMissing,
              count: currentCount,
              percentage: Math.round((currentCount / Math.max(1, currentAvailable.length + currentMissing.length)) * 100),
              isFullSquad: currentMissing.length === 0,
            });
          }
          currentStart = hour;
          currentCount = slot.count;
          currentAvailable = slot.availableNames;
          currentMissing = slot.missingNames;
        }
      } else {
        if (currentStart !== null) {
          const duration = hour - currentStart;
          if (duration >= 1) {
            windows.push({
              dayName: DAYS_OF_WEEK[dayIndex],
              startHour: currentStart,
              endHour: hour,
              startLabel: formatHourLabel(currentStart),
              endLabel: formatHourLabel(hour),
              durationHours: duration,
              availableNames: currentAvailable,
              missingNames: currentMissing,
              count: currentCount,
              percentage: Math.round((currentCount / Math.max(1, currentAvailable.length + currentMissing.length)) * 100),
              isFullSquad: currentMissing.length === 0,
            });
          }
          currentStart = null;
        }
      }
    }

    if (currentStart !== null) {
      const duration = 24 - currentStart;
      windows.push({
        dayName: DAYS_OF_WEEK[dayIndex],
        startHour: currentStart,
        endHour: 24,
        startLabel: formatHourLabel(currentStart),
        endLabel: '12:00 AM (Next Day)',
        durationHours: duration,
        availableNames: currentAvailable,
        missingNames: currentMissing,
        count: currentCount,
        percentage: Math.round((currentCount / Math.max(1, currentAvailable.length + currentMissing.length)) * 100),
        isFullSquad: currentMissing.length === 0,
      });
    }
  }

  // Sort by full squad status first, then highest percentage, then longest duration
  return windows.sort((a, b) => {
    if (a.isFullSquad !== b.isFullSquad) return a.isFullSquad ? -1 : 1;
    if (a.count !== b.count) return b.count - a.count;
    return b.durationHours - a.durationHours;
  });
}

export function generateGoogleCalendarUrl(event: {
  gameName: string;
  startIso: string;
  endIso: string;
  details?: string;
}): string {
  const formatIso = (iso: string) => iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const title = encodeURIComponent(`🎮 Steam Squad Game Night: ${event.gameName}`);
  const dates = `${formatIso(event.startIso)}/${formatIso(event.endIso)}`;
  const details = encodeURIComponent(event.details || `Steam Squad Sync Game Night Session for ${event.gameName}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

export function generateIcsPayload(event: {
  gameName: string;
  startIso: string;
  endIso: string;
  details?: string;
}): string {
  const formatIso = (iso: string) => iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Steam Squad Sync//Gaming Scheduler//EN',
    'BEGIN:VEVENT',
    `SUMMARY:🎮 Steam Squad Game Night: ${event.gameName}`,
    `DTSTART:${formatIso(event.startIso)}`,
    `DTEND:${formatIso(event.endIso)}`,
    `DESCRIPTION:${event.details || 'Squad Gaming Session'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function generateDiscordInviteText(event: GameNightEvent): string {
  const attendees = event.attendingNames.length > 0 ? event.attendingNames.join(', ') : 'Squad Members';
  return `🎮 **STEAM SQUAD GAME NIGHT** 🎮\n\n📌 **Game:** ${event.gameName}\n📅 **When:** ${event.dayName} (${event.startTimeLabel} - ${event.endTimeLabel})\n👥 **Attending:** ${attendees}\n\n*Synced via Steam Squad Sync*`;
}
