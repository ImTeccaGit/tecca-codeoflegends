import {
  BarChart3,
  Crosshair,
  Hammer,
  Map,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ModulePreviewProps {
  moduleId: string;
  className?: string;
}

function Block({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.05] bg-white/[0.025]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Line({ className }: { className?: string }) {
  return (
    <span
      className={cn("block h-1.5 rounded-full bg-white/[0.07]", className)}
    />
  );
}

function Dashes({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-mono text-muted-foreground/45">—</span>
    </div>
  );
}

function Toolbar({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 flex-1 items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2">
        <Icon className="size-3 text-muted-foreground/60" />
        <Line className="w-24" />
      </div>
      <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[8px] tracking-wider text-muted-foreground/50 uppercase">
        filtro
      </span>
      <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[8px] tracking-wider text-muted-foreground/50 uppercase">
        sort
      </span>
    </div>
  );
}

function ChampionSlot({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/[0.06] bg-gradient-to-br from-primary/[0.08] via-surface-raised to-surface",
        tall ? "aspect-[3/4]" : "aspect-[4/3]",
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Shield className="size-6 text-primary/35" />
      </div>
      <div className="absolute inset-x-2 bottom-2 space-y-1">
        <Line className="w-3/4 bg-white/[0.09]" />
        <Line className="w-1/2 bg-white/[0.05]" />
      </div>
    </div>
  );
}

function RuneTree() {
  return (
    <div className="relative flex h-28 items-center justify-center">
      <div className="absolute size-20 rounded-full border border-primary/15" />
      <div className="absolute size-14 rounded-full border border-secondary/15" />
      <div className="flex size-9 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.1] text-primary">
        <Sparkles className="size-4" />
      </div>
      <span className="absolute top-1 left-3 size-3 rounded-full border border-white/10 bg-white/[0.04]" />
      <span className="absolute top-4 right-4 size-3 rounded-full border border-white/10 bg-white/[0.04]" />
      <span className="absolute bottom-2 left-7 size-3 rounded-full border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

function ItemSlots({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="aspect-square rounded-md border border-white/[0.06] bg-white/[0.02]"
        />
      ))}
    </div>
  );
}

function MatchRow() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
      <div className="flex size-7 items-center justify-center rounded-md border border-white/[0.06] bg-surface-raised">
        <Shield className="size-3.5 text-muted-foreground/50" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Line className="w-20" />
        <Line className="w-12 bg-white/[0.05]" />
      </div>
      <span className="font-mono text-[9px] text-muted-foreground/45">
        — / — / —
      </span>
    </div>
  );
}

function MetricTile({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
      <p className="font-mono text-[8px] tracking-wider text-muted-foreground/55 uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-sm font-semibold text-muted-foreground/60">
        —
      </p>
    </div>
  );
}

function previewContent(moduleId: string) {
  switch (moduleId) {
    case "champions":
      return (
        <div className="space-y-3">
          <Toolbar icon={Shield} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ChampionSlot key={index} />
            ))}
          </div>
        </div>
      );
    case "builds":
    case "runes":
      return (
        <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr_0.9fr]">
          <Block className="space-y-2 p-2">
            <ChampionSlot />
            <Line className="w-3/4" />
            <Line className="w-1/2" />
            <Block className="h-6" />
            <Block className="h-6" />
          </Block>
          <Block className="p-2">
            <RuneTree />
            <div className="mt-1 grid grid-cols-3 gap-1">
              <Block className="h-5" />
              <Block className="h-5" />
              <Block className="h-5" />
            </div>
            <div className="mt-2 space-y-1.5">
              <Line className="w-full" />
              <Line className="w-4/5" />
            </div>
          </Block>
          <Block className="space-y-2 p-2">
            <p className="font-mono text-[8px] tracking-wider text-muted-foreground/55 uppercase">
              item
            </p>
            <ItemSlots />
            <div className="space-y-1.5 pt-1">
              <Line className="w-full" />
              <Line className="w-3/4" />
              <Line className="w-1/2" />
            </div>
          </Block>
        </div>
      );
    case "jungle":
      return (
        <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr]">
          <Block className="relative h-44 overflow-hidden">
            <div className="absolute inset-6 rounded-[45%] border border-secondary/10" />
            <div className="absolute inset-12 rounded-[45%] border border-primary/10" />
            <div className="absolute top-1/2 left-1/2 h-24 w-10 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-secondary/[0.04]" />
            {[
              [24, 30],
              [70, 22],
              [32, 72],
              [76, 70],
              [50, 50],
            ].map(([left, top], index) => (
              <span
                key={index}
                className="absolute size-3.5 rounded-full border border-primary/30 bg-primary/15"
                style={{ left: `${left}%`, top: `${top}%` }}
              />
            ))}
          </Block>
          <div className="space-y-2">
            {["Full Clear", "5 Camp", "3 Camp"].map((label) => (
              <Block
                key={label}
                className="flex items-center justify-between px-2 py-2"
              >
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="font-mono text-[8px] text-muted-foreground/45 uppercase">
                  —
                </span>
              </Block>
            ))}
            <Block className="p-2">
              <Line className="w-full" />
              <Line className="mt-1.5 w-2/3" />
            </Block>
          </div>
        </div>
      );
    case "live":
      return (
        <div className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr]">
          <Block className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-primary/60" />
              <span className="text-[11px] font-semibold text-muted-foreground">
                Stato partita
              </span>
              <Badge variant="outline" className="ml-auto text-[8px]">
                offline
              </Badge>
            </div>
            <Dashes label="Campione" />
            <Dashes label="Modalità" />
            <Dashes label="Durata" />
            <Dashes label="Connessione" />
          </Block>
          <Block className="flex flex-col items-center justify-center gap-2 p-3">
            <div className="flex size-12 items-center justify-center rounded-full border border-white/[0.08] bg-surface-raised">
              <Radio className="size-5 text-muted-foreground/50" />
            </div>
            <Line className="w-20" />
            <Line className="w-12 bg-white/[0.05]" />
          </Block>
        </div>
      );
    case "players":
      return (
        <div className="space-y-2">
          <Block className="flex items-center gap-3 p-3">
            <span className="flex size-10 items-center justify-center rounded-full border border-white/[0.08] bg-surface-raised">
              <UserRound className="size-4 text-muted-foreground/50" />
            </span>
            <div className="flex-1 space-y-1.5">
              <Line className="w-28" />
              <Line className="w-16 bg-white/[0.05]" />
            </div>
            <Trophy className="size-4 text-muted-foreground/40" />
          </Block>
          <div className="grid grid-cols-3 gap-2">
            <MetricTile label="Win Rate" />
            <MetricTile label="KDA" />
            <MetricTile label="LP" />
          </div>
          <Block className="space-y-2 p-3">
            <Dashes label="Rank" />
            <Dashes label="Pool campioni" />
          </Block>
        </div>
      );
    case "matches":
      return (
        <div className="space-y-2">
          <MatchRow />
          <MatchRow />
          <MatchRow />
          <div className="flex items-center justify-between px-1 pt-1">
            <Line className="w-20" />
            <span className="font-mono text-[8px] text-muted-foreground/45 uppercase">
              0 sincronizzate
            </span>
          </div>
        </div>
      );
    case "analysis":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            <MetricTile label="KDA" />
            <MetricTile label="CS/min" />
            <MetricTile label="Gold" />
            <MetricTile label="Vision" />
          </div>
          <Block className="relative h-28 overflow-hidden p-2">
            <div className="absolute inset-x-3 top-4 bottom-4 flex flex-col justify-between">
              {Array.from({ length: 4 }).map((_, index) => (
                <span
                  key={index}
                  className="block h-px w-full bg-white/[0.05]"
                />
              ))}
            </div>
            <div className="relative flex h-full items-center justify-center">
              <BarChart3 className="size-5 text-muted-foreground/35" />
            </div>
          </Block>
          <div className="grid grid-cols-2 gap-2">
            <Dashes label="Danni inflitti" />
            <Dashes label="Danni subiti" />
          </div>
        </div>
      );
    case "matchups":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <Block className="space-y-2 p-2">
            <ChampionSlot tall />
            <Dashes label="Win Rate" />
            <Dashes label="Sinergie" />
          </Block>
          <div className="flex justify-center">
            <span className="flex size-8 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.1] font-mono text-[9px] font-bold text-primary">
              VS
            </span>
          </div>
          <Block className="space-y-2 p-2">
            <ChampionSlot tall />
            <Dashes label="Counter" />
            <Dashes label="Rune" />
          </Block>
        </div>
      );
    default:
      return (
        <div className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr]">
          <Block className="space-y-2 p-3">
            <Crosshair className="size-5 text-primary/50" />
            <Line className="w-32" />
            <Line className="w-24 bg-white/[0.05]" />
            <Line className="w-20 bg-white/[0.05]" />
            <Block className="mt-2 h-16" />
          </Block>
          <div className="space-y-2">
            <Block className="p-2">
              <Dashes label="Stato" />
            </Block>
            <Block className="p-2">
              <Dashes label="Dati" />
            </Block>
            <Block className="p-2">
              <Dashes label="Fonte" />
            </Block>
          </div>
        </div>
      );
  }
}

const previewIcon: Record<string, LucideIcon> = {
  champions: Shield,
  builds: Hammer,
  runes: Sparkles,
  jungle: Map,
  live: Radio,
  players: UserRound,
  matches: Swords,
  analysis: BarChart3,
  matchups: Crosshair,
};

export function ModulePreview({ moduleId, className }: ModulePreviewProps) {
  const Icon = previewIcon[moduleId] ?? Sparkles;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.06] bg-background/35 p-3.5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
          <Icon className="size-3" />
          Anteprima layout
        </p>
        <Badge variant="outline">Dati non collegati</Badge>
      </div>
      {previewContent(moduleId)}
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/60">
        Struttura visiva di riferimento: nessun campione, statistica o partita
        viene simulato.
      </p>
    </div>
  );
}
