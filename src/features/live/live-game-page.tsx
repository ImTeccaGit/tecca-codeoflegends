import { Keyboard, LayoutPanelTop, MonitorOff, Radio, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusDot } from "@/components/shared/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BOARD_SHORTCUT_LABEL } from "@/features/live/board-view";
import { LiveBoardContent } from "@/features/live/components/live-board";
import { LiveStats } from "@/features/live/components/live-stats";
import { OverlaySettingsCard } from "@/features/live/components/overlay-settings-card";
import { PolicyCard } from "@/features/live/components/policy-card";
import {
  STATUS_LABELS,
  STATUS_TONES,
  formatUpdatedAt,
} from "@/features/live/lib/live-format";
import {
  useLiveBoard,
  useLiveBoardOpen,
  useLiveEventListeners,
  useLiveSnapshot,
  useOverlaySettings,
  useSetLiveEnabled,
  useToggleLiveBoard,
} from "@/hooks/use-live";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { isLiveAvailable } from "@/services/live-service";

function Section({
  eyebrow,
  title,
  aside,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 font-display text-sm font-semibold">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function LiveContent() {
  useLiveEventListeners();
  const snapshot = useLiveSnapshot();
  const overlay = useOverlaySettings();
  const toggle = useSetLiveEnabled();

  if (snapshot.isError) {
    return (
      <ErrorState
        message={getErrorMessage(snapshot.error)}
        onRetry={() => void snapshot.refetch()}
      />
    );
  }
  if (!snapshot.data) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const live = snapshot.data;
  const enabled = live.status !== "disabled";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Section
        eyebrow="Consenso"
        title="Rilevamento partita"
        aside={
          <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <StatusDot tone={STATUS_TONES[live.status]} pulse={live.status === "in_game"} />
            {STATUS_LABELS[live.status]}
          </span>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
            <div>
              <Label htmlFor="live-enabled" className="text-xs font-semibold">
                Rileva la partita in corso
              </Label>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Disattivato di default. Quando è attivo, l'app interroga in sola
                lettura la Live Client Data API locale del gioco
                (127.0.0.1:2999): ogni 2 s in partita, ogni 5 s altrimenti.
                Nessun dato lascia il computer.
              </p>
            </div>
            <Switch
              id="live-enabled"
              checked={enabled}
              disabled={toggle.isPending}
              onCheckedChange={(next) =>
                toggle.mutate(next, {
                  onError: (error) => toast.error(getErrorMessage(error)),
                })
              }
            />
          </div>

          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.06] px-3 py-2">
              <dt className="eyebrow">Stato</dt>
              <dd className="mt-1 text-foreground">{live.message ?? STATUS_LABELS[live.status]}</dd>
            </div>
            <div className="rounded-lg border border-white/[0.06] px-3 py-2">
              <dt className="eyebrow">Fonte · ultimo controllo</dt>
              <dd className="mt-1 text-foreground">
                Live Client Data API (Riot, locale) · {formatUpdatedAt(live.updatedAtMs)}
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section
        eyebrow="Solo i tuoi dati"
        title="La tua partita"
        aside={live.status === "in_game" ? <Badge variant="success">Dati reali</Badge> : null}
      >
        {live.status === "in_game" ? (
          <LiveStats snapshot={live} />
        ) : (
          <EmptyState
            icon={enabled ? Radio : MonitorOff}
            title={enabled ? "Nessuna partita rilevata" : "Rilevamento disattivato"}
            description={
              enabled
                ? "Avvia una partita di League of Legends: i tuoi dati compariranno qui appena il gioco li rende disponibili."
                : "Attiva il rilevamento per vedere i tuoi dati della partita in corso. Nessun dato dimostrativo viene mostrato."
            }
          />
        )}
      </Section>

      <BoardSection />

      <Section eyebrow="Finestra separata" title="Overlay desktop">
        {overlay.isError ? (
          <ErrorState
            compact
            message={getErrorMessage(overlay.error)}
            onRetry={() => void overlay.refetch()}
          />
        ) : overlay.data ? (
          <OverlaySettingsCard key={JSON.stringify(overlay.data)} settings={overlay.data} />
        ) : (
          <Skeleton className="h-48 w-full rounded-xl" />
        )}
      </Section>

      <Section
        eyebrow="Policy Riot"
        title="Limiti volontari del modulo"
        aside={<ShieldCheck className="size-4 text-success" aria-hidden="true" />}
      >
        <PolicyCard />
        <p className="mt-4 rounded-lg border border-warning/20 bg-warning/[0.05] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Per la distribuzione pubblica, Riot richiede che ogni prodotto sia
          registrato e approvato tramite il Developer Portal. Questa versione
          è per uso personale e di sviluppo.
        </p>
      </Section>
    </div>
  );
}

/** Players of the game + build of the user's champion. */
function BoardSection() {
  const board = useLiveBoard();
  const open = useLiveBoardOpen();
  const toggle = useToggleLiveBoard();
  return (
    <Section
      eyebrow="In partita"
      title="Pannello partita"
      className="xl:col-span-2"
      aside={
        <Button
          size="sm"
          variant={open.data ? "outline" : "default"}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(undefined, { onError: (error) => toast.error(getErrorMessage(error)) })}
        >
          <LayoutPanelTop className="size-3.5" />
          {open.data ? "Nascondi pannello" : "Mostra pannello"}
        </Button>
      }
    >
      <p className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Keyboard className="size-3.5" />
        Si apre da solo a inizio partita; premi <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 font-mono">{BOARD_SHORTCUT_LABEL}</kbd>
        per nasconderlo o riaprirlo sopra il gioco (finestra separata, non cliccabile). Rank e
        partite recenti vengono dalla Riot API con la tua chiave; i giocatori con nome nascosto e i bot non
        vengono cercati.
      </p>
      {board.isError ? (
        <ErrorState compact message={getErrorMessage(board.error)} onRetry={() => void board.refetch()} />
      ) : board.data ? (
        <LiveBoardContent board={board.data} />
      ) : (
        <Skeleton className="h-48 w-full rounded-xl" />
      )}
    </Section>
  );
}

export function LiveGamePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fase 7 · Live Game"
        title="Live Game & Overlay"
        description="Stato della partita in corso e i tuoi dati, letti in sola lettura dall'API locale documentata da Riot. Nessun accesso alla memoria o ai file del gioco."
      />
      {isLiveAvailable() ? (
        <LiveContent />
      ) : (
        <EmptyState
          icon={MonitorOff}
          title="Disponibile solo nell'app desktop"
          description="Il rilevamento della partita passa dal backend Rust: in questa anteprima browser non è attivo."
        />
      )}
    </div>
  );
}
