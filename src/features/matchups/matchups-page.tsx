import { Ban, Crosshair, Globe2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { DataProvenance } from "@/components/shared/data-provenance";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { GroupTable } from "@/features/analysis/components/group-table";
import { VersusRow } from "@/features/analysis/components/match-detail";
import { PlayerScope } from "@/features/analysis/components/player-scope";
import { byChampion, filterOptions, provenance, roleLabel } from "@/features/analysis/lib/analysis";
import { formatWinRate, winRateDetail } from "@/features/analysis/lib/format";
import { ChampionCard } from "@/features/matchups/components/champion-card";
import {
  completedItems,
  counters,
  headToHead,
  matchupMatches,
  opponentsFaced,
  presence,
  runePages,
  synergies,
  type Presence,
} from "@/features/matchups/lib/matchups";
import { useChampionCatalog } from "@/hooks/use-catalog";
import { formatPercent } from "@/lib/match-stats";
import type { AnalysisDataset, ChampionRef } from "@/types/analysis";

function Section({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
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

function positiveInt(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function PresenceLine({ name, value }: { name: string; value: Presence }) {
  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">{name}</th>
      <td className="px-2 py-2 text-right tabular-nums">
        {formatPercent(value.pickRate)} <span className="text-muted-foreground">({value.picked})</span>
      </td>
      <td className="py-2 pl-2 text-right tabular-nums">
        {formatPercent(value.banRate)} <span className="text-muted-foreground">({value.banned})</span>
      </td>
    </tr>
  );
}

function MatchupsView({ dataset }: { dataset: AnalysisDataset }) {
  const [params, setParams] = useSearchParams();
  const catalog = useChampionCatalog();
  const options = filterOptions(dataset.matches);

  const requestedChampion = positiveInt(params.get("champion"));
  // Default: the most played champion (data order is newest first).
  const mostPlayed = byChampion(dataset.matches)[0];
  const championId =
    options.champions.find((champion) => champion.id === requestedChampion)?.id ??
    (mostPlayed ? Number(mostPlayed.key) : null);
  const roleParam = params.get("role");
  const role = roleParam && options.roles.includes(roleParam) ? roleParam : null;
  const opponents = championId === null ? [] : opponentsFaced(dataset.matches, championId, role);
  const requestedOpponent = positiveInt(params.get("opponent"));
  const opponentId = opponents.find((entry) => entry.id === requestedOpponent)?.id ?? null;

  const update = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    setParams(search, { replace: true });
  };

  if (championId === null) {
    return <EmptyState icon={Crosshair} title="Nessun campione" description="Nessuna partita con un campione riconosciuto." />;
  }

  const championMatches = matchupMatches(dataset.matches, { championId, opponentId: null, role });
  const selected = opponentId === null ? championMatches : matchupMatches(championMatches, { championId, opponentId, role });
  const h2h = headToHead(selected);
  const info = provenance(dataset.source, selected);

  const myRef: ChampionRef | null = championMatches[0]?.champion ?? null;
  const opponentRef: ChampionRef | null =
    opponentId === null ? null : (selected.find((match) => match.opponent)?.opponent?.champion ?? null);
  const catalogItem = (id: number | null) =>
    id === null ? undefined : catalog.data?.champions.find((champion) => champion.id === id);

  const scope = opponentId === null ? championMatches : selected;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="matchup-champion" className="text-[11px] text-muted-foreground">Campione selezionato</Label>
            <NativeSelect
              id="matchup-champion"
              value={championId}
              onChange={(event) => update({ champion: event.currentTarget.value, opponent: null })}
            >
              {options.champions.map((champion) => (
                <option key={champion.id} value={champion.id}>{champion.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="matchup-role" className="text-[11px] text-muted-foreground">Ruolo</Label>
            <NativeSelect
              id="matchup-role"
              value={role ?? ""}
              onChange={(event) => update({ role: event.currentTarget.value || null, opponent: null })}
            >
              <option value="">Tutti</option>
              {options.roles.map((value) => (
                <option key={value} value={value}>{roleLabel(value)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="matchup-opponent" className="text-[11px] text-muted-foreground">Campione avversario (corsia)</Label>
            <NativeSelect
              id="matchup-opponent"
              value={opponentId ?? ""}
              onChange={(event) => update({ opponent: event.currentTarget.value || null })}
              disabled={opponents.length === 0}
            >
              <option value="">{opponents.length === 0 ? "Nessun avversario di corsia registrato" : "Tutti gli avversari"}</option>
              {opponents.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.games})
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Gli avversari elencati sono quelli affrontati davvero in corsia (stesso ruolo Riot, squadra opposta) nelle tue partite salvate.
        </p>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <ChampionCard label="Il tuo campione" champion={myRef} catalog={catalogItem(championId)} tone="primary" emptyText="—" />
        <div className="flex items-center justify-center font-display text-sm font-semibold text-muted-foreground">VS</div>
        <ChampionCard
          label="Avversario"
          champion={opponentRef}
          catalog={catalogItem(opponentId)}
          tone="secondary"
          emptyText="Scegli un avversario per il confronto diretto."
        />
      </div>

      <DataProvenance
        {...info}
        note={`Solo le partite di ${dataset.gameName}#${dataset.tagLine}${role ? ` come ${roleLabel(role)}` : ""}. Intervalli di confidenza al 95% (Wilson).`}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          eyebrow="Confronto"
          title={opponentRef ? `Tu vs ${opponentRef.championName}` : "Tu vs i tuoi avversari di corsia"}
          aside={h2h.summary.sufficient ? null : <Badge variant="warning">Pochi dati</Badge>}
        >
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] p-3">
              <p className="eyebrow">Win rate</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatWinRate(h2h.summary)}</p>
              <p className="text-[11px] text-muted-foreground">{winRateDetail(h2h.summary)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-3">
              <p className="eyebrow">Partite confrontabili</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{h2h.compared}</p>
              <p className="text-[11px] text-muted-foreground">con avversario di corsia identificato</p>
            </div>
          </div>
          {h2h.you && h2h.opponent ? (
            <div className="space-y-3">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-primary">Tu (media)</span>
                <span className="text-secondary">Avversario (media)</span>
              </div>
              <VersusRow label="KDA" you={h2h.you.kda} them={h2h.opponent.kda} digits={2} />
              <VersusRow label="Kill" you={h2h.you.kills} them={h2h.opponent.kills} digits={1} />
              <VersusRow label="Morti" you={h2h.you.deaths} them={h2h.opponent.deaths} digits={1} />
              <VersusRow label="CS/min" you={h2h.you.csPerMinute} them={h2h.opponent.csPerMinute} digits={1} />
              <VersusRow label="Oro/min" you={h2h.you.goldPerMinute} them={h2h.opponent.goldPerMinute} />
              <VersusRow label="Visione" you={h2h.you.visionScore} them={h2h.opponent.visionScore} digits={1} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nessuna partita con un avversario di corsia identificato: confronto non disponibile.
            </p>
          )}
        </Section>

        <Section eyebrow="Affidabilità" title="Win rate, pick rate e ban rate" aside={<Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />}>
          <div className="space-y-4">
            <div className="rounded-xl border border-warning/20 bg-warning/[0.05] p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">Statistiche globali: non disponibili</p>
              La Riot API ufficiale non fornisce win rate, pick rate o ban rate aggregati per campione o
              matchup. Non usiamo fonti di terze parti non verificate e non stimiamo percentuali: qui
              trovi solo dati calcolati dalle tue partite.
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Ban className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Presenza nelle tue {dataset.matches.length} partite salvate
              </p>
              <table className="w-full text-xs">
                <caption className="sr-only">Pick rate e ban rate nelle tue partite</caption>
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                    <th scope="col" className="py-2 pr-3 text-left font-semibold">Campione</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Pick rate</th>
                    <th scope="col" className="py-2 pl-2 text-right font-semibold">Ban rate</th>
                  </tr>
                </thead>
                <tbody>
                  {myRef ? <PresenceLine name={myRef.championName} value={presence(dataset.matches, championId)} /> : null}
                  {opponentRef && opponentId !== null ? (
                    <PresenceLine name={opponentRef.championName} value={presence(dataset.matches, opponentId)} />
                  ) : null}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Pick rate: partite in cui il campione era in una delle due squadre. Ban rate: partite in cui è stato bannato.
                I ban sono disponibili per le partite che li prevedono (es. classificate e Draft).
              </p>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section eyebrow="Counter" title={`Avversari di corsia con ${myRef?.championName ?? "il campione"}`}>
          <GroupTable
            caption="Avversari di corsia, dal più difficile"
            firstColumn="Avversario"
            groups={counters(championMatches)}
            showImages
            limit={12}
            empty="Nessun avversario di corsia identificato."
          />
        </Section>
        <Section eyebrow="Sinergie" title="Alleati nelle tue partite">
          <GroupTable
            caption="Alleati, dal win rate più alto"
            firstColumn="Alleato"
            groups={synergies(scope)}
            showImages
            limit={12}
            empty="Nessun alleato registrato."
          />
        </Section>
        <Section eyebrow="Rune" title="Rune che hai usato">
          <GroupTable
            caption="Pagine di rune usate"
            firstColumn="Chiave + ramo secondario"
            groups={runePages(scope)}
            shareLabel="Uso"
            empty="Nessuna runa registrata."
          />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Sono le rune usate da te in queste partite, non raccomandazioni: per consigli servirebbero dati globali, non disponibili dalla Riot API.
          </p>
        </Section>
        <Section eyebrow="Build" title="Oggetti completati associati">
          <GroupTable
            caption="Oggetti completati"
            firstColumn="Oggetto"
            groups={completedItems(scope)}
            shareLabel="Frequenza"
            showImages
            limit={12}
            empty="Nessun oggetto completato registrato."
          />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Oggetti nell'inventario a fine partita classificati come completi da Data Dragon (nessun
            potenziamento, almeno 900 oro, non consumabili). L'ordine di acquisto richiede la timeline, non usata.
          </p>
        </Section>
      </div>
    </div>
  );
}

export function MatchupsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Database · Fase 06"
        title="Matchups & Counters"
        description="Confronto tra il tuo campione e gli avversari di corsia che hai affrontato davvero, con counter, sinergie, rune e oggetti delle tue partite."
        actions={<Badge variant="outline">Fonte: le tue partite match-v5</Badge>}
      />
      <PlayerScope>{(dataset) => <MatchupsView dataset={dataset} />}</PlayerScope>
    </div>
  );
}
