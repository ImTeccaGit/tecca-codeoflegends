import { GameIcon } from "@/features/champions/components/global/game-icon";
import { cn } from "@/lib/utils";
import type { IconRef, RunePageStat, RuneTreeLayout } from "@/types/global-stats";

interface RunePageViewProps {
  page: RunePageStat;
  trees: RuneTreeLayout[];
  shardRows: IconRef[][];
}

function TreeHeader({ tree }: { tree: IconRef }) {
  return (
    <div className="mb-3 flex items-center justify-center gap-2">
      <GameIcon src={tree.iconUrl} name={tree.name} className="size-6" round />
      <span className="text-[11px] font-semibold text-foreground">{tree.name ?? `Albero ${tree.id}`}</span>
    </div>
  );
}

/** Rows of a tree with the chosen runes highlighted and the others dimmed. */
function TreeRows({
  rows,
  chosen,
  keystoneRow,
}: {
  rows: IconRef[][];
  chosen: Set<number>;
  keystoneRow: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {rows.map((row, index) => (
        <ul
          key={index}
          className={cn("flex items-center justify-center gap-2", keystoneRow && index === 0 && "gap-1.5 pb-1")}
        >
          {row.map((rune) => {
            const selected = chosen.has(rune.id);
            return (
              <li key={rune.id}>
                <GameIcon
                  src={rune.iconUrl}
                  name={selected ? `${rune.name ?? rune.id} (scelta)` : rune.name}
                  round
                  selected={selected}
                  muted={!selected}
                  className={keystoneRow && index === 0 ? "size-10" : "size-7"}
                />
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

/** Fallback when the current Data Dragon patch has no layout for a tree. */
function ChosenList({ runes }: { runes: IconRef[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {runes.map((rune, index) => (
        <li key={`${rune.id}-${index}`}>
          <GameIcon src={rune.iconUrl} name={rune.name} round className={index === 0 ? "size-10" : "size-7"} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Full rune page as shown in the client: primary tree, secondary tree
 * (keystone row excluded) and the three shard rows.
 */
export function RunePageView({ page, trees, shardRows }: RunePageViewProps) {
  const primaryTree = trees.find((tree) => tree.tree.id === page.primaryStyle.id);
  const secondaryTree = trees.find((tree) => tree.tree.id === page.secondaryStyle.id);
  const primaryChosen = new Set(page.primaryRunes.map((rune) => rune.id));
  const secondaryChosen = new Set(page.secondaryRunes.map((rune) => rune.id));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <section aria-label={`Albero primario: ${page.primaryStyle.name ?? page.primaryStyle.id}`}>
        <TreeHeader tree={primaryTree?.tree ?? page.primaryStyle} />
        {primaryTree ? (
          <TreeRows rows={primaryTree.rows} chosen={primaryChosen} keystoneRow />
        ) : (
          <ChosenList runes={page.primaryRunes} />
        )}
      </section>

      <section aria-label={`Albero secondario: ${page.secondaryStyle.name ?? page.secondaryStyle.id}`}>
        <TreeHeader tree={secondaryTree?.tree ?? page.secondaryStyle} />
        {secondaryTree ? (
          <TreeRows rows={secondaryTree.rows.slice(1)} chosen={secondaryChosen} keystoneRow={false} />
        ) : (
          <ChosenList runes={page.secondaryRunes} />
        )}

        <div className="mt-4 border-t border-white/[0.06] pt-3" aria-label="Frammenti">
          <div className="space-y-1.5">
            {shardRows.map((row, index) => {
              const chosen = page.shards[index]?.id;
              return (
                <ul key={index} className="flex items-center justify-center gap-2.5">
                  {row.map((shard, position) => {
                    const selected = shard.id === chosen;
                    return (
                      <li key={`${shard.id}-${position}`}>
                        <GameIcon
                          src={shard.iconUrl}
                          name={selected ? `${shard.name ?? shard.id} (scelto)` : shard.name}
                          round
                          selected={selected}
                          muted={!selected}
                          className="size-5 bg-black/40 p-0.5"
                        />
                      </li>
                    );
                  })}
                </ul>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
