import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DemoBadgeProps {
  className?: string;
  /** Longer text for wide spots; defaults to the short "DEMO" tag. */
  label?: string;
}

/** Visible marker for any value coming from the DEMO dataset. */
export function DemoBadge({ className, label = "DEMO" }: DemoBadgeProps) {
  return (
    <Badge
      variant="demo"
      className={cn("shrink-0", className)}
      title="Dati dimostrativi: non sono le tue partite e non vengono salvati."
    >
      <FlaskConical aria-hidden="true" />
      {label}
    </Badge>
  );
}
