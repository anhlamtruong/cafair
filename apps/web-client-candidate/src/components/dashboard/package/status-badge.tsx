"use client";

/**
 * StatusBadge — Displays "Complete" (green outline) or "Draft" (warning fill).
 *
 * Figma: h-[30px] rounded-[10px]
 */

import { Badge } from "@starter/ui";

export function StatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge variant="default" size="sm">
        Complete
      </Badge>
    );
  }

  return (
    <Badge variant="warning" size="sm">
      Draft
    </Badge>
  );
}
