import { z } from "zod";

/** Contracts for `src-tauri/src/jungle/dto.rs`. Practice data only. */

/** Camp identifiers, mirrored by `CAMP_IDS` in `src-tauri/src/jungle/mod.rs`. */
export const CAMP_IDS = [
  "blue-blue",
  "blue-gromp",
  "blue-wolves",
  "blue-raptors",
  "blue-red",
  "blue-krugs",
  "red-blue",
  "red-gromp",
  "red-wolves",
  "red-raptors",
  "red-red",
  "red-krugs",
  "scuttle-top",
  "scuttle-bot",
] as const;

export type CampId = (typeof CAMP_IDS)[number];

export const campIdSchema = z.enum(CAMP_IDS);
export const mapSideSchema = z.enum(["blue", "red"]);

export const customRouteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  side: mapSideSchema,
  camps: z.array(campIdSchema),
  notes: z.string().nullable(),
  championId: z.number().int().positive().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type CustomRoute = z.infer<typeof customRouteSchema>;

export const routeInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Inserisci un nome").max(60),
  side: mapSideSchema,
  camps: z
    .array(campIdSchema)
    .min(2, "Seleziona almeno due campi")
    .max(CAMP_IDS.length)
    .refine((camps) => new Set(camps).size === camps.length, {
      message: "Ogni campo può comparire una sola volta",
    }),
  notes: z.string().max(500).nullable(),
  championId: z.number().int().positive().nullable(),
});
export type RouteInput = z.infer<typeof routeInputSchema>;

export const clearSplitSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  campId: campIdSchema,
  splitMs: z.number().int().positive(),
});
export type ClearSplit = z.infer<typeof clearSplitSchema>;

export const clearAttemptSchema = z.object({
  id: z.number().int().positive(),
  routeKey: z.string().min(1),
  routeName: z.string().min(1),
  side: mapSideSchema,
  camps: z.array(campIdSchema),
  totalMs: z.number().int().positive(),
  championId: z.number().int().positive().nullable(),
  championName: z.string().nullable(),
  createdAt: z.string().min(1),
  splits: z.array(clearSplitSchema),
});
export type ClearAttempt = z.infer<typeof clearAttemptSchema>;

export const attemptInputSchema = z
  .object({
    routeKey: z.string().min(1).max(80),
    routeName: z.string().min(1).max(80),
    side: mapSideSchema,
    camps: z.array(campIdSchema).min(1),
    splitsMs: z.array(z.number().int().positive()),
    championId: z.number().int().positive().nullable(),
  })
  .refine((input) => input.splitsMs.length === input.camps.length, {
    message: "Ogni campo deve avere il proprio tempo",
  });
export type AttemptInput = z.infer<typeof attemptInputSchema>;
