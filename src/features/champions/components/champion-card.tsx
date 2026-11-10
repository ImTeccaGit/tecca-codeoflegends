import { useState } from "react";
import { Link } from "react-router-dom";
import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { LaneIcon } from "@/components/shared/lane-icon";
import { FavoriteButton } from "@/features/champions/components/favorite-button";
import { classLabel } from "@/features/champions/lib/champion-filters";
import { laneLabel } from "@/features/champions/lib/lanes";
import type { ChampionListItem } from "@/types/catalog";

interface ChampionCardProps {
  champion: ChampionListItem;
  /** Keeps the current filters in the URL when coming back from the detail. */
  search: string;
}

export function ChampionCard({ champion, search }: ChampionCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="card-lift group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card">
      <FavoriteButton
        championId={champion.id}
        championName={champion.name}
        favorite={champion.favorite}
        className="absolute top-2 right-2 z-10"
      />

      <Link
        to={{ pathname: `/champions/${champion.key}`, search }}
        className="flex flex-1 flex-col items-center gap-2 px-3 pt-4 pb-3 text-center outline-none focus-visible:bg-white/[0.03]"
      >
        <div className="relative">
          <span className="absolute inset-0 rounded-2xl bg-primary/25 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
          {imageFailed ? (
            <ChampionAvatar
              name={champion.name}
              className="relative size-16 rounded-2xl text-sm"
            />
          ) : (
            <img
              src={champion.imageUrl}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className="relative size-16 rounded-2xl border border-white/10 object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-foreground">
            {champion.name}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
            {champion.title}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {champion.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-px font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase"
            >
              {classLabel(tag)}
            </span>
          ))}
        </div>
        {champion.lanes.length > 0 ? (
          <div
            className="flex items-center justify-center gap-1 text-primary-soft"
            aria-label={`Corsie giocate: ${champion.lanes.map(laneLabel).join(", ")}`}
          >
            {champion.lanes.map((lane) => (
              <LaneIcon key={lane} lane={lane} className="size-3.5" />
            ))}
          </div>
        ) : null}
      </Link>


    </div>
  );
}
