"use client";

/**
 * Candidate Navigation — compound component
 *
 * <Navigation>
 *   <NavigationHeader />
 *   <NavigationBody />
 * </Navigation>
 *
 * • Free drag-to-resize (68 px ↔ 259 px) via right-edge handle
 * • On release the width snaps to collapsed or expanded
 * • Collapsed logo hover reveals an expand icon below the logo (Figma 149:8685)
 * • All dimensions come from `@/services/navigation` constants
 */

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  NAV_ITEMS,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_TRANSITION_MS,
  BENTO_BORDER_RADIUS,
  useSidebarStore,
  isNavItemActive,
} from "@/services/navigation";
import { useResizeHandle } from "@/services/navigation/use-resize-handle";
import { SidebarUserProfile } from "./sidebar-user-profile";

/* ═══════════════════════════════════════════════════════════════════════════
 * Navigation (wrapper)
 * Owns the resize handle and controls sidebar width.
 * ═══════════════════════════════════════════════════════════════════════════ */

interface NavigationProps {
  children: ReactNode;
}

export function Navigation({ children }: NavigationProps) {
  const { width, isDragging, isCollapsed } = useSidebarStore();
  const { handleProps } = useResizeHandle();

  return (
    <aside
      data-collapsed={isCollapsed}
      style={{
        width,
        minWidth: SIDEBAR_WIDTH_COLLAPSED,
        maxWidth: SIDEBAR_WIDTH_EXPANDED,
        borderRadius: BENTO_BORDER_RADIUS,
        // Disable smooth transition while actively dragging
        transitionDuration: isDragging ? "0ms" : `${SIDEBAR_TRANSITION_MS}ms`,
      }}
      className="relative flex h-full flex-col bg-bg-primary transition-[width] ease-in-out"
    >
      {children}

      {/* ── Resize handle (right edge) ──────────────────────── */}
      <div
        {...handleProps}
        aria-hidden
        className={cn(
          "absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize",
          "after:absolute after:inset-y-4 after:left-1/2 after:-translate-x-1/2 after:w-0.5 after:rounded-full after:transition-colors",
          isDragging
            ? "after:bg-brand-700"
            : "after:bg-transparent hover:after:bg-neutral-200",
        )}
      />
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * NavigationHeader
 * Logo + brand name + collapse toggle.
 * When collapsed: hovering the logo reveals an expand icon below it.
 * ═══════════════════════════════════════════════════════════════════════════ */

export function NavigationHeader() {
  const { isCollapsed, toggle, width } = useSidebarStore();

  // Determine if labels should show based on current width
  const showLabels = width > SIDEBAR_WIDTH_COLLAPSED + 40;

  return (
    <div className="shrink-0 border-b border-neutral-200 px-4">
      <div
        className={cn(
          "flex items-center py-6",
          showLabels ? "justify-between" : "justify-center",
        )}
      >
        {/* Logo + brand name */}
        <div
          className={cn(
            "flex items-center",
            showLabels ? "gap-1" : "flex-col items-center gap-0",
          )}
        >
          {/* Logo wrapper — relative anchor for the expand icon overlay */}
          <div className="group/logo relative shrink-0">
            {/* Logo — 48×48, centered when collapsed */}
            <div className="relative size-12">
              <Image
                src="/assets/navigation/logo.svg"
                alt="AI Hire logo"
                fill
                className="object-cover"
                sizes="48px"
                priority
              />
            </div>

            {/* Expand icon — absolutely positioned below logo, fade + slide up on hover */}
            {isCollapsed && (
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                className={cn(
                  "absolute -bottom-5 left-1/2 -translate-x-1/2",
                  "flex size-4 items-center justify-center",
                  "translate-y-1 scale-90 opacity-0 transition-all duration-200 ease-out",
                  "group-hover/logo:translate-y-0 group-hover/logo:scale-100 group-hover/logo:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/navigation/sidebar-collapse.svg"
                  alt=""
                  aria-hidden
                  className="size-4 rotate-180"
                />
              </button>
            )}
          </div>

          {/* Brand name (visible when wide enough) */}
          {showLabels && (
            <span className="whitespace-nowrap text-xl font-semibold text-neutral-900">
              AIHire
            </span>
          )}
        </div>

        {/* Collapse toggle (shown when expanded) */}
        {showLabels && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="flex size-4 shrink-0 items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/navigation/sidebar-collapse.svg"
              alt=""
              aria-hidden
              className="size-4"
            />
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * NavigationBody
 * Nav links + user profile footer.
 * ═══════════════════════════════════════════════════════════════════════════ */

export function NavigationBody() {
  const pathname = usePathname();
  const { isCollapsed, width } = useSidebarStore();

  // Whether we have room for text labels
  const showLabels = width > SIDEBAR_WIDTH_COLLAPSED + 40;

  return (
    <>
      {/* ── Nav links ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-8">
        <div
          className={cn(
            "flex flex-col gap-1",
            showLabels ? "px-4" : "items-center px-2",
          )}
        >
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center transition-colors",
                  active
                    ? "rounded-[10px] border-l-[5px] border-brand-700 bg-brand-50 py-3 pr-3"
                    : "rounded-[14px] p-3",
                  active && !showLabels && "border-l-0 p-3",
                  active && showLabels && "pl-4.25",
                  !active && "hover:bg-sidebar-accent",
                  showLabels ? "gap-3" : "justify-center",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active ? item.iconActive : item.icon}
                  alt=""
                  aria-hidden
                  className="size-4 shrink-0"
                />

                {showLabels && (
                  <span
                    className={cn(
                      "whitespace-nowrap text-sm tracking-[-0.15px]",
                      active
                        ? "font-semibold text-text-brand"
                        : "font-normal text-text-secondary",
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── User profile footer ─────────────────────────────────── */}
      <div className={cn(showLabels ? "px-4" : "px-2")}>
        <SidebarUserProfile isCollapsed={!showLabels} />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Default composed export — drop-in replacement for the old <Sidebar />
 * ═══════════════════════════════════════════════════════════════════════════ */

export function Sidebar() {
  return (
    <Navigation>
      <NavigationHeader />
      <NavigationBody />
    </Navigation>
  );
}
