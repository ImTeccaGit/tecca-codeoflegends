import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { systemKeys } from "@/hooks/use-system-snapshot";
import {
  clearRiotApiKey,
  deletePlayerData,
  getPlayerProfile,
  getPrimaryProfile,
  getRiotKeyStatus,
  isRiotAvailable,
  listSavedProfiles,
  removePlayerProfile,
  savePlayerProfile,
  searchPlayer,
  setRiotApiKey,
  syncPlayer,
  verifyRiotApiKey,
} from "@/services/riot-service";
import type { PlayerProfile } from "@/types/riot";
import type { RiotRegion } from "@/types/system";

export const riotKeys = {
  all: ["riot"] as const,
  keyStatus: ["riot", "key-status"] as const,
  saved: ["riot", "saved"] as const,
  primary: ["riot", "primary"] as const,
  profile: (puuid: string) => ["riot", "profile", puuid] as const,
};

export function useRiotKeyStatus() {
  return useQuery({
    queryKey: riotKeys.keyStatus,
    queryFn: getRiotKeyStatus,
    enabled: isRiotAvailable(),
  });
}

function useKeyMutation<T>(mutationFn: (value: T) => ReturnType<typeof getRiotKeyStatus>, message: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (status) => {
      queryClient.setQueryData(riotKeys.keyStatus, status);
      void queryClient.invalidateQueries({ queryKey: systemKeys.snapshot });
      toast.success(message);
    },
  });
}

export function useSetRiotKey() {
  return useKeyMutation(setRiotApiKey, "Chiave salvata nella Gestione credenziali di Windows");
}

export function useClearRiotKey() {
  return useKeyMutation(() => clearRiotApiKey(), "Chiave rimossa dalla Gestione credenziali");
}

export function useVerifyRiotKey() {
  return useMutation({
    mutationFn: verifyRiotApiKey,
    onSuccess: () => toast.success("Chiave valida: la Riot API risponde correttamente"),
  });
}

export function useSavedProfiles() {
  return useQuery({
    queryKey: riotKeys.saved,
    queryFn: listSavedProfiles,
    enabled: isRiotAvailable(),
  });
}

export function usePrimaryProfile() {
  return useQuery({
    queryKey: riotKeys.primary,
    queryFn: getPrimaryProfile,
    enabled: isRiotAvailable(),
  });
}

/** Local data only (no request to Riot). */
export function usePlayerProfile(puuid: string) {
  return useQuery({
    queryKey: riotKeys.profile(puuid),
    queryFn: () => getPlayerProfile(puuid),
    enabled: isRiotAvailable() && puuid.length > 0,
  });
}

function useStoreProfile() {
  const queryClient = useQueryClient();
  return (profile: PlayerProfile) => {
    queryClient.setQueryData(riotKeys.profile(profile.puuid), profile);
    void queryClient.invalidateQueries({ queryKey: riotKeys.saved });
    void queryClient.invalidateQueries({ queryKey: riotKeys.primary });
  };
}

export function useSearchPlayer() {
  const store = useStoreProfile();
  return useMutation({
    mutationFn: ({ riotId, region }: { riotId: string; region: RiotRegion }) =>
      searchPlayer(riotId, region),
    onSuccess: store,
  });
}

export function useSyncPlayer() {
  const store = useStoreProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ puuid, force }: { puuid: string; force: boolean }) => syncPlayer(puuid, force),
    onSuccess: (profile) => {
      store(profile);
      toast.success("Profilo aggiornato dalla Riot API");
    },
    // A failed sync records the error on the profile: show the stored state.
    onError: (_error, { puuid }) => {
      void queryClient.invalidateQueries({ queryKey: riotKeys.profile(puuid) });
    },
  });
}

function useProfileMutation(
  mutationFn: (puuid: string) => Promise<void>,
  message: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_result, puuid) => {
      void queryClient.invalidateQueries({ queryKey: riotKeys.all });
      void queryClient.invalidateQueries({ queryKey: riotKeys.profile(puuid) });
      toast.success(message);
    },
  });
}

export function useSaveProfile() {
  return useProfileMutation((puuid) => savePlayerProfile(puuid, false), "Profilo salvato");
}

export function useSetPrimaryProfile() {
  return useProfileMutation((puuid) => savePlayerProfile(puuid, true), "Profilo principale aggiornato");
}

export function useRemoveProfile() {
  return useProfileMutation(removePlayerProfile, "Profilo rimosso dai salvati");
}

export function useDeletePlayerData() {
  return useProfileMutation(deletePlayerData, "Dati del giocatore eliminati dal dispositivo");
}
