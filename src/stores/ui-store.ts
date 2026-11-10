import { create } from "zustand";

interface UiState {
  commandOpen: boolean;
  mobileNavOpen: boolean;
  profileOpen: boolean;
  sidebarCollapsed: boolean;
  /**
   * Shows the labelled DEMO dataset on the dashboard. Session-only on
   * purpose: never persisted, so the app always starts on real data.
   */
  demoMode: boolean;
  /** ISO time the DEMO dataset was generated (when the switch was turned on). */
  demoGeneratedAt: string | null;
  setCommandOpen: (open: boolean) => void;
  setDemoMode: (enabled: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

/**
 * UI-only state. Server data lives in TanStack Query, never in Zustand.
 */
export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  mobileNavOpen: false,
  profileOpen: false,
  sidebarCollapsed: false,
  demoMode: false,
  demoGeneratedAt: null,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setDemoMode: (demoMode) =>
    set({
      demoMode,
      demoGeneratedAt: demoMode ? new Date().toISOString() : null,
    }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
