import { ArrowLeft, Database, SearchX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AbilityList } from "@/features/champions/components/ability-list";
import { ChampionGlobalSection } from "@/features/champions/components/global/champion-global-section";
import {
  DesktopOnlyState,
  EmptyCatalogState,
} from "@/features/champions/components/catalog-states";
import {
  ChampionRatings,
  ChampionStatsTable,
} from "@/features/champions/components/champion-stats";
import { FavoriteButton } from "@/features/champions/components/favorite-button";
import { LaneIcon } from "@/components/shared/lane-icon";
import { formatPercent, playedLanes, ratio } from "@/features/champions/lib/global-format";
import { laneLabel } from "@/features/champions/lib/lanes";
import { useChampionRoles } from "@/hooks/use-global-stats";
import { SkinGallery } from "@/features/champions/components/skin-gallery";
import { classLabel } from "@/features/champions/lib/champion-filters";
import { useCatalogStatus, useChampionDetail } from "@/hooks/use-catalog";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import { isCatalogAvailable } from "@/services/catalog-service";
import type { ChampionDetail } from "@/types/catalog";

function BackLink() {
  const location = useLocation();
  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
      <Link to={{ pathname: "/champions", search: location.search }}>
        <ArrowLeft className="size-3.5" />
        Tutti i campioni
      </Link>
    </Button>
  );
}

function Section({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
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

/** Lanes the champion really plays, from the matches (not a user choice). */
function PlayedLanes({ championId }: { championId: number }) {
  const { data } = useChampionRoles();
  const entry = data?.champions.find((item) => item.championId === championId);
  const lanes = playedLanes(entry);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-background/60 p-2.5 backdrop-blur-sm">
      <p className="eyebrow mb-2">Corsie giocate</p>
      {entry && lanes.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {lanes.map((lane) => {
            const share = entry.roles.find((role) => role.role === lane);
            return (
              <li
                key={lane}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium"
              >
                <LaneIcon lane={lane} className="size-3.5" />
                {laneLabel(lane)}
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatPercent(ratio(share?.games ?? 0, entry.games))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="max-w-[19rem] text-[11px] text-muted-foreground">
          Nessuna partita con questo campione: la corsia compare appena ce ne sono.
        </p>
      )}
      {entry ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Da {entry.games} {entry.games === 1 ? "partita" : "partite"} con corsia nota
        </p>
      ) : null}
    </div>
  );
}

function ChampionHero({ champion }: { champion: ChampionDetail }) {
  const [splashFailed, setSplashFailed] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-surface shadow-hero">
      {!splashFailed ? (
        <img
          src={champion.splashUrl}
          alt=""
          onError={() => setSplashFailed(true)}
          className="absolute inset-0 -z-10 size-full object-cover object-top opacity-60 motion-safe:animate-fade-in"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-transparent" />

      <div className="flex flex-col justify-end gap-5 p-5 sm:p-6 md:flex-row md:items-center">
        {portraitFailed ? (
          <ChampionAvatar
            name={champion.name}
            className="size-16 rounded-2xl text-base"
          />
        ) : (
          <img
            src={champion.imageUrl}
            alt=""
            width={64}
            height={64}
            onError={() => setPortraitFailed(true)}
            className="size-16 rounded-2xl border border-white/15 object-cover shadow-xl shadow-black/40"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Campione · Patch {champion.patch.patch}</p>
          <h1 className="mt-1 font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-semibold tracking-[-0.03em] text-foreground">
            {champion.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground first-letter:uppercase">
            {champion.title}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {champion.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {classLabel(tag)}
              </Badge>
            ))}
            {champion.partype ? (
              <Badge variant="outline">{champion.partype}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <FavoriteButton
            variant="labeled"
            championId={champion.id}
            championName={champion.name}
            favorite={champion.favorite}
          />
          <PlayedLanes championId={champion.id} />
        </div>
      </div>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export function ChampionDetailPage() {
  const { championId = "" } = useParams<{ championId: string }>();
  const { data: status } = useCatalogStatus();
  const { data, isLoading, isError, error, refetch } =
    useChampionDetail(championId);

  if (!isCatalogAvailable()) {
    return (
      <div className="space-y-5">
        <BackLink />
        <DesktopOnlyState />
      </div>
    );
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <BackLink />
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <BackLink />
        {status && status.current === null ? (
          <EmptyCatalogState />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Campione non trovato"
            description={`"${championId.slice(0, 64)}" non esiste nella patch ${status?.current?.patch ?? "corrente"} di Data Dragon.`}
          />
        )}
      </div>
    );
  }

  const paragraphs = data.lore.split(/\n+/).filter(Boolean);

  return (
    <div className="space-y-5">
      <BackLink />
      <ChampionHero champion={data} />

      <ChampionGlobalSection
        key={data.id}
        championId={data.id}
        championName={data.name}
        spells={data.spells}
      />

      <h2 className="eyebrow pt-2">Kit, collezione e storia · Data Dragon</h2>

      <div className="stagger grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <Section eyebrow="Kit" title="Abilità">
            <AbilityList spells={data.spells} />
          </Section>

          <Section
            eyebrow="Collezione"
            title="Skin"
            aside={
              <span className="font-mono text-[10px] text-muted-foreground">
                {data.skins.length} voci Data Dragon
              </span>
            }
          >
            <SkinGallery skins={data.skins} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section eyebrow="Storia" title="Descrizione">
            <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </Section>

          <Section eyebrow="Valutazioni ufficiali Riot" title="Profilo (0–10)">
            <ChampionRatings info={data.info} />
          </Section>

          <Section eyebrow="Statistiche" title="Base e crescita per livello">
            <ChampionStatsTable stats={data.stats} partype={data.partype} />
          </Section>

          <div className="flex items-start gap-3 rounded-xl border border-secondary/15 bg-secondary/[0.04] p-4">
            <Database className="mt-0.5 size-4 shrink-0 text-secondary" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Fonte: {data.patch.source} {data.patch.version} (
              {data.patch.language}), importata il{" "}
              <time dateTime={data.patch.importedAt}>
                {formatDateTime(data.patch.importedAt)}
              </time>
              . Le patch precedenti restano salvate per lo storico partite.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
