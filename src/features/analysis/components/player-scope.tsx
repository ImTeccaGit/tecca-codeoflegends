import { History, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { RiotDesktopOnly } from "@/features/players/components/riot-states";
import { useMatchAnalysis } from "@/hooks/use-analysis";
import { useSavedProfiles } from "@/hooks/use-riot";
import { getErrorMessage } from "@/lib/errors";
import { isAnalysisAvailable } from "@/services/analysis-service";
import type { AnalysisDataset } from "@/types/analysis";

interface PlayerScopeProps {
  children: (dataset: AnalysisDataset) => ReactNode;
}

/**
 * Resolves the analysed player (URL `player`, else the primary saved
 * profile) and handles every non-success state before rendering children.
 */
export function PlayerScope({ children }: PlayerScopeProps) {
  const [params, setParams] = useSearchParams();
  const saved = useSavedProfiles();
  const requested = params.get("player");
  const puuid =
    requested ?? saved.data?.find((profile) => profile.primary)?.puuid ?? saved.data?.[0]?.puuid ?? "";
  const dataset = useMatchAnalysis(puuid);

  if (!isAnalysisAvailable()) return <RiotDesktopOnly />;
  if (saved.isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (saved.isError) {
    return <ErrorState message={getErrorMessage(saved.error)} onRetry={() => void saved.refetch()} />;
  }
  if (!puuid) {
    return (
      <EmptyState
        icon={UserRound}
        title="Nessun profilo salvato"
        description="L'analisi usa le partite reali di un profilo salvato. Cerca e salva il tuo profilo in Player Profiles."
        action={
          <Button asChild size="sm">
            <Link to="/players">Vai a Player Profiles</Link>
          </Button>
        }
      />
    );
  }

  const picker =
    (saved.data?.length ?? 0) > 1 ? (
      <div className="flex max-w-xs items-center gap-2">
        <Label htmlFor="analysis-player" className="shrink-0 text-xs text-muted-foreground">
          Profilo
        </Label>
        <NativeSelect
          id="analysis-player"
          value={puuid}
          onChange={(event) => {
            const search = new URLSearchParams();
            search.set("player", event.currentTarget.value);
            setParams(search, { replace: true });
          }}
        >
          {saved.data?.map((profile) => (
            <option key={profile.puuid} value={profile.puuid}>
              {profile.gameName}#{profile.tagLine}
              {profile.primary ? " (principale)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
    ) : null;

  let body: ReactNode;
  if (dataset.isLoading) {
    body = <Skeleton className="h-64 rounded-2xl" />;
  } else if (dataset.isError) {
    body = <ErrorState message={getErrorMessage(dataset.error)} onRetry={() => void dataset.refetch()} />;
  } else if (!dataset.data) {
    body = (
      <EmptyState
        icon={UserRound}
        title="Profilo non presente in locale"
        description="Questo profilo non è più salvato sul dispositivo. Cercalo di nuovo in Player Profiles."
      />
    );
  } else if (dataset.data.matches.length === 0) {
    body = (
      <EmptyState
        icon={History}
        title="Nessuna partita da analizzare"
        description="Non ci sono partite salvate per questo profilo. Aggiorna il profilo in Player Profiles per scaricarle dalla Riot API: nessun dato dimostrativo viene usato qui."
        action={
          <Button asChild size="sm">
            <Link to={`/players/${encodeURIComponent(dataset.data.puuid)}`}>Apri il profilo</Link>
          </Button>
        }
      />
    );
  } else {
    body = children(dataset.data);
  }

  return (
    <div className="space-y-5">
      {picker}
      {body}
    </div>
  );
}
