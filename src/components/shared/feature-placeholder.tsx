import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getModuleById } from "@/app/navigation";
import { ModulePreview } from "@/components/shared/module-preview";
import { ModuleStatusBadge } from "@/components/shared/module-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FeaturePlaceholderProps {
  moduleId: string;
  scope: string[];
  prerequisites: string[];
  note: string;
  preview?: ReactNode;
  children?: ReactNode;
}

export function FeaturePlaceholder({
  moduleId,
  scope,
  prerequisites,
  note,
  preview,
  children,
}: FeaturePlaceholderProps) {
  const module = getModuleById(moduleId);

  if (!module) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-muted-foreground">
        Modulo non riconosciuto: {moduleId}
      </div>
    );
  }

  const Icon = module.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${module.label} · Fase ${String(module.phase).padStart(2, "0")}`}
        title={module.label}
        description={module.description}
        actions={
          <>
            <ModuleStatusBadge status={module.status} />
            <Badge variant="outline">Scaffold verificato</Badge>
          </>
        }
      />

      <div className="stagger grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/[0.08] blur-3xl" />
          <div className="relative p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <span className="glow-primary flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.08] text-primary">
                <Icon className="size-6" />
              </span>
              <Badge variant="secondary">
                <Sparkles className="size-3" />
                UI pronta · dati onesti
              </Badge>
            </div>

            <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">
              Interfaccia pronta. Dati non ancora collegati.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {note}
            </p>

            <div className="mt-6">
              {preview ?? <ModulePreview moduleId={moduleId} />}
            </div>

            <div className="mt-6">
              <p className="eyebrow">Scope del modulo</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {scope.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rotate-45 bg-secondary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/">
                  <ArrowLeft className="size-3.5" />
                  Dashboard
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/settings">
                  Configura l'app
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        <div className="stagger space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-warning/[0.07] text-warning">
                <LockKeyhole className="size-4" />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold">
                  Perché non è ancora attivo
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Questo modulo è uno scaffold verificato: rotta, stato e layout
                  esistono, ma non vengono mostrati dati inventati o simulati.
                  Lo sviluppo procede quando le dipendenze reali sono
                  disponibili.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="eyebrow">Prerequisiti</p>
            <ul className="mt-3 space-y-2.5">
              {prerequisites.map((item, index) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.03] font-mono text-[8px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <p className="eyebrow">Stato reale</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rotta</span>
                <span className="font-mono text-[10px] text-foreground">
                  {module.path}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">UI shell</span>
                <Badge variant="success">Presente</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dati collegati</span>
                <Badge
                  variant={module.status === "available" ? "success" : "outline"}
                >
                  {module.status === "available" ? "Sì" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Persistenza</span>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {module.status === "available" ? "SQLite" : "—"}
                </span>
              </div>
            </div>
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-secondary/15 bg-secondary/[0.04] p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Nessuna API key nel frontend, nessun accesso alla memoria di gioco
              e nessuna automazione. Solo API pubbliche e dati verificabili.
            </p>
          </div>
        </div>
      </div>

      {children ? (
        <div className="stagger space-y-5">
          {children}
        </div>
      ) : null}

      {module.status !== "available" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-muted-foreground/60" />
          Stato dichiarato: pianificato. Nessun dato dimostrativo viene
          persistito come sincronizzato.
        </div>
      ) : null}
    </div>
  );
}
