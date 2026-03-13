/**
 * Navigation service — barrel export
 *
 * Import everything navigation-related from `@/services/navigation`.
 */

// Types
export type { NavItem, SidebarMode, SidebarState } from "./types";

// Constants (dimensions, nav items)
export {
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  LAYOUT_PADDING,
  LAYOUT_GAP,
  BENTO_BORDER_RADIUS,
  SIDEBAR_TRANSITION_MS,
  SIDEBAR_SNAP_THRESHOLD,
  SIDEBAR_STORAGE_KEY,
  NAV_ITEMS,
} from "./constants";

// Store
export { useSidebarStore } from "./sidebar-store";

// Helpers
export { isNavItemActive, getActiveNavItem } from "./helpers";

// Hooks
export { useResizeHandle } from "./use-resize-handle";
