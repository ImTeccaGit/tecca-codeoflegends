import { useQuery } from "@tanstack/react-query";
import { getMatchAnalysis, isAnalysisAvailable } from "@/services/analysis-service";

/** Under ["riot"]: invalidated together with profiles after every sync. */
export const analysisKeys = {
  dataset: (puuid: string) => ["riot", "analysis", puuid] as const,
};

export function useMatchAnalysis(puuid: string) {
  return useQuery({
    queryKey: analysisKeys.dataset(puuid),
    queryFn: () => getMatchAnalysis(puuid),
    enabled: isAnalysisAvailable() && puuid.length > 0,
  });
}
