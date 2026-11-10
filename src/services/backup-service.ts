import { z } from "zod";
import { invokeCommand, isTauriRuntime } from "@/lib/tauri";

export const backupInfoSchema = z.object({
  fileName: z.string().min(1),
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  reason: z.enum(["manual", "pre-migration"]),
  createdAt: z.string().min(1),
});
export type BackupInfo = z.infer<typeof backupInfoSchema>;

export function isBackupAvailable(): boolean {
  return isTauriRuntime();
}

/** Verified local copy of the database (VACUUM INTO), kept in `backups/`. */
export function createDatabaseBackup(): Promise<BackupInfo> {
  return invokeCommand("create_database_backup", backupInfoSchema);
}

export function listDatabaseBackups(): Promise<BackupInfo[]> {
  return invokeCommand("list_database_backups", z.array(backupInfoSchema));
}
