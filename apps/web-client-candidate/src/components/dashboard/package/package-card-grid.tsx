"use client";

/**
 * PackageCardGrid — Fetches & displays all candidate packages as cards.
 *
 * When the list is empty, falls through to the parent-rendered empty state.
 * Uses framer-motion stagger for entrance animation.
 */

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fadeSlideUp, staggerContainer } from "@/lib/motion";
import { PackageCard } from "./package-card";
import { Skeleton } from "@starter/ui";

export function PackageCardGrid() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: packages, isLoading } = useQuery(
    trpc.packages.list.queryOptions(),
  );

  const deleteMutation = useMutation(
    trpc.packages.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.packages.list.queryKey(),
        });
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-[14px] bg-neutral-0 p-4"
          >
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-2 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-[34px] w-24 rounded-[10px]" />
              <Skeleton className="h-[34px] w-20 rounded-[10px]" />
              <Skeleton className="h-[34px] w-24 rounded-[10px]" />
            </div>
            <Skeleton className="h-9 w-full rounded-[10px]" />
          </div>
        ))}
      </div>
    );
  }

  if (!packages || packages.length === 0) {
    return null; // Parent will show empty state
  }

  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {packages.map((pkg) => (
        <motion.div key={pkg.id} variants={fadeSlideUp}>
          <PackageCard
            pkg={pkg}
            onDelete={(id) => deleteMutation.mutate({ id })}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
