import { useMemo } from "react";
import { createDemoDashboard } from "@/features/dashboard/demo/demo-dashboard";
import { toDashboardData } from "@/features/dashboard/lib/real-dashboard";
import { usePrimaryProfile } from "@/hooks/use-riot";
import { useUiStore } from "@/stores/ui-store";
import type { DashboardData } from "@/types/dashboard";

/**
 * Competitive data for the dashboard, in order of precedence:
 * 1. the primary saved profile with real matches (source "riot");
 * 2. the labelled DEMO set, only if the user turned it on;
 * 3. null — panels show honest empty states.
 * Real and DEMO data are never mixed.
 *
 * The DEMO timestamp is taken when the switch is turned on (an event), so
 * rendering stays pure and relative dates are stable.
 */
export function useDashboardData(): DashboardData | null {
  const demoGeneratedAt = useUiStore((state) => state.demoGeneratedAt);
  const primary = usePrimaryProfile();

  return useMemo(() => {
    const real = primary.data ? toDashboardData(primary.data) : null;
    if (real) return real;
    return demoGeneratedAt ? createDemoDashboard(new Date(demoGeneratedAt)) : null;
  }, [demoGeneratedAt, primary.data]);
}
