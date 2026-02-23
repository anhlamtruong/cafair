"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Clock,
  Calendar,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  BarChart3,
  Zap,
} from "lucide-react";

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    on_track: { label: "On Track", icon: CheckCircle, cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    at_risk: { label: "At Risk", icon: AlertTriangle, cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    critical: { label: "Critical", icon: AlertTriangle, cls: "bg-red-50 text-red-700 border border-red-200" },
  };
  const s = map[status ?? "on_track"] ?? map.on_track;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
      <s.icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

// ─── Coverage Bar ─────────────────────────────────────────
function CoverageBar({ sent, needed }: { sent: number; needed: number }) {
  const pct = needed === 0 ? 0 : Math.min(100, Math.round((sent / needed) * 100));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{sent}/{needed}</span>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────
function Sparkline({ status }: { status: string | null }) {
  const color = status === "on_track" ? "#2d6a4f" : status === "critical" ? "#c53030" : "#b7791f";
  const points = status === "critical"
    ? "0,6 15,8 30,12 45,16 60,20"
    : status === "at_risk"
    ? "0,14 15,12 30,16 45,10 60,8"
    : "0,20 15,14 30,10 45,6 60,4";
  return (
    <svg viewBox="0 0 60 24" className="w-16 h-6">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main Dashboard ───────────────────────────────────────
export default function RecruiterDashboard() {
  const trpc = useTRPC();

  const { data: stats, isLoading: statsLoading } = useQuery(
    trpc.recruiter.getDashboardStats.queryOptions()
  );
  const { data: activeEvent } = useQuery(
    trpc.recruiter.getActiveEvent.queryOptions()
  );
  const { data: candidates } = useQuery(
    trpc.recruiter.getCandidates.queryOptions()
  );

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Stage counts for funnel
  const stageCounts = {
    registered: candidates?.length ?? 0,
    screened: candidates?.filter(c => ["screen", "interview", "offer", "day1"].includes(c.stage ?? "")).length ?? 0,
    interviewed: candidates?.filter(c => ["interview", "offer", "day1"].includes(c.stage ?? "")).length ?? 0,
    offer: candidates?.filter(c => ["offer", "day1"].includes(c.stage ?? "")).length ?? 0,
    accepted: candidates?.filter(c => c.stage === "day1").length ?? 0,
  };

  const maxStage = stageCounts.registered || 1;

  // Stage movement (last 24h simulation)
  const stageMovement = [
    { label: "Verified", value: "+12", icon: CheckCircle, color: "text-emerald-600" },
    { label: "Screens Done", value: "+9", icon: TrendingUp, color: "text-primary" },
    { label: "Interviews Sched.", value: "+6", icon: Calendar, color: "text-blue-600" },
    { label: "Offers Sent", value: "+2", icon: Target, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-5 max-w-[1200px]">

      {/* Live Event Banner + Stat Cards row */}
      <div className="flex gap-4 items-stretch">
        {/* Live Event Banner */}
        {activeEvent && (
          <div className="flex items-center gap-4 rounded-xl bg-primary px-5 py-4 min-w-[280px] shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 shrink-0">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/90 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
                <span className="text-sm font-semibold text-white truncate">{activeEvent.name}</span>
              </div>
              <p className="text-xs text-white/70">
                {stats?.inQueue ?? 0} queued · {candidates?.filter(c => c.stage === "screen").length ?? 0} screens · {activeEvent.recruiterCount} recruiters
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/50 shrink-0" />
          </div>
        )}

        {/* Stat Cards */}
        <div className="flex-1 grid grid-cols-4 gap-3">
          {[
            {
              label: "QUEUE / WAIT",
              value: stats?.inQueue ?? 0,
              sub: "4m avg",
              icon: Clock,
            },
            {
              label: "RECRUITERS",
              value: `${activeEvent?.recruiterCount ?? 5}`,
              sub2: "online",
              sub: "72% util.",
              icon: Users,
            },
            {
              label: "INTERVIEWS",
              value: stats?.inInterview ?? 0,
              sub2: "today",
              sub: `${(stats?.inInterview ?? 0) + 16} 7-day`,
              icon: Calendar,
            },
            {
              label: "PROJECTED HIRES",
              value: stats?.projectedHires ?? 0,
              sub: `/ ${stats?.roles?.reduce((acc, r) => acc + (r.targetHires ?? 0), 0) ?? 21} target`,
              icon: Target,
              extra: true,
            },
          ].map((card) => (
            <div key={card.label} className="bg-card border border-border rounded-xl px-4 py-3.5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <card.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground tabular-nums">{card.value}</span>
                {card.sub2 && <span className="text-xs text-muted-foreground">{card.sub2}</span>}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{card.sub}</span>
                {card.extra && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    Low conf.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles Progress Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <div>
              <h2 className="font-semibold text-foreground">Roles Progress</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats?.roles?.length ?? 0} reqs · {stats?.roles?.reduce((acc, r) => acc + (r.targetHires ?? 0), 0) ?? 0} total HC
              </p>
            </div>
          </div>
          <select className="text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground">
            <option>All Roles</option>
          </select>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Role", "HC", "Offers Needed", "Sent", "Accepted", "Pipeline Coverage", "Status", "Projection"].map(h => (
                <th key={h} className="text-left text-[10px] font-semibold text-muted-foreground px-6 py-3 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats?.roles?.map((role) => (
              <tr key={role.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-6 py-3.5">
                  <p className="text-sm font-medium text-foreground">{role.title}</p>
                  <p className="text-xs text-muted-foreground">{role.department}</p>
                </td>
                <td className="px-6 py-3.5 text-sm text-foreground tabular-nums">{role.targetHires}</td>
                <td className="px-6 py-3.5 text-sm text-foreground tabular-nums">{role.offersNeeded}</td>
                <td className="px-6 py-3.5 text-sm text-foreground tabular-nums">{role.offersSent}</td>
                <td className="px-6 py-3.5 text-sm text-foreground tabular-nums">{role.offersAccepted}</td>
                <td className="px-6 py-3.5 w-40">
                  <CoverageBar sent={role.offersSent ?? 0} needed={role.offersNeeded ?? 1} />
                </td>
                <td className="px-6 py-3.5">
                  <StatusBadge status={role.status} />
                </td>
                <td className="px-6 py-3.5">
                  <Sparkline status={role.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">

        {/* Stage Movement */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Stage Movement</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">last 24h</span>
              <svg viewBox="0 0 40 16" className="w-10 h-4">
                <polyline points="0,12 8,8 16,10 24,4 32,6 40,2" fill="none" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stageMovement.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Conversion Funnel</h2>
            </div>
            <select className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground">
              <option>All Roles</option>
            </select>
          </div>

          {/* Bar chart */}
          <div className="flex gap-3 h-[140px]">
            {[
              { label: "Registered", count: stageCounts.registered },
              { label: "Screened", count: stageCounts.screened, drop: stageCounts.registered > 0 ? `-${Math.round(((stageCounts.registered - stageCounts.screened) / stageCounts.registered) * 100)}%` : undefined },
              { label: "Interviewed", count: stageCounts.interviewed, drop: stageCounts.screened > 0 ? `-${Math.round(((stageCounts.screened - stageCounts.interviewed) / stageCounts.screened) * 100)}%` : undefined },
              { label: "Offer", count: stageCounts.offer, drop: stageCounts.interviewed > 0 ? `-${Math.round(((stageCounts.interviewed - stageCounts.offer) / stageCounts.interviewed) * 100)}%` : undefined },
              { label: "Accepted", count: stageCounts.accepted, drop: stageCounts.offer > 0 ? `-${Math.round(((stageCounts.offer - stageCounts.accepted) / stageCounts.offer) * 100)}%` : undefined },
            ].map(({ label, count, drop }) => {
              const pct = Math.max(8, Math.round((count / maxStage) * 100));
              return (
                <div key={label} className="flex-1 flex flex-col items-center">
                  <span className="text-xs font-bold text-foreground tabular-nums mb-1">{count}</span>
                  <div className="w-full flex flex-col justify-end flex-1">
                    <div
                      className="w-full bg-primary rounded-t transition-all duration-500"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1">{label}</span>
                  <span className={`text-[10px] tabular-nums h-4 ${drop ? "text-red-500" : "invisible"}`}>
                    {drop ?? "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
