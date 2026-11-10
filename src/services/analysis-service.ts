import { invokeCommand, isTauriRuntime } from "@/lib/tauri";
import { analysisDatasetSchema, type AnalysisDataset } from "@/types/analysis";

/** Analysis reads the local SQLite data through Rust: desktop only. */
export function isAnalysisAvailable(): boolean {
  return isTauriRuntime();
}

/** Stored matches of a player, enriched for the analysis. No network. */
export function getMatchAnalysis(puuid: string): Promise<AnalysisDataset | null> {
  return invokeCommand("get_match_analysis", analysisDatasetSchema.nullable(), {
    puuid,
  });
}
