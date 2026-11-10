import { describe, expect, it } from "vitest";
import { clientStatusSchema, installPathSchema } from "@/types/client-account";

const LEAGUE_DIR = String.raw`C:\Riot Games\League of Legends`;

describe("client account contracts", () => {
  it("accepts a connected status and rejects unknown states", () => {
    const status = {
      enabled: true,
      state: "connected",
      installPath: LEAGUE_DIR,
      account: { puuid: "p", gameName: "Tester", tagLine: "EUW", region: "euw1" },
      lastSyncMs: 1,
      newMatches: 3,
      message: null,
      detectedRiotId: { riotId: "Tester#EUW", detectedAt: "2026-11-10T10:00:00.000Z" },
    };
    expect(clientStatusSchema.safeParse(status).success).toBe(true);
    expect(clientStatusSchema.safeParse({ ...status, state: "injected" }).success).toBe(false);
  });

  it("validates a manual League folder", () => {
    expect(installPathSchema.safeParse(LEAGUE_DIR).success).toBe(true);
    expect(installPathSchema.safeParse("League of Legends").success).toBe(false);
    expect(installPathSchema.safeParse(String.raw`\\server\share`).success).toBe(false);
  });
});
