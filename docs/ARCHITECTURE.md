# Architecture — Tecca CodeOfLegends

Reference document for the technical structure. It describes only what exists
and works, plus the planned extension points.

---

## 1. Principles

1. **Strict layer separation.** The UI never talks directly to SQLite or to
   external APIs.
2. **Validation at the boundaries.** Every value crossing the Tauri bridge is
   validated with Zod; every external input is validated again in Rust.
3. **A single entry point.** TypeScript services are the only way into
   `invoke`; Rust is the only access point to the filesystem and the database.
4. **Transparency.** No silent fallback that pretends to succeed. If the
   backend is missing, the UI says so.
5. **Append-only migrations.** The schema evolves by adding files, never by
   changing applied ones.

---

## 2. Data flow

```
┌─────────────────────────────────────────────────────────────┐
│ React (feature)                                             │
│  └─ TanStack Query hook (src/hooks)                         │
│      └─ TypeScript service (src/services)                   │
│          └─ invokeCommand + Zod schema (src/lib/tauri.ts)   │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tauri IPC
┌───────────────────────────▼─────────────────────────────────┐
│ Rust                                                        │
│  commands.rs  → validation and orchestration                │
│  db.rs        → SQLite, migrations, activity log            │
│  models.rs    → serialized contracts (camelCase)            │
│  error.rs     → AppError { code, message }                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ rusqlite
┌───────────────────────────▼─────────────────────────────────┐
│ Local SQLite (WAL, foreign_keys ON, STRICT tables)          │
└─────────────────────────────────────────────────────────────┘
```

Practical rules:

- No component imports `@tauri-apps/api/core` directly; only
  `src/lib/tauri.ts` does.
- No component imports `rusqlite` or SQL.
- TanStack Query owns server state; Zustand owns only ephemeral UI state
  (command palette, mobile drawer).

---

## 3. Frontend

### 3.1 Module registry

`src/app/navigation.ts` is the single source for:

- module list, labels and descriptions;
- navigation group;
- phase and status (`available`, `in-development`, `planned`);
- icon and path.

Sidebar, mobile drawer, command palette, dashboard and scaffold pages read the
same registry. Adding a module means adding an entry here and a route in the
router.

### 3.2 Routing

`src/app/router.tsx` uses `createHashRouter`, a deliberate choice to avoid
deep-link problems in the Tauri webview. Main routes:

| Path | Page | Status |
| --- | --- | --- |
| `/` | Dashboard | Real |
| `/settings` | Settings | Real |
| `/champions` | Champions | Real (Data Dragon + real lanes) |
| `/champions/:championId` | Champion detail | Real (Data Dragon + champion statistics) |
| `/runes` | Rune Builder | Scaffold |
| `/builds` | Build Builder | Scaffold |
| `/jungle` | Jungle Routes | Real (training only) |
| `/players` | Player Profiles | Real (Riot API) |
| `/matches` | Match History | Real (Riot API / League client) |
| `/analysis` | Match Analysis | Real (local match-v5 data) |
| `/matchups` | Matchups | Real (local match-v5 data) |
| `/live` | Live Game & Overlay | Real (separate `overlay` and `board` windows) |
| `*` | 404 | Real |

The separate `overlay` and `board` windows load the same bundle and, based on
their label, render only `OverlayApp` or `BoardApp` (no router, no input).

### 3.3 Shell and accessibility

- Permanent sidebar on desktop (`lg`), Radix drawer on mobile.
- Skip link to `#main-content`.
- Global visible focus, ARIA roles in the primitives, keyboard navigation.
- Command palette with `Ctrl+K`, arrows, `Enter` and `Esc`.
- Short animations, disabled by `prefers-reduced-motion` and by the user
  preference (`html[data-reduce-motion="true"]`).

### 3.4 Design system

Tokens defined once in `src/index.css` and mapped to Tailwind with
`@theme inline`:

| Token | Value |
| --- | --- |
| Background | `#10121C` |
| Surface / Card | `#191B29` |
| Primary | `#8B6CFF` |
| Secondary | `#42D6D0` |
| Foreground | `#F3F4FA` |
| Muted foreground | `#969AAF` |

Shadows and glows are tokens too (`--shadow-card`, `--shadow-button-primary`,
`--shadow-nav-indicator`, `--shadow-module-hover`, `--shadow-hero`,
`--drop-shadow-rift-path`, `--drop-shadow-rift-camp`) and generate the
`shadow-*` / `drop-shadow-*` utilities. Reusable decorative backgrounds live as
utilities in `index.css` (`app-backdrop`, `surface-grid`,
`hero-secondary-glow`, `chart-grid`, `panel-sheen`). No color (hex or `rgba`)
is written in components.

Dialog and Tooltip enter/exit animations (`animate-in`, `fade-in-0`,
`zoom-in-95`, …) come from `tw-animate-css`, imported in `index.css`. They
follow the same reduced-motion rules.

### 3.5 Error handling

- `AppError` (`src/lib/errors.ts`) normalizes backend, network and unknown
  errors into `{ code, message }`.
- `src/lib/query-client.ts` registers `QueryCache` and `MutationCache` to show
  global toasts on errors and write them to the local logs.
- `ErrorBoundary` catches rendering errors and writes them to the logs through
  `src/services/log-service.ts`.
- Features show explicit loading, empty, error and success states.

### 3.6 Competitive data and DEMO mode

- Contract: `src/types/dashboard.ts` (Zod).
- Calculations: `src/lib/match-stats.ts`, pure functions. Every card value
  (win rate, KDA, averages, champions, chart) is derived from the listed
  matches, never written by hand.
- Origin: the main profile (Riot API or League client); without one, panels
  show explicit empty states.
- **DEMO mode**: switch in the dashboard (`demoMode` in Zustand, session only,
  off at every start). The dataset in `features/dashboard/demo/` has
  `source: "demo"`, ids `DEMO-xxx`, patch `DEMO`, and every panel shows
  `DemoBadge`. It is never saved or sent to the backend.
- The chart (Recharts) is lazy-loaded: a chunk separate from the main bundle.
  One series at a time, one axis.

### 3.7 Browser preview

`getSystemSnapshot()` returns a snapshot marked `runtime: "browser"` when
`window.__TAURI_INTERNALS__` is not present. It is not a mock of game data: it
describes the missing backend and disables saving.

---

## 4. Rust backend

### 4.1 Tauri commands

| Command | Input | Output |
| --- | --- | --- |
| `get_system_snapshot` | — | `SystemSnapshot` |
| `update_settings` | `SettingsPatch` | `AppSettings` |
| `get_champion_catalog` | — | `ChampionCatalog` (current patch) |
| `get_champion_detail` | `key` (Data Dragon id, alphanumeric ≤ 64) | `ChampionDetail \| null` |
| `get_catalog_status` | — | `CatalogStatus` |
| `sync_data_dragon` | — | `SyncOutcome` (async) |
| `set_champion_favorite` | `championId`, `favorite` | `ChampionPreferences` |
| `set_champion_lanes` | `championId`, `lanes` (≤ 5, Riot values) | `ChampionPreferences` (no longer used by the UI) |
| `list_jungle_routes` | — | `CustomRoute[]` |
| `save_jungle_route` | `RouteInput` (create or update) | `CustomRoute` |
| `delete_jungle_route` | `id` | — |
| `list_clear_attempts` | — | `ClearAttempt[]` (last 1000) |
| `save_clear_attempt` | `AttemptInput` | `ClearAttempt` |
| `delete_clear_attempt` | `id` | — |
| `get_match_analysis` | `puuid` | `AnalysisDataset \| null` (local data only) |
| `get_client_account_status` | — | `ClientStatus` |
| `set_client_sync_enabled` | `enabled` | `ClientStatus` |
| `sync_from_client` | — | `ClientStatus` (async, immediate read) |
| `set_league_install_path` | `path \| null` (validated: contains `LeagueClient.exe`) | `ClientStatus` |
| `get_live_snapshot` | — | `LiveSnapshot` |
| `set_live_enabled` | `enabled` | `LiveSnapshot` |
| `get_overlay_settings` | — | `OverlaySettings` |
| `update_overlay_settings` | `OverlayPatch` (async: creates/closes the window) | `OverlaySettings` |
| `get_live_board` | — | `LiveBoard` |
| `toggle_live_board` | — | `bool` (panel open) |
| `is_live_board_open` | — | `bool` |
| `get_global_stats_status` | — | `GlobalStatsStatus` |
| `update_global_stats_settings` | `enabled`, `platform`, `seedTier` | `GlobalStatsStatus` |
| `clear_global_stats` | — | `GlobalStatsStatus` |
| `get_champion_global_stats` | `championId`, `patch \| null`, `role \| null` | `ChampionGlobalStats` |
| `get_champion_roles` | — | `ChampionRolesOverview` |

Riot commands are listed in § 4.8 and backup commands in § 4.11.

Event to the webview: `catalog-updated` (payload: version) after every
successful import. `useCatalogUpdateListener` invalidates the `["catalog"]`
queries.

Commands delegate the logic to dedicated modules; they contain no queries or
complex business rules.

### 4.2 Errors and logs

`AppError` always serializes as:

```json
{ "code": "DATABASE_ERROR", "message": "Operazione sul database locale non riuscita. ..." }
```

- `message` is the text for the user (`AppError::user_message`, in Italian like
  the UI), without technical details. Validation errors are the exception,
  being already understandable.
- The technical detail (`Display`) is written to the logs by
  `AppError::logged()` at the boundary of every command.

Exposed codes: `DATABASE_ERROR`, `VALIDATION_ERROR`, `NETWORK_ERROR`, `BUSY`,
`NOT_FOUND`, `RIOT_KEY`, `RATE_LIMITED`, `BACKEND_UNAVAILABLE`. The frontend
normalizes unknown codes to `UNKNOWN_ERROR`.

**Local logs** (`tauri-plugin-log`): rotated files (1 MB, 5 files kept, UTC
timestamps) in `%LOCALAPPDATA%\com.tecca.codeoflegends\logs\`, plus stdout in
development. The path is exposed in the snapshot (`logDirectory`) and shown in
Settings. Nothing is sent remotely; secrets are never logged.

**Database that cannot be opened:** the app does not exit.
`DatabaseSlot::Unavailable` is handled as Tauri state, every command returns
`DATABASE_ERROR` with a message pointing to the log folder, and the UI shows the
error state.

### 4.3 Database

Opening in `Database::open`:

- Tauri app directory created if missing;
- `journal_mode = WAL`;
- `foreign_keys = ON`;
- `busy_timeout = 5000`;
- missing migrations applied in a transaction;
- real "Application started" event recorded;
- activity log limited to 200 records.

### 4.4 Base schema (v2, unchanged)

| Table | Purpose | Notes |
| --- | --- | --- |
| `settings` | Local preferences | Serialized JSON values, `updated_at` |
| `champions` | Champion identity | Unique `champion_key` |
| `favorite_champions` | Favorites | FK with `ON DELETE CASCADE` |
| `rune_pages` | Future rune pages | `shards_json` |
| `builds` | Future builds | `items_json`, `skill_order_json` |
| `jungle_routes` | Custom jungle routes | `steps_json`, `patch` |
| `players` | Riot profiles | key `puuid` |
| `matches` | Match history | `raw_json`, indexes per player and date |
| `match_participants` | Participants | composite key `(match_id, puuid)` |
| `matchup_notes` | Personal notes | FK to `champions` |
| `activity_log` | Real local events | index on `created_at` |

All tables are `STRICT`. Timestamps are ISO 8601 UTC generated by SQLite with
`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`.

### 4.5 Data Dragon catalog (schema v3)

Rust modules:

```
ddragon/model.rs       raw JSON shapes (serde), required fields mandatory
ddragon/bundle.rs      conversion + validation (before any write)
ddragon/client.rs      HTTP: timeouts, 3 attempts with backoff on transient errors only
ddragon/sync.rs        one sync at a time, scheduler every 6 h, check log
catalog/repository.rs  all SQL: transactional import, verification, queries
catalog/dto.rs         contracts for the frontend (Zod in src/types/catalog.ts)
```

| Table | Key | Notes |
| --- | --- | --- |
| `patch_versions` | `version` | source, URL, language, counts, `imported_at` |
| `champions` (0001) | `id` = Riot numeric key | stable identity, updated only by the newest patch |
| `champion_versions` | `(champion_id, patch_version)` | name, title, lore, classes, resource, ratings, stats, image |
| `champion_spells` | `(champion_id, patch_version, slot)` | `P`, `Q`, `W`, `E`, `R`; composite FK to `champion_versions` |
| `champion_skins` | `(patch_version, skin_id)` | `UNIQUE (patch_version, champion_id, num)` |
| `items` | `(patch_version, item_id)` | gold, purchasable, in store, maps, components |
| `rune_trees`, `runes` | `(patch_version, id)` | FK rune → tree of the same patch |
| `data_dragon_checks` | `id` | outcome of each check (last 200) |

Import flow:

1. `versions.json` → newest release version (numeric order).
2. If already present: check recorded as `up_to_date`.
3. Download of `championFull.json`, `item.json`, `runesReforged.json`
   (`it_IT`).
4. Validation: file version, unique numeric ids, 4 abilities + passive, base
   skin present, no duplicates. Any error cancels everything.
5. One transaction inserts everything, then `verify_patch` checks the counts
   against the source, 5 abilities per champion, base skin, unique names,
   `PRAGMA foreign_key_check` and `quick_check`. Any problem rolls back.
6. Commit, `catalog-updated` event and activity log entry.

Guarantees: `BEFORE UPDATE/DELETE` triggers make all versioned tables
immutable; re-importing an existing version is refused; importing an older
patch does not overwrite the champions' identity.

Text: Data Dragon descriptions contain markup. Rust converts it to plain text
(`html_to_text`) and the UI never uses `dangerouslySetInnerHTML`.

### 4.6 Champion preferences (schema v4)

- `favorite_champions` (0001) and `user_champion_lanes` (0004), both tied to
  `champions.id`: they survive every new patch.
- Lanes shown in the UI now come from real matches (§ 4.9c); the table
  `user_champion_lanes` stays in the schema (append-only migrations) but is no
  longer used by the interface.
- SQL in `catalog/preferences.rs`; the catalog enriches each champion with
  `favorite` and `lanes` in a single pass (`PreferenceIndex`).
- Frontend: optimistic mutations on list and detail with rollback on error
  (`useToggleFavorite`).

### 4.7 Jungle & Farming (schema v5)

User training data only: no live integration.

- Rust `jungle/`: `CAMP_IDS` (14 camps, mirror of `src/types/jungle.ts`),
  validation of every input (side, known and non-repeated camps, name ≤ 60,
  notes ≤ 500, existing champion, increasing times, clear ≤ 30 minutes).
- Custom routes in `jungle_routes` (0001): `steps_json` = camps.
- Attempts in `jungle_clear_attempts` + `jungle_clear_splits` (0005): each
  split is the cumulative time when a camp is completed; the total is the last
  split. The attempt keeps the route name, side and camps.
- Frontend `features/jungle/`: schematic map data (`data/camps.ts`), template
  routes (`data/routes.ts`), stopwatch as a pure reducer
  (`lib/training-timer.ts`, tested with a simulated clock) and statistics
  (`lib/attempt-stats.ts`). The stopwatch state lives in the page, so the map
  shows progress and switching route is blocked during a clear.

### 4.8 Riot API and player data (schema v6)

Rust module `riot/`, one service per responsibility:

```
routing.rs     platforms (euw1…) → clusters (americas/europe/asia/sea)
rate_limit.rs  18/1 s and 95/120 s windows per routing value + Retry-After block
secrets.rs     KeyProvider: RIOT_API_KEY, then the Windows Credential Manager
transport.rs   HTTP behind a trait (simulated in tests)
client.rs      X-Riot-Token header, limited 429/5xx retries, error mapping
account.rs / summoner.rs / league.rs / matches.rs   one module per Riot API
repository.rs  SQLite: players, player_ranked, matches, match_participants,
               player_matches, saved_profiles, player_sync
sync.rs        TTLs (profile 60', rank 10', matches 3'), dedup, lock per PUUID
```

Dedicated errors: `NOT_FOUND` (unknown Riot ID), `RIOT_KEY` (missing, invalid
or expired key), `RATE_LIMITED` (with seconds to wait).

Commands: `get_riot_key_status`, `set_riot_api_key` (write-only),
`clear_riot_api_key`, `verify_riot_api_key`, `search_player`, `sync_player`,
`get_player_profile`, `get_primary_profile`, `list_saved_profiles`,
`save_player_profile`, `remove_player_profile`, `delete_player_data`.

A match is shared between players: the link is `player_matches`
(`matches.player_puuid` from 0001 stays unused). `matches.raw_json` keeps the
original match-v5 response.

### 4.9 Match Analysis & Matchups (schema v7)

Rust module `analysis/`: `repository::dataset` returns the player's matches
enriched with:

- lane opponent (same `teamPosition`, opposite team, only if unique);
- allies, enemies and team kills;
- bans;
- items with the "completed" flag from Data Dragon;
- runes;
- patch.

Aggregations are pure TypeScript functions (`src/features/analysis/lib`,
`src/features/matchups/lib`), so cards, tables and charts use the same
numbers. Migration `0007_match_analysis` adds `match_participants.damage_taken`
and the `match_bans` table, with a backfill from `matches.raw_json`. Details in
[MATCH_ANALYSIS.md](MATCH_ANALYSIS.md).

### 4.9b Account from the League client (schema v8)

Rust module `client/` (LCU, read-only, no API key):

```
lockfile.rs    League folder (override, Riot metadata, standard paths) and
               lockfile reading (password never printed)
source.rs      ClientSource (trait) + HttpClientSource: GET with Basic auth to
               127.0.0.1, Riot CA, no proxy
convert.rs     LCU responses → LeagueEntry and MatchDto (same storage as
               match-v5; match id "EUW1_<gameId>", no duplicates; full rune
               page, no shards)
sync.rs        account → saved profile (main if there is none), rank, last
               20 matches with source = 'league-client'
service.rs     check every 30 s, read at each new session and then every
               10 min, `client-account-updated` event, Riot ID from the Live
               Client as a fallback
repository.rs  preferences: enabled, manual folder, Riot ID seen in game
```

Commands: `get_client_account_status`, `set_client_sync_enabled`,
`sync_from_client`, `set_league_install_path`. Migration `0008_client_source`
adds `matches.source` and `player_sync.client_synced_at`; the source shown
("Riot API", "League client (LCU)" or both) is computed from stored data.

### 4.9c Champion statistics (schema v9–v10)

Rust module `meta/` (official Riot API with the user's key, opt-in, off by
default):

```
collector.rs   one step: league-v4 ladder of the chosen tier (Master+:
               challenger/grandmaster/master; Diamond/Emerald/Platinum:
               divisions I and II, page 1) at most once a day, then the
               Solo/Duo matches (queue 420) of the last 2 weeks of one player
               (match-v5) and their timelines, each downloaded once.
               One request every 2.5 s (about half of a development key)
store.rs       settings, seed players, compact rows per participant
               (canonical rune page, keystone, summoner spells, items, skill
               order, starting items, purchases), bans; keeps the last 3
               patches; copy of the user's own matches
stats.rs       aggregations per champion/patch/role: popularity, wins, bans,
               roles, rune pages, keystones, summoner spells, boots,
               completed items, skill order, starting and core builds, lane
               opponents (minimum 5 games, 2 for personal data), real lanes
service.rs     background loop, in-memory state, pauses on 429/errors and
               while the in-game panel is loading
static_data.rs names and icons of rune shards and summoner spells (Data
               Dragon does not import summoner.json or the shards)
```

Commands: `get_global_stats_status`, `update_global_stats_settings`,
`clear_global_stats`, `get_champion_global_stats`, `get_champion_roles`.

Schema v10 (`0010_global_timeline`): for each collected match the match-v5
timeline is also read (one more request) for skill order, starting items
(first 90 s) and purchase order; already stored matches are completed 5 at a
time. The user's own matches (Riot API or League client) are copied with
`seed_tier = 'PERSONAL'`: they never enter the collected statistics, but the
champion page uses them (labelled) when the collected matches do not contain
that champion. Lanes shown in the list and the detail are those really played
(at least 15% of the games with a known lane), no longer chosen by the user. No
percentage is stored: everything is recomputed from the rows at every request
and the UI always shows the sample size. Remakes (< 5 min or early surrender)
are excluded. The rank is verified only for the player each match starts from.

UI: Settings → *Champion statistics* (switch, region, tier, counters,
deletion) and the champion page (lanes, patch, overview, skill order, builds,
counters, role, summoner spells, full runes with alternatives), always shown
with explicit empty states and a banner to start the collection.

### 4.10 Live Game, overlay and in-game panel (no migration)

Rust module `live/`, policies and limits in [LIVE_GAME.md](LIVE_GAME.md):

```
source.rs      LiveSource (trait) + HttpLiveSource: GET https://127.0.0.1:2999,
               bundled Riot CA (certs/riotgames.pem), short timeouts, no proxy
snapshot.rs    pure function: gamestats + activeplayername + playerlist →
               LiveSnapshot with the local player's data and the scoreboard
               identity of the others (no items, scores or timers; hidden
               names and bots without Riot ID)
service.rs     LiveService: opt-in, polling every 2 s in game / 5 s otherwise,
               emits `live-game-update` only on changes
board.rs       in-game panel: public Riot API profile of each player (level,
               Solo/Duo rank, last 5 ranked games) and build of the user's
               champion; `live-board-update` event
overlay.rs     OverlaySettings: validation, patch, pure positioning
window.rs      `overlay` and `board` windows: transparent, always on top,
               click-through; hidden = destroyed; global `Home` shortcut
repository.rs  `live_enabled` and `overlay` keys in the settings table
```

Events: `live-game-update`, `live-board-update` and
`overlay-settings-updated`. Capability `overlay` (windows `overlay` and
`board`): `core:event:default`, `log:allow-log`. The global shortcut is
registered from Rust (`tauri-plugin-global-shortcut`): the webview has no
shortcut permission.

### 4.11 Migrations

```
src-tauri/migrations/0001_init.sql                 initial schema
src-tauri/migrations/0002_defaults.sql             default values + first event
src-tauri/migrations/0003_data_dragon_catalog.sql  versioned Data Dragon catalog
src-tauri/migrations/0004_user_champion_lanes.sql  lanes assigned by the user
src-tauri/migrations/0005_jungle_training.sql      clear attempts and splits
src-tauri/migrations/0006_riot_player_data.sql     Riot API player data
src-tauri/migrations/0007_match_analysis.sql       damage taken, bans (backfill from raw_json)
src-tauri/migrations/0008_client_source.sql        match source, client read
src-tauri/migrations/0009_global_stats.sql         opt-in champion statistics
src-tauri/migrations/0010_global_timeline.sql      timeline data, personal matches
```

`MIGRATIONS` in `src-tauri/src/db.rs` lists the files with `include_str!`. The
applied version is tracked with `PRAGMA user_version`.

**Rule:** never change a released migration. For every change:

1. create `000N_description.sql`;
2. add it to `MIGRATIONS` in order;
3. verify startup on an existing database and on a new one.

On opening, before migrating:

- a database with a **newer** schema than the known one is refused without
  changes (downgrade protection);
- an existing database with an older schema gets a **verified backup**
  (`VACUUM INTO` + `integrity_check`) in `backups/`.

The `backup.rs` module also handles manual backups (commands
`create_database_backup` and `list_database_backups`) and keeps the last 10.
Full guide: [DATABASE.md](DATABASE.md).

---

## 5. Security

- **CSP** in `tauri.conf.json`:
  - production (`csp`): `default-src 'self'`, `connect-src` limited to IPC,
    `img-src` with Data Dragon, `object-src 'none'`, `base-uri 'self'`,
    `frame-ancestors 'none'`, no `unsafe-eval`;
  - development (`devCsp`): adds only the Vite dev server.
- **Minimal capabilities**:
  - `main`: `core:event:default`, `opener:allow-open-url` with a limited
    scope, `log:allow-log`;
  - `overlay` (windows `overlay` and `board`): `core:event:default`,
    `log:allow-log`.
  App commands need no core permissions. The Rust test `release_tests` fails if
  `core:default`, `shell:`, `fs:`, `http:` or `process:` appear, or if the
  production CSP contains the dev server.
- **Network**: only the Rust backend contacts Data Dragon, the Riot API (key in
  the header, rate limits, limited retries) and the local Live Client Data API
  and League client (Riot CA verified). Details in
  [RIOT_COMPLIANCE.md](RIOT_COMPLIANCE.md).
- **External links** HTTPS only and only allowlisted origins
  (`developer.riotgames.com`, `www.riotgames.com`, `www.leagueoflegends.com`
  for official patch notes), enforced twice: in `external-service.ts` and in
  the opener capability scope. The two lists must stay aligned.
- **Secrets** never in the frontend, never in `VITE_*`, never in logs. `.env*`
  ignored except `.env.example`.
- **Input** validated twice: Zod on the client, Rust on the backend.
- **SQL** never built from user input; table and column names come from
  internal constants.

---

## 6. Technical choices and reasons

| Choice | Reason |
| --- | --- |
| HashRouter | Avoids deep-link and reload problems in the Tauri webview |
| Bundled SQLite (`rusqlite`) | No dependency on an external installation |
| Migrations with `include_str!` | Schema versioned in the binary, no missing external files |
| Zod + Rust validation | Defense in depth at the boundaries |
| TanStack Query | Cache, retries, invalidation and explicit server state |
| Minimal Zustand | UI state only, no duplication of server data |
| Local shadcn-style primitives | Full control of style and accessibility without a generator |
| Explicit browser snapshot | The UI stays inspectable without simulating a backend |

---

## 7. How to extend the project

### New UI module

1. Add the entry to `MODULES` (`src/app/navigation.ts`).
2. Create `src/features/<feature>/<feature>-page.tsx`.
3. Register the route in `src/app/router.tsx`.
4. Until the data is real, use `FeaturePlaceholder` with an honest scope and
   prerequisites.

### New backend command

1. Define the models in `src-tauri/src/models.rs` or the module's `dto.rs`.
2. Implement the logic in a dedicated module (not in the command).
3. Expose the command in `commands.rs` and in `generate_handler!`.
4. Define the Zod schema in `src/types/`.
5. Add the function in `src/services/`.
6. Create the TanStack Query hook and handle loading/empty/error.
7. Add a verified manual check and report it.

### New migration

1. Create the numbered SQL file.
2. Add it to `MIGRATIONS`.
3. Verify both a new database and one at the previous version.
4. Never change earlier files.

---

## 8. Known technical debt

- Main JS bundle above 500 kB; Recharts charts are already in a lazy chunk.
- The region list is duplicated in three places (`RIOT_REGIONS`,
  `riotRegionSchema`, `VALID_REGIONS` in Rust).
- In the Rust models `state` and `kind` are `String` while Zod uses enums: a
  new backend value would make the whole snapshot fail.
- Activity log pruning happens only at startup.
- Degraded mode (database that cannot be opened) is verified only at compile
  time, not with a real failure.
- Data Dragon images are not cached locally: offline the data stays readable,
  while images depend on the WebView2 cache.
- Skins without an image are detected only in the UI, on load.
- The `user_champion_lanes` table and the `set_champion_lanes` command are no
  longer used by the UI.
- `matches` has no uniqueness constraint per player beyond the primary key
  `match_id`.
- The activity log can be noisy over many starts; pruning to 200 records
  mitigates but does not remove the problem.
- Unsigned installer (no Authenticode certificate).
- User-facing texts and error messages are in Italian only.

---

## 9. Updates

Current state (0.10.0): **manual update through the NSIS installer**. The
installer of the new version replaces the app files in
`%LOCALAPPDATA%\TECCA CODEOFLEGENDS` and leaves the data in
`%APPDATA%\com.tecca.codeoflegends` untouched.

The architecture is already ready for updates without data loss:

| Element | Where |
| --- | --- |
| Single version in `package.json`, `Cargo.toml` and `tauri.conf.json` | Test `release_tests::version_is_identical_in_cargo_tauri_and_npm` |
| Append-only migrations with transaction and `user_version` | `db.rs` |
| Automatic verified backup before every migration | `backup.rs` |
| A database created by a newer version is refused | `Database::check_compatible` |
| No downgrade from the installer | `bundle.windows.allowDowngrades = false` |
| Stable identifier (`com.tecca.codeoflegends`) that decides the data folder | `tauri.conf.json` |

**In-app update (future, not enabled).** No automatic update is active: an
unsigned updater would allow distributing arbitrary binaries. If added, it
must:

1. use `tauri-plugin-updater` with signed artifacts (minisign key generated
   with `tauri signer generate`). The private key goes **outside** the
   repository, the public one in `plugins.updater.pubkey`;
2. read the manifest only from an HTTPS endpoint controlled by the project
   (for example GitHub Releases);
3. ask the user for confirmation before downloading and installing, with no
   silent updates;
4. also sign the installer with Authenticode;
5. grant the `main` window only the `updater:default` permission, in a
   dedicated capability.

## 10. Build and release

```powershell
npm run desktop:build
```

- Runs `npm run build` (typecheck + Vite), compiles Rust in `release` (LTO,
  `opt-level = "s"`, `panic = "abort"`) and creates the NSIS installer.
- Target: `nsis` with `installMode: currentUser` (no administrator
  privileges), Italian and English languages and LZMA compression. WebView2 is
  installed with the official bootstrapper if missing.
- Output: `src-tauri/target/release/bundle/nsis/TECCA CODEOFLEGENDS_<version>_x64-setup.exe`.
- The executable is `tecca-codeoflegends.exe` (`mainBinaryName`) and the shown
  name is `TECCA CODEOFLEGENDS` (`productName`).
- No MSI is generated: it would need WiX and adds nothing for a per-user
  installation.
