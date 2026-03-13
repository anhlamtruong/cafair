"use client";

/**
 * Dashboard content shell.
 *
 * Wraps the main content area with:
 * • `select-none` while the sidebar is being dragged (prevents text highlighting)
 * • Correct gap spacing & border radius from navigation constants
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  LAYOUT_GAP,
  BENTO_BORDER_RADIUS,
  useSidebarStore,
} from "@/services/navigation";

export function DashboardShell({ children }: { children: ReactNode }) {
  const isDragging = useSidebarStore((s) => s.isDragging);

  return (
    <main
      className={cn(
        "flex min-w-0 flex-1 flex-col overflow-y-auto bg-bg-primary",
        isDragging && "select-none",
      )}
      style={{
        marginLeft: LAYOUT_GAP,
        borderRadius: BENTO_BORDER_RADIUS,
      }}
    >
      {children}
    </main>
  );
}
