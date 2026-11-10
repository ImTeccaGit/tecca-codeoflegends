import type {
  DashboardData,
  MatchSummary,
  TeamPosition,
} from "@/types/dashboard";

/**
 * DEMO DATASET — Dati dimostrativi.
 *
 * Fixed, hand-written sample used only when the user turns on "Modalità DEMO".
 * It is not the user's data, it is never written to SQLite and it never
 * reaches the Rust backend. Champion names are used only as labels.
 */

export const DEMO_SOURCE_LABEL = "Dati dimostrativi";

type DemoMatchRow = readonly [
  championName: string,
  position: TeamPosition,
  win: boolean,
  kills: number,
  deaths: number,
  assists: number,
  creepScore: number,
  durationMinutes: number,
  hoursAgo: number,
];

/** Most recent first. */
const DEMO_MATCH_ROWS: readonly DemoMatchRow[] = [
  ["Ahri", "MIDDLE", true, 9, 3, 11, 214, 29, 2],
  ["Ahri", "MIDDLE", false, 4, 6, 7, 188, 31, 3],
  ["Orianna", "MIDDLE", true, 6, 2, 14, 241, 33, 5],
  ["Ahri", "MIDDLE", true, 11, 4, 8, 202, 27, 21],
  ["Viktor", "MIDDLE", false, 3, 7, 5, 196, 35, 23],
  ["Orianna", "MIDDLE", true, 5, 1, 16, 227, 30, 26],
  ["Ahri", "MIDDLE", true, 8, 2, 9, 176, 24, 45],
  ["Syndra", "MIDDLE", false, 7, 8, 4, 201, 34, 47],
  ["Orianna", "MIDDLE", false, 2, 5, 9, 233, 38, 50],
  ["Ahri", "MIDDLE", true, 12, 5, 6, 219, 32, 70],
  ["Viktor", "MIDDLE", true, 7, 3, 10, 254, 36, 72],
  ["Ahri", "MIDDLE", false, 5, 6, 6, 181, 28, 94],
  ["Syndra", "MIDDLE", true, 10, 2, 7, 210, 29, 97],
  ["Orianna", "MIDDLE", true, 4, 3, 18, 238, 34, 99],
  ["Ahri", "MIDDLE", true, 9, 4, 12, 205, 30, 120],
  ["Viktor", "MIDDLE", false, 4, 6, 8, 222, 37, 123],
  ["Ahri", "MIDDLE", false, 6, 7, 5, 190, 26, 145],
  ["Orianna", "MIDDLE", true, 7, 2, 13, 246, 31, 147],
  ["Syndra", "MIDDLE", true, 13, 3, 5, 218, 28, 168],
  ["Ahri", "MIDDLE", true, 10, 3, 9, 199, 27, 171],
];

const HOUR_MS = 3_600_000;

function toMatch(row: DemoMatchRow, index: number, now: Date): MatchSummary {
  const [
    championName,
    position,
    win,
    kills,
    deaths,
    assists,
    creepScore,
    durationMinutes,
    hoursAgo,
  ] = row;

  return {
    matchId: `DEMO-${String(index + 1).padStart(3, "0")}`,
    championName,
    position,
    queue: "Classificata Solo/Duo",
    win,
    kills,
    deaths,
    assists,
    creepScore,
    durationSeconds: durationMinutes * 60,
    playedAt: new Date(now.getTime() - hoursAgo * HOUR_MS).toISOString(),
  };
}

/**
 * Builds the DEMO dataset relative to `now`, so "2 ore fa" stays plausible.
 * Content is fixed: only timestamps depend on `now`.
 */
export function createDemoDashboard(now: Date): DashboardData {
  return {
    source: "demo",
    sourceLabel: DEMO_SOURCE_LABEL,
    retrievedAt: now.toISOString(),
    matches: DEMO_MATCH_ROWS.map((row, index) => toMatch(row, index, now)),
    rank: {
      queue: "Classificata Solo/Duo",
      tier: "GOLD",
      division: "II",
      leaguePoints: 47,
    },
    patch: {
      version: "DEMO",
      publishedAt: new Date(now.getTime() - 72 * HOUR_MS).toISOString(),
      highlights: [
        {
          title: "Esempio · Bilanciamento campioni",
          detail:
            "Qui compariranno le modifiche ai campioni lette dalle note patch ufficiali.",
        },
        {
          title: "Esempio · Oggetti",
          detail:
            "Variazioni di costo e statistiche degli oggetti, con versione di riferimento.",
        },
        {
          title: "Esempio · Sistemi di gioco",
          detail:
            "Cambiamenti a obiettivi, giungla e regole di coda, con fonte dichiarata.",
        },
      ],
    },
  };
}
