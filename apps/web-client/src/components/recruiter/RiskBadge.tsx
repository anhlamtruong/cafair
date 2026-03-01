type Risk = "low" | "medium" | "high";

const styles: Record<Risk, string> = {
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  high: "bg-red-50 text-red-700 border border-red-200",
};

const icons: Record<Risk, string> = {
  low: "✓",
  medium: "△",
  high: "⚠",
};

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${styles[risk]}`}
    >
      <span>{icons[risk]}</span>
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  );
}
