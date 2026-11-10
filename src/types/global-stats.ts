import { z } from "zod";
import { riotRegionSchema } from "@/types/system";

/**
 * Contracts of the Rust `meta` module: global champion statistics collected
 * with the user's own Riot API key (league-v4 + match-v5, Ranked Solo/Duo).
 */

export const SEED_TIERS = [
  { value: "MASTER_PLUS", label: "Master+" },
  { value: "DIAMOND", label: "Diamante I–II" },
  { value: "EMERALD", label: "Smeraldo I–II" },
  { value: "PLATINUM", label: "Platino I–II" },
] as const;

export const seedTierSchema = z.enum(["MASTER_PLUS", "DIAMOND", "EMERALD", "PLATINUM"]);
export type SeedTier = z.infer<typeof seedTierSchema>;

export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** "ALL" = every stored patch. */
export const ALL_PATCHES = "ALL";
export const patchFilterSchema = z.union([z.literal(ALL_PATCHES), z.string().regex(/^\d{1,3}\.\d{1,3}$/)]);

export const iconRefSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  iconUrl: z.string().url().nullable(),
});
export type IconRef = z.infer<typeof iconRefSchema>;

export const patchSampleSchema = z.object({
  patch: z.string().min(1),
  matches: z.number().int().nonnegative(),
});
export type PatchSample = z.infer<typeof patchSampleSchema>;

export const collectorStateSchema = z.enum(["disabled", "idle", "collecting", "waiting", "error"]);
export type CollectorState = z.infer<typeof collectorStateSchema>;

export const globalStatsStatusSchema = z.object({
  enabled: z.boolean(),
  state: collectorStateSchema,
  platform: z.string().min(1),
  seedTier: seedTierSchema,
  message: z.string().nullable(),
  sessionMatches: z.number().int().nonnegative(),
  lastActivityMs: z.number().int().nonnegative().nullable(),
  totalMatches: z.number().int().nonnegative(),
  patches: z.array(patchSampleSchema),
  seedPlayers: z.number().int().nonnegative(),
  seedsRefreshedAt: z.string().nullable(),
  lastFetchedAt: z.string().nullable(),
  keyConfigured: z.boolean(),
});
export type GlobalStatsStatus = z.infer<typeof globalStatsStatusSchema>;

export const globalStatsSettingsSchema = z.object({
  enabled: z.boolean(),
  platform: riotRegionSchema,
  seedTier: seedTierSchema,
});
export type GlobalStatsSettings = z.infer<typeof globalStatsSettingsSchema>;

const tallySchema = {
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
};

export const roleShareSchema = z.object({ role: z.string().min(1), ...tallySchema });
export type RoleShare = z.infer<typeof roleShareSchema>;

export const runePageStatSchema = z.object({
  primaryStyle: iconRefSchema,
  primaryRunes: z.array(iconRefSchema),
  secondaryStyle: iconRefSchema,
  secondaryRunes: z.array(iconRefSchema),
  shards: z.array(iconRefSchema),
  ...tallySchema,
});
export type RunePageStat = z.infer<typeof runePageStatSchema>;

export const iconStatSchema = z.object({ icon: iconRefSchema, ...tallySchema });
export type IconStat = z.infer<typeof iconStatSchema>;

export const spellPairStatSchema = z.object({ spells: z.array(iconRefSchema), ...tallySchema });
export type SpellPairStat = z.infer<typeof spellPairStatSchema>;

export const matchupStatSchema = z.object({
  championId: z.number().int().positive(),
  key: z.string().nullable(),
  name: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  ...tallySchema,
});
export type MatchupStat = z.infer<typeof matchupStatSchema>;

export const runeTreeLayoutSchema = z.object({
  tree: iconRefSchema,
  rows: z.array(z.array(iconRefSchema)),
});
export type RuneTreeLayout = z.infer<typeof runeTreeLayoutSchema>;

export const skillOrderStatSchema = z.object({
  priority: z.array(z.enum(["Q", "W", "E"])),
  sequence: z.array(z.enum(["Q", "W", "E", "R"])),
  ...tallySchema,
});
export type SkillOrderStat = z.infer<typeof skillOrderStatSchema>;

export const itemSetStatSchema = z.object({ items: z.array(iconRefSchema), ...tallySchema });
export type ItemSetStat = z.infer<typeof itemSetStatSchema>;

export const championGlobalStatsSchema = z.object({
  championId: z.number().int().positive(),
  patch: z.string().nullable(),
  patches: z.array(patchSampleSchema),
  platforms: z.array(z.string()),
  seedTiers: z.array(z.string()),
  totalMatches: z.number().int().nonnegative(),
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  bans: z.number().int().nonnegative(),
  roles: z.array(roleShareSchema),
  role: z.string().nullable(),
  roleGames: z.number().int().nonnegative(),
  roleWins: z.number().int().nonnegative(),
  runePages: z.array(runePageStatSchema),
  keystones: z.array(iconStatSchema),
  summonerSpells: z.array(spellPairStatSchema),
  boots: z.array(iconStatSchema),
  coreItems: z.array(iconStatSchema),
  strongAgainst: z.array(matchupStatSchema),
  weakAgainst: z.array(matchupStatSchema),
  matchupMinGames: z.number().int().positive(),
  runeTrees: z.array(runeTreeLayoutSchema),
  shardRows: z.array(z.array(iconRefSchema)),
  lastFetchedAt: z.string().nullable(),
  source: z.string().min(1),
  personal: z.boolean(),
  skillOrders: z.array(skillOrderStatSchema),
  startBuilds: z.array(itemSetStatSchema),
  coreBuilds: z.array(itemSetStatSchema),
  timelineGames: z.number().int().nonnegative(),
});
export type ChampionGlobalStats = z.infer<typeof championGlobalStatsSchema>;

export interface ChampionStatsFilter {
  patch: string | null;
  role: Role | null;
}

export const championRolesSchema = z.object({
  championId: z.number().int().positive(),
  games: z.number().int().nonnegative(),
  roles: z.array(roleShareSchema),
});
export type ChampionRoles = z.infer<typeof championRolesSchema>;

export const championRolesOverviewSchema = z.object({
  champions: z.array(championRolesSchema),
  globalMatches: z.number().int().nonnegative(),
  personalMatches: z.number().int().nonnegative(),
});
export type ChampionRolesOverview = z.infer<typeof championRolesOverviewSchema>;
