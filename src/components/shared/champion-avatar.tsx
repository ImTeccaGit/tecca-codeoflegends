import { cn } from "@/lib/utils";

interface ChampionAvatarProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
}

const sizes = {
  sm: "size-8 rounded-lg text-[10px]",
  md: "size-10 rounded-xl text-xs",
} as const;

/**
 * Initials placeholder for a champion. Real portraits will come from Data
 * Dragon (with patch and source) once that integration exists.
 */
export function ChampionAvatar({
  name,
  size = "md",
  className,
}: ChampionAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border border-white/[0.08] bg-gradient-to-br from-primary/25 via-surface-raised to-secondary/15 font-display font-semibold tracking-wide text-foreground/90",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
