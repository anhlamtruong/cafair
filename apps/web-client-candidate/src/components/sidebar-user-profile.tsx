"use client";

/**
 * SidebarUserProfile
 * Bottom section of the sidebar — shows the authenticated user's avatar, name,
 * email (hidden when collapsed), and a settings-gear button.
 *
 * Reads user info from Clerk's `useUser()` hook.
 */

import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface SidebarUserProfileProps {
  isCollapsed: boolean;
}

export function SidebarUserProfile({ isCollapsed }: SidebarUserProfileProps) {
  const { user } = useUser();

  const avatarUrl = user?.imageUrl ?? "";
  const displayName = user?.fullName ?? user?.firstName ?? "User";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div className="w-full shrink-0 py-4">
      <div
        className={cn(
          "flex items-start rounded-[10px] py-2.25",
          isCollapsed
            ? "flex-col items-center gap-2 px-2.5"
            : "justify-between",
        )}
      >
        {/* Avatar + info */}
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "flex-col gap-2" : "gap-2",
          )}
        >
          {/* Avatar */}
          <div className="relative size-8 shrink-0 overflow-hidden rounded-full">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                fill
                className="object-cover"
                sizes="32px"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + email (hidden when collapsed) */}
          {!isCollapsed && (
            <div className="flex flex-col gap-1 leading-4">
              <span className="font-(family-name:--font-inter) text-sm font-semibold text-foreground">
                {displayName}
              </span>
              <span className="font-(family-name:--font-inter) text-xs font-normal text-text-tertiary">
                {email}
              </span>
            </div>
          )}
        </div>

        {/* Settings gear */}
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[10px] size-7.5 transition-colors hover:bg-sidebar-accent",
            isCollapsed && "size-8",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/navigation/setting-gear.svg"
            alt=""
            aria-hidden
            className="size-4"
          />
        </Link>
      </div>
    </div>
  );
}
