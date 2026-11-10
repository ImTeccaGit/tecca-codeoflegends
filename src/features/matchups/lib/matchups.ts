import {
  groupBy,
  kda,
  summarize,
  type AnalysisSummary,
  type GroupStats,
} from "@/features/analysis/lib/analysis";
import type { AnalysisMatch } from "@/types/analysis";

/**
 * Matchups computed only from the player's own stored matches. Global win,
 * pick and ban rates are not available from the official Riot API, so they
 * are never estimated: the UI states it explicitly.
 */

export interface MatchupQuery {
  championId: number;
  opponentId: number | null;
  role: string | null;
}

/** Matches played with `championId` (and role), optionally vs a lane opponent. */
export function matchupMatches(matches: AnalysisMatch[], query: MatchupQuery): AnalysisMatch[] {
  return matches.filter(
    (match) =>
      match.champion.championId === query.championId &&
      (query.role === null || match.teamPosition === query.role) &&
      (query.opponentId === null || match.opponent?.champion.championId === query.opponentId),
  );
}

export interface HeadToHead {
  summary: AnalysisSummary;
  /** Matches with a known lane opponent (all of them when an opponent is set). */
  compared: number;
  you: SideAverages | null;
  opponent: SideAverages | null;
}

export interface SideAverages {
  kda: number;
  kills: number;
  deaths: number;
  assists: number;
  csPerMinute: number | null;
  goldPerMinute: number | null;
  visionScore: number;
}

function sideAverages(
  rows: { kills: number; deaths: number; assists: number; creepScore: number; goldEarned: number; visionScore: number; seconds: number }[],
): SideAverages | null {
  if (rows.length === 0) return null;
  const sum = (pick: (row: (typeof rows)[number]) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const minutes = sum((row) => row.seconds) / 60;
  return {
    kda: kda(sum((r) => r.kills), sum((r) => r.deaths), sum((r) => r.assists)),
    kills: sum((r) => r.kills) / rows.length,
    deaths: sum((r) => r.deaths) / rows.length,
    assists: sum((r) => r.assists) / rows.length,
    csPerMinute: minutes > 0 ? sum((r) => r.creepScore) / minutes : null,
    goldPerMinute: minutes > 0 ? sum((r) => r.goldEarned) / minutes : null,
    visionScore: sum((r) => r.visionScore) / rows.length,
  };
}

/** You vs your direct lane opponent, over the matches that have one. */
export function headToHead(matches: AnalysisMatch[]): HeadToHead {
  const compared = matches.filter((match) => match.opponent !== null);
  return {
    summary: summarize(matches),
    compared: compared.length,
    you: sideAverages(
      compared.map((match) => ({
        kills: match.kills,
        deaths: match.deaths,
        assists: match.assists,
        creepScore: match.creepScore,
        goldEarned: match.goldEarned,
        visionScore: match.visionScore,
        seconds: match.durationSeconds,
      })),
    ),
    opponent: sideAverages(
      compared.flatMap((match) =>
        match.opponent
          ? [
              {
                kills: match.opponent.kills,
                deaths: match.opponent.deaths,
                assists: match.opponent.assists,
                creepScore: match.opponent.creepScore,
                goldEarned: match.opponent.goldEarned,
                visionScore: match.opponent.visionScore,
                seconds: match.durationSeconds,
              },
            ]
          : [],
      ),
    ),
  };
}

/** Lane opponents faced, hardest first (lowest win rate, then most games). */
export function counters(matches: AnalysisMatch[]): GroupStats[] {
  return groupBy(matches, (match) =>
    match.opponent
      ? {
          key: String(match.opponent.champion.championId),
          label: match.opponent.champion.championName,
          imageUrl: match.opponent.champion.imageUrl,
        }
      : null,
  ).sort(
    (a, b) =>
      Number(b.summary.sufficient) - Number(a.summary.sufficient) ||
      (a.summary.winRate ?? 0) - (b.summary.winRate ?? 0) ||
      b.summary.games - a.summary.games,
  );
}

/** Allies you played with, by win rate (best first) then games. */
export function synergies(matches: AnalysisMatch[]): GroupStats[] {
  const expanded = matches.flatMap((match) =>
    match.allies.map((ally) => ({ ally, match })),
  );
  const groups = new Map<number, { ally: AnalysisMatch["allies"][number]; matches: AnalysisMatch[] }>();
  for (const { ally, match } of expanded) {
    const group = groups.get(ally.championId) ?? { ally, matches: [] };
    group.matches.push(match);
    groups.set(ally.championId, group);
  }
  return [...groups.values()]
    .map(({ ally, matches: games }) => ({
      key: String(ally.championId),
      label: ally.championName,
      imageUrl: ally.imageUrl,
      summary: summarize(games),
      share: matches.length === 0 ? 0 : games.length / matches.length,
    }))
    .sort(
      (a, b) =>
        Number(b.summary.sufficient) - Number(a.summary.sufficient) ||
        (b.summary.winRate ?? 0) - (a.summary.winRate ?? 0) ||
        b.summary.games - a.summary.games,
    );
}

/** Rune pages you used (keystone + secondary tree), most used first. */
export function runePages(matches: AnalysisMatch[]): GroupStats[] {
  return groupBy(matches, (match) =>
    match.keystone
      ? {
          key: `${match.keystone.id}-${match.secondaryStyle?.id ?? 0}`,
          label: [match.keystone.name ?? `Runa ${match.keystone.id}`, match.secondaryStyle?.name]
            .filter(Boolean)
            .join(" + "),
          imageUrl: match.keystone.iconUrl,
        }
      : null,
  );
}

/** Completed items you finished, most frequent first. */
export function completedItems(matches: AnalysisMatch[]): GroupStats[] {
  const groups = new Map<number, { label: string; imageUrl: string | null; matches: AnalysisMatch[] }>();
  for (const match of matches) {
    const seen = new Set<number>();
    for (const item of match.items) {
      if (!item.completed || seen.has(item.id)) continue;
      seen.add(item.id);
      const group = groups.get(item.id) ?? {
        label: item.name ?? `Oggetto ${item.id}`,
        imageUrl: item.imageUrl,
        matches: [],
      };
      group.matches.push(match);
      groups.set(item.id, group);
    }
  }
  return [...groups.entries()]
    .map(([id, group]) => ({
      key: String(id),
      label: group.label,
      imageUrl: group.imageUrl,
      summary: summarize(group.matches),
      share: matches.length === 0 ? 0 : group.matches.length / matches.length,
    }))
    .sort((a, b) => b.summary.games - a.summary.games || a.label.localeCompare(b.label, "it"));
}

export interface Presence {
  /** Matches where the champion was picked by anyone, 0–1. */
  pickRate: number | null;
  /** Matches where the champion was banned by either team, 0–1. */
  banRate: number | null;
  picked: number;
  banned: number;
  games: number;
}

/** Pick and ban presence of a champion inside the given matches only. */
export function presence(matches: AnalysisMatch[], championId: number): Presence {
  const games = matches.length;
  const picked = matches.filter(
    (match) =>
      match.champion.championId === championId ||
      match.allies.some((ally) => ally.championId === championId) ||
      match.enemies.some((enemy) => enemy.championId === championId),
  ).length;
  const banned = matches.filter((match) => match.bans.includes(championId)).length;
  return {
    pickRate: games === 0 ? null : picked / games,
    banRate: games === 0 ? null : banned / games,
    picked,
    banned,
    games,
  };
}

/** Lane opponents met with a champion (and role), for the opponent picker. */
export function opponentsFaced(matches: AnalysisMatch[], championId: number, role: string | null) {
  const found = new Map<number, { id: number; name: string; games: number }>();
  for (const match of matchupMatches(matches, { championId, opponentId: null, role })) {
    if (!match.opponent) continue;
    const { championId: id, championName: name } = match.opponent.champion;
    const entry = found.get(id) ?? { id, name, games: 0 };
    entry.games += 1;
    found.set(id, entry);
  }
  return [...found.values()].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, "it"));
}
