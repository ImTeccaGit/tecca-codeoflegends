# TECCA CODEOFLEGENDS

A local-first **Windows desktop companion for League of Legends**, built with
Tauri 2 (Rust backend) and React + TypeScript (UI). It shows champion data,
the player's own match history and analysis, champion build statistics and an
informative in-game panel, using only official Riot data sources.

> **Status:** personal project, version 0.10.0 (beta), for the developer's own
> use. It is not distributed publicly, has no accounts, no servers, no ads and
> no monetization.

TECCA CODEOFLEGENDS isn't endorsed by Riot Games and doesn't reflect the views
or opinions of Riot Games or anyone officially involved in producing or
managing Riot Games properties. Riot Games, and all associated properties are
trademarks or registered trademarks of Riot Games, Inc.

---

## What it does

| Feature | Data source | Notes |
| --- | --- | --- |
| Champion catalog (abilities, stats, skins, items, runes) | Data Dragon | Versioned per patch, cached locally |
| Player profiles and match history | Riot API: account-v1, summoner-v4, league-v4, match-v5 | Search by Riot ID; each finished match is downloaded only once |
| Post-game analysis and matchups | Matches already stored locally | Always shows sample size; no estimated values |
| Champion build statistics (most used runes, items, skill order, lanes, counters) | Riot API: league-v4 ladders → match-v5 + match-v5 timeline (Ranked Solo/Duo) | **Opt-in**, off by default. Aggregated locally from matches downloaded with the user's own key |
| Own account without a key | League Client API (LCU), read-only GET on `127.0.0.1` | Only the logged-in user's account, rank and recent games; can be turned off |
| Live game detection | Live Client Data API (`127.0.0.1:2999`), read-only | **Opt-in**, off by default |
| In-game panel | Live Client Data API + Riot API | See below |

### In-game panel

When a game starts, a separate panel window shows:

- for each player, starting from the Riot IDs already visible on the in-game
  scoreboard: summoner level, **official** Ranked Solo/Duo rank and a summary
  of their last 5 ranked games (win rate, average KDA, main role, games on the
  current champion);
- the build of the **user's own champion** (runes, starting items, core items,
  boots, skill order), taken from the statistics above.

The panel is informative only. It is a transparent, click-through window that
never receives input and never interacts with the game. The `Home` key hides
or shows it.

## What it does NOT do

- No memory reading, injection, hooks or modification of game or client files.
- No automation of any kind: no auto-accept, no lobby or champion select
  actions, no automatic item purchases or skill level-ups, no input to the game.
- No write calls to the League client (LCU is used with GET only, for the
  user's own account).
- No timers, cooldown trackers (ultimates, summoner spells, objectives) and no
  items, scores or runes of other players from the game in progress.
- No players whose name is hidden by the game (anonymous mode) and no bots are
  ever looked up.
- No custom ranking or MMR: only Riot's official rank is shown.
- No dynamic in-game advice, no notifications, no ads.
- No win rates for Augments or Arena items.
- No scraping and no third-party statistics websites.

## How it works

`TECCA CODEOFLEGENDS_<version>_x64-setup.exe` installs a local desktop app.
**Every user enters their own Riot API key** in *Settings → Riot API key*.

- The key is stored in the **Windows Credential Manager** (or read from the
  `RIOT_API_KEY` environment variable). It is never sent to the UI, never
  written to the database, logs or build files, and is only sent as the
  `X-Riot-Token` header to `*.api.riotgames.com`.
- All Riot requests are made by the Rust backend. The UI never calls Riot.
- Data is stored in a local SQLite database on the user's PC. There is no
  backend server and no telemetry.

### Rate limits

- Client-side limiter per routing value, below the development key limits
  (18 requests/1 s, 95 requests/2 min); `Retry-After` is respected on `429`,
  with a limited number of retries on `5xx`.
- Local caches: profile 60 min, rank 10 min, match list 3 min; finished matches
  and timelines are downloaded once.
- The optional statistics collector sends at most **one request every 2.5 s**,
  re-reads a ladder at most once a day and each player at most every 12 hours,
  keeps only the last 3 patches, and pauses while the in-game panel is loading.

## Project structure

```
src/                 React + TypeScript UI (features, services, Zod contracts)
src-tauri/src/
  riot/              Riot API client (routing, rate limiter, key storage)
  meta/              opt-in champion statistics (collector + aggregations)
  live/              Live Client Data API, overlay and in-game panel
  client/            League Client API (read-only, own account)
  ddragon/, catalog/ Data Dragon import
src-tauri/migrations SQLite schema (append-only)
docs/                architecture, database, compliance and feature docs
```

More detail: [docs/RIOT_COMPLIANCE.md](docs/RIOT_COMPLIANCE.md),
[docs/LIVE_GAME.md](docs/LIVE_GAME.md),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/DATABASE.md](docs/DATABASE.md),
[docs/ROADMAP.md](docs/ROADMAP.md) and the user guide
[docs/USER_GUIDE.md](docs/USER_GUIDE.md). The app interface is in Italian.

## Build from source

Requirements: Windows 10/11, a current Node.js LTS, Rust stable (1.77.2 or
newer), WebView2.

```powershell
npm install
npm run desktop:dev      # run the app in development
npm run desktop:build    # build the Windows installer (NSIS)
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`,
`cargo test --manifest-path src-tauri/Cargo.toml`,
`cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.

## License

Declared as MIT in `package.json` (a `LICENSE` file has not been added yet).
Riot Games data and assets remain property of Riot Games, Inc.
