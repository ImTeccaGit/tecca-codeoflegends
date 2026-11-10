import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  getCatalogStatus,
  getChampionCatalog,
  getChampionDetail,
  isCatalogAvailable,
  setChampionFavorite,
  setChampionLanes,
  subscribeToCatalogUpdates,
  syncDataDragon,
} from "@/services/catalog-service";
import { logFrontendError } from "@/services/log-service";
import type {
  ChampionCatalog,
  ChampionDetail,
  ChampionPreferences,
  Lane,
} from "@/types/catalog";

export const catalogKeys = {
  all: ["catalog"] as const,
  status: ["catalog", "status"] as const,
  champions: ["catalog", "champions"] as const,
  champion: (key: string) => ["catalog", "champion", key.toLowerCase()] as const,
};

/** Poll while an import runs or before the first catalog exists. */
const STATUS_POLL_MS = 3_000;

export function useCatalogStatus() {
  return useQuery({
    queryKey: catalogKeys.status,
    queryFn: getCatalogStatus,
    enabled: isCatalogAvailable(),
    refetchInterval: (query) =>
      query.state.data?.syncing || query.state.data?.current === null
        ? STATUS_POLL_MS
        : false,
  });
}

export function useChampionCatalog() {
  return useQuery({
    queryKey: catalogKeys.champions,
    queryFn: getChampionCatalog,
    enabled: isCatalogAvailable(),
    // Static per patch: refreshed by the update event, not by time.
    staleTime: Infinity,
  });
}

export function useChampionDetail(key: string) {
  return useQuery({
    queryKey: catalogKeys.champion(key),
    queryFn: () => getChampionDetail(key),
    enabled: isCatalogAvailable() && key.length > 0,
    staleTime: Infinity,
  });
}

export function useSyncDataDragon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDataDragon,
    onSuccess: (outcome) => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      if (outcome.outcome === "up_to_date") {
        toast.success(`Dati già aggiornati alla patch ${outcome.version}`);
      }
      // "imported" is announced by the update event listener.
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.status });
    },
  });
}

type PreferencePatch = Partial<Pick<ChampionPreferences, "favorite" | "lanes">>;

/**
 * Applies a preference change to every cached view of a champion (list and
 * detail) and returns a function that restores the previous caches.
 */
function patchCachedChampion(
  queryClient: QueryClient,
  championId: number,
  patch: PreferencePatch,
): () => void {
  const previousList = queryClient.getQueryData<ChampionCatalog>(
    catalogKeys.champions,
  );
  const previousDetails = queryClient.getQueriesData<ChampionDetail | null>({
    queryKey: ["catalog", "champion"],
  });

  queryClient.setQueryData<ChampionCatalog>(catalogKeys.champions, (list) =>
    list
      ? {
          ...list,
          champions: list.champions.map((champion) =>
            champion.id === championId ? { ...champion, ...patch } : champion,
          ),
        }
      : list,
  );
  queryClient.setQueriesData<ChampionDetail | null>(
    { queryKey: ["catalog", "champion"] },
    (detail) =>
      detail && detail.id === championId ? { ...detail, ...patch } : detail,
  );

  return () => {
    queryClient.setQueryData(catalogKeys.champions, previousList);
    for (const [key, value] of previousDetails) {
      queryClient.setQueryData(key, value);
    }
  };
}

interface FavoriteVariables {
  championId: number;
  favorite: boolean;
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ championId, favorite }: FavoriteVariables) =>
      setChampionFavorite(championId, favorite),
    onMutate: ({ championId, favorite }) => ({
      rollback: patchCachedChampion(queryClient, championId, { favorite }),
    }),
    onError: (_error, _variables, context) => context?.rollback(),
    onSuccess: (saved) => {
      patchCachedChampion(queryClient, saved.championId, {
        favorite: saved.favorite,
        lanes: saved.lanes,
      });
    },
  });
}

interface LanesVariables {
  championId: number;
  lanes: Lane[];
}

export function useSetChampionLanes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ championId, lanes }: LanesVariables) =>
      setChampionLanes(championId, lanes),
    onMutate: ({ championId, lanes }) => ({
      rollback: patchCachedChampion(queryClient, championId, { lanes }),
    }),
    onError: (_error, _variables, context) => context?.rollback(),
    onSuccess: (saved) => {
      patchCachedChampion(queryClient, saved.championId, {
        favorite: saved.favorite,
        lanes: saved.lanes,
      });
    },
  });
}

/**
 * Refreshes catalog queries when the backend imports a new patch, whether
 * the import was manual or scheduled. Mounted once in the app providers.
 */
export function useCatalogUpdateListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    subscribeToCatalogUpdates((version) => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      toast.success(`Dati Data Dragon aggiornati alla versione ${version}`);
    })
      .then((stop) => {
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
        }
      })
      .catch((error: unknown) => {
        void logFrontendError("Listener aggiornamenti catalogo", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [queryClient]);
}
