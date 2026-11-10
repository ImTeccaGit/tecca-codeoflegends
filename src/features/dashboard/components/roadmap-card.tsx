import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ModuleStatusBadge } from "@/components/shared/module-status-badge";
import type { ModuleStatus } from "@/app/navigation";

const nextMilestones: ReadonlyArray<{
  phase: number;
  title: string;
  description: string;
  path: string;
  status: ModuleStatus;
}> = [
  {
    phase: 2,
    title: "Champions Database",
    description: "Dati Data Dragon reali, cache locale e dettaglio campione.",
    path: "/champions",
    status: "planned",
  },
  {
    phase: 3,
    title: "Rune & Build Builder",
    description: "Preset salvati in SQLite, nessun dato dimostrativo spacciato per reale.",
    path: "/runes",
    status: "planned",
  },
  {
    phase: 4,
    title: "Jungle Routes",
    description: "Percorsi e timing per ruolo, con note modificabili.",
    path: "/jungle",
    status: "planned",
  },
  {
    phase: 7,
    title: "Live Game & Overlay",
    description: "Solo dopo l'integrazione Riot approvata e policy-compliant.",
    path: "/live",
    status: "planned",
  },
];

export function RoadmapCard() {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-card">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2 className="mt-1 font-display text-sm font-semibold">
            Prossime tappe
          </h2>
        </div>
        <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
          aggiornata
        </span>
      </div>

      <ul className="divide-y divide-white/[0.05]">
        {nextMilestones.map((milestone) => (
          <li key={milestone.phase}>
            <Link
              to={milestone.path}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025]"
            >
              <span className="font-mono text-[10px] font-semibold text-primary/80">
                {String(milestone.phase).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {milestone.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                  {milestone.description}
                </p>
              </div>
              <ModuleStatusBadge status={milestone.status} />
              <ChevronRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
