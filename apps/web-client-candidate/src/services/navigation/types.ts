/**
 * Navigation service types
 * Central type definitions for the app's navigation system.
 */

/** A single navigation item displayed in the sidebar */
export interface NavItem {
  /** Display label shown next to the icon (hidden when sidebar is collapsed) */
  label: string;
  /** Route path for Next.js Link */
  href: string;
  /** Path to the default (inactive) SVG icon in /public/assets/navigation/ */
  icon: string;
  /** Path to the active-state SVG icon in /public/assets/navigation/ */
  iconActive: string;
}

/** Sidebar visual state */
export type SidebarMode = "expanded" | "collapsed";

/** Sidebar store state shape */
export interface SidebarState {
  /** Whether the sidebar is collapsed (icon-only) */
  isCollapsed: boolean;
  /** Current sidebar width in px (used during drag resize) */
  width: number;
  /** Whether the user is actively dragging the resize handle */
  isDragging: boolean;
  /** Toggle between expanded and collapsed */
  toggle: () => void;
  /** Programmatically set collapsed state */
  setCollapsed: (collapsed: boolean) => void;
  /** Set exact width (clamps to min/max and auto-collapses) */
  setWidth: (width: number) => void;
  /** Mark drag start */
  startDrag: () => void;
  /** Mark drag end — snaps to collapsed/expanded based on threshold */
  endDrag: () => void;
}
