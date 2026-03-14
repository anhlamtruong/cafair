"use client";

/**
 * UserSync — ensures the Clerk user is synced to the DB `users` table.
 *
 * Runs once per mount (dashboard layout wraps all authenticated pages).
 * Uses a mutation so it's idempotent — upserts the user row.
 */

import { useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

export function UserSync() {
  const trpc = useTRPC();
  const didSync = useRef(false);

  const { mutate } = useMutation(
    trpc.users.syncFromClerk.mutationOptions({
      onError: (err) => {
        console.error("[UserSync] failed:", err.message);
      },
    }),
  );

  useEffect(() => {
    if (!didSync.current) {
      didSync.current = true;
      mutate();
    }
  }, [mutate]);

  return null;
}
