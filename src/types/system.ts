import { z } from "zod";

export const RIOT_REGIONS = [
  { value: "euw1", label: "EU West" },
  { value: "eun1", label: "EU Nordic & East" },
  { value: "na1", label: "North America" },
  { value: "kr", label: "Korea" },
  { value: "br1", label: "Brazil" },
  { value: "jp1", label: "Japan" },
  { value: "ru", label: "Russia" },
  { value: "oc1", label: "Oceania" },
  { value: "tr1", label: "Turkey" },
  { value: "la1", label: "Latin America North" },
  { value: "la2", label: "Latin America South" },
  { value: "me1", label: "Middle East" },
  { value: "sg2", label: "Southeast Asia" },
  { value: "tw2", label: "Taiwan" },
  { value: "vn2", label: "Vietnam" },
] as const;

export const riotRegionSchema = z.enum([
  "euw1",
  "eun1",
  "na1",
  "kr",
  "br1",
  "jp1",
  "ru",
  "oc1",
  "tr1",
  "la1",
  "la2",
  "me1",
  "sg2",
  "tw2",
  "vn2",
]);

export type RiotRegion = z.infer<typeof riotRegionSchema>;

export const appSettingsSchema = z.object({
  region: riotRegionSchema,
  reduceMotion: z.boolean(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const settingsPatchSchema = z
  .object({
    region: riotRegionSchema.optional(),
    reduceMotion: z.boolean().optional(),
  })
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const databaseStatusSchema = z.object({
  state: z.enum(["ready", "unavailable", "error"]),
  path: z.string().nullable(),
  schemaVersion: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  tableCounts: z.record(z.string(), z.number().int().nonnegative()),
});

export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;

export const riotStatusSchema = z.object({
  state: z.enum(["not_configured", "configured", "error"]),
  message: z.string(),
});

export const liveClientStatusSchema = z.object({
  state: z.enum([
    "not_implemented",
    "disabled",
    "not_running",
    "running",
    "error",
  ]),
  message: z.string(),
});

export const activityEntrySchema = z.object({
  id: z.number().int().positive(),
  kind: z.enum(["system", "database", "riot", "analysis", "settings"]),
  title: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
});

export type ActivityEntry = z.infer<typeof activityEntrySchema>;

export const systemSnapshotSchema = z.object({
  runtime: z.enum(["tauri", "browser"]),
  appVersion: z.string(),
  generatedAt: z.string(),
  logDirectory: z.string().nullable(),
  database: databaseStatusSchema,
  riot: riotStatusSchema,
  liveClient: liveClientStatusSchema,
  settings: appSettingsSchema,
  activity: z.array(activityEntrySchema),
});

export type SystemSnapshot = z.infer<typeof systemSnapshotSchema>;
