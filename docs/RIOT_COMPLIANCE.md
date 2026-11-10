# Riot Games compliance

TECCA CODEOFLEGENDS is a companion app **not affiliated** with Riot Games.
This document lists the data sources it uses, the constraints it respects and
the checks done for the release.

## 1. Data sources

| Source | Use | Authentication | Where |
| --- | --- | --- | --- |
| Data Dragon (`ddragon.leagueoflegends.com`) | Champions, abilities, skins, items, runes, images | None (public CDN) | Rust backend |
| Riot API: account-v1, summoner-v4, league-v4, match-v5, lol-status-v4 | Profiles, rank, matches, key check | The user's own key (`X-Riot-Token`) | Rust backend |
| Riot API: league-v4 (ladders), match-v5 (Solo/Duo) | Champion statistics, **opt-in** | The user's own key | Rust backend, off by default |
| Live Client Data API (`127.0.0.1:2999`) | Game state, the local player's data, Riot IDs and champions of the scoreboard for the in-game panel | None, Riot certificate verified | Rust backend, opt-in |
| League Client API (LCU, `127.0.0.1:<lockfile port>`) | **Only the user's own** account, rank and last 20 matches, without a key | Local session password from the `lockfile`, Riot certificate verified | Rust backend, on by default and can be turned off |

The frontend contacts none of these APIs: it only loads Data Dragon images,
allowed by the CSP. **No** scraping and no third-party statistics websites are
used.

### League Client API (LCU)

Riot documents that the client API is **not officially supported** for
third-party applications: it may change or stop working with an update. It is
used at the user's explicit request, only to avoid entering an API key for
**their own account**, with these limits:

| Constraint | Implementation |
| --- | --- |
| Read-only | GET requests only: `current-summoner`, `region-locale`, `current-ranked-stats`, match history and match details (`client/sync.rs`) |
| No client actions | No POST, PUT or DELETE: no auto-accept, lobby, champion select, chat or purchases |
| Game files | The `lockfile` in the League folder is **read**, never written; no other game file is touched |
| Session secret | Used only in memory for the Basic header to 127.0.0.1; hidden by `Debug`; never in logs, the database or the webview |
| Network | `127.0.0.1` only, no proxy; TLS chain verified with the Riot CA |
| Data | Only the account logged in to the client; matches are stored with `source = 'league-client'` and the UI shows the source "League client (LCU)" |
| User control | Switch in Settings → Automatic account; manual read with a button |
| Pace | One check every 30 s; full read at each new client session and then every 10 minutes |

If the client is not open, the app says so and uses the data already stored.
During a game the Live Client Data API provides the player's Riot ID, which
is remembered as a fallback: without the client or a key, however, neither
rank nor matches arrive.

## 2. API key

- The key is never included in the frontend, the repository, build files, the
  database or logs.
- It is read, in this order, from:
  1. the process environment variable `RIOT_API_KEY`;
  2. the Windows Credential Manager (service `com.tecca.codeoflegends`),
     where **Settings → Riot API key** stores it.
- The field in the UI is write-only: the key is never sent back to the
  webview.
- It is sent only as the `X-Riot-Token` header to the official hosts
  `*.api.riotgames.com`.
- Development keys expire after 24 hours. Regular use needs a **personal** or
  **production** key, approved through the Developer Portal.

## 3. Rate limits and requests

- The limiter works per routing value and uses the development key limits
  (20 requests/s, 100 every 2 minutes) with a margin.
- On `429` it respects `Retry-After`; `5xx` responses get a limited number of
  retries.
- Local cache: profile 60 min, rank 10 min, match list 3 min. Finished matches
  are downloaded only once.
- Only one sync per player at a time.
- Champion statistics (opt-in): at most one request every 2.5 s, which leaves
  about half of the limit for profile searches; ladder refreshed at most once a
  day, each player re-read after at least 12 hours, each match and timeline
  downloaded once; automatic pause on `429` (Retry-After), network errors and an
  expired key, and while the in-game panel is loading. Only the fields needed
  by the aggregations are stored (no names or Riot IDs of other players) and
  only the last 3 patches; they can be deleted from Settings.
- In-game panel: one lookup per game, at most about 9 requests per player
  (account, summoner, league, match list, 5 match details); players with a
  hidden name and bots are never looked up.
- Errors distinguish an invalid or expired key, a missing account, a reached
  limit and network problems, with clear messages for the user.

## 4. Game and client

| Constraint | Status | Check (release 0.10.0) |
| --- | --- | --- |
| No reading of the game process memory | Respected | No process or memory APIs in the code; no `windows-sys`, `winapi` or `sysinfo` dependency in the crate |
| No injection, hooks or debugger | Respected | As above |
| No changes to game or client files | Respected | The League path is used only to **read** the `lockfile`; writes happen only in the app data folder |
| No automation or synthetic input | Respected | No `SendInput` or similar; overlay and in-game panel ignore mouse and keyboard |
| Overlay and in-game panel | Separate, optional, transparent, click-through Tauri windows | `live/window.rs`; capability `overlay` with events and log only |
| In-game data | The user's own client data; for other players only the scoreboard identity and the public Riot API profile (level, official rank, recent ranked games), never hidden names or bots; informative build of the user's own champion. No timers, cooldowns, other players' items or scores, custom MMR or dynamic advice | `docs/LIVE_GAME.md` § 1a, tests on discarding other players' game data and hidden names |
| Statistics | Personal analysis: only from the user's own matches, with sample size and CI. Champion statistics: computed only from matches downloaded with the user's key, with sample size, patch, region and tier stated; no estimated percentages and nothing taken from third-party sites | `docs/MATCH_ANALYSIS.md`, `src-tauri/src/meta/` |
| Advertising | None | — |

## 5. Distribution

- Under Riot policies, every publicly distributed product must be **registered
  and approved** through the Riot Developer Portal. Release 0.10.0 is meant
  for personal use and testing: registration is the project owner's
  responsibility.
- Collecting champion statistics with a development or personal key is only
  suitable for prototypes and personal use: distributing it to other users
  needs an approved production key, with limits and purpose declared to Riot.
- The app and its documentation must show Riot's legal notice:
  *TECCA CODEOFLEGENDS isn't endorsed by Riot Games and doesn't reflect the
  views or opinions of Riot Games or anyone officially involved in producing or
  managing Riot Games properties. Riot Games, and all associated properties are
  trademarks or registered trademarks of Riot Games, Inc.*

## 6. How to repeat the checks

```powershell
# No real key in the repository or its history (only the fake test keys)
git log -p --all | Select-String -Pattern "RGAPI-[0-9a-fA-F]{8}-" | Select-Object -ExpandProperty Line -Unique

# No process, memory or input APIs in the backend
Select-String -Path src-tauri\src\*.rs, src-tauri\src\*\*.rs -Pattern "ReadProcessMemory|OpenProcess|SendInput|SetWindowsHookEx"

# Permissions and CSP: also checked by the cargo test `release_tests`
cargo test --manifest-path src-tauri/Cargo.toml release_tests
```
