import * as React from "react";
import { cn } from "../utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Percentage value 0–100 */
  value?: number;
}

function Progress({ className, value = 0, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-text-brand transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
