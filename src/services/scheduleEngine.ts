import { BlockOverlapSlot, GameNightEvent, PlayerAvailability, ScheduleBlockInfo, SteamUserSlot } from '../types/steam';

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SCHEDULE_BLOCKS: ScheduleBlockInfo[] = [
  { id: 'daybreak', label: 'Daybreak', timeRange: '4:00 AM - 8:00 AM', startHour: 4, endHour: 8 },
  { id: 'morning', label: 'Morning', timeRange: '8:00 AM - 12:00 PM', startHour: 8, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', timeRange: '12:00 PM - 4:00 PM', startHour: 12, endHour: 16 },
  { id: 'evening', label: 'Evening', timeRange: '4:00 PM - 8:00 PM', startHour: 16, endHour: 20 },
  { id: 'night', label: 'Night', timeRange: '8:00 PM - 12:00 AM', startHour: 20, endHour: 24 },
  { id: 'graveyard', label: 'Graveyard', timeRange: '12:00 AM - 4:00 AM', startHour: 0, endHour: 4 },
];

export function getStartOfWeek(refDate: Date = new Date()): Date {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getWeekDates(refDate: Date = new Date()): Date[] {
  const start = getStartOfWeek(refDate);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getMonthDates(year: number, monthIndex: number): Date[] {
  const dates: Date[] = [];
  const count = new Date(year, monthIndex + 1, 0).getDate();
  for (let i = 1; i <= count; i++) {
    dates.push(new Date(year, monthIndex, i));
  }
  return dates;
}

export function getMonthCalendarGrid(year: number, monthIndex: number): {
  daysInMonth: Date[];
  paddingBefore: number;
  paddingAfter: number;
} {
  const daysInMonth = getMonthDates(year, monthIndex);
  const firstDay = new Date(year, monthIndex, 1);
  const paddingBefore = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((paddingBefore + daysInMonth.length) / 7) * 7;
  const paddingAfter = totalCells - (paddingBefore + daysInMonth.length);

  return { daysInMonth, paddingBefore, paddingAfter };
}

export function parseLocalDateStr(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getDayNameFromDateStr(dateStr: string): string {
  const dateObj = parseLocalDateStr(dateStr);
  const dayIdx = (dateObj.getDay() + 6) % 7;
  return DAYS_OF_WEEK[dayIdx];
}

export function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(date: Date): string {
  const dayName = DAYS_OF_WEEK[(date.getDay() + 6) % 7];
  const month = date.getMonth() + 1;
  const dayNum = date.getDate();
  return `${dayName} ${month}/${dayNum}`;
}

export function computeBlockScheduleOverlap(
  schedules: Record<string, PlayerAvailability>,
  activeSlots: SteamUserSlot[],
  weekDates: Date[]
): BlockOverlapSlot[][] {
  const validSlots = activeSlots.filter(s => s.input.trim().length > 0 || s.personaName);
  const activeCount = validSlots.length;

  const matrix: BlockOverlapSlot[][] = [];

  for (let dayIdx = 0; dayIdx < weekDates.length; dayIdx++) {
    const dateObj = weekDates[dayIdx];
    const dateStr = formatDateStr(dateObj);
    const dayName = DAYS_OF_WEEK[(dateObj.getDay() + 6) % 7];
    const dayFormatted = formatDateLabel(dateObj);
    const dayRow: BlockOverlapSlot[] = [];

    for (const block of SCHEDULE_BLOCKS) {
      const dateKey = `${dateStr}-${block.id}`;
      const dayKey = `${dayName}-${block.id}`;

      const availableSteamIds: string[] = [];
      const availableNames: string[] = [];
      const missingNames: string[] = [];

      validSlots.forEach((slot, idx) => {
        const cleanSlotNum = slot.id.replace(/^slot-/, '');
        const pSched =
          schedules[slot.id] ||
          (slot.steamId && schedules[slot.steamId]) ||
          (slot.personaName && schedules[slot.personaName]) ||
          schedules[`slot-${cleanSlotNum}`] ||
          schedules[cleanSlotNum] ||
          schedules[`slot-${idx + 1}`] ||
          schedules[`${idx + 1}`] ||
          Object.values(schedules).find(p => p.personaName && slot.personaName && p.personaName.trim().toLowerCase() === slot.personaName.trim().toLowerCase()) ||
          Object.values(schedules).find(p => p.slotId === slot.id || (slot.steamId && p.slotId === slot.steamId));

        const name = slot.personaName || slot.input || `Player ${slot.id}`;
        
        const isAvailable = pSched && pSched.grid && (pSched.grid[dateKey] || pSched.grid[dayKey]);
        if (isAvailable) {
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
        dateStr,
        dayName,
        dayFormatted,
        blockId: block.id,
        blockLabel: block.label,
        timeRange: block.timeRange,
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

export interface RecommendedBlockWindow {
  dateStr: string;
  dayFormatted: string;
  blockLabel: string;
  timeRange: string;
  availableNames: string[];
  missingNames: string[];
  count: number;
  percentage: number;
  isFullSquad: boolean;
}

export function findBestSquadBlockWindows(matrix: BlockOverlapSlot[][]): RecommendedBlockWindow[] {
  const windows: RecommendedBlockWindow[] = [];

  for (const dayRow of matrix) {
    for (const slot of dayRow) {
      if (slot.count >= 2) {
        windows.push({
          dateStr: slot.dateStr,
          dayFormatted: slot.dayFormatted,
          blockLabel: slot.blockLabel,
          timeRange: slot.timeRange,
          availableNames: slot.availableNames,
          missingNames: slot.missingNames,
          count: slot.count,
          percentage: slot.percentage,
          isFullSquad: slot.isFullSquad,
        });
      }
    }
  }

  return windows.sort((a, b) => {
    if (a.isFullSquad !== b.isFullSquad) return a.isFullSquad ? -1 : 1;
    return b.count - a.count;
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

export function exportSquadSchedulesToJson(schedules: Record<string, PlayerAvailability>): string {
  return JSON.stringify(schedules, null, 2);
}

export function parseSquadSchedulesFromJson(jsonStr: string): Record<string, PlayerAvailability> {
  const parsed = JSON.parse(jsonStr);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid schedule format');
  }
  return parsed;
}
