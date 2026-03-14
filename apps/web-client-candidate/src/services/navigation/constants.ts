/**
 * Navigation constants
 * Single source of truth for sidebar dimensions, animation, and nav items.
 */

import type { NavItem } from "./types";

// ---------------------------------------------------------------------------
// Sidebar dimensions (px) — adjust these to resize the bento-box layout
// ---------------------------------------------------------------------------

/** Sidebar width when expanded (with labels visible) */
export const SIDEBAR_WIDTH_EXPANDED = 259;

/** Sidebar width when collapsed (icons only) */
export const SIDEBAR_WIDTH_COLLAPSED = 68;

/** Outer padding around the entire bento-box layout */
export const LAYOUT_PADDING = 10;

/** Gap between the sidebar and the content area */
export const LAYOUT_GAP = 16;

/** Border-radius applied to every bento-box card (sidebar, header, body) */
export const BENTO_BORDER_RADIUS = 16;

/** Transition duration for sidebar expand/collapse animation (ms) */
export const SIDEBAR_TRANSITION_MS = 300;

/** Width threshold below which drag-release snaps to collapsed */
export const SIDEBAR_SNAP_THRESHOLD =
  (SIDEBAR_WIDTH_COLLAPSED + SIDEBAR_WIDTH_EXPANDED) / 2;

/** localStorage key used to persist sidebar collapsed preference */
export const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

// ---------------------------------------------------------------------------
// Navigation items — order here determines render order in the sidebar
// ---------------------------------------------------------------------------

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "/assets/navigation/dashboard.svg",
    iconActive: "/assets/navigation/dashboard-active.svg",
  },
  {
    label: "Role matches",
    href: "/dashboard/role-matches",
    icon: "/assets/navigation/magic-star.svg",
    iconActive: "/assets/navigation/magic-star-active.svg",
  },
  {
    label: "Package management",
    href: "/dashboard/package-management",
    icon: "/assets/navigation/packages.svg",
    iconActive: "/assets/navigation/packages-active.svg",
  },
  {
    label: "Application status",
    href: "/dashboard/application-status",
    icon: "/assets/navigation/status.svg",
    iconActive: "/assets/navigation/status-active.svg",
  },
  {
    label: "Action Needed",
    href: "/dashboard/action-needed",
    icon: "/assets/navigation/action.svg",
    iconActive: "/assets/navigation/action-active.svg",
  },
];
