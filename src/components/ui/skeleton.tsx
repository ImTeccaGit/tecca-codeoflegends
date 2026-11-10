import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "shimmer rounded-md bg-white/[0.04] text-transparent",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
