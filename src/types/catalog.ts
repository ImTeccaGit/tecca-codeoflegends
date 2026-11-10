import { z } from "zod";
import { teamPositionSchema } from "@/types/dashboard";

/**
 * Contracts for the Data Dragon catalog returned by the Rust backend
 * (`src-tauri/src/catalog/dto.rs`). Every response is validated here.
 */

export const patchSummarySchema = z.object({
  version: z.string().min(1),
  patch: z.string().min(1),
  language: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  importedAt: z.string().min(1),
  championCount: z.number().int().nonnegative(),
  spellCount: z.number().int().nonnegative(),
  skinCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  runeCount: z.number().int().nonnegative(),
});
export type PatchSummary = z.infer<typeof patchSummarySchema>;

/**
 * Riot team positions. For champions these are the user's own choices:
 * Data Dragon publishes classes, not lanes.
 */
export const laneSchema = teamPositionSchema;
export type Lane = z.infer<typeof laneSchema>;

export const championListItemSchema = z.object({
  id: z.number().int().positive(),
  key: z.string().min(1),
  name: z.string().min(1),
  title: z.string(),
  tags: z.array(z.string()),
  imageUrl: z.string().url(),
  favorite: z.boolean(),
  lanes: z.array(laneSchema),
});

export const championPreferencesSchema = z.object({
  championId: z.number().int().positive(),
  favorite: z.boolean(),
  lanes: z.array(laneSchema),
});
export type ChampionPreferences = z.infer<typeof championPreferencesSchema>;
export type ChampionListItem = z.infer<typeof championListItemSchema>;

export const championCatalogSchema = z.object({
  patch: patchSummarySchema.nullable(),
  champions: z.array(championListItemSchema),
});
export type ChampionCatalog = z.infer<typeof championCatalogSchema>;

export const spellSlotSchema = z.enum(["P", "Q", "W", "E", "R"]);
export type SpellSlot = z.infer<typeof spellSlotSchema>;

export const championSpellSchema = z.object({
  slot: spellSlotSchema,
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  cooldown: z.string().nullable(),
  cost: z.string().nullable(),
  range: z.string().nullable(),
  maxRank: z.number().int().positive().nullable(),
  imageUrl: z.string().url(),
});
export type ChampionSpell = z.infer<typeof championSpellSchema>;

export const championSkinSchema = z.object({
  id: z.number().int().positive(),
  num: z.number().int().nonnegative(),
  name: z.string().min(1),
  hasChromas: z.boolean(),
  splashUrl: z.string().url(),
  loadingUrl: z.string().url(),
});
export type ChampionSkin = z.infer<typeof championSkinSchema>;

export const championInfoSchema = z.object({
  attack: z.number(),
  defense: z.number(),
  magic: z.number(),
  difficulty: z.number(),
});
export type ChampionInfo = z.infer<typeof championInfoSchema>;

/** Data Dragon stat keys, kept as published. */
export const championStatsSchema = z.object({
  hp: z.number(),
  hpperlevel: z.number(),
  mp: z.number(),
  mpperlevel: z.number(),
  movespeed: z.number(),
  armor: z.number(),
  armorperlevel: z.number(),
  spellblock: z.number(),
  spellblockperlevel: z.number(),
  attackrange: z.number(),
  hpregen: z.number(),
  hpregenperlevel: z.number(),
  mpregen: z.number(),
  mpregenperlevel: z.number(),
  crit: z.number(),
  critperlevel: z.number(),
  attackdamage: z.number(),
  attackdamageperlevel: z.number(),
  attackspeedperlevel: z.number(),
  attackspeed: z.number(),
});
export type ChampionStats = z.infer<typeof championStatsSchema>;

export const championDetailSchema = z.object({
  id: z.number().int().positive(),
  key: z.string().min(1),
  name: z.string().min(1),
  title: z.string(),
  blurb: z.string(),
  lore: z.string(),
  tags: z.array(z.string()),
  partype: z.string(),
  info: championInfoSchema,
  stats: championStatsSchema,
  imageUrl: z.string().url(),
  splashUrl: z.string().url(),
  spells: z.array(championSpellSchema),
  skins: z.array(championSkinSchema),
  patch: patchSummarySchema,
  favorite: z.boolean(),
  lanes: z.array(laneSchema),
});
export type ChampionDetail = z.infer<typeof championDetailSchema>;

export const checkRecordSchema = z.object({
  checkedAt: z.string().min(1),
  latestVersion: z.string().nullable(),
  outcome: z.enum(["up_to_date", "imported", "failed"]),
  detail: z.string().nullable(),
});
export type CheckRecord = z.infer<typeof checkRecordSchema>;

export const catalogStatusSchema = z.object({
  current: patchSummarySchema.nullable(),
  versions: z.array(patchSummarySchema),
  lastCheck: checkRecordSchema.nullable(),
  syncing: z.boolean(),
  checkIntervalHours: z.number().int().positive(),
});
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;

export const syncOutcomeSchema = z.object({
  outcome: z.enum(["up_to_date", "imported"]),
  version: z.string().min(1),
  patch: patchSummarySchema.nullable(),
});
export type SyncOutcome = z.infer<typeof syncOutcomeSchema>;

/** Data Dragon champion id as used in routes ("Ahri", "MonkeyKing"). */
export const championKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+$/);
