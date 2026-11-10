# Match Analysis & Matchups

Phase 6 module. The analysis is **post-game** and relies only on real matches
stored locally from the Riot API (match-v5) for a saved profile. No DEMO data,
no third-party sources, no estimated percentages.

## 1. Data

| Data | Origin |
| --- | --- |
| K/D/A, CS, gold, vision, damage to champions, items, runes, role | `match_participants` (match-v5) |
| Damage taken | `match_participants.damage_taken` (`totalDamageTaken`, since migration 0007) |
| Team kills (for kill participation) | Sum of the kills of the participants with the same `teamId` |
| Lane opponent | Participant of the opposite team with the same `teamPosition`, only if it is **unique** |
| Allies and enemies | The other participants of the match |
| Bans | `match_bans` (`info.teams[].bans`, since migration 0007) |
| Patch | `major.minor` of `gameVersion` |
| "Completed" items | Data Dragon: no further upgrade, at least 900 gold, not a consumable or trinket |
| Current rank | league-v4 (informative only) |

Migration `0007_match_analysis.sql` completes the matches already stored by
reading `matches.raw_json`, i.e. Riot's original response. If a field is
missing from the response it stays `NULL`, and the UI shows it as "not
provided by Riot".

## 2. Calculations

They are all pure functions in `src/features/analysis/lib/analysis.ts` and
`src/features/matchups/lib/matchups.ts`, covered by Vitest tests.

| Statistic | Formula |
| --- | --- |
| KDA (match) | (K + A) / max(D, 1) |
| KDA (aggregate) | (ΣK + ΣA) / max(ΣD, 1) |
| Win rate | wins / matches |
| Confidence interval | Wilson, 95% |
| CS/min, gold/min (aggregate) | Σ value / Σ minutes played |
| Kill participation | Σ(K + A) / Σ team kills, only on matches where the team scored at least one kill; at most 100% |
| Damage averages | Only on matches where the value exists; shown as "average over N of M matches" |
| Rolling win rate | Last 10 matches |

Below **5 matches** a win rate is marked as unreliable (asterisk in tables,
"Few data" badge in cards, light bars in charts).

## 3. Reliability shown

Every view shows a box with:

- source (Riot API · match-v5);
- patches involved;
- number of matches analyzed;
- period (first and last match);
- confidence interval method.

## 4. Filters

Champion, role, patch, mode (queue), period (7/30/90 days or all) and number
of matches (last 10/20/50 or all, applied after the other filters). Filters
are kept in the URL.

**Ranked tier: not available.** match-v5 does not report the players' rank at
the time of the match. Using the current rank for past matches would be
invented data, so the filter stays disabled and the page explains why.

## 5. Matchups: what is there and what is not

| Request | Status | Reason |
| --- | --- | --- |
| Selected champion, opponent, role | Implemented | Opponents actually faced in lane |
| Matchup win rate | Implemented, **only on your matches** | With sample size and confidence interval |
| Pick rate and ban rate | Implemented **only in your matches** | Champion present in either team, or banned |
| Global win/pick/ban rates | **Not in this module** | The official Riot API provides no aggregated statistics. Champion pages compute them separately from matches collected with the user's own key (opt-in, `src-tauri/src/meta/`) |
| Counters | Implemented | Lane opponents sorted by lowest win rate (those with enough data first) |
| Synergies | Implemented | Allies you played with |
| "Recommended" runes | Shown as **runes you used** | A recommendation would need global data |
| Associated builds | **Completed items** at the end of the match, with frequency | Purchase order needs the match-v5 timeline, not used here |
| Champion cards | Implemented | Portrait, title and classes from Data Dragon |

## 6. Tests

- **Rust** (`src-tauri/src/analysis/tests.rs`):
  - match–champion association;
  - lane opponent, also ambiguous or missing;
  - team kills, allies, enemies and bans;
  - missing data;
  - match order;
  - migration 0007 backfill from `raw_json`.
- **Vitest**:
  - KDA, win rate, CS/min, gold/min and kill participation;
  - Wilson interval;
  - single and combined filters, match limit, filters from the URL;
  - grouping by champion and role;
  - chart series (cumulative, rolling, weeks);
  - data provenance;
  - matchups, counters, synergies, runes, items and presence.
