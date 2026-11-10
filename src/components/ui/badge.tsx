import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-primary/12 text-primary [background:color-mix(in_srgb,var(--primary)_14%,transparent)]",
        secondary:
          "border-secondary/25 bg-secondary/10 text-secondary",
        outline: "border-white/10 bg-white/[0.03] text-muted-foreground",
        success: "border-success/25 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/10 text-warning",
        danger: "border-destructive/25 bg-destructive/10 text-destructive",
        demo: "border-dashed border-warning/45 bg-warning/[0.08] text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
