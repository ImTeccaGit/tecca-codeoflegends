import type { ChampionInfo, ChampionStats } from "@/types/catalog";

type StatKey = keyof ChampionStats;

interface StatRow {
  label: string;
  base: StatKey;
  growth: StatKey | null;
  /** Data Dragon gives attack speed growth as a percentage. */
  growthIsPercent?: boolean;
}

const numberFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 3,
});

function statRows(partype: string): StatRow[] {
  return [
    { label: "Salute", base: "hp", growth: "hpperlevel" },
    { label: "Rigenerazione salute (5 s)", base: "hpregen", growth: "hpregenperlevel" },
    {
      label: partype ? `Risorsa · ${partype}` : "Risorsa",
      base: "mp",
      growth: "mpperlevel",
    },
    { label: "Rigenerazione risorsa (5 s)", base: "mpregen", growth: "mpregenperlevel" },
    { label: "Armatura", base: "armor", growth: "armorperlevel" },
    { label: "Resistenza magica", base: "spellblock", growth: "spellblockperlevel" },
    { label: "Danno d'attacco", base: "attackdamage", growth: "attackdamageperlevel" },
    {
      label: "Velocità d'attacco",
      base: "attackspeed",
      growth: "attackspeedperlevel",
      growthIsPercent: true,
    },
    { label: "Velocità di movimento", base: "movespeed", growth: null },
    { label: "Gittata d'attacco", base: "attackrange", growth: null },
  ];
}

/** Base values and per-level growth, without derived or estimated numbers. */
export function ChampionStatsTable({
  stats,
  partype,
}: {
  stats: ChampionStats;
  partype: string;
}) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">
        Statistiche base e crescita per livello
      </caption>
      <thead>
        <tr className="border-b border-white/[0.06] text-left text-[10px] text-muted-foreground">
          <th scope="col" className="py-2 font-medium">
            Statistica
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Base
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Per livello
          </th>
        </tr>
      </thead>
      <tbody>
        {statRows(partype).map((row) => {
          const growth = row.growth ? stats[row.growth] : null;
          return (
            <tr
              key={row.base}
              className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]"
            >
              <th scope="row" className="py-2 pr-2 text-left font-normal text-muted-foreground">
                {row.label}
              </th>
              <td className="py-2 text-right font-mono text-foreground tabular-nums">
                {numberFormatter.format(stats[row.base])}
              </td>
              <td className="py-2 text-right font-mono text-muted-foreground tabular-nums">
                {growth === null || growth === 0
                  ? "—"
                  : `+${numberFormatter.format(growth)}${row.growthIsPercent ? "%" : ""}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const INFO_ROWS: ReadonlyArray<{ key: keyof ChampionInfo; label: string }> = [
  { key: "attack", label: "Attacco" },
  { key: "defense", label: "Difesa" },
  { key: "magic", label: "Magia" },
  { key: "difficulty", label: "Difficoltà" },
];

/** Riot's official 0–10 ratings for each champion. */
export function ChampionRatings({ info }: { info: ChampionInfo }) {
  return (
    <div className="space-y-3">
      {INFO_ROWS.map((row) => {
        const value = Math.max(0, Math.min(info[row.key], 10));
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono text-foreground tabular-nums">
                {numberFormatter.format(value)}/10
              </span>
            </div>
            <div
              role="meter"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={value}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-white/[0.04] bg-white/[0.025]"
            >
              <span
                className="block h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500 ease-out"
                style={{ width: `${value * 10}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
