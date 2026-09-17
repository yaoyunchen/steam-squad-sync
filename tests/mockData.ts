import { SteamUserSlot, CachedLibrary } from '../src/types/steam';

export const TEST_SQUAD_SLOTS: SteamUserSlot[] = [
  {
    id: 'slot-1',
    input: '76561197960287930',
    steamId: '76561197960287930',
    personaName: 'GabeN',
    profileUrl: 'https://steamcommunity.com/profiles/76561197960287930',
    avatarUrl: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
    isValidated: true,
  },
  {
    id: 'slot-2',
    input: '76561198012345678',
    steamId: '76561198012345678',
    personaName: 'ViperStrike',
    profileUrl: 'https://steamcommunity.com/profiles/76561198012345678',
    avatarUrl: 'https://avatars.steamstatic.com/6c65e8a379469502b4d1b70220c8f5f624d62325_full.jpg',
    isValidated: true,
  },
  {
    id: 'slot-3',
    input: '76561198087654321',
    steamId: '76561198087654321',
    personaName: 'PixelHealer',
    profileUrl: 'https://steamcommunity.com/profiles/76561198087654321',
    avatarUrl: 'https://avatars.steamstatic.com/d5e3c15079a40733d3c8c67cbf7e58a7413498f3_full.jpg',
    isValidated: true,
  },
  {
    id: 'slot-4',
    input: '76561198199887766',
    steamId: '76561198199887766',
    personaName: 'IronVanguard',
    profileUrl: 'https://steamcommunity.com/profiles/76561198199887766',
    avatarUrl: 'https://avatars.steamstatic.com/3932e652c799a7b9ce05342a58d62660898516fa_full.jpg',
    isValidated: true,
  },
];

export const TEST_SQUAD_LIBRARIES: Record<string, CachedLibrary> = {
  '76561197960287930': {
    steamId: '76561197960287930',
    personaName: 'GabeN',
    avatarUrl: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
    isPrivate: false,
    timestamp: Date.now(),
    games: [
      { appid: 730, name: 'Counter-Strike 2', playtime_forever: 14200 },
      { appid: 570, name: 'Dota 2', playtime_forever: 8900 },
      { appid: 550, name: 'Left 4 Dead 2', playtime_forever: 3450 },
      { appid: 105600, name: 'Terraria', playtime_forever: 6120 },
      { appid: 1966720, name: 'Lethal Company', playtime_forever: 2150 },
      { appid: 945360, name: 'Among Us', playtime_forever: 1840 },
      { appid: 440, name: 'Team Fortress 2', playtime_forever: 12500 },
      { appid: 892970, name: 'Valheim', playtime_forever: 4600 },
      { appid: 252490, name: 'Rust', playtime_forever: 7800 },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 3800 },
      { appid: 286160, name: 'Tabletop Simulator', playtime_forever: 2400 },
      { appid: 218620, name: 'PAYDAY 2', playtime_forever: 4200 },
      { appid: 1145360, name: 'Hades', playtime_forever: 3200 },
      { appid: 1245620, name: 'ELDEN RING', playtime_forever: 9400 },
      { appid: 728880, name: 'Overcooked! 2', playtime_forever: 1100 },
      { appid: 108600, name: 'Project Zomboid', playtime_forever: 3200 },
    ]
  },
  '76561198012345678': {
    steamId: '76561198012345678',
    personaName: 'ViperStrike',
    avatarUrl: 'https://avatars.steamstatic.com/6c65e8a379469502b4d1b70220c8f5f624d62325_full.jpg',
    isPrivate: false,
    timestamp: Date.now(),
    games: [
      { appid: 730, name: 'Counter-Strike 2', playtime_forever: 9800 },
      { appid: 570, name: 'Dota 2', playtime_forever: 4300 },
      { appid: 550, name: 'Left 4 Dead 2', playtime_forever: 2100 },
      { appid: 105600, name: 'Terraria', playtime_forever: 4500 },
      { appid: 1966720, name: 'Lethal Company', playtime_forever: 1900 },
      { appid: 945360, name: 'Among Us', playtime_forever: 980 },
      { appid: 440, name: 'Team Fortress 2', playtime_forever: 5600 },
      { appid: 892970, name: 'Valheim', playtime_forever: 3200 },
      { appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 5800 },
      { appid: 553850, name: 'HELLDIVERS™ 2', playtime_forever: 7200 },
      { appid: 739630, name: 'Phasmophobia', playtime_forever: 3400 },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 2900 },
      { appid: 252490, name: 'Rust', playtime_forever: 6100 },
      { appid: 1172470, name: 'Apex Legends', playtime_forever: 4900 },
      { appid: 108600, name: 'Project Zomboid', playtime_forever: 4100 },
    ]
  },
  '76561198087654321': {
    steamId: '76561198087654321',
    personaName: 'PixelHealer',
    avatarUrl: 'https://avatars.steamstatic.com/d5e3c15079a40733d3c8c67cbf7e58a7413498f3_full.jpg',
    isPrivate: false,
    timestamp: Date.now(),
    games: [
      { appid: 730, name: 'Counter-Strike 2', playtime_forever: 6500 },
      { appid: 570, name: 'Dota 2', playtime_forever: 1200 },
      { appid: 550, name: 'Left 4 Dead 2', playtime_forever: 1800 },
      { appid: 105600, name: 'Terraria', playtime_forever: 8900 },
      { appid: 1966720, name: 'Lethal Company', playtime_forever: 2800 },
      { appid: 945360, name: 'Among Us', playtime_forever: 2100 },
      { appid: 440, name: 'Team Fortress 2', playtime_forever: 3100 },
      { appid: 892970, name: 'Valheim', playtime_forever: 5100 },
      { appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 4300 },
      { appid: 553850, name: 'HELLDIVERS™ 2', playtime_forever: 4900 },
      { appid: 739630, name: 'Phasmophobia', playtime_forever: 4100 },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 1700 },
      { appid: 413150, name: 'Stardew Valley', playtime_forever: 9500 },
      { appid: 728880, name: 'Overcooked! 2', playtime_forever: 2300 },
      { appid: 108600, name: 'Project Zomboid', playtime_forever: 2800 },
    ]
  },
  '76561198199887766': {
    steamId: '76561198199887766',
    personaName: 'IronVanguard',
    avatarUrl: 'https://avatars.steamstatic.com/3932e652c799a7b9ce05342a58d62660898516fa_full.jpg',
    isPrivate: false,
    timestamp: Date.now(),
    games: [
      { appid: 730, name: 'Counter-Strike 2', playtime_forever: 11200 },
      { appid: 570, name: 'Dota 2', playtime_forever: 3400 },
      { appid: 550, name: 'Left 4 Dead 2', playtime_forever: 4100 },
      { appid: 105600, name: 'Terraria', playtime_forever: 3900 },
      { appid: 1966720, name: 'Lethal Company', playtime_forever: 2400 },
      { appid: 945360, name: 'Among Us', playtime_forever: 1400 },
      { appid: 440, name: 'Team Fortress 2', playtime_forever: 7800 },
      { appid: 892970, name: 'Valheim', playtime_forever: 6300 },
      { appid: 548430, name: 'Deep Rock Galactic', playtime_forever: 6200 },
      { appid: 553850, name: 'HELLDIVERS™ 2', playtime_forever: 8100 },
      { appid: 252490, name: 'Rust', playtime_forever: 9200 },
      { appid: 632360, name: 'Risk of Rain 2', playtime_forever: 3400 },
      { appid: 286160, name: 'Tabletop Simulator', playtime_forever: 1800 },
      { appid: 218620, name: 'PAYDAY 2', playtime_forever: 3600 },
      { appid: 108600, name: 'Project Zomboid', playtime_forever: 5100 },
    ]
  }
};

export const TEST_SQUAD_WISHLISTS: Record<string, { appid: number; name: string; headerImage: string; storeUrl: string; priceFormatted: string; discountPercent: number; tags: string[] }[]> = {
  '76561197960287930': [
    { appid: 2246340, name: 'Monster Hunter Wilds', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg', storeUrl: 'https://store.steampowered.com/app/2246340/', priceFormatted: '$69.99', discountPercent: 0, tags: ['Co-Op', 'Action', 'Multiplayer', 'RPG'] },
    { appid: 2868840, name: 'Slay the Spire 2', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2868840/header.jpg', storeUrl: 'https://store.steampowered.com/app/2868840/', priceFormatted: '$24.99', discountPercent: 0, tags: ['Co-Op', 'Deckbuilder', 'Roguelike'] },
    { appid: 1030300, name: 'Hollow Knight: Silksong', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1030300/header.jpg', storeUrl: 'https://store.steampowered.com/app/1030300/', priceFormatted: '$19.99', discountPercent: 0, tags: ['Action', 'Adventure', 'Indie'] },
    { appid: 548430, name: 'Deep Rock Galactic', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/548430/header.jpg', storeUrl: 'https://store.steampowered.com/app/548430/', priceFormatted: '$29.99', discountPercent: 0, tags: ['Co-Op', 'FPS', 'Multiplayer'] },
    { appid: 553850, name: 'HELLDIVERS™ 2', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/553850/header.jpg', storeUrl: 'https://store.steampowered.com/app/553850/', priceFormatted: '$39.99', discountPercent: 0, tags: ['Co-Op', 'Action', 'TPS', 'Multiplayer'] },
  ],
  '76561198012345678': [
    { appid: 2246340, name: 'Monster Hunter Wilds', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg', storeUrl: 'https://store.steampowered.com/app/2246340/', priceFormatted: '$69.99', discountPercent: 0, tags: ['Co-Op', 'Action', 'Multiplayer', 'RPG'] },
    { appid: 2868840, name: 'Slay the Spire 2', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2868840/header.jpg', storeUrl: 'https://store.steampowered.com/app/2868840/', priceFormatted: '$24.99', discountPercent: 0, tags: ['Co-Op', 'Deckbuilder', 'Roguelike'] },
  ],
  '76561198087654321': [
    { appid: 2246340, name: 'Monster Hunter Wilds', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg', storeUrl: 'https://store.steampowered.com/app/2246340/', priceFormatted: '$69.99', discountPercent: 0, tags: ['Co-Op', 'Action', 'Multiplayer', 'RPG'] },
    { appid: 2868840, name: 'Slay the Spire 2', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2868840/header.jpg', storeUrl: 'https://store.steampowered.com/app/2868840/', priceFormatted: '$24.99', discountPercent: 0, tags: ['Co-Op', 'Deckbuilder', 'Roguelike'] },
  ],
  '76561198199887766': [
    { appid: 2246340, name: 'Monster Hunter Wilds', headerImage: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg', storeUrl: 'https://store.steampowered.com/app/2246340/', priceFormatted: '$69.99', discountPercent: 0, tags: ['Co-Op', 'Action', 'Multiplayer', 'RPG'] },
  ]
};
