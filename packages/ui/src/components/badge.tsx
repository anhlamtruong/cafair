import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border border-brand-900 text-brand-900 bg-transparent",
        warning:
          "bg-other-warning-bg text-other-warning-text",
        success:
          "bg-bg-brand text-text-brand-2",
        muted:
          "bg-bg-primary border border-border-neutral text-text-secondary",
        destructive:
          "bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "h-[30px] text-xs",
        md: "h-[34px] text-xs",
        lg: "h-9 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
