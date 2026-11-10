import { CAMPS, OBJECTIVES, getCamp, type CampId, type MapSide } from "@/features/jungle/data/camps";
import { cn } from "@/lib/utils";

interface RiftMapProps {
  /** Camps of the selected route, in order. */
  route: readonly CampId[];
  /** Side the route belongs to: camps of the other side are "enemy". */
  routeSide: MapSide;
  /** Training progress: camps already cleared (0 = none). */
  completed?: number;
  /** Highlights the next camp while a practice timer runs. */
  showNext?: boolean;
  /** Editing: clicking a camp toggles it in the route. */
  onCampClick?: (id: CampId) => void;
  className?: string;
}

const OWNER_CLASSES = {
  blue: { ring: "stroke-secondary", fill: "fill-secondary/15", text: "fill-secondary" },
  red: { ring: "stroke-destructive", fill: "fill-destructive/15", text: "fill-destructive" },
  river: { ring: "stroke-primary", fill: "fill-primary/15", text: "fill-primary-soft" },
} as const;

/**
 * Schematic Summoner's Rift drawn for TECCA: no Riot map art. Positions are
 * approximate; the map is meant for studying the order of a route.
 */
export function RiftMap({
  route,
  routeSide,
  completed = 0,
  showNext = false,
  onCampClick,
  className,
}: RiftMapProps) {
  const points = route.map((id) => getCamp(id));
  const editable = Boolean(onCampClick);

  return (
    <svg
      viewBox="0 0 600 600"
      role="img"
      aria-label="Mappa schematica della giungla di Summoner's Rift con Blue Side, Red Side, campi, buff, Scuttle e fosse degli obiettivi epici"
      className={cn("w-full select-none", className)}
    >
      <defs>
        <linearGradient id="jungle-route-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="60%" stopColor="var(--primary-soft)" />
          <stop offset="100%" stopColor="var(--secondary)" />
        </linearGradient>
        <pattern id="jungle-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0v30" fill="none" stroke="var(--foreground)" strokeOpacity="0.035" />
        </pattern>
        <marker
          id="jungle-arrow"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" fill="var(--primary-soft)" />
        </marker>
      </defs>

      {/* Board */}
      <rect x="1" y="1" width="598" height="598" rx="20" fill="var(--surface-muted)" stroke="var(--foreground)" strokeOpacity="0.07" />
      <rect x="1" y="1" width="598" height="598" rx="20" fill="url(#jungle-grid)" />

      {/* Team halves */}
      <path d="M20 40 20 580 560 580Z" fill="var(--secondary)" fillOpacity="0.035" />
      <path d="M40 20 580 20 580 560Z" fill="var(--destructive)" fillOpacity="0.035" />

      {/* River (diagonal from top-left to bottom-right) */}
      <path
        d="M0 46 46 0 600 554 554 600Z"
        fill="var(--primary)"
        fillOpacity="0.07"
        stroke="var(--primary)"
        strokeOpacity="0.14"
      />

      {/* Lanes */}
      <g fill="none" stroke="var(--foreground)" strokeOpacity="0.07" strokeLinecap="round">
        <path d="M44 556V44h512" strokeWidth="20" />
        <path d="M44 556h512V44" strokeWidth="20" />
        <path d="M70 530 530 70" strokeWidth="16" />
      </g>

      {/* Bases */}
      <g>
        <rect x="14" y="514" width="72" height="72" rx="14" fill="var(--secondary)" fillOpacity="0.14" stroke="var(--secondary)" strokeOpacity="0.4" />
        <rect x="514" y="14" width="72" height="72" rx="14" fill="var(--destructive)" fillOpacity="0.14" stroke="var(--destructive)" strokeOpacity="0.4" />
        <text x="96" y="580" fontSize="11" fontWeight="700" letterSpacing="2" fill="var(--secondary)">BLUE SIDE</text>
        <text x="504" y="28" fontSize="11" fontWeight="700" letterSpacing="2" textAnchor="end" fill="var(--destructive)">RED SIDE</text>
      </g>

      {/* Epic objective pits (locations only, no timers) */}
      {OBJECTIVES.map((objective) => (
        <g key={objective.id}>
          <title>{objective.name}</title>
          <circle cx={objective.x} cy={objective.y} r="26" fill="var(--warning)" fillOpacity="0.08" stroke="var(--warning)" strokeOpacity="0.45" strokeDasharray="4 4" />
          <text x={objective.x} y={objective.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--warning)">
            {objective.id === "baron" ? "BAR" : "DRG"}
          </text>
          <text x={objective.x} y={objective.labelY} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">
            {objective.name}
          </text>
        </g>
      ))}

      {/* Route */}
      {points.length > 1 ? (
        <polyline
          key={route.join("-")}
          points={points.map((camp) => `${camp.x},${camp.y}`).join(" ")}
          fill="none"
          stroke="url(#jungle-route-gradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerMid="url(#jungle-arrow)"
          markerEnd="url(#jungle-arrow)"
          pathLength={1}
          className="rift-path drop-shadow-rift-path"
        />
      ) : null}

      {/* Camps */}
      {CAMPS.map((camp) => {
        const order = route.indexOf(camp.id);
        const inRoute = order >= 0;
        const done = inRoute && order < completed;
        const next = showNext && order === completed;
        const enemy = inRoute && camp.owner !== "river" && camp.owner !== routeSide;
        const styles = OWNER_CLASSES[camp.owner];
        const radius = camp.kind === "buff" ? 15 : camp.kind === "scuttle" ? 11 : 12;

        return (
          <g
            key={camp.id}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-pressed={editable ? inRoute : undefined}
            aria-label={
              editable
                ? `${camp.name} (${camp.owner === "river" ? "fiume" : camp.owner === "blue" ? "Blue Side" : "Red Side"})${inRoute ? `, tappa ${order + 1}` : ""}`
                : undefined
            }
            onClick={editable ? () => onCampClick?.(camp.id) : undefined}
            onKeyDown={
              editable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onCampClick?.(camp.id);
                    }
                  }
                : undefined
            }
            className={cn(editable && "cursor-pointer outline-none [&:focus-visible>circle]:stroke-[3]")}
          >
            <title>{camp.name}</title>
            {editable ? <circle cx={camp.x} cy={camp.y} r={radius + 10} fill="transparent" /> : null}
            {next ? (
              <circle cx={camp.x} cy={camp.y} r={radius + 8} className="fill-none stroke-warning motion-safe:animate-pulse-soft" strokeWidth="2" />
            ) : null}
            <circle
              cx={camp.x}
              cy={camp.y}
              r={radius}
              className={cn(
                "transition-[fill,stroke-width] duration-200",
                styles.ring,
                inRoute ? styles.fill : "fill-[var(--surface-raised)]",
                done && "fill-success/25 stroke-success",
              )}
              strokeWidth={inRoute ? 2.2 : 1.4}
              strokeOpacity={inRoute ? 1 : 0.55}
              strokeDasharray={enemy ? "3 3" : undefined}
            />
            <text
              x={camp.x}
              y={camp.y + 3.5}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              className={inRoute ? styles.text : "fill-muted-foreground"}
              pointerEvents="none"
            >
              {camp.short}
            </text>
            {inRoute ? (
              <g pointerEvents="none">
                <circle cx={camp.x + radius} cy={camp.y - radius} r="8" fill="var(--background)" stroke="var(--primary)" strokeWidth="1.4" />
                <text x={camp.x + radius} y={camp.y - radius + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">
                  {order + 1}
                </text>
              </g>
            ) : null}
            <text
              x={camp.x}
              y={camp.labelPosition === "above" ? camp.y - radius - 6 : camp.y + radius + 13}
              textAnchor="middle"
              fontSize="9"
              fill="var(--muted-foreground)"
              fillOpacity={inRoute ? 0.95 : 0.55}
              pointerEvents="none"
            >
              {camp.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MapLegend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground">
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-secondary" /> Blue Side
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-destructive" /> Red Side
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" /> Fiume (Scuttle)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full border border-dashed border-warning" /> Obiettivi epici
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full border border-dashed border-foreground/60" /> Campo nemico (invasione)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-success" /> Completato
      </li>
    </ul>
  );
}
