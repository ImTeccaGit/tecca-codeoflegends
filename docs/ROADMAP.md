# Roadmap — Tecca CodeOfLegends

The roadmap explicitly separates what is **verified** from what is
**planned**. No phase can be marked complete without building, running and
verifying its behavior.

Status legend:

- **Completed** — implemented, run and verified.
- **In progress** — partly implemented, not yet verified end to end.
- **Planned** — not implemented; at most an honest UI scaffold exists.

---

## Phase 1 — Foundations · Completed

### Goal

A solid, secure and transparent desktop base to build the modules on.

### Deliverables

- [x] Tauri 2 + React + strict TypeScript + Vite + Tailwind 4 scaffold.
- [x] Dark design system with the official palette and centralized tokens.
- [x] Desktop shell: permanent sidebar, top bar, mobile drawer.
- [x] `Ctrl+K` command palette with search and keyboard navigation.
- [x] Skip link, visible focus, ARIA roles, `prefers-reduced-motion` support.
- [x] Single module registry with status and phase.
- [x] Dashboard with real data: DB state, schema, size, counts, settings,
      activity log.
- [x] Settings truly persisted in SQLite (region, reduced motion).
- [x] Diagnostics: copyable DB path, runtime, local records.
- [x] Rust: `AppError`, typed commands, input validation.
- [x] SQLite: schema v2, append-only migrations, WAL, foreign keys, `STRICT`.
- [x] Local activity log pruned to 200 records.
- [x] Explicit loading, empty, error and success states.
- [x] Browser preview aware of the missing backend.
- [x] Generated app icons and configured Tauri bundle.
- [x] Documentation: `AGENTS.md`, `README.md`, architecture, roadmap.

### Post-review fixes (Phase 1)

- [x] Dialog and Tooltip animations restored (`tw-animate-css`).
- [x] Opener capability limited to allowlisted domains.
- [x] Rotated local technical logs (`tauri-plugin-log`), path in Settings.
- [x] User error messages without technical details.
- [x] App starts even when the database cannot be opened (explicit error).
- [x] Shadow and glow colors moved to `index.css` tokens.
- [x] Misleading texts fixed, a single `<h1>` per page.
- [x] Settings form without synchronization `useEffect`.

### Competitive dashboard (Phase 1)

- [x] Win rate, KDA, rank, LP, matches and Riot API status cards.
- [x] Performance chart (Recharts, lazy-loaded), recent matches, recent
      champions, personal averages, latest patch.
- [x] DEMO mode: labelled demo dataset, session-only, never saved. Without DEMO
      the panels show explicit empty states.
- [x] Zod contracts in `src/types/dashboard.ts` and pure calculations in
      `src/lib/match-stats.ts`, ready for real Riot data.
- [x] Frontend lint with oxlint, tests with Vitest and `cargo test`.

### Verified exit criteria

- `npm run typecheck` without errors.
- `npm run build` without errors.
- `cargo check` without errors.
- `cargo clippy -D warnings` without warnings.
- `cargo fmt --check` clean.
- Desktop app starts, creates the database and persists settings.

### Out of scope in this phase

- Any Riot call.
- Any read of the game client.
- Overlay.
- Champion, match, build or rune data.

---

## Phase 2 — Champions Database · Completed

- [x] Data Dragon backend client with controlled timeouts and retries.
- [x] SQLite catalog versioned per patch, with source, URL and import timestamp.
- [x] Import of champions, abilities (passive + Q/W/E/R), skins, items and runes.
- [x] Automatic check every 6 hours + manual check; log of the checks.
- [x] Immutable historical data (triggers) and integrity check before commit.
- [x] Champion list and detail endpoints.
- [x] List UI: search, Data Dragon class filter, sorting, source state.
- [x] Detail UI: lore, abilities, stats, ratings, skins, patch.
- [x] Tests with fictional fixtures + live test on real Data Dragon (patch
      16.22.1: 173 champions, 865 abilities, 9,268 skin entries, 863 items,
      62 runes, 2,141 images checked).
- [x] Persisted favorites (star on card and detail, "Favorites" filter).
- [x] Lane filter with original icons, based on the lanes champions are really
      played in (collected and personal matches), no longer chosen by the user.
- [ ] Local image cache for fully offline use.

**Exit criterion:** the data shown comes from Data Dragon and states source,
version and timestamp.

---

## Phase 3 — Rune & Build Builder · Planned

**Prerequisites:** real champion catalog and static Riot sources.

- [ ] Data model for rune trees, shards and combination constraints.
- [ ] Rune page CRUD on SQLite.
- [ ] Accessible editor with combination validation.
- [ ] Real item catalog with declared patch.
- [ ] Builds with core and situational items, skill order and notes.
- [ ] Duplicate, rename, delete with confirmation.
- [ ] Local export/import in a versioned format.

**Exit criterion:** create, edit, restart the app and find identical data; no
suggestion presented as a statistic.

---

## Phase 4 — Jungle & Farming · Completed

- [x] Original schematic map: Blue/Red Side, 12 camps, Scuttle, epic pits.
- [x] Template routes per side (Full Clear ×2, 5 Camp, 3 Camp, simulated
      invade), declared as sequences only, without official times.
- [x] Custom routes in SQLite (created from the map or a template, reorder,
      notes, deletion with confirmation).
- [x] Training stopwatch with per-camp time, pause and undo.
- [x] History, personal best, average, improvement, chart, comparison.
- [x] Jungle champion cards.
- [x] Monsters and objectives without invented spawn times; no live feature.
- [ ] Jungle matchup notes and guided training scenarios.

**Exit criterion met:** no route or time is presented as official data; the
only times are those recorded by the user.

---

## Phase 5 — Player Profiles & Match History · Implemented, live check pending

- [x] Key on the Rust side only: `RIOT_API_KEY` or the Windows Credential
      Manager.
- [x] Riot client with regional routing, rate limiting, retries on 429/5xx,
      cache.
- [x] Account search by Riot ID and region (including SEA: sg2, tw2, vn2).
- [x] Profile with Solo/Flex rank, statistics, champions and update times.
- [x] Match sync with deduplication by `match_id`.
- [x] History with items, runes and queue filters.
- [x] States: missing key, unknown account, rate limit, error with previous
      data kept.
- [x] Dashboard fed by the main profile (DEMO never mixed in).
- [x] 21 Rust tests with simulated responses.
- [ ] End-to-end check with a real key in the desktop app.
- [ ] Match detail with all participants (data already stored).

**Exit criterion:** every remote value shows source and fetch time; no profile
or match is invented.

---

## Champion statistics · Implemented, live check pending

- [x] Opt-in collection with the user's key: league-v4 → match-v5 (Solo/Duo).
- [x] Most used runes (full page with shards), keystones, summoner spells,
      boots and completed items per champion, patch and role.
- [x] Popularity, wins, bans and lane opponents with stated sample size.
- [x] Champion page with roles, patch filter and card-style panels.
- [x] Skill order, starting items and core build (match-v5 timeline).
- [x] Real champion lanes (list and detail) instead of user-chosen ones.
- [x] Statistics from the user's own matches when collected ones are missing
      (labelled).
- [ ] Check with a real key and a meaningful volume of matches.

---

## Phase 6 — Match Analysis & Matchups · Implemented

Details and limits: [MATCH_ANALYSIS.md](MATCH_ANALYSIS.md).

- [x] Documented and tested post-game metrics (KDA, CS/min, gold/min, KP,
      damage, vision).
- [x] Recharts charts only on real, verifiable series.
- [x] Statistics with stated source, patch, sample size, period and 95% CI.
- [x] Matchups, counters, synergies, runes and items computed from the user's
      matches.
- [x] Analysis rebuildable offline from cached data.
- [ ] Match timeline in the personal analysis: purchase order, gold over time.
- [ ] Personal matchup notes (table `matchup_notes` already present).
- [ ] Ranked tier filter: not possible with match-v5 (no historical rank).
- [ ] Check with real matches (needs the user's Riot key).

**Exit criterion:** no demo chart or win rate is shown as the user's match
data.

---

## Phase 7 — Live Game & Overlay · Implemented

Riot policies checked: see [LIVE_GAME.md](LIVE_GAME.md).

- [x] Game detection through the local Live Client Data API, read-only.
- [x] No hooks, injection, pattern scanning or memory reading.
- [x] Separate Tauri overlay window, transparent and non-interactive over the
      game.
- [x] Immediate kill switch and explicit consent (off by default).
- [x] For other players, only the scoreboard identity; their game data is
      discarded in the backend.
- [x] In-game panel (approved by the user on 2026-11-10): official rank,
      level and recent ranked games of the other players, informative build of
      the user's own champion; opens by itself, `Home` to hide or show it.
- [ ] ~~Contextual in-game advice~~: excluded, policies forbid apps that
      dictate the player's decisions.
- [x] No gameplay automation or input manipulation.
- [ ] Check with a real game (depends on the user).

**Exit criterion:** the app does not modify, automate or inspect the game's
memory in any way.

---

## Phase 8 — Polish and distribution · Release 0.10.0 (beta)

- [x] Automated frontend (Vitest) and backend (cargo test) tests, with release
      guards (single version, CSP, permissions).
- [x] Chart code splitting (lazy Recharts).
- [x] Safe update path: verified backup before every migration, newer
      databases refused, `allowDowngrades: false`.
- [x] Manual database backups from Settings.
- [x] Per-user NSIS installer (Italian and English).
- [ ] Authenticode signature of the installer (needs a certificate).
- [x] Rotated, diagnosable local logs.
- [x] User documentation: installation, startup, update, API, build
      (README, [USER_GUIDE.md](USER_GUIDE.md), [DATABASE.md](DATABASE.md),
      [RIOT_COMPLIANCE.md](RIOT_COMPLIANCE.md)).
- [x] Public source repository for the Riot personal key request.
- [ ] Signed in-app update (`tauri-plugin-updater`), only with a signature and
      user confirmation: architecture in ARCHITECTURE.md § 9.
- [ ] Product registration on the Riot Developer Portal before public
      distribution.
- [ ] `LICENSE` file (owner's choice; `package.json` declares MIT).

---

## Permanent non-goals

These will never be part of the product, whatever the phase:

- gameplay automation, clickbots, ability scripts, auto-accept;
- memory reading, DLL injection, hooks, pattern scanning;
- changes to game or client files;
- Riot API keys in the frontend, the repository or logs;
- undeclared remote telemetry;
- invented data presented as real.
