import { useQuery } from "@tanstack/react-query";
import { getSystemSnapshot } from "@/services/system-service";

export const systemKeys = {
  snapshot: ["system", "snapshot"] as const,
};

export function useSystemSnapshot() {
  return useQuery({
    queryKey: systemKeys.snapshot,
    queryFn: getSystemSnapshot,
    staleTime: 20_000,
  });
}
