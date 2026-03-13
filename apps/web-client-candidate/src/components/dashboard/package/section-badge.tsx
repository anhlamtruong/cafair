"use client";

/**
 * SectionBadge — Shows completion state for each of the 5 sections.
 *
 * Figma: h-[34px] rounded-[10px]
 *  - Complete: bg-bg-brand + checkmark icon
 *  - Incomplete: bg-bg-primary + border-border-neutral
 */

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SectionBadgeProps {
  label: string;
  complete: boolean;
}

export function SectionBadge({ label, complete }: SectionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium",
        complete
          ? "bg-bg-brand text-text-brand"
          : "border border-border-neutral bg-bg-primary text-text-secondary",
      )}
    >
      {complete && <Check className="size-3.5" />}
      {label}
    </span>
  );
}
