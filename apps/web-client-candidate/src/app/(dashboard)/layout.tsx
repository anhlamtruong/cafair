import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar-candidate";
import { DashboardShell } from "@/components/dashboard-shell";
import { LAYOUT_PADDING } from "@/services/navigation";
import { UserSync } from "@/components/user-sync";

/**
 * Bento-box dashboard layout
 *
 * ┌──────────────────────────────────────────────────┐
 * │  p=10px                                          │
 * │  ┌─────────┐ gap ┌──────────────────────────┐   │
 * │  │         │  16  │  Content (rounded card)   │   │
 * │  │ Sidebar │ px   │  flex-col, scrollable     │   │
 * │  │         │      │                           │   │
 * │  └─────────┘      └──────────────────────────┘   │
 * └──────────────────────────────────────────────────┘
 *
 * Sidebar lives in normal document flow (no fixed positioning).
 * Adjust LAYOUT_PADDING, LAYOUT_GAP, BENTO_BORDER_RADIUS in
 * `@/services/navigation/constants` to resize the layout globally.
 */
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div
      className="flex h-screen bg-background"
      style={{ padding: LAYOUT_PADDING }}
    >
      <UserSync />

      {/* ── Sidebar bento card ─────────────────────────────── */}
      <Sidebar />

      {/* ── Content bento card ─────────────────────────────── */}
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
