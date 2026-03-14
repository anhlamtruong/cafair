"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

/**
 * Dev dashboard — lightweight data browser.
 * The previous recruiter-specific tables were removed along with the recruiter service.
 * Add new data panels here as candidate-side services are built.
 */
export default function DevDashboard() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.protectedHello.queryOptions());

  return (
    <div className="space-y-5 max-w-[1200px] p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dev Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Development reference &amp; quick links
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Auth check
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {isLoading ? "Loading…" : data?.greeting}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quick links
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/theme-editor"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              🎨 Theme Editor
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
