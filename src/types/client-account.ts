import { z } from "zod";

/** Contracts of the Rust `client` module (League client, read-only). */

export const clientStateSchema = z.enum([
  "disabled",
  "not_found",
  "not_running",
  "syncing",
  "connected",
  "error",
]);
export type ClientState = z.infer<typeof clientStateSchema>;

export const clientAccountSchema = z.object({
  puuid: z.string().min(1),
  gameName: z.string(),
  tagLine: z.string(),
  region: z.string().min(1),
});
export type ClientAccount = z.infer<typeof clientAccountSchema>;

export const detectedRiotIdSchema = z.object({
  riotId: z.string().min(3),
  detectedAt: z.string().min(1),
});
export type DetectedRiotId = z.infer<typeof detectedRiotIdSchema>;

export const clientStatusSchema = z.object({
  enabled: z.boolean(),
  state: clientStateSchema,
  installPath: z.string().nullable(),
  account: clientAccountSchema.nullable(),
  lastSyncMs: z.number().int().nonnegative().nullable(),
  newMatches: z.number().int().nonnegative(),
  message: z.string().nullable(),
  detectedRiotId: detectedRiotIdSchema.nullable(),
});
export type ClientStatus = z.infer<typeof clientStatusSchema>;

export const installPathSchema = z
  .string()
  .trim()
  .max(400, "Percorso troppo lungo")
  .regex(/^[A-Za-z]:\\/, "Indica un percorso completo, es. C:\\Riot Games\\League of Legends");
