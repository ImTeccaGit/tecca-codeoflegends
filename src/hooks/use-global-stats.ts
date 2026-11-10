import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearGlobalStats,
  getChampionGlobalStats,
  getChampionRoles,
  getGlobalStatsStatus,
  isGlobalStatsAvailable,
  updateGlobalStatsSettings,
} from "@/services/global-stats-service";
import type { ChampionStatsFilter, GlobalStatsStatus } from "@/types/global-stats";

export const globalStatsKeys = {
  all: ["global-stats"] as const,
  status: ["global-stats", "status"] as const,
  roles: ["global-stats", "roles"] as const,
  champion: (championId: number, filter: ChampionStatsFilter) =>
    ["global-stats", "champion", championId, filter.patch, filter.role] as const,
};

/** Refresh while the collector runs, so counters move. */
const RUNNING_POLL_MS = 10_000;
/** Champion pages refresh slowly while new matches arrive. */
const STATS_POLL_MS = 60_000;

const isRunning = (status: GlobalStatsStatus | undefined) =>
  status?.enabled === true && status.state !== "disabled";

export function useGlobalStatsStatus() {
  return useQuery({
    queryKey: globalStatsKeys.status,
    queryFn: getGlobalStatsStatus,
    enabled: isGlobalStatsAvailable(),
    refetchInterval: (query) => (isRunning(query.state.data) ? RUNNING_POLL_MS : false),
  });
}

export function useChampionGlobalStats(championId: number | undefined, filter: ChampionStatsFilter) {
  const status = useGlobalStatsStatus();
  return useQuery({
    queryKey: globalStatsKeys.champion(championId ?? 0, filter),
    queryFn: () => getChampionGlobalStats(championId ?? 0, filter),
    enabled: isGlobalStatsAvailable() && championId !== undefined,
    placeholderData: keepPreviousData,
    refetchInterval: isRunning(status.data) ? STATS_POLL_MS : false,
  });
}

export function useUpdateGlobalStatsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateGlobalStatsSettings,
    onSuccess: (status) => queryClient.setQueryData(globalStatsKeys.status, status),
  });
}

export function useClearGlobalStats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearGlobalStats,
    onSuccess: (status) => {
      queryClient.setQueryData(globalStatsKeys.status, status);
      void queryClient.invalidateQueries({ queryKey: globalStatsKeys.all });
    },
  });
}

export function useChampionRoles() {
  const status = useGlobalStatsStatus();
  return useQuery({
    queryKey: globalStatsKeys.roles,
    queryFn: getChampionRoles,
    enabled: isGlobalStatsAvailable(),
    staleTime: 60_000,
    refetchInterval: isRunning(status.data) ? STATS_POLL_MS : false,
  });
}
