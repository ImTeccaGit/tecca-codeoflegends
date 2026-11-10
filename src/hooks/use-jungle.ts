import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteClearAttempt,
  deleteJungleRoute,
  isJungleStorageAvailable,
  listClearAttempts,
  listJungleRoutes,
  saveClearAttempt,
  saveJungleRoute,
} from "@/services/jungle-service";

export const jungleKeys = {
  all: ["jungle"] as const,
  routes: ["jungle", "routes"] as const,
  attempts: ["jungle", "attempts"] as const,
};

export function useCustomRoutes() {
  return useQuery({
    queryKey: jungleKeys.routes,
    queryFn: listJungleRoutes,
    enabled: isJungleStorageAvailable(),
  });
}

export function useClearAttempts() {
  return useQuery({
    queryKey: jungleKeys.attempts,
    queryFn: listClearAttempts,
    enabled: isJungleStorageAvailable(),
  });
}

export function useSaveRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveJungleRoute,
    onSuccess: (route) => {
      void queryClient.invalidateQueries({ queryKey: jungleKeys.routes });
      toast.success(`Percorso "${route.name}" salvato`);
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteJungleRoute,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jungleKeys.routes });
      toast.success("Percorso eliminato. Lo storico dei tentativi resta.");
    },
  });
}

export function useSaveAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveClearAttempt,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jungleKeys.attempts });
    },
  });
}

export function useDeleteAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteClearAttempt,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jungleKeys.attempts });
      toast.success("Tentativo eliminato");
    },
  });
}
