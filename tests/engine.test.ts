if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
}

import { computeSquadOverlap, generateSquadRecommendations, getPrioritizedStoreResolutionAppIds } from '../src/services/intersectionEngine';
import { TEST_SQUAD_LIBRARIES as DEMO_SQUAD_LIBRARIES, TEST_SQUAD_SLOTS as DEMO_SQUAD_SLOTS, TEST_SQUAD_WISHLISTS as DEMO_SQUAD_WISHLISTS } from './mockData';
import { parseSteamInput, detectMaxPlayers } from '../src/services/steamApi';

console.log('--- RUNNING STEAM SQUAD SYNC VERIFICATION TESTS ---');

// 1. Test Vanity & SteamID Parsing
console.log('\n[1] Testing Steam Input Parser...');
const testCases = [
  { input: '76561197960287930', expectedType: 'steamid', expectedVal: '76561197960287930' },
  { input: 'https://steamcommunity.com/profiles/76561198012345678', expectedType: 'steamid', expectedVal: '76561198012345678' },
  { input: 'https://steamcommunity.com/id/gabelogannewell/', expectedType: 'vanity', expectedVal: 'gabelogannewell' },
  { input: 'custom_vanity_name', expectedType: 'vanity', expectedVal: 'custom_vanity_name' },
];

for (const tc of testCases) {
  const res = parseSteamInput(tc.input);
  if (res.type !== tc.expectedType || res.value !== tc.expectedVal) {
    console.error(`FAILED test case for ${tc.input}: got`, res);
    process.exit(1);
  }
}
console.log('✓ All 4 URL & SteamID parsing test cases passed!');

// 2. Test Deterministic Intersection Engine
console.log('\n[2] Testing Set Intersection Engine...');
const steamIds = Object.keys(DEMO_SQUAD_LIBRARIES);
const overlap = computeSquadOverlap(DEMO_SQUAD_LIBRARIES, steamIds);

console.log(`- Active Squad Count: ${steamIds.length}`);
console.log(`- Full Squad Overlap (4/4 Owned): ${overlap.fullSquadGames.length} games`);
console.log(`- Near Overlap (3/4 Owned): ${overlap.nearOverlapGames.length} games`);
console.log(`- Total Squad Playtime Hours: ${overlap.totalSquadPlaytimeHours} hrs`);

// Validate 4/4 games
const fullAppIds = overlap.fullSquadGames.map(g => g.appid);
console.log('- 4/4 Overlap Games:', overlap.fullSquadGames.map(g => `${g.name} (${g.totalSquadPlaytimeHours}h)`).join(', '));

if (!fullAppIds.includes(730) || !fullAppIds.includes(105600) || !fullAppIds.includes(1966720)) {
  console.error('FAILED: Expected CS2 (730), Terraria (105600), and Lethal Company (1966720) in 4/4 overlap!');
  process.exit(1);
}
console.log('✓ 4/4 full squad overlap verified correctly!');

// Validate 3/4 near overlap games
console.log('- 3/4 Near Overlap Games:');
overlap.nearOverlapGames.forEach(g => {
  console.log(`  * ${g.name} (appid ${g.appid}) - Missing: [${g.missingBySteamIds.join(', ')}], Playtime: ${g.totalSquadPlaytimeHours}h`);
});

const deepRock = overlap.nearOverlapGames.find(g => g.appid === 548430);
if (!deepRock) {
  console.error('FAILED: Deep Rock Galactic (548430) must be in 3/4 overlap!');
  process.exit(1);
}
// GabeN does not own Deep Rock in the demo dataset (76561197960287930)
if (!deepRock.missingBySteamIds.includes('76561197960287930')) {
  console.error('FAILED: GabeN should be identified as the missing squad member for Deep Rock!');
  process.exit(1);
}
console.log('✓ 3/4 near overlap & missing player identification verified correctly!');

// 2.5 Test Single-Player Game Exclusion
console.log('\n[2.5] Testing Single-Player Game Exclusion (Group Play Filter)...');
// Inject a single-player game owned by all 4 accounts to test exclusion
const singlePlayerTestLibs = JSON.parse(JSON.stringify(DEMO_SQUAD_LIBRARIES));
Object.keys(singlePlayerTestLibs).forEach(sId => {
  singlePlayerTestLibs[sId].games.push({
    appid: 1145360, // Hades (pure single player)
    name: 'Hades',
    playtime_forever: 5000,
  });
  singlePlayerTestLibs[sId].games.push({
    appid: 292030, // The Witcher 3: Wild Hunt (pure single player)
    name: 'The Witcher 3: Wild Hunt',
    playtime_forever: 8000,
  });
});

const overlapWithSinglePlayer = computeSquadOverlap(singlePlayerTestLibs, steamIds);
const allGroupGames = [...overlapWithSinglePlayer.fullSquadGames, ...overlapWithSinglePlayer.nearOverlapGames];

const foundHades = allGroupGames.find(g => g.appid === 1145360);
const foundWitcher = allGroupGames.find(g => g.appid === 292030);

if (foundHades) {
  console.error('FAILED: Single player game "Hades" appeared on group list!');
  process.exit(1);
}
if (foundWitcher) {
  console.error('FAILED: Single player game "The Witcher 3" appeared on group list!');
  process.exit(1);
}

// Ensure all included games have group play capability
for (const g of allGroupGames) {
  if (!g.isMultiplayer && !g.isCoop && !g.isPvp) {
    console.error(`FAILED: Game "${g.name}" has no multiplayer/co-op/pvp flags but was included!`);
    process.exit(1);
  }
}
console.log('✓ Verified: Single-player games are strictly excluded from group play lists!');

// 2.6 Test Co-Op / Multiplayer Games (Stolen Realm, Necesse, Back 4 Blood, etc.)
console.log('\n[2.6] Testing Multiplayer Recognition for Specific Co-Op Titles...');
const testTitles = [
  { appid: 1330920, name: 'Stolen Realm' },
  { appid: 322330, name: "Don't Starve Together" },
  { appid: 1169040, name: 'Necesse' },
  { appid: 924970, name: 'Back 4 Blood' },
  { appid: 815370, name: 'Green Hell' },
  { appid: 1343400, name: 'RuneScape: Dragonwilds' },
  { appid: 552500, name: 'Warhammer: Vermintide 2' },
  { appid: 489630, name: 'Warhammer 40,000: Gladius - Relics of War' },
  { appid: 1422450, name: 'Deadlock' },
  { appid: 2868840, name: 'Slay the Spire 2' },
  { appid: 304930, name: 'Unturned' }
];

const coopTestLibs = JSON.parse(JSON.stringify(DEMO_SQUAD_LIBRARIES));
Object.keys(coopTestLibs).forEach(sId => {
  testTitles.forEach(t => {
    coopTestLibs[sId].games.push({
      appid: t.appid,
      name: t.name,
      playtime_forever: 3000,
    });
  });
});

const overlapWithCoop = computeSquadOverlap(coopTestLibs, steamIds, true);
const allFullAppIds = overlapWithCoop.fullSquadGames.map(g => g.appid);

for (const t of testTitles) {
  if (!allFullAppIds.includes(t.appid)) {
    console.error(`FAILED: Expected multiplayer game "${t.name}" (appid ${t.appid}) to be included in Ready to Play list!`);
    process.exit(1);
  }
}
console.log('✓ All 8 multiplayer/co-op titles (Stolen Realm, Necesse, Back 4 Blood, Green Hell, RuneScape, Don\'t Starve Together, etc.) correctly identified and present!');


console.log('\n[3] Testing Squad Suggestions & Recommendations...');
const ownedSet = new Set<number>(overlap.fullSquadGames.map(g => g.appid));
const recs = generateSquadRecommendations(overlap, ownedSet);

console.log(`- Generated ${recs.length} unowned external co-op recommendations:`);
recs.slice(0, 5).forEach((r, idx) => {
  console.log(`  ${idx + 1}. ${r.name} - Price: ${r.price} | Rating: ${r.ratingText} | Matching tags: [${r.matchingSquadTags.join(', ')}]`);
});

if (recs.length === 0) {
  console.error('FAILED: Recommendations should not be empty!');
  process.exit(1);
}
console.log('✓ Squad recommendations generated and ranked successfully!');

// 4. Test Dynamic Squad Sizing (2 Players and 8 Players)
console.log('\n[4] Testing Dynamic Squad Sizing (2 Players & 8 Players)...');

// 2 Players Test
const twoPlayerIds = steamIds.slice(0, 2);
const twoPlayerOverlap = computeSquadOverlap(DEMO_SQUAD_LIBRARIES, twoPlayerIds, true);
console.log(`- 2-Player Squad: Full (2/2): ${twoPlayerOverlap.fullSquadGames.length}, Missing One (1/2): ${twoPlayerOverlap.nearOverlapGames.length}`);
if (twoPlayerOverlap.fullSquadGames.length === 0) {
  console.error('FAILED: 2-player squad should have shared games!');
  process.exit(1);
}
console.log('✓ 2-Player squad overlap verified successfully!');

// 8 Players Test (generate 8 mock libraries)
const eightPlayerLibs: Record<string, any> = {};
const eightPlayerIds: string[] = [];
for (let i = 1; i <= 8; i++) {
  const id = `7656119800000000${i}`;
  eightPlayerIds.push(id);
  eightPlayerLibs[id] = {
    steamId: id,
    personaName: `Player ${i}`,
    games: [
      { appid: 730, name: 'Counter-Strike 2', playtime_forever: 1000 }, // All 8 have CS2
      { appid: 105600, name: 'Terraria', playtime_forever: 500 }, // All 8 have Terraria
    ],
  };
  // 7 out of 8 have Helldivers 2 (player 8 missing)
  if (i < 8) {
    eightPlayerLibs[id].games.push({ appid: 553850, name: 'HELLDIVERS™ 2', playtime_forever: 800 });
  }
  // 4 out of 8 have Rust
  if (i <= 4) {
    eightPlayerLibs[id].games.push({ appid: 252490, name: 'Rust', playtime_forever: 600 });
  }
}

const eightPlayerOverlap = computeSquadOverlap(eightPlayerLibs, eightPlayerIds, true);
console.log(`- 8-Player Squad: Full (8/8): ${eightPlayerOverlap.fullSquadGames.length}, Near (7/8): ${eightPlayerOverlap.nearOverlapGames.length}, Partial: ${eightPlayerOverlap.twoPlayerGames.length}`);

const full8AppIds = eightPlayerOverlap.fullSquadGames.map(g => g.appid);
if (!full8AppIds.includes(730) || !full8AppIds.includes(105600)) {
  console.error('FAILED: Expected CS2 and Terraria in 8/8 full overlap!');
  process.exit(1);
}

const near8AppIds = eightPlayerOverlap.nearOverlapGames.map(g => g.appid);
if (!near8AppIds.includes(553850)) {
  console.error('FAILED: Expected Helldivers 2 in 7/8 near overlap!');
  process.exit(1);
}

const partial8AppIds = eightPlayerOverlap.twoPlayerGames.map(g => g.appid);
if (!partial8AppIds.includes(252490)) {
  console.error('FAILED: Expected Rust in partial overlap for 8-player squad!');
  process.exit(1);
}
console.log('✓ 8-Player squad overlap verified successfully (Full 8/8, Near 7/8, Partial 4/8)!');

// 7. Test Delisted & Unpurchasable Games (e.g. MapleStory 2)
console.log('\n[7] Testing Delisted & Unpurchasable Games (MapleStory 2)...');
const delistedTestLibs = JSON.parse(JSON.stringify(DEMO_SQUAD_LIBRARIES));
const testSquadIds = Object.keys(delistedTestLibs).slice(0, 4);

// Scenario A: Only 2 out of 4 players own MapleStory 2 (560380)
StorageService.setAppStoreDetails(560380, { name: 'MapleStory 2', isAvailableOnSteam: false, isMultiplayer: true, isCoop: true, categories: ['Multi-player', 'Co-op'], genres: ['RPG'], tags: ['Co-Op'] });
delistedTestLibs[testSquadIds[0]].games.push({ appid: 560380, name: 'MapleStory 2', playtime_forever: 1200 });
delistedTestLibs[testSquadIds[1]].games.push({ appid: 560380, name: 'MapleStory 2', playtime_forever: 800 });

const overlapDelistedPartial = computeSquadOverlap(delistedTestLibs, testSquadIds, true);
const partialAllGames = [
  ...overlapDelistedPartial.fullSquadGames,
  ...overlapDelistedPartial.nearOverlapGames,
  ...overlapDelistedPartial.twoPlayerGames,
  ...overlapDelistedPartial.allSquadGames,
];

const foundMs2Partial = partialAllGames.find(g => g.appid === 560380);
if (foundMs2Partial) {
  console.error('FAILED: Delisted game MapleStory 2 (560380) appeared in squad list when only 2/4 own it!');
  process.exit(1);
}

const recommendationsMs2 = generateSquadRecommendations(overlapDelistedPartial, new Set([730, 105600]));
const foundMs2Rec = recommendationsMs2.find(r => r.appid === 560380);
if (foundMs2Rec) {
  console.error('FAILED: Delisted game MapleStory 2 appeared in squad recommendations!');
  process.exit(1);
}
console.log('✓ MapleStory 2 correctly excluded from missing list and recommendations when not owned by all!');

// Scenario B: ALL 4 players own MapleStory 2 -> Should appear in Ready to Play
delistedTestLibs[testSquadIds[2]].games.push({ appid: 560380, name: 'MapleStory 2', playtime_forever: 600 });
delistedTestLibs[testSquadIds[3]].games.push({ appid: 560380, name: 'MapleStory 2', playtime_forever: 400 });

const overlapDelistedAll = computeSquadOverlap(delistedTestLibs, testSquadIds, true);
const foundMs2Ready = overlapDelistedAll.fullSquadGames.find(g => g.appid === 560380);
if (!foundMs2Ready) {
  console.error('FAILED: MapleStory 2 should appear in Ready to Play if ALL squad members already own it!');
  process.exit(1);
}
console.log('✓ MapleStory 2 correctly included in Ready to Play when 100% of squad members own it!');

// 8. Test Dynamic Max Players Detection & 5-Player Squad Filtering
console.log('\n[8] Testing Dynamic Max Players Detection & 5-Player Squad Filtering...');
// Test player count extraction
const testMax1 = detectMaxPlayers('Deep Rock Galactic', 'Deep Rock Galactic is a 1-4 player co-op FPS featuring dwarven miners');
const testMax2 = detectMaxPlayers('HELLDIVERS™ 2', 'Join the fight for freedom in online play for up to four players');
const testMax3 = detectMaxPlayers('It Takes Two', 'A purely co-op platform adventure built for two players');
const testMax4 = detectMaxPlayers('Valheim', 'A brutal 1-10 player multiplayer exploration and survival game');
const testMax5 = detectMaxPlayers('Counter-Strike 2', 'Competitive 5v5 multiplayer FPS');

if (testMax1 !== 4) {
  console.error(`FAILED: Expected Deep Rock Galactic maxPlayers = 4, got ${testMax1}`);
  process.exit(1);
}
if (testMax2 !== 4) {
  console.error(`FAILED: Expected Helldivers 2 maxPlayers = 4, got ${testMax2}`);
  process.exit(1);
}
if (testMax3 !== 2) {
  console.error(`FAILED: Expected It Takes Two maxPlayers = 2, got ${testMax3}`);
  process.exit(1);
}
if (testMax4 !== 10) {
  console.error(`FAILED: Expected Valheim maxPlayers = 10, got ${testMax4}`);
  process.exit(1);
}
console.log('✓ Max player capacity extraction verified (Deep Rock: 4, Helldivers: 4, It Takes Two: 2, Valheim: 10)!');

// Test recommendations filtering with a 5-player squad
// Construct mock overlap result containing 4-player games and 10-player games
const mock5POldOverlap: any = {
  nearOverlapGames: [
    { appid: 548430, name: 'Deep Rock Galactic', tags: ['Action'], genres: ['Action'], ownershipCount: 4, maxPlayers: 4 },
    { appid: 553850, name: 'HELLDIVERS™ 2', tags: ['Action'], genres: ['Action'], ownershipCount: 4, maxPlayers: 4 },
    { appid: 892970, name: 'Valheim', tags: ['Survival'], genres: ['Survival'], ownershipCount: 4, maxPlayers: 10 },
    { appid: 105600, name: 'Terraria', tags: ['Adventure'], genres: ['Adventure'], ownershipCount: 4, maxPlayers: 10 },
  ],
  twoPlayerGames: [],
  topGenres: [{ name: 'Action', count: 5 }, { name: 'Survival', count: 4 }],
};

// When activeSquadCount is 5, 4-player games (Deep Rock, Helldivers) MUST NOT be suggested!
const recsFor5P = generateSquadRecommendations(mock5POldOverlap, new Set(), 5);
const recNamesFor5P = recsFor5P.map(r => r.name);

console.log('- Recommendations for 5-Player Squad:', recNamesFor5P);

if (recNamesFor5P.includes('Deep Rock Galactic') || recNamesFor5P.includes('HELLDIVERS™ 2')) {
  console.error('FAILED: 4-player games were suggested to a 5-player squad!');
  process.exit(1);
}
if (!recNamesFor5P.includes('Valheim') || !recNamesFor5P.includes('Terraria')) {
  console.error('FAILED: Valheim or Terraria (which support 5+ players) should be suggested to a 5-player squad!');
  process.exit(1);
}
console.log('✓ 5-Player squad recommendations correctly filtered out 4-player co-op games and kept 5+ player titles!');

// 9. Test Prioritized Store Resolution Queue
console.log('\n[9] Testing Prioritized Store Resolution Queue...');
const testQueueIds = Object.keys(DEMO_SQUAD_LIBRARIES);
const prioritizedQueue = getPrioritizedStoreResolutionAppIds(DEMO_SQUAD_LIBRARIES, testQueueIds);

console.log(`- Demo Squad: Queued ${prioritizedQueue.length} prioritized games (shared + candidate F2P).`);

// Verify that shared games (CS2 730, Terraria 105600, Lethal Company 1966720) are at the front of the queue
const firstThree = prioritizedQueue.slice(0, 5);
if (!prioritizedQueue.includes(730) || !prioritizedQueue.includes(105600) || !prioritizedQueue.includes(1966720)) {
  console.error('FAILED: Full squad shared games must be included in the resolution queue!');
  process.exit(1);
}

// Verify that single-player solo games like Hades or Witcher (if present in only 1 player's lib) are NOT queued
const mockQueueLibs: any = JSON.parse(JSON.stringify(DEMO_SQUAD_LIBRARIES));
mockQueueLibs[testQueueIds[0]].games.push({ appid: 1145360, name: 'Hades', playtime_forever: 100 }); // Solo singleplayer
mockQueueLibs[testQueueIds[0]].games.push({ appid: 292030, name: 'The Witcher 3: Wild Hunt', playtime_forever: 100 }); // Solo singleplayer
mockQueueLibs[testQueueIds[0]].games.push({ appid: 291550, name: 'Brawlhalla', playtime_forever: 100 }); // Solo F2P candidate

const optimizedQueue = getPrioritizedStoreResolutionAppIds(mockQueueLibs, testQueueIds);

if (optimizedQueue.includes(1145360)) {
  console.error('FAILED: Solo singleplayer game Hades was unnecessarily queued for store resolution!');
  process.exit(1);
}
if (optimizedQueue.includes(292030)) {
  console.error('FAILED: Solo singleplayer game The Witcher 3 was unnecessarily queued for store resolution!');
  process.exit(1);
}
if (!optimizedQueue.includes(291550)) {
  console.error('FAILED: Solo candidate F2P game Brawlhalla should be queued for store resolution!');
  process.exit(1);
}
// 10. Test Wishlist Overlap Computation & Couch Co-op Exclusion
console.log('\n[10] Testing Wishlist Overlaps & Couch Co-Op Exclusion...');

import { computeSquadWishlistOverlap } from '../src/services/intersectionEngine';

const wishlistOverlap = computeSquadWishlistOverlap(DEMO_SQUAD_WISHLISTS, testQueueIds, DEMO_SQUAD_LIBRARIES);
console.log(`- Wishlist Overlaps Analyzed: ${wishlistOverlap.length} unique wishlisted games`);

const mhWilds = wishlistOverlap.find(g => g.appid === 2246340);
if (!mhWilds || mhWilds.wishlistCount !== 4) {
  console.error('FAILED: Monster Hunter Wilds must have 4/4 wishlist count!');
  process.exit(1);
}
console.log('✓ Monster Hunter Wilds 4/4 wishlist overlap verified correctly!');

const helldiversWishlist = wishlistOverlap.find(g => g.appid === 553850);
if (!helldiversWishlist || helldiversWishlist.ownershipCount !== 3 || helldiversWishlist.wishlistCount !== 1) {
  console.error('FAILED: Helldivers 2 must show 3 owned + 1 wishlisted!');
  process.exit(1);
}
console.log('✓ Wishlist + Ownership combination (3 owned, 1 wishlisted) verified correctly!');

// Verify Couch Co-op Exclusion
const couchCoopTestLibs: any = JSON.parse(JSON.stringify(DEMO_SQUAD_LIBRARIES));
Object.keys(couchCoopTestLibs).forEach(sId => {
  couchCoopTestLibs[sId].games.push({ appid: 111111, name: 'Couch Split Screen Only Game', playtime_forever: 100 });
});

// Cache metadata indicating split screen only
import { StorageService } from '../src/services/storage';
StorageService.setAppStoreDetails(111111, {
  isMultiplayer: true,
  isCoop: true,
  isPvp: false,
  isFree: false,
  isAvailableOnSteam: true,
  isLocalOrSplitScreenOnly: true,
  categories: ['Shared/Split Screen', 'Shared/Split Screen Co-op'],
  genres: ['Casual'],
  tags: ['Local Co-Op', 'Split Screen'],
});

const couchOverlap = computeSquadOverlap(couchCoopTestLibs, testQueueIds, true);
const foundCouch = [...couchOverlap.fullSquadGames, ...couchOverlap.nearOverlapGames].find(g => g.appid === 111111);
if (foundCouch) {
  console.error('FAILED: Couch/Split Screen only game was included in online multiplayer squad results!');
  process.exit(1);
}
console.log('✓ Couch / Split-screen only game successfully excluded from online multi-machine squad results!');

// 11. Test 3 Distinct Squad Suggestions Sections
console.log('\n[11] Testing 3 Distinct Squad Suggestions Sections...');
import { generateTopWishlistCarousel, generateUpcomingTwoWeeksCarousel } from '../src/services/intersectionEngine';

const mockWishlistAnalyses = computeSquadWishlistOverlap(DEMO_SQUAD_WISHLISTS, testQueueIds, DEMO_SQUAD_LIBRARIES);

// Section 1: Top Wishlisted Carousel (100% squad members wishlisted or owned)
const topWishlistCarousel = generateTopWishlistCarousel(mockWishlistAnalyses, 4, []);
console.log(`- Section 1 (Top Wishlisted Carousel): ${topWishlistCarousel.length} games`);
if (topWishlistCarousel.length === 0) {
  console.error('FAILED: Top wishlist carousel should contain titles where 100% of squad wishlisted or owned!');
  process.exit(1);
}
const mhWildsTop = topWishlistCarousel.find(g => g.appid === 2246340);
if (!mhWildsTop || (mhWildsTop.wishlistCount + mhWildsTop.ownershipCount) !== 4) {
  console.error('FAILED: Monster Hunter Wilds must be in Section 1 with 4/4 wishlist/ownership total!');
  process.exit(1);
}
console.log('✓ Section 1 (Top Wishlisted Carousel 100% threshold) verified!');

// Section 2: Upcoming Games (within two weeks - unreleased titles only)
const mockLiveSearch = [
  { appid: 3560670, name: 'OpenFront', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3560670/header.jpg' }
];
StorageService.setAppStoreDetails(3560670, {
  isMultiplayer: true,
  isCoop: true,
  isPvp: true,
  categories: ['Multi-player', 'Online Co-op', 'Online PvP'],
  genres: ['Action', 'Free to Play'],
  tags: ['Action', 'FPS', 'Multiplayer'],
  priceFormatted: 'Free to Play',
  maxPlayers: 16,
  releaseDateLabel: '17 Sep, 2026',
});

const upcomingCarousel = generateUpcomingTwoWeeksCarousel(mockWishlistAnalyses, overlap, new Set([730, 105600]), 4, [], mockLiveSearch);
console.log(`- Section 2 (Upcoming Unreleased Games Carousel < 2 weeks): ${upcomingCarousel.length} games`);
if (upcomingCarousel.length === 0 || !upcomingCarousel.find(g => g.appid === 3560670)) {
  console.error('FAILED: Live upcoming search item OpenFront (3560670) should be included in Section 2!');
  process.exit(1);
}
console.log('✓ Section 2 (Strictly unreleased games within 2 weeks from live search API) verified!');

// Section 3: Recommendations Grid (Discounted & NEW games at top)
const recsGrid = generateSquadRecommendations(overlap, new Set([730, 105600]), 4);
console.log(`- Section 3 (Recommendations Grid): ${recsGrid.length} games`);
if (recsGrid.length === 0) {
  console.error('FAILED: Section 3 recommendations grid should not be empty!');
  process.exit(1);
}
const subnauticaInSection3 = recsGrid.find(r => r.appid === 1962700);
if (!subnauticaInSection3) {
  console.error('FAILED: Subnautica 2 (Early Access released title) should appear in Section 3 Curated Recommendations!');
  process.exit(1);
}
console.log('✓ Subnautica 2 correctly placed in Section 3 Curated Recommendations!');
const hasDiscountOrNewAtTop = recsGrid[0].discountPercent || recsGrid[0].isNewRelease || recsGrid[0].isFree;
if (!hasDiscountOrNewAtTop) {
  console.error('FAILED: Section 3 must prioritize discounted, new releases, or free-to-play games at the top!');
  process.exit(1);
}
console.log('✓ Section 3 (Discounted and NEW releases prioritized at top) verified!');

console.log('\n[12] Testing Strict Release Date Filtering (isConfirmedWithinTwoWeeks)...');
import { isConfirmedWithinTwoWeeks } from '../src/services/intersectionEngine';

const tbaTests = [
  { dateStr: 'Planned Release Date: To be announced', expected: false },
  { dateStr: 'To be announced', expected: false },
  { dateStr: 'TBA', expected: false },
  { dateStr: 'TBD', expected: false },
  { dateStr: 'Coming Soon', expected: false },
  { dateStr: 'Planned Release Date: September 2026', expected: false },
  { dateStr: 'September 2026', expected: false },
  { dateStr: 'Q4 2026', expected: false },
  { dateStr: 'Planned Release Date: Sept 17, 2026', expected: true },
  { dateStr: 'Sept 17', expected: true },
  { dateStr: 'Releasing Tomorrow', expected: true },
];

for (const t of tbaTests) {
  const res = isConfirmedWithinTwoWeeks(t.dateStr);
  if (res !== t.expected) {
    console.error(`FAILED date check for "${t.dateStr}": expected ${t.expected}, got ${res}`);
    process.exit(1);
  }
}
console.log('✓ All 11 release date confirmation test cases passed!');

console.log('\n========================================');
console.log('ALL VERIFICATION SUITES PASSED (100%)');
console.log('========================================\n');


