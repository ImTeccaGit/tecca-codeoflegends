import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChampionSpell } from "@/types/catalog";

const SLOT_LABELS: Record<ChampionSpell["slot"], string> = {
  P: "Passiva",
  Q: "Q",
  W: "W",
  E: "E",
  R: "Suprema · R",
};

function hasValue(value: string | null): value is string {
  return value !== null && value !== "" && value !== "0";
}

function SpellIcon({ spell }: { spell: ChampionSpell }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface-raised font-display text-sm font-semibold text-muted-foreground">
        {spell.slot}
      </span>
    );
  }

  return (
    <img
      src={spell.imageUrl}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-12 shrink-0 rounded-xl border border-white/10 object-cover"
    />
  );
}

/** Passive + Q/W/E/R exactly as published by Data Dragon. */
export function AbilityList({ spells }: { spells: ChampionSpell[] }) {
  return (
    <ol className="space-y-2.5">
      {spells.map((spell) => (
        <li
          key={spell.slot}
          className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-colors duration-200 hover:border-white/[0.1] hover:bg-white/[0.03]"
        >
          <div className="relative">
            <SpellIcon spell={spell} />
            <span
              className={cn(
                "absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-md border font-mono text-[9px] font-bold",
                spell.slot === "P"
                  ? "border-secondary/40 bg-background text-secondary"
                  : "border-primary/40 bg-background text-primary-soft",
              )}
              aria-hidden="true"
            >
              {spell.slot}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{SLOT_LABELS[spell.slot]}</p>
            <h3 className="mt-1 font-display text-sm font-semibold text-foreground">
              {spell.name}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
              {spell.description}
            </p>
            {spell.slot !== "P" ? (
              <dl className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                {hasValue(spell.cooldown) ? (
                  <Meta label="Ricarica (s)" value={spell.cooldown} />
                ) : null}
                {hasValue(spell.cost) ? (
                  <Meta label="Costo" value={spell.cost} />
                ) : null}
                {hasValue(spell.range) ? (
                  <Meta label="Gittata" value={spell.range} />
                ) : null}
                {spell.maxRank ? (
                  <Meta label="Livelli" value={String(spell.maxRank)} />
                ) : null}
              </dl>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
