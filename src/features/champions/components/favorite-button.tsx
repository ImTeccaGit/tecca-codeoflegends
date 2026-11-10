import { Star } from "lucide-react";
import { useToggleFavorite } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  championId: number;
  championName: string;
  favorite: boolean;
  /** "icon": compact star for cards; "labeled": button with text. */
  variant?: "icon" | "labeled";
  className?: string;
}

/** Toggles a champion in the user's favorites (saved in SQLite). */
export function FavoriteButton({
  championId,
  championName,
  favorite,
  variant = "icon",
  className,
}: FavoriteButtonProps) {
  const toggle = useToggleFavorite();
  const label = favorite
    ? `Rimuovi ${championName} dai preferiti`
    : `Aggiungi ${championName} ai preferiti`;

  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={label}
      title={label}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ championId, favorite: !favorite })}
      className={cn(
        "group/star inline-flex items-center justify-center gap-1.5 rounded-lg border transition-colors duration-200 disabled:opacity-70",
        variant === "icon" ? "size-7" : "h-8 px-3 text-xs font-semibold",
        favorite
          ? "border-warning/40 bg-warning/[0.12] text-warning"
          : "border-white/10 bg-background/60 text-muted-foreground hover:border-warning/30 hover:text-warning",
        className,
      )}
    >
      <Star
        className={cn(
          "size-3.5 transition-transform duration-200 group-hover/star:scale-110",
          favorite && "fill-current",
        )}
      />
      {variant === "labeled" ? (favorite ? "Preferito" : "Aggiungi ai preferiti") : null}
    </button>
  );
}
