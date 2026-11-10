import { UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  /** Data Dragon profile icon of the primary profile, if any. */
  iconUrl: string | null | undefined;
  className?: string;
}

/** Real profile icon when available, otherwise a neutral placeholder. */
export function ProfileAvatar({ iconUrl, className }: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        onError={() => setFailed(true)}
        className={cn("size-8 shrink-0 rounded-full border border-white/10 object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface-raised text-muted-foreground transition-colors group-hover:text-primary",
        className,
      )}
    >
      <UserRound className="size-4" />
    </span>
  );
}
