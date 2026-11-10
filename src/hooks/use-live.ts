import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import {
  getLiveBoard,
  getLiveSnapshot,
  isLiveBoardOpen,
  subscribeToLiveBoard,
  toggleLiveBoard,
  getOverlaySettings,
  isLiveAvailable,
  setLiveEnabled,
  subscribeToLiveUpdates,
  subscribeToOverlaySettings,
  updateOverlaySettings,
} from "@/services/live-service";
import { logFrontendError } from "@/services/log-service";
import type { LiveBoard, LiveSnapshot, OverlayPatch, OverlaySettings } from "@/types/live";

export const liveKeys = {
  snapshot: ["live", "snapshot"] as const,
  overlay: ["live", "overlay"] as const,
  board: ["live", "board"] as const,
  boardOpen: ["live", "board-open"] as const,
};

/** Pushed by Rust events: no client-side polling. */
export function useLiveSnapshot() {
  return useQuery({
    queryKey: liveKeys.snapshot,
    queryFn: getLiveSnapshot,
    enabled: isLiveAvailable(),
    staleTime: Infinity,
  });
}

export function useOverlaySettings() {
  return useQuery({
    queryKey: liveKeys.overlay,
    queryFn: getOverlaySettings,
    enabled: isLiveAvailable(),
    staleTime: Infinity,
  });
}

export function useSetLiveEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setLiveEnabled,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(liveKeys.snapshot, snapshot);
      void queryClient.invalidateQueries({ queryKey: ["system"] });
    },
  });
}

export function useUpdateOverlay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: OverlayPatch) => updateOverlaySettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(liveKeys.overlay, settings);
    },
  });
}

/**
 * Keeps the live caches in sync with the backend events. Mounted by the Live
 * page and by the overlay window (each window has its own query client).
 */
export function useLiveEventListeners() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const stops: (() => void)[] = [];
    let disposed = false;

    const keep = (stop: () => void) => {
      if (disposed) {
        stop();
      } else {
        stops.push(stop);
      }
    };
    const fail = (error: unknown) => {
      void logFrontendError("Listener Live Game", error);
    };

    subscribeToLiveUpdates((snapshot: LiveSnapshot) => {
      queryClient.setQueryData(liveKeys.snapshot, snapshot);
    })
      .then(keep)
      .catch(fail);
    subscribeToOverlaySettings((settings: OverlaySettings) => {
      queryClient.setQueryData(liveKeys.overlay, settings);
    })
      .then(keep)
      .catch(fail);

    return () => {
      disposed = true;
      for (const stop of stops) {
        stop();
      }
    };
  }, [queryClient]);
}

/** In-game board: initial read, then pushed by `live-board-update`. */
export function useLiveBoard() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let stop: (() => void) | undefined;
    let disposed = false;
    subscribeToLiveBoard((board: LiveBoard) => queryClient.setQueryData(liveKeys.board, board))
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => {
        void logFrontendError("Listener pannello partita", error);
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: liveKeys.board,
    queryFn: getLiveBoard,
    enabled: isLiveAvailable(),
    staleTime: Infinity,
  });
}

export function useLiveBoardOpen() {
  return useQuery({
    queryKey: liveKeys.boardOpen,
    queryFn: isLiveBoardOpen,
    enabled: isLiveAvailable(),
    refetchInterval: 3_000,
  });
}

export function useToggleLiveBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleLiveBoard,
    onSuccess: (open) => queryClient.setQueryData(liveKeys.boardOpen, open),
  });
}
