"use client";

/**
 * Package Management page — Figma node 2155:1192
 *
 * Shows either:
 *   - PackageCardGrid (when packages exist)
 *   - PackageEmptyState (when no packages)
 *
 * Page-level stagger orchestration via framer-motion.
 */

import { motion } from "framer-motion";
import { fadeSlideUp, staggerContainerMedium } from "@/lib/motion";
import { PackageHeader } from "@/components/dashboard/package-header";
import { PackageEmptyState } from "@/components/dashboard/package-empty-state";
import { PackageCardGrid } from "@/components/dashboard/package/package-card-grid";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function PackageManagementPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: packages, isLoading } = useQuery(
    trpc.packages.list.queryOptions(),
  );

  const createMutation = useMutation(
    trpc.packages.create.mutationOptions({
      onSuccess: (created) => {
        queryClient.invalidateQueries({
          queryKey: trpc.packages.list.queryKey(),
        });
        router.push(`/dashboard/package-management/${created.id}`);
      },
    }),
  );

  const handleCreate = () => {
    createMutation.mutate({ title: "My Application Package" });
  };

  const hasPackages = !isLoading && packages && packages.length > 0;

  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={staggerContainerMedium}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeSlideUp}>
        <div className="flex items-center justify-between rounded-2xl bg-bg-primary px-4 py-5">
          <h1 className="text-[32px] font-bold leading-10 tracking-normal text-neutral-900">
            Your Application Package
          </h1>
          {hasPackages && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-[14px] px-5 py-2.5 text-sm font-semibold text-neutral-0"
              style={{
                backgroundImage:
                  "linear-gradient(171deg, var(--brand-900) 16%, #156139 72%)",
              }}
            >
              <Plus className="size-4" />
              New Package
            </button>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeSlideUp}>
        {hasPackages ? (
          <div className="rounded-2xl bg-bg-primary px-4 py-5">
            <PackageCardGrid />
          </div>
        ) : isLoading ? (
          <div className="rounded-2xl bg-bg-primary px-4 py-5">
            <PackageCardGrid />
          </div>
        ) : (
          <PackageEmptyState
            onCreate={handleCreate}
            isCreating={createMutation.isPending}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
