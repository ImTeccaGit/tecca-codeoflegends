# TECCA CODEOFLEGENDS — User guide

Windows desktop companion for League of Legends, built with Tauri 2, React and
Rust. The app is **local-first**: data lives in a SQLite database on the
device, there is no telemetry and no Riot credential goes through the
frontend. It does not read the game's memory and does not modify its files.
The app interface is in Italian.

> **Release 0.10.0 (beta).** 9 of 11 modules work. Rune Builder and Build
> Builder are still planned. Riot API features were verified with simulated
> responses; checking them with a real key is up to the user. Open issues:
> [§ 0.6](#06-open-issues-of-the-release).

TECCA CODEOFLEGENDS isn't endorsed by Riot Games and doesn't reflect the views
or opinions of Riot Games or anyone officially involved in producing or
managing Riot Games properties. Riot Games, and all associated properties are
trademarks or registered trademarks of Riot Games, Inc.

---

## 0. Quick guide

### 0.1 Install

1. Get `TECCA CODEOFLEGENDS_0.10.0_x64-setup.exe`. If you build it yourself,
   it is in `src-tauri\target\release\bundle\nsis\`.
2. Run it. Installation is **per user** and needs no administrator privileges;
   it installs to `%LOCALAPPDATA%\TECCA CODEOFLEGENDS` and creates Start menu
   shortcuts.
3. The installer is **not digitally signed**, so Windows SmartScreen may show
   "Windows protected your PC": choose *More info → Run anyway* only if the
   installer comes from a source you trust.
4. WebView2 is already present on up-to-date Windows 10/11. If it is missing,
   the installer downloads Microsoft's official bootstrapper.

### 0.2 Start

From the Start menu: **TECCA CODEOFLEGENDS**. On first start:

- the database is created in `%APPDATA%\com.tecca.codeoflegends\`;
- the Data Dragon catalog is imported automatically (needs the network, about
  3 MB).

### 0.3 Update

Updates are **manual and safe**: there is no automatic download.

1. Close the app.
2. Run the installer of the new version: it updates the existing installation
   and leaves the data where it is.
3. On the first start, if the database schema changes, the app creates a
   verified backup (`backups\…pre-migration…`) before migrating.

The installer refuses to install an **older** version over a newer one
(`allowDowngrades: false`). A database created by a newer version is not
opened by an older one either, so data is not corrupted. Details:
[DATABASE.md](DATABASE.md). Architecture planned for a future signed in-app
update: [ARCHITECTURE.md § Updates](ARCHITECTURE.md#9-updates).

### 0.4 Configure the APIs

- **Data Dragon**: no configuration, it is public.
- **Your account, without a key**: open the League of Legends client. The app
  automatically reads, read-only, your account, rank and last 20 matches, and
  sets them as the main profile (Settings → *Automatic account from the League
  client*, can be turned off). It uses the client API, which Riot does not
  officially support: it may stop working after an update. During a game the
  app recognizes your Riot ID anyway.
- **Riot API (key)**, to look up **other** players, collect champion
  statistics and fill the in-game panel:
  1. get a key at [developer.riotgames.com](https://developer.riotgames.com).
     Development keys expire after 24 hours; regular use needs an approved
     personal or production key;
  2. paste and save it in **Settings → Riot API key**. It goes to the Windows
     Credential Manager and is never shown again;
  3. press **Verify key**;
  4. alternatively set the `RIOT_API_KEY` environment variable, which takes
     precedence.
- **Champion statistics**: switch in Settings (off by default), with region
  and tier. It downloads recent Ranked Solo/Duo matches with your key, one
  request every 2.5 s, while the app is open.
- **Live Game**: turn it on with the switch in the Live Game page (off by
  default). It uses only the game's local API during a game. The in-game panel
  opens by itself at the start of a game; `Home` hides or shows it. The game
  must run in "Borderless" or "Windowed" mode.

### 0.5 Create a new build

Requirements: [§ 3](#3-requirements).

1. Update the version **in all three files**: `package.json`,
   `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`. The
   `release_tests` test fails if they differ.
2. If the schema changes, add a **new** migration in `src-tauri/migrations/`
   and its entry in `MIGRATIONS`.
3. Run all the checks (they must pass without errors):

```powershell
npm run typecheck; npm run lint; npm test; npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

4. Build the installer:

```powershell
npm run desktop:build
```

The output is `src-tauri\target\release\bundle\nsis\TECCA CODEOFLEGENDS_<version>_x64-setup.exe`.
On the first build Tauri downloads the NSIS tools from GitHub.

### 0.6 Open issues of the release

| Issue | Impact | Required action |
| --- | --- | --- |
| Unsigned installer | SmartScreen warning | A code signing certificate (Authenticode) and its configuration in `bundle.windows` |
| Real Riot key never tried | Riot API features verified only with simulated responses | Enter a valid key and sync a profile |
| Live Game and in-game panel not tried in a real match | Verified without a game in progress and in the Practice Tool | Start a match with detection on |
| Product registration on the Riot Developer Portal | Required for public distribution | Up to the project owner |
| No `LICENSE` file | `package.json` declares MIT but the license text is missing | Legal choice of the owner |
| `cargo audit` not run | Rust dependencies not checked against the advisory DB | `cargo install cargo-audit`, then `cargo audit` |
| Rune Builder, Build Builder | Planned modules | Future phases |

---

## 1. What really works

| Area | Status | Notes |
| --- | --- | --- |
| App shell | Working | Permanent sidebar, mobile drawer, top bar, `Ctrl+K` command palette, skip link |
| Dashboard | Working | Real local data; win rate, KDA, rank, LP, matches, chart, champions and patch empty until Riot is connected, or demo data with **DEMO mode** |
| Settings | Working | Region, animations, Riot key, champion statistics, database backup, diagnostics, Riot legal notice |
| Rust backend | Working | Thin Tauri commands, errors serialized as `{ code, message }` |
| Database | Working | SQLite WAL, schema v10, append-only migrations, automatic pre-migration and manual backups, compatibility check. Details in [DATABASE.md](DATABASE.md) |
| Activity log | Working | Only real app events, at most 200 records, no telemetry |
| Technical logs | Working | Rotated local files (`tauri-plugin-log`), path shown in Settings |
| Champions | Working | Riot Data Dragon catalog (`it_IT`): grid, search, filters by real lane, class and favorites, sorting; champion page with lanes, statistics panels, abilities, stats, ratings and skins |
| Champion statistics | Implemented (check with a real key pending) | Most used runes, skill order, builds, summoner spells, counters, pick/win/ban rates from matches collected with your key, or from your own saved matches (labelled) |
| Data Dragon | Working | Automatic (check every 6 hours) and manual import of champions, abilities, skins, items and runes, versioned per patch, with integrity check |
| Riot API | Implemented (check with a real key pending) | Account-v1, Summoner-v4, League-v4, Match-v5 from the Rust backend only; key in `RIOT_API_KEY` or the Windows Credential Manager |
| Automatic account | Implemented and verified with a real client | Account, rank and last 20 matches from the open League client, without a key (LCU, read-only); Riot ID from the game as a fallback |
| Player Profiles | Implemented | Search by Riot ID and region, Solo/Flex rank, statistics, per-champion performance, saved and main profiles |
| Match History | Implemented | match-v5 matches stored locally with items, runes, KDA, CS/min, queue filters |
| Live Game | Implemented (verified without a match in progress) | Opt-in, local Live Client Data API, read-only. Details in [LIVE_GAME.md](LIVE_GAME.md) |
| In-game panel | Implemented (not yet tried in a real match) | Opens by itself, `Home` to hide/show; official rank, level and recent ranked games of the players, build of your champion; hidden names and bots never looked up |
| Desktop overlay | Implemented | Separate, optional, transparent and click-through Tauri window (or normal window); configurable size, position, opacity and theme |
| Jungle & Farming | Working | Original schematic map (Blue/Red Side, 12 camps, Scuttle, epic pits), template and custom routes, training stopwatch with per-camp times, history, best, comparison and chart |
| Match Analysis | Implemented (verified with simulated data) | Post-game on your match-v5 matches: cards, charts, tables by champion and role, match detail with lane comparison, filters; source, patch, sample size and 95% CI always shown. Details in [MATCH_ANALYSIS.md](MATCH_ANALYSIS.md) |
| Matchups | Implemented (same check) | Your champion vs lane opponents you faced: win rate, pick/ban presence in your matches, counters, synergies, runes used, completed items |
| Runes, Builds | **Planned scaffolds** | Route and layout present. Items and runes are already imported for the future builders |

The "Active modules" counter in the dashboard comes from the registry
`src/app/navigation.ts` and is **9 / 11** in this phase.

### Riot API

- **Key**: paste it in **Settings → Riot API key** (stored in the Windows
  Credential Manager, write-only field) or set the `RIOT_API_KEY` environment
  variable, which takes precedence. The key never reaches the frontend and
  never ends up in logs, the database or the repository. Development keys from
  the Riot Developer Portal expire after 24 hours.
- **Endpoints used** (official only): `account-v1`, `summoner-v4`,
  `league-v4`, `match-v5` (including timelines), `lol-status-v4` (key check).
  No scraping.
- **Rate limits**: development key limits (20/s, 100/2 min) applied per
  routing value, with a margin; `429` responses respect `Retry-After`.
- **Cache**: profile 60 min, rank 10 min, match list 3 min; each match is
  downloaded once. "Update from Riot" forces a refresh.
- **Dashboard**: with a saved main profile it shows real data, labelled with
  its source; remakes are excluded from statistics. DEMO mode turns off when
  real data exists and never mixes with it.

### Jungle & Farming

- **Map**: original TECCA SVG, no Riot graphic assets. Positions are
  schematic (good for studying camp order, not to exact scale).
- **Template routes** for Blue and Red Side: Full Clear (Red and Blue start),
  5 Camp, 3 Camp, simulated invade. They only give the camp order: no
  "official" times. Custom routes are created by clicking the map or starting
  from a template.
- **Training stopwatch**: manual start, one time per camp, pause, undo last
  camp. It is explicitly a training timer: it does not read the game and is not
  a live timer.
- **History**: each attempt saves a copy of the route (still valid if you
  change or delete the route); personal best, average, improvement, chart and
  camp-by-camp comparison between two attempts.
- **Monsters and objectives**: names, type, side and area. **No spawn or
  respawn times**: Riot does not publish them in a structured, versioned
  source, so the app points to the official patch notes.
- **Jungle champion cards**: champions really played in the jungle.

### Data Dragon data

- Source: [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon),
  public CDN, no key. Downloaded only by the Rust backend.
- On first start the catalog is imported automatically (about 3 MB
  compressed). Then one check every 6 hours; the **Check for updates** button
  in the Champions page runs it at once.
- Every patch stays stored: a new version adds rows and neither changes nor
  deletes previous ones (constraint enforced by SQLite triggers).
- Images are not downloaded: Data Dragon file names are stored and the app
  builds the official URLs. Skin splash art is not versioned by the CDN.
- Data Dragon also lists chroma variants without an image: the app shows them
  in a separate list instead of inventing a preview.
- The **Class** filter uses the official Data Dragon classes (Assassin,
  Fighter, Mage, Marksman, Support, Tank).
- The **Lane** filter (Top, Jungle, Mid, Bot, Support, with original icons)
  uses the lanes **really played** in collected and saved matches (at least 15%
  of the champion's games with a known lane). Riot does not publish champion
  lanes, so champions without matches have no lane yet.
- **Favorites**: star on card and champion page, "Favorites" filter. Saved in
  SQLite and tied to the champion's stable id: they stay valid at every new
  patch.

---

## 2. Stack

- **Frontend:** React 19, TypeScript 7 (`strict`), Vite 8, Tailwind CSS 4.
- **UI:** shadcn/ui primitives (Radix + CVA), `lucide-react`, `sonner`,
  `tw-animate-css` for Dialog and Tooltip animations.
- **State:** TanStack Query for backend data, Zustand only for ephemeral UI
  state.
- **Contracts:** Zod at the boundaries (`src/types/*`, `src/lib/tauri.ts`).
- **Desktop:** Tauri 2.
- **Backend:** Rust, `rusqlite` with bundled SQLite, `tauri-plugin-log`,
  `tauri-plugin-global-shortcut`, `reqwest` with Windows native TLS (Data
  Dragon, Riot API, Live Client), `keyring` (Windows Credential Manager).
- **Charts:** Recharts (lazy-loaded), real data only.
- **Fonts:** Manrope Variable and Space Grotesk Variable, bundled.

---

## 3. Requirements

- Windows 10/11 (primary target).
- Node.js 20+ (verified with Node 26).
- Rust stable with the MSVC toolchain (verified with Rust 1.99).
- Visual Studio 2022 Build Tools with the **Desktop development with C++**
  workload (needed to link Tauri on Windows).
- WebView2 (normally already present on Windows 11).

---

## 4. Running

```powershell
npm install
npm run desktop:dev
```

`npm run desktop:dev` starts Vite on port `1420` and opens the Tauri window.
The database is created on first start in:

```
%APPDATA%\com.tecca.codeoflegends\tecca-codeoflegends.sqlite3
```

The exact path can be seen and copied from **Settings → Local database**.

Technical logs (database and interface errors) are written to:

```
%LOCALAPPDATA%\com.tecca.codeoflegends\logs\tecca-codeoflegends.log
```

Rotation at 1 MB, 5 files kept, UTC timestamps. They stay on the device. If
the database cannot be opened, the app still starts and shows an explicit
error with the log path.

### Frontend only, in the browser

```powershell
npm run dev
```

In this mode the backend is not available: the dashboard shows the "Browser
preview" state, the database is reported as unavailable and saving is
disabled. This is intended, not a fallback that pretends to succeed.

---

## 5. Commands

```powershell
npm run dev              # Vite dev server (browser)
npm run build            # typecheck + production build
npm run preview          # build preview
npm run typecheck        # TypeScript only
npm run lint             # oxlint
npm test                 # Vitest (pure logic, DEMO dataset, navigation)
npm run test:rust        # cargo test (databases on temporary files)
# Live check on real Data Dragon (network, ~2 minutes): full import,
# 1:1 comparison with the official champion list, check of ~2,100 images
cargo test --manifest-path src-tauri/Cargo.toml live_data_dragon_import -- --ignored --nocapture

npm run desktop:dev      # full Tauri app
npm run desktop:build    # Windows bundle (NSIS)

npm run check:rust       # cargo check
npm run lint:rust        # cargo clippy -D warnings
npm run fmt:rust         # cargo fmt
```

Full check before considering a task done:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

---

## 6. Structure

```
src/
  app/            router, providers, module registry
  components/     UI, layout, feedback, shared
  features/       one module per folder (dashboard, champions, jungle,
                  players, matches, analysis, matchups, live, settings…)
  hooks/          TanStack Query hooks
  lib/            utils, errors, Tauri gateway, query client
  services/       the only access point to invoke and external URLs
  stores/         Zustand (UI only)
  types/          Zod contracts
src-tauri/
  src/            main, lib, commands, db, backup, error, catalog, ddragon,
                  riot, meta, client, analysis, live, jungle
  migrations/     append-only SQL
  capabilities/   Tauri permissions
docs/             ARCHITECTURE, ROADMAP, DATABASE, RIOT_COMPLIANCE,
                  LIVE_GAME, MATCH_ANALYSIS, USER_GUIDE
scripts/          icon generation
```

Architectural details and boundaries: [ARCHITECTURE.md](ARCHITECTURE.md).
Development plan and exit criteria: [ROADMAP.md](ROADMAP.md).

---

## 7. Data rules

1. No invented data is shown as real.
2. Every external value has a source, patch/version and fetch timestamp.
3. Empty states are explicit; modules that are not ready say so.
4. Errors are shown with an understandable message; the technical detail stays
   in the local logs.
5. Preferences are really persisted, not only kept in memory.

These rules are binding and repeated in [`AGENTS.md`](../AGENTS.md).

---

## 8. Riot Games compliance

The project respects these constraints:

- no Riot API key in the frontend, the repository, build files or logs;
- no access to the game process memory (no hooks, injection, pattern scanning
  or debugger);
- no changes to game or client files;
- no gameplay automation or input manipulation;
- only public/documented APIs and allowed data;
- respect for rate limits, Terms of Service and Riot policies;
- overlay and in-game panel only as separate, transparent Tauri windows that
  do not interact with the game.

Riot integrations live exclusively on the Rust side, with the key handled
through the OS credential store. Full check:
[RIOT_COMPLIANCE.md](RIOT_COMPLIANCE.md).

---

## 9. Security

- Strict CSP in `src-tauri/tauri.conf.json`: the production one does not
  include the dev server, which stays only in `devCsp`.
- Minimal Tauri capabilities:
  - `main` window: `core:event:default`, `opener:allow-open-url` with scope
    limited to allowlisted domains, `log:allow-log`;
  - `overlay` and `board` windows: `core:event:default`, `log:allow-log`.
  The `release_tests` test blocks `core:default`, `shell:`, `fs:`, `http:` and
  `process:`.
- No generic shell permission.
- External links only to `developer.riotgames.com`, `www.riotgames.com` and
  `www.leagueoflegends.com` (patch notes), through an allowlist enforced both
  in `src/services/external-service.ts` and in the opener capability.
- User error messages without technical details; the detail goes to the local
  logs.
- Input validated both in TypeScript (Zod) and in Rust.
- `.env` and credentials ignored by Git.

---

## 10. Known problems and solutions

| Problem | Cause | Solution |
| --- | --- | --- |
| `npm.ps1 cannot be loaded` | PowerShell execution policy | Use `npm.cmd` or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `Option 'baseUrl' has been removed` | TypeScript 7 | Do not use `baseUrl`; aliases live only in `paths` and `vite.config.ts` |
| `Cannot find package 'esbuild'` during build | Vite 8 no longer includes esbuild | Keep `minify` boolean in `vite.config.ts` |
| `link.exe not found` during `cargo check` | Missing C++ workload | Install VS 2022 Build Tools with `Microsoft.VisualStudio.Workload.VCTools` |
| JS chunk > 500 kB | UI dependencies concentrated | Non-blocking warning; charts are already in lazy chunks |
| SmartScreen on install | Unsigned installer | See § 0.6 |
| In-game panel not visible over the game | Game in exclusive fullscreen | Set League to "Borderless" or "Windowed" |
| "Riot API key invalid or expired" | Development keys last 24 hours | Regenerate it on the Developer Portal or use a personal key |

---

## 11. License

`package.json` declares MIT, but the `LICENSE` file is not there yet (see
§ 0.6). The project is not affiliated with Riot Games. League of Legends is a
trademark of Riot Games, Inc.
