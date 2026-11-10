import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { AppModule } from "@/app/navigation";
import { ModuleStatusBadge } from "@/components/shared/module-status-badge";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  module: AppModule;
  className?: string;
}

export function ModuleCard({ module, className }: ModuleCardProps) {
  const Icon = module.icon;

  return (
    <Link
      to={module.path}
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white/[0.035] hover:shadow-module-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg border border-white/[0.07] bg-surface-raised text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:text-primary">
          <Icon className="size-[18px]" />
        </span>
        <ModuleStatusBadge status={module.status} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
          {module.label}
          <ArrowUpRight className="size-3.5 -translate-x-1 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {module.description}
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.05] pt-3">
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70 uppercase">
          Fase {String(module.phase).padStart(2, "0")}
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/50 uppercase">
          {module.path}
        </span>
      </div>
    </Link>
  );
}
