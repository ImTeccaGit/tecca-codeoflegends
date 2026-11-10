import { useState } from "react";
import { cn } from "@/lib/utils";

interface GameIconProps {
  src: string | null;
  name: string | null;
  className?: string;
  /** Dimmed and desaturated (rune not chosen). */
  muted?: boolean;
  /** Ring around a chosen rune. */
  selected?: boolean;
  round?: boolean;
}

/**
 * Data Dragon image with a neutral placeholder when the URL is missing or
 * fails to load. The name is the accessible label and the native tooltip.
 */
export function GameIcon({ src, name, className, muted = false, selected = false, round = false }: GameIconProps) {
  const [failed, setFailed] = useState(false);
  const label = name ?? "Sconosciuto";
  const shape = round ? "rounded-full" : "rounded-md";

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center border border-white/10 bg-white/[0.04] text-[9px] text-muted-foreground",
          shape,
          muted && "opacity-30",
          className,
        )}
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      title={label}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "size-8 shrink-0 object-cover",
        shape,
        muted && "opacity-25 grayscale",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
        className,
      )}
    />
  );
}
