import { Link } from "react-router-dom";
import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChampionListItem } from "@/types/catalog";
import type { ChampionRef } from "@/types/analysis";

interface ChampionCardProps {
  label: string;
  champion: ChampionRef | null;
  catalog: ChampionListItem | undefined;
  tone: "primary" | "secondary";
  emptyText: string;
}

/** Champion sheet: Data Dragon portrait, title and classes. */
export function ChampionCard({ label, champion, catalog, tone, emptyText }: ChampionCardProps) {
  const image = catalog?.imageUrl ?? champion?.imageUrl ?? null;
  const name = catalog?.name ?? champion?.championName ?? null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-4 rounded-2xl border p-4",
        tone === "primary" ? "border-primary/25 bg-primary/[0.05]" : "border-secondary/25 bg-secondary/[0.05]",
      )}
    >
      {name ? (
        image ? (
          <img src={image} alt="" className="size-16 shrink-0 rounded-xl" />
        ) : (
          <ChampionAvatar name={name} className="size-16 rounded-xl" />
        )
      ) : (
        <span className="size-16 shrink-0 rounded-xl border border-dashed border-white/15" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        {name ? (
          <>
            <p className="mt-1 truncate font-display text-lg font-semibold text-foreground">
              {catalog ? (
                <Link to={`/champions/${catalog.key.toLowerCase()}`} className="hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
            </p>
            {catalog?.title ? <p className="truncate text-xs text-muted-foreground">{catalog.title}</p> : null}
            {catalog?.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {catalog.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
