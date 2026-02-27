type Stage = "fair" | "screen" | "interview" | "offer" | "day1";

const styles: Record<Stage, string> = {
  fair: "bg-muted text-muted-foreground border-border",
  screen: "bg-blue-50 text-blue-700 border-blue-200",
  interview: "bg-purple-50 text-purple-700 border-purple-200",
  offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  day1: "bg-primary/10 text-primary border-primary/20",
};

const labels: Record<Stage, string> = {
  fair: "Fair",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
  day1: "Day 1",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${styles[stage]}`}
    >
      {labels[stage]}
    </span>
  );
}
