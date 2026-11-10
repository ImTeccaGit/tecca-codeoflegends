# Live Game & Desktop Overlay

Phase 7 module. This document summarizes the Riot policies consulted, what
was implemented, what was left out on purpose and why.

## 1. Sources consulted

- Riot Developer Portal, LoL documentation, section *Game Client API → Live
  Client Data API* (`https://127.0.0.1:2999/liveclientdata/...`, root
  certificate `riotgames.pem`).
- Riot Developer Portal, *General Policies* and League of Legends *Game
  Policies*.

Relevant policy points:

- **Allowed:** overlays with static data available before the game, the
  player's own statistics, training tools on the player's own data.
- **Not allowed:**
  - providing session information the player would not already know;
  - apps that dictate the player's decisions;
  - tracking enemy ultimate cooldowns;
  - using information missing from the client that gives a competitive
    advantage;
  - identifying or analyzing players hidden by the game, or de-anonymizing
    them;
  - showing win rates for Augments or Arena items;
  - in-game advertising.
- **Distribution:** every product must be registered and approved by Riot
  through the Developer Portal.
- **LCU:** the client API is not officially supported for third-party
  applications.

## 1a. In-game panel (approved by the user on 2026-11-10)

At the user's explicit request, after the conflict with the previous rules
was pointed out, the module also shows an **in-game panel** in a "player
cards" style. The official policy page could not be read automatically; a
secondary summary of Riot's 2025-05-29 update lists data from the official
APIs and build suggestions as allowed, and the following as not allowed:
players in anonymous mode, custom rank/MMR systems, cooldown trackers,
advertising and overlays that decide for the player. Checking the official
text remains the owner's responsibility before any public distribution.

| Element | Detail |
| --- | --- |
| Players | From the Live Client Data API: Riot ID, champion, team and lane (what the scoreboard shows). Other players' items, scores, runes, summoner spells and timers are discarded in `live/snapshot.rs`. |
| Public profile | With the user's key (`live/board.rs`): account-v1 → summoner-v4 (level) → league-v4 (official Solo/Duo rank) → match-v5 (last 5 ranked games of the last 30 days: wins, average KDA, main role, games on the current champion). One lookup per game; the champion statistics collector pauses meanwhile. |
| Excluded | Bots and players with a hidden name: no request at all. No rank or MMR computed by the app. |
| Build | Only for the user's own champion, from the app statistics (collected or personal matches), computed at the start of the game: runes, starting items, core items, boots, final items, levels 1-2-3, skill order. No automatic purchases or level-ups. |
| Window | Label `board`, transparent, always on top (re-asserted about every 2 s in game), never focused, **click-through**; opens by itself at the start of a game; global `Home` shortcut registered by Rust (no permission for the webview) to hide or reopen it, button in the Live Game page. Closes at the end of the game. Capability: events and log only. |

## 2. What is implemented

| Feature | Detail |
| --- | --- |
| Explicit consent | Detection **off by default**. Switch in the Live Game page, persisted in `settings.live_enabled` and recorded in the activity log. When it is off, the backend makes no request at all. |
| Game detection | Read-only polling of the local Live Client Data API: every 2 s in game, every 5 s otherwise. 3 endpoints are used: `gamestats`, `activeplayername`, `playerlist`. |
| Connection state | `disabled`, `not_running` (port closed), `loading` (client running but data not ready), `in_game`, `error` (invalid response, detail in the logs). |
| Data shown | The **local player's** data already visible in their client: mode, map, game time, champion, level, role, K/D/A, CS, CS/min, vision score. For other players, only the scoreboard identity used by the in-game panel (§ 1a). |
| Privacy | Other players' game data (items, scores, runes, spells, timers) is discarded in the Rust backend (`live/snapshot.rs`) and never reaches the webview; tests check it, and that hidden names and bots get no Riot ID. Spectators and replays: only the game is shown, without personal data. |
| Events | `live-game-update` is emitted only when the content changes; `live-board-update` when the in-game panel changes; `overlay-settings-updated` after each settings save. |
| Overlay | Separate Tauri window (label `overlay`), optional and closed by default. Configurable size (200–600 × 80–400 px), screen corner, margins, opacity (30–100%) and theme (Tecca, Minimal, High contrast). |
| Overlay mode | Transparent, borderless, always on top, hidden from the taskbar, never focused and **click-through** (`set_ignore_cursor_events`). It receives no input, so it cannot interact with the game. |
| Window mode | Normal decorated window, not on top. Closing it with the X means "hide overlay". |
| Resources | Hidden overlay = destroyed window (no active webview). Overlay and in-game panel close with the main window. |
| Permissions | The `overlay` capability (windows `overlay` and `board`) grants only `core:event:default` and `log:allow-log`: no windows, files, shell or URLs. |

## 3. What is NOT implemented and why

| Excluded feature | Reason |
| --- | --- |
| Respawn timers for dragons, Baron, Herald, jungle camps (`eventdata`) | Session information the player must remember on their own, with a competitive advantage; not allowed. The `eventdata` feed is not read. |
| Cooldowns of enemy ultimates, Flash or summoner spells | Explicitly not allowed ("tracking enemy ultimate cooldowns"). |
| Items, runes, scores or timers of other players in the game in progress | Session information; discarded in the backend. (Public rank and history: see § 1a.) |
| Dynamic advice (rotations, objectives, automatic purchases or level-ups) | Apps may not dictate or automate the player's decisions. The informative build of the user's own champion is in § 1a. |
| Timed in-game notifications or alerts | They would be gameplay reminders with a competitive advantage. |
| Memory reading, injection, hooks, file changes, automated input | Forbidden by the Terms of Service and by AGENTS.md. |
| Actions through the client API (LCU): auto-accept, lobby, champion select | Automation is not allowed. The LCU is used **read-only** for the user's own account, outside the game, by the `client` module (see RIOT_COMPLIANCE.md). |
| Win rates for Augments or Arena items | Explicitly not allowed. |
| Interactive overlay on top of the game | Not needed, and an overlay that captures input would interfere with the game. |
| Advertising in the overlay | Not allowed in game. |

## 4. Connection security

- `HttpLiveSource` talks only to `https://127.0.0.1:2999` and ignores proxies.
- The game certificate is verified against the Riot root CA included in
  `src-tauri/certs/riotgames.pem` (pinning).
- Host name verification is disabled: the certificate is not issued for
  `127.0.0.1`, while the chain is still verified.
- Timeouts: connection 800 ms, request 2 s.

## 5. Tests

- Rust (`src-tauri/src/live/tests.rs`) with a game **simulated only in the
  tests** through the `LiveSource` trait. Covered cases:
  - game not started, loading screen, malformed response;
  - in game, spectator, CS/min in the first minute;
  - other players reduced to their scoreboard identity; hidden names and bots
    never identified;
  - recent ranked form summary and `Home` shortcut;
  - no request when detection is off;
  - events emitted only on changes, data refresh and disconnection;
  - overlay validation and positioning;
  - persistence with safe fallbacks.
- Vitest (`src/features/live/lib/live-format.test.ts`): formatting and Zod
  contracts.
- The app neither contains nor shows simulated game data.

## 6. Known limits

- In window mode, a position or size changed by hand is not saved.
- Overlay and in-game panel are placed on the monitor of the main window.
- Games in **exclusive fullscreen** can cover any window, overlay and panel
  included: the game must use "Borderless" or "Windowed" mode.
- While the app is open, the `Home` key is reserved for the panel in every
  program.
- Verification with a real game depends on the user: development was verified
  without a game in progress (`not_running` state), with the panel opened over
  the Practice Tool, and with simulated tests.
