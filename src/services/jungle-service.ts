import { z } from "zod";
import { AppError } from "@/lib/errors";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import {
  attemptInputSchema,
  clearAttemptSchema,
  customRouteSchema,
  routeInputSchema,
  type AttemptInput,
  type ClearAttempt,
  type CustomRoute,
  type RouteInput,
} from "@/types/jungle";

/** Practice data lives in the desktop SQLite database. */
export function isJungleStorageAvailable(): boolean {
  return isTauriRuntime();
}

function validated<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Dati non validi.",
      parsed.error,
    );
  }
  return parsed.data;
}

export function listJungleRoutes(): Promise<CustomRoute[]> {
  return invokeCommand("list_jungle_routes", z.array(customRouteSchema));
}

export async function saveJungleRoute(input: RouteInput): Promise<CustomRoute> {
  const data = validated(routeInputSchema, input);
  return invokeCommand("save_jungle_route", customRouteSchema, {
    input: { ...data, id: data.id ?? null },
  });
}

export function deleteJungleRoute(id: string): Promise<void> {
  return invokeCommand("delete_jungle_route", z.null(), { id }).then(() => undefined);
}

export function listClearAttempts(): Promise<ClearAttempt[]> {
  return invokeCommand("list_clear_attempts", z.array(clearAttemptSchema));
}

export async function saveClearAttempt(input: AttemptInput): Promise<ClearAttempt> {
  const data = validated(attemptInputSchema, input);
  return invokeCommand("save_clear_attempt", clearAttemptSchema, { input: data });
}

export function deleteClearAttempt(id: number): Promise<void> {
  return invokeCommand("delete_clear_attempt", z.null(), { id }).then(() => undefined);
}
