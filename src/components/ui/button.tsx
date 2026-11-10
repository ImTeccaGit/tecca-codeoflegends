import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background,color,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-button-primary hover:bg-primary/90",
        secondary:
          "border border-secondary/25 bg-secondary/10 text-secondary hover:bg-secondary/15",
        outline:
          "border border-white/10 bg-white/[0.02] text-foreground hover:border-white/20 hover:bg-white/[0.06]",
        ghost:
          "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-secondary underline-offset-4 hover:underline",
        destructive:
          "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/25 hover:bg-destructive/25",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
