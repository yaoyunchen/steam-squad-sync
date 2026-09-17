# Steam Squad Sync

**Steam Squad Sync** is a modern Windows 11 desktop utility built with **Electron**, **React**, and **TypeScript**. It analyzes and compares the Steam libraries of up to 4 squad members to find full multiplayer overlap, identify near-overlap games missing exactly one player, and deliver tailored co-op recommendations.

---

## Key Features

1. **Input & Profile Resolution**:
   - Accepts 64-bit SteamIDs, custom vanity names (e.g., `gabelogannewell`), or full Steam profile URLs (`https://steamcommunity.com/id/...` or `https://steamcommunity.com/profiles/...`).
   - Automatically resolves vanity URLs using Valve's `ISteamUser/ResolveVanityURL/v1` endpoint.
   - Retrieves player avatars, persona names, and profile states via `ISteamUser/GetPlayerSummaries/v2`.
   - Clear, non-blocking UI badge for private/hidden libraries.
   - **One-Click Instant Demo Squad**: Test all features immediately with a preloaded 4-player squad (GabeN, ViperStrike, PixelHealer, IronVanguard) without needing an API key.

2. **Data Ingestion & Resilient Caching**:
   - Queries `IPlayerService/GetOwnedGames/v1` with `include_appinfo=1` and `include_played_free_games=1`.
   - IPC-based HTTPS proxy through Electron's main process, completely eliminating browser CORS blocks.
   - Local timestamped cache (`steamid_timestamp`) with automatic TTL validation to prevent Valve 429 rate-limiting.
   - Reversible client-side credential encryption for your Steam Web API key.

3. **Deterministic Set Intersection Engine**:
   - **Ready to Play (4/4 Owned)**: $S_1 \cap S_2 \cap S_3 \cap S_4$ (or $N/N$ for active squad count).
   - **One Person Missing (3/4 Owned)**: Games owned by exactly $N-1$ users, displaying a badge highlighting the missing member and a quick Steam Store link.
   - Combined squad playtime calculation (hours played across the squad).

4. **Squad Suggestions & Co-Op Recommendations**:
   - High-playtime 3/4 ownership favorites ranked by combined hours.
   - Curated unowned co-op gems matched to the squad's gameplay genre tags with pricing, discount badges, ratings, and direct Steam links.

5. **Windows 11 Fluent UI Styling**:
   - Custom frameless title bar with drag region, minimize, maximize, and close controls.
   - Steam dark aesthetic with mica/acrylic styling and smooth micro-animations.
   - Interactive search and tag filtering (Co-Op, PvP, Survival, Casual, Shooter, RPG).

---

## Running the Application

### 1. Launch in Development Mode (Electron + Vite)
```bash
npm run dev
```

### 2. Build for Production
```bash
npm run build
```

### 3. Launch Packaged App
```bash
npm start
```

### 4. Run Automated Test Suite
```bash
npx tsx tests/engine.test.ts
```
