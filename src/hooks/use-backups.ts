import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { systemKeys } from "@/hooks/use-system-snapshot";
import {
  createDatabaseBackup,
  isBackupAvailable,
  listDatabaseBackups,
} from "@/services/backup-service";

export const backupKeys = {
  list: ["backups"] as const,
};

export function useBackups() {
  return useQuery({
    queryKey: backupKeys.list,
    queryFn: listDatabaseBackups,
    enabled: isBackupAvailable(),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDatabaseBackup,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: backupKeys.list });
      void queryClient.invalidateQueries({ queryKey: systemKeys.snapshot });
    },
  });
}
