import { useId } from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
}

export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = `logo-gradient-${useId().replaceAll(":", "")}`;
  const glowId = `logo-glow-${useId().replaceAll(":", "")}`;

  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Tecca CodeOfLegends"
      className={cn("size-9", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="4" x2="44" y2="46">
          <stop offset="0%" stopColor="var(--primary-soft)" />
          <stop offset="55%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--secondary)" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${glowId})`} />
      <path
        d="M24 2.75 42.4 13.4v21.2L24 45.25 5.6 34.6V13.4L24 2.75Z"
        fill="var(--primary)"
        fillOpacity="0.08"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.4"
      />
      <path
        d="M24 9.4 36.6 16.7v14.6L24 38.6 11.4 31.3V16.7L24 9.4Z"
        fill="var(--background)"
        stroke="var(--foreground)"
        strokeOpacity="0.12"
        strokeWidth="1"
      />
      <path
        d="M17.4 18.2h13.2M24 18.2v13"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="18.2" r="2" fill="var(--secondary)" />
      <circle cx="17.4" cy="18.2" r="1.2" fill="var(--primary-soft)" />
      <circle cx="30.6" cy="18.2" r="1.2" fill="var(--primary-soft)" />
    </svg>
  );
}

export function LogoWordmark({ className }: LogoMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="min-w-0 leading-none">
        <span className="block font-mono text-[9px] font-semibold tracking-[0.34em] text-muted-foreground uppercase">
          Tecca
        </span>
        <span className="mt-1 block font-display text-[15px] font-semibold tracking-tight text-foreground">
          Code<span className="text-primary">Of</span>Legends
        </span>
      </div>
    </div>
  );
}
