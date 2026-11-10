import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Short branded boot screen. It never blocks data loading: it fades out after
 * a fixed, brief beat and fails open if the timer is interrupted.
 */
export function SplashScreen() {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = reducedMotion ? 240 : 780;
    const fade = reducedMotion ? 0 : 220;

    const fadeTimer = window.setTimeout(() => setLeaving(true), hold);
    const removeTimer = window.setTimeout(() => setVisible(false), hold + fade);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [reducedMotion]);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Avvio di Tecca CodeOfLegends"
      className={cn(
        "fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-200",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <div className="app-backdrop pointer-events-none absolute inset-0 opacity-90" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-primary/25 blur-2xl" />
          <LogoMark className="relative size-16 animate-splash-logo" />
        </div>

        <div className="animate-splash-word text-center">
          <p className="font-mono text-[10px] font-semibold tracking-[0.34em] text-muted-foreground uppercase">
            Tecca
          </p>
          <p className="mt-2 font-display text-xl font-semibold tracking-[0.14em] text-foreground uppercase">
            Code<span className="text-primary">Of</span>Legends
          </p>
        </div>

        <div className="h-0.5 w-44 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="block h-full w-full origin-left animate-splash-bar rounded-full bg-gradient-to-r from-primary via-primary-soft to-secondary" />
        </div>

        <p className="font-mono text-[9px] tracking-[0.22em] text-muted-foreground/60 uppercase">
          Preparazione del workspace locale
        </p>
      </div>
    </div>
  );
}
