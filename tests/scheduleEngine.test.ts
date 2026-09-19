import { computeScheduleOverlap, findBestSquadWindows, formatHourLabel, generateDiscordInviteText, generateGoogleCalendarUrl, generateIcsPayload } from '../src/services/scheduleEngine';
import { PlayerAvailability, SteamUserSlot } from '../src/types/steam';

console.log('--- RUNNING SCHEDULE ENGINE VERIFICATION TESTS ---');

// 1. Test Hour Formatting
console.log('\n[1] Testing Hour Formatting...');
if (formatHourLabel(0) !== '12:00 AM') throw new Error(`Expected 12:00 AM, got ${formatHourLabel(0)}`);
if (formatHourLabel(12) !== '12:00 PM') throw new Error(`Expected 12:00 PM, got ${formatHourLabel(12)}`);
if (formatHourLabel(20) !== '8:00 PM') throw new Error(`Expected 8:00 PM, got ${formatHourLabel(20)}`);
console.log('✓ All hour formatting test cases passed!');

// 2. Test 4-Player Squad Availability Overlap Matrix
console.log('\n[2] Testing 4-Player Squad Availability Overlap Matrix...');
const activeSlots: SteamUserSlot[] = [
  { id: 'slot-1', input: '76561198000000001', personaName: 'GabeN' },
  { id: 'slot-2', input: '76561198000000002', personaName: 'ViperStrike' },
  { id: 'slot-3', input: '76561198000000003', personaName: 'PixelHealer' },
  { id: 'slot-4', input: '76561198000000004', personaName: 'IronVanguard' },
];

const mockSchedules: Record<string, PlayerAvailability> = {
  'slot-1': { slotId: 'slot-1', timezone: 'America/Los_Angeles', grid: { 'Fri-20': true, 'Fri-21': true, 'Fri-22': true } },
  'slot-2': { slotId: 'slot-2', timezone: 'America/Los_Angeles', grid: { 'Fri-20': true, 'Fri-21': true, 'Fri-22': true } },
  'slot-3': { slotId: 'slot-3', timezone: 'America/Los_Angeles', grid: { 'Fri-20': true, 'Fri-21': true, 'Fri-22': true } },
  'slot-4': { slotId: 'slot-4', timezone: 'America/Los_Angeles', grid: { 'Fri-20': true, 'Fri-21': true, 'Fri-22': false } },
};

const matrix = computeScheduleOverlap(mockSchedules, activeSlots);

// Friday index is 4 (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4)
const fri20 = matrix[4][20];
const fri22 = matrix[4][22];

console.log(`- Friday 8:00 PM (Hour 20): Available ${fri20.count}/4 (${fri20.availableNames.join(', ')})`);
if (fri20.count !== 4 || !fri20.isFullSquad) throw new Error('Expected 4/4 full squad available at Fri-20!');

console.log(`- Friday 10:00 PM (Hour 22): Available ${fri22.count}/4 (Missing: ${fri22.missingNames.join(', ')})`);
if (fri22.count !== 3 || fri22.isFullSquad) throw new Error('Expected 3/4 near overlap at Fri-22!');

console.log('✓ Squad availability overlap matrix verified successfully!');

// 3. Test Best Squad Windows Detection
console.log('\n[3] Testing Best Squad Windows Detection...');
const windows = findBestSquadWindows(matrix);
console.log(`- Detected ${windows.length} recommended gaming windows.`);
console.log(`- Top Window: ${windows[0].dayName} (${windows[0].startLabel} - ${windows[0].endLabel}) -> Full Squad: ${windows[0].isFullSquad}`);

if (windows.length === 0 || !windows[0].isFullSquad) {
  throw new Error('Best squad window detection failed!');
}
console.log('✓ Best squad windows detection verified successfully!');

// 4. Test Calendar Export & Discord Link Generation
console.log('\n[4] Testing Calendar & Discord Link Generation...');
const testEvent = {
  id: 'evt-1',
  appid: 553850,
  gameName: 'HELLDIVERS 2',
  dayName: 'Friday',
  dateString: '2026-09-25',
  startTimeLabel: '8:00 PM',
  endTimeLabel: '11:00 PM',
  startIso: '2026-09-25T20:00:00.000Z',
  endIso: '2026-09-25T23:00:00.000Z',
  attendingNames: ['GabeN', 'ViperStrike', 'PixelHealer', 'IronVanguard'],
  createdAt: Date.now(),
};

const gCalUrl = generateGoogleCalendarUrl(testEvent);
const icsPayload = generateIcsPayload(testEvent);
const discordText = generateDiscordInviteText(testEvent);

if (!gCalUrl.includes('HELLDIVERS') || !gCalUrl.includes('calendar.google.com')) {
  throw new Error('Google Calendar URL generation failed!');
}
if (!icsPayload.includes('BEGIN:VCALENDAR') || !icsPayload.includes('HELLDIVERS')) {
  throw new Error('ICS payload generation failed!');
}
if (!discordText.includes('HELLDIVERS 2') || !discordText.includes('GabeN')) {
  throw new Error('Discord invite text generation failed!');
}

console.log('✓ Calendar URL & Discord invite formatting verified!');

console.log('\n========================================');
console.log('ALL SCHEDULE ENGINE TESTS PASSED (100%)');
console.log('========================================\n');
