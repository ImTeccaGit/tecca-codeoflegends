import { describe, expect, it } from "vitest";
import { champ, makeMatch } from "@/features/analysis/lib/fixtures.test-utils";
import {
  completedItems,
  counters,
  headToHead,
  matchupMatches,
  opponentsFaced,
  presence,
  runePages,
  synergies,
} from "@/features/matchups/lib/matchups";
import type { LaneOpponent } from "@/types/analysis";

function opponent(id: number, name: string, overrides: Partial<LaneOpponent> = {}): LaneOpponent {
  return {
    champion: champ(id, name),
    kills: 2,
    deaths: 4,
    assists: 2,
    creepScore: 180,
    goldEarned: 10000,
    visionScore: 15,
    damageDealt: 15000,
    damageTaken: 20000,
    ...overrides,
  };
}

const ALPHA = champ(1, "Alpha");
const matches = [
  makeMatch({ champion: ALPHA, opponent: opponent(11, "Delta"), win: true, allies: [champ(5, "Eco")], bans: [11] }),
  makeMatch({ champion: ALPHA, opponent: opponent(11, "Delta"), win: false, allies: [champ(5, "Eco")] }),
  makeMatch({ champion: ALPHA, opponent: opponent(12, "Epsilon"), win: false, allies: [champ(6, "Foxtrot")], enemies: [champ(11, "Delta")] }),
  makeMatch({ champion: ALPHA, opponent: null, win: true, teamPosition: "TOP" }),
  makeMatch({ champion: champ(2, "Beta"), opponent: opponent(11, "Delta"), win: true }),
];

describe("matchups", () => {
  it("selects matches by champion, role and lane opponent", () => {
    expect(matchupMatches(matches, { championId: 1, opponentId: null, role: null })).toHaveLength(4);
    expect(matchupMatches(matches, { championId: 1, opponentId: 11, role: null })).toHaveLength(2);
    expect(matchupMatches(matches, { championId: 1, opponentId: null, role: "TOP" })).toHaveLength(1);
    expect(matchupMatches(matches, { championId: 1, opponentId: 99, role: null })).toHaveLength(0);
  });

  it("compares you and the lane opponent only where the opponent is known", () => {
    const result = headToHead(matchupMatches(matches, { championId: 1, opponentId: null, role: null }));
    expect(result.summary.games).toBe(4);
    expect(result.compared).toBe(3);
    expect(result.opponent?.kda).toBe(1);
    expect(result.opponent?.csPerMinute).toBe(6);
    expect(result.you?.kda).toBe(5);
  });

  it("has no comparison without data", () => {
    const empty = headToHead([]);
    expect(empty.you).toBeNull();
    expect(empty.summary.winRate).toBeNull();
  });

  it("lists counters and synergies with their sample", () => {
    const alpha = matchupMatches(matches, { championId: 1, opponentId: null, role: null });
    const vs = counters(alpha);
    expect(vs.map((g) => [g.label, g.summary.games, g.summary.winRate])).toEqual([
      ["Epsilon", 1, 0],
      ["Delta", 2, 0.5],
    ]);
    expect(vs.every((g) => !g.summary.sufficient)).toBe(true);

    const allies = synergies(alpha);
    expect(allies.map((g) => [g.label, g.summary.games])).toEqual([
      ["Eco", 2],
      ["Foxtrot", 1],
    ]);
  });

  it("measures pick and ban presence inside the analysed matches", () => {
    const delta = presence(matches, 11);
    expect(delta.games).toBe(5);
    expect(delta.banned).toBe(1);
    // Enemy in one match; lane opponents are not counted twice as "picked"
    // unless they appear in the team lists.
    expect(delta.picked).toBe(1);
    expect(delta.banRate).toBeCloseTo(0.2, 10);
    expect(presence([], 11).pickRate).toBeNull();
  });

  it("lists opponents faced for the picker", () => {
    expect(opponentsFaced(matches, 1, null)).toEqual([
      { id: 11, name: "Delta", games: 2 },
      { id: 12, name: "Epsilon", games: 1 },
    ]);
  });

  it("groups rune pages and completed items without double counting", () => {
    const rune = { id: 8112, name: "Elettrocuzione", iconUrl: null };
    const sub = { id: 8300, name: "Ispirazione", iconUrl: null };
    const item = { id: 3089, name: "Copricapo", imageUrl: null, completed: true };
    const component = { id: 1058, name: "Bastone", imageUrl: null, completed: false };
    const games = [
      makeMatch({ keystone: rune, secondaryStyle: sub, items: [item, item, component], win: true }),
      makeMatch({ keystone: rune, secondaryStyle: sub, items: [item], win: false }),
      makeMatch({ keystone: null, items: [] }),
    ];
    expect(runePages(games).map((g) => [g.label, g.summary.games])).toEqual([
      ["Elettrocuzione + Ispirazione", 2],
    ]);
    expect(completedItems(games).map((g) => [g.label, g.summary.games, g.share])).toEqual([
      ["Copricapo", 2, 2 / 3],
    ]);
  });
});
