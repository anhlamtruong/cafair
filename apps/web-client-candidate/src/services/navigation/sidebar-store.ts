/**
 * Sidebar store — Zustand with localStorage persistence
 * Controls expanded/collapsed state and drag-resizable width.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SidebarState } from "./types";
import {
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_SNAP_THRESHOLD,
} from "./constants";

function clampWidth(w: number): number {
  return Math.max(SIDEBAR_WIDTH_COLLAPSED, Math.min(w, SIDEBAR_WIDTH_EXPANDED));
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      width: SIDEBAR_WIDTH_EXPANDED,
      isDragging: false,

      toggle: () =>
        set((s) => ({
          isCollapsed: !s.isCollapsed,
          width: s.isCollapsed
            ? SIDEBAR_WIDTH_EXPANDED
            : SIDEBAR_WIDTH_COLLAPSED,
        })),

      setCollapsed: (collapsed: boolean) =>
        set({
          isCollapsed: collapsed,
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        }),

      setWidth: (w: number) => {
        const clamped = clampWidth(w);
        set({
          width: clamped,
          isCollapsed: clamped <= SIDEBAR_WIDTH_COLLAPSED,
        });
      },

      startDrag: () => set({ isDragging: true }),

      endDrag: () =>
        set((s) => {
          const snap =
            s.width <= SIDEBAR_SNAP_THRESHOLD
              ? SIDEBAR_WIDTH_COLLAPSED
              : SIDEBAR_WIDTH_EXPANDED;
          return {
            isDragging: false,
            width: snap,
            isCollapsed: snap === SIDEBAR_WIDTH_COLLAPSED,
          };
        }),
    }),
    {
      name: SIDEBAR_STORAGE_KEY,
      // Only persist these keys (skip isDragging)
      partialize: (state) => ({
        isCollapsed: state.isCollapsed,
        width: state.width,
      }),
    },
  ),
);
