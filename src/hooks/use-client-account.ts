import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { riotKeys } from "@/hooks/use-riot";
import { systemKeys } from "@/hooks/use-system-snapshot";
import {
  getClientAccountStatus,
  isClientAccountAvailable,
  setClientSyncEnabled,
  setLeagueInstallPath,
  subscribeToClientAccount,
  syncFromClient,
} from "@/services/client-account-service";
import { logFrontendError } from "@/services/log-service";
import type { ClientStatus } from "@/types/client-account";

export const clientAccountKeys = {
  status: ["client-account"] as const,
};

/** Stores a new status and refreshes everything built on local Riot data. */
function applyStatus(queryClient: QueryClient, status: ClientStatus) {
  const previous = queryClient.getQueryData<ClientStatus>(clientAccountKeys.status);
  queryClient.setQueryData(clientAccountKeys.status, status);
  const dataChanged =
    status.state === "connected" &&
    (previous?.lastSyncMs !== status.lastSyncMs || previous?.account?.puuid !== status.account?.puuid);
  if (dataChanged) {
    void queryClient.invalidateQueries({ queryKey: riotKeys.all });
    void queryClient.invalidateQueries({ queryKey: systemKeys.snapshot });
  }
}

export function useClientAccountStatus() {
  return useQuery({
    queryKey: clientAccountKeys.status,
    queryFn: getClientAccountStatus,
    enabled: isClientAccountAvailable(),
  });
}

export function useSetClientSyncEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setClientSyncEnabled,
    onSuccess: (status) => applyStatus(queryClient, status),
  });
}

export function useSyncFromClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncFromClient,
    onSuccess: (status) => applyStatus(queryClient, status),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: clientAccountKeys.status }),
  });
}

export function useSetLeagueInstallPath() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setLeagueInstallPath,
    onSuccess: (status) => applyStatus(queryClient, status),
  });
}

/** Mounted once in the app providers: keeps profiles in sync with the client. */
export function useClientAccountListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    subscribeToClientAccount((status) => applyStatus(queryClient, status))
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => {
        void logFrontendError("Listener account client League", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [queryClient]);
}
