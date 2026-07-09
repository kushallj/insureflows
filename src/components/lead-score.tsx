import { cn } from "@/lib/utils";

export function leadScoreTone(score: number): {
  label: string;
  bg: string;
  ring: string;
  text: string;
  bar: string;
} {
  if (score < 30) {
    return {
      label: "Cold",
      bg: "bg-red-500/10",
      ring: "ring-red-500/30",
      text: "text-red-600 dark:text-red-400",
      bar: "bg-red-500",
    };
  }
  if (score <= 70) {
    return {
      label: "Warm",
      bg: "bg-amber-500/10",
      ring: "ring-amber-500/30",
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    };
  }
  return {
    label: "Hot",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  };
}

export function LeadScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone = leadScoreTone(clamped);
  return (
    <div
      className={cn(
        "rounded-lg p-3 ring-1 flex items-center gap-3",
        tone.bg,
        tone.ring,
      )}
    >
      <div className={cn("text-2xl font-semibold tabular-nums leading-none", tone.text)}>
        {clamped}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className={cn("font-medium", tone.text)}>{tone.label}</span>
          <span className="text-muted-foreground">Lead score</span>
        </div>
        <div className="h-1.5 rounded-full bg-background/60 mt-1.5 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", tone.bar)}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function LeadScoreBadge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone = leadScoreTone(clamped);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ring-1",
        tone.bg,
        tone.ring,
        tone.text,
      )}
      title={`${tone.label} · Lead score ${clamped}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
      {clamped}
    </span>
  );
}
