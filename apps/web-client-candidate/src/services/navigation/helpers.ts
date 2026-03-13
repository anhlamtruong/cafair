/**
 * Navigation helpers
 * Utility functions for route matching and sidebar behaviour.
 */

import { NAV_ITEMS } from "./constants";
import type { NavItem } from "./types";

/**
 * Determine whether a nav item is "active" for the given pathname.
 *
 * Rules:
 * - The dashboard root (`/dashboard`) is only active on an exact match to
 *   avoid highlighting it when a sub-page is open.
 * - All other items match when the pathname starts with their href.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname.startsWith(item.href);
}

/**
 * Return the NavItem that is active for the current pathname, or undefined.
 */
export function getActiveNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
}
