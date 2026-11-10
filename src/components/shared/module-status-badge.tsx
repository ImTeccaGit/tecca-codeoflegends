import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type ModuleStatus } from "@/app/navigation";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  ModuleStatus,
  "success" | "warning" | "outline"
> = {
  available: "success",
  "in-development": "warning",
  planned: "outline",
};

interface ModuleStatusBadgeProps {
  status: ModuleStatus;
  className?: string;
}

export function ModuleStatusBadge({
  status,
  className,
}: ModuleStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} className={cn(className)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "available"
            ? "bg-success"
            : status === "in-development"
              ? "bg-warning"
              : "bg-muted-foreground/60",
        )}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
