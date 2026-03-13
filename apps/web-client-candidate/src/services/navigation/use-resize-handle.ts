"use client";

/**
 * useResizeHandle — drag-to-resize hook for the sidebar.
 *
 * Returns props to spread onto a resize handle element.
 * While dragging, mouse events update the sidebar width in
 * real-time via the sidebar store.
 */

import { useCallback, useEffect, useRef } from "react";
import { useSidebarStore } from "./sidebar-store";

export function useResizeHandle() {
  const { setWidth, startDrag, endDrag, isDragging } = useSidebarStore();
  const sidebarRef = useRef<HTMLElement | null>(null);

  /** Called on mousedown of the handle */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      // Capture the sidebar element's left edge to compute width = clientX - left
      const sidebar = (e.currentTarget as HTMLElement).parentElement;
      if (sidebar) sidebarRef.current = sidebar;

      startDrag();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [startDrag],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      setWidth(newWidth);
    },
    [isDragging, setWidth],
  );

  const onPointerUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  /** Safety net: end drag if pointer leaves window while dragging */
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalUp = () => endDrag();
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, [isDragging, endDrag]);

  return {
    /** Spread onto the resize handle element */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      style: { touchAction: "none" as const },
    },
    isDragging,
  };
}
