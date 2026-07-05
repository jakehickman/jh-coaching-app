import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface Props {
  clientId: number;
  onWeekClick?: (weekNumber: number | null) => void;
}

type Week = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isInProgress: boolean;
  daysLogged: number;
  sessionsCompleted: number;
  avgSleepQuality: number | null;
  avgSleepHours: number | null;
  avgStress?: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
  avgWeight?: number | null;
  mealLogCount?: number | null;
  mealLogTreats?: number | null;
  mealLogAvgHunger?: number | null;
  mealLogAvgFullness?: number | null;
  mealLogIdealZonePct?: number | null;
};

const DEFAULT_VISIBLE = 4;

// ── Colour tokens (match Insights design system) ──────────────────────────────
const C = {
  green: "#52B788",
  amber: "#FBBF24",
  red: "#F87171",
  muted: "#9BA1A6",
  fg: "#ECEDEE",
};

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function hoursToHmm(h: number | null | undefined): string {
  if (h == null) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

// ── Delta helpers ─────────────────────────────────────────────────────────────
type DeltaResult = { arrow: "up" | "down" | "flat"; good: boolean; pct?: number; abs?: number };

function calcDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  lowerIsBetter = false,
  asPct = false,
): DeltaResult | null {
  if (current == null || previous == null || previous === 0) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return { arrow: "flat", good: true };
  const positive = diff > 0;
  const good = lowerIsBetter ? !positive : positive;
  const pct = asPct ? Math.abs((diff / previous) * 100) : undefined;
  const abs = !asPct ? Math.abs(diff) : undefined;
  return { arrow: positive ? "up" : "down", good, pct, abs };
}

function DeltaBadge({ delta, unit = "" }: { delta: DeltaResult | null; unit?: string }) {
  if (!delta) return null;
  const colour = delta.arrow === "flat" ? C.muted : delta.good ? C.green : C.red;
  const Icon = delta.arrow === "up" ? ArrowUp : delta.arrow === "down" ? ArrowDown : Minus;
  const label = delta.arrow === "flat"
    ? "flat"
    : delta.pct != null
      ? `${delta.pct.toFixed(1)}%`
      : delta.abs != null
        ? `${delta.abs.toFixed(1)}${unit}`
        : "";
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: colour }}>
      <Icon className="w-3 h-3" />
      {label && <span>{label}</span>}
    </span>
  );
}

// ── Summary stat card (Insights design system) ────────────────────────────────
function SummaryCard({
  label,
  value,
  unit,
  delta,
  deltaUnit,
  interpretation,
  valueColour,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: DeltaResult | null;
  deltaUnit?: string;
  interpretation?: string;
  valueColour?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{
        background: "#1A2020",
        border: "1px solid #2D3B35",
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-[0.8px]"
        style={{ color: C.muted }}
      >
        {label}
      </p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span
          className="text-[32px] font-bold leading-none tabular-nums"
          style={{ color: valueColour ?? C.fg, fontFamily: "Inter, sans-serif" }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium" style={{ color: C.muted }}>
            {unit}
          </span>
        )}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-0.5">
          <DeltaBadge delta={delta ?? null} unit={deltaUnit} />
          {delta && delta.arrow !== "flat" && (
            <span className="text-xs" style={{ color: C.muted }}>vs prev 7d</span>
          )}
          {delta && delta.arrow === "flat" && (
            <span className="text-xs" style={{ color: C.muted }}>vs prev 7d</span>
          )}
        </div>
      )}
      {interpretation && (
        <p className="text-[12px] mt-1" style={{ color: C.muted }}>{interpretation}</p>
      )}
    </div>
  );
}

// ── Weekly table row ──────────────────────────────────────────────────────────
function WeekRow({ week }: { week: Week }) {
  const hasData = week.daysLogged > 0 || week.sessionsCompleted > 0;
  const stepsVal = week.avgSteps != null ? fmtK(Math.round(week.avgSteps)) : null;
  const stepsGoal = (week.stepGoal != null && stepsVal != null) ? `/${fmtK(week.stepGoal)}` : "";

  return (
    <tr
      className={`border-b border-border/40 transition-colors ${
        week.isInProgress ? "bg-amber-500/5" : !hasData ? "opacity-40" : ""
      }`}
    >
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{week.label}</span>
          {week.isInProgress && (
            <span className="text-xs font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`text-xs tabular-nums ${hasData ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {hasData ? `${week.daysLogged}/7` : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.avgWeight != null ? `${fmt(week.avgWeight)} kg` : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {stepsVal != null ? <>{stepsVal}{stepsGoal && <span className="text-muted-foreground">{stepsGoal}</span>}</> : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {hoursToHmm(week.avgSleepHours)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.avgSleepQuality != null ? `${fmt(week.avgSleepQuality)}/5` : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className={`text-xs tabular-nums ${
          week.avgStress != null && week.avgStress >= 4 ? "text-red-400"
          : week.avgStress != null && week.avgStress >= 3 ? "text-amber-400"
          : "text-foreground"
        }`}>
          {week.avgStress != null ? `${fmt(week.avgStress)}/5` : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.sessionsCompleted > 0 ? week.sessionsCompleted : "—"}
        </span>
      </td>
    </tr>
  );
}

// ── Interpretation helpers ────────────────────────────────────────────────────
function weightInterpretation(delta: DeltaResult | null): string {
  if (!delta) return "No previous data to compare";
  if (delta.arrow === "flat") return "Stable — no meaningful change";
  const dir = delta.arrow === "up" ? "up" : "down";
  const pct = delta.pct?.toFixed(1) ?? "";
  return `${pct}% ${dir} vs previous 7 days`;
}

function daysInterpretation(days: number): string {
  if (days === 7) return "Full week of data";
  if (days >= 5) return "Most days logged — minor gaps";
  if (days >= 3) return "Partial data — interpret with caution";
  return "Sparse data this week";
}

function stepsInterpretation(avg: number | null, goal: number | null, delta: DeltaResult | null): string {
  if (avg == null) return "No step data this week";
  if (goal != null) {
    const pct = Math.round((avg / goal) * 100);
    if (pct >= 100) return `Above goal — averaging ${fmtK(Math.round(avg))} steps`;
    if (pct >= 80) return `Close to goal — ${fmtK(Math.round(avg))} of ${fmtK(goal)} target`;
    return `Below goal — ${fmtK(Math.round(avg))} of ${fmtK(goal)} target`;
  }
  if (!delta) return `Averaging ${fmtK(Math.round(avg))} steps per day`;
  return delta.arrow === "flat" ? "Consistent with last week" : `Moving ${delta.arrow === "up" ? "toward" : "away from"} higher activity`;
}

function sleepInterpretation(hours: number | null): string {
  if (hours == null) return "No sleep data this week";
  if (hours >= 8) return "Good sleep duration";
  if (hours >= 7) return "Slightly below ideal — aim for 7–9 h";
  if (hours >= 6) return "Below ideal — may affect recovery";
  return "Low sleep — worth discussing";
}

function qualityInterpretation(q: number | null): string {
  if (q == null) return "No quality data this week";
  if (q >= 4) return "Reporting good sleep quality";
  if (q >= 3) return "Moderate quality — room to improve";
  return "Low quality reported — worth exploring";
}

function stressInterpretation(s: number | null): string {
  if (s == null) return "No stress data this week";
  if (s <= 2) return "Low stress — good recovery environment";
  if (s <= 3) return "Moderate stress — monitor trend";
  if (s <= 4) return "Elevated stress — may affect adherence";
  return "High stress — consider discussing load";
}

function sessionsInterpretation(n: number | null, delta: DeltaResult | null): string {
  if (n == null || n === 0) return "No sessions logged this week";
  if (!delta) return `${n} session${n !== 1 ? "s" : ""} logged`;
  if (delta.arrow === "flat") return `${n} session${n !== 1 ? "s" : ""} — consistent with last week`;
  return `${n} session${n !== 1 ? "s" : ""} — ${delta.arrow === "up" ? "more" : "fewer"} than last week`;
}

// ── Main component ────────────────────────────────────────────────────────────
export function WeeklyReviewTab({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = (data?.weeks ?? []) as Week[];
  const r = data?.rolling7 ?? null;

  // ── Current week (weeks[0]) still used for the history table only ──
  const cur = weeks[0] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Failed to load overview</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </div>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-base font-medium">No data logged yet for this client</p>
        <p className="text-sm mt-1">Summaries will appear once the client starts logging.</p>
      </div>
    );
  }

  const visibleWeeks = showAll ? weeks : weeks.slice(0, DEFAULT_VISIBLE);
  const hasMore = weeks.length > DEFAULT_VISIBLE;

  // ── Rolling-7 deltas (all vs prev 7 days) ───────────────────────────────
  const weightDelta = calcDelta(r?.avgWeight, r?.prevAvgWeight, false, true);
  const stepsDelta  = calcDelta(r?.avgSteps, r?.prevAvgSteps, false, false);
  const qualDelta   = calcDelta(r?.avgSleepQuality, r?.prevAvgSleepQuality, false, false);
  const stressDelta = calcDelta(r?.avgStress, r?.prevAvgStress, true, false);
  const sessDelta   = calcDelta(r?.sessions, r?.prevSessions, false, false);
  const sleepDeltaMins: DeltaResult | null = (() => {
    if (r?.avgSleepHours == null || r?.prevAvgSleepHours == null) return null;
    const diffMins = Math.round((r.avgSleepHours - r.prevAvgSleepHours) * 60);
    if (Math.abs(diffMins) < 2) return { arrow: "flat" as const, good: true };
    return { arrow: diffMins > 0 ? "up" as const : "down" as const, good: diffMins > 0, abs: Math.abs(diffMins) };
  })();

  const stressColour = r?.avgStress != null
    ? r.avgStress >= 4 ? C.red : r.avgStress >= 3 ? C.amber : C.green
    : C.fg;
  const daysColour = r?.daysLogged != null
    ? r.daysLogged >= 6 ? C.green : r.daysLogged >= 4 ? C.amber : C.red
    : C.fg;

  return (
    <div className="space-y-8">

      {/* ── Last 7 Days summary ── */}
      <div>
        <p
          className="text-xs font-medium uppercase tracking-[0.8px] mb-4"
          style={{ color: C.muted }}
        >
          Last 7 Days
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

          {/* Avg Weight */}
          {r?.avgWeight != null && (
            <SummaryCard label="Avg Weight" value={fmt(r.avgWeight)} unit="kg" delta={weightDelta} />
          )}

          {/* Days Logged */}
          {r?.daysLogged != null && (
            <SummaryCard label="Days Logged" value={`${r.daysLogged}`} unit="/ 7" valueColour={daysColour} />
          )}

          {/* Avg Steps */}
          {r?.avgSteps != null && (
            <SummaryCard label="Avg Steps" value={fmtK(Math.round(r.avgSteps))} delta={stepsDelta} />
          )}

          {/* Sleep Duration */}
          {r?.avgSleepHours != null && (
            <SummaryCard label="Avg Sleep" value={hoursToHmm(r.avgSleepHours)} delta={sleepDeltaMins} deltaUnit="min" />
          )}

          {/* Sleep Quality */}
          {r?.avgSleepQuality != null && (
            <SummaryCard label="Sleep Quality" value={fmt(r.avgSleepQuality)} unit="/ 5" delta={qualDelta} />
          )}

          {/* Stress */}
          {r?.avgStress != null && (
            <SummaryCard label="Avg Stress" value={fmt(r.avgStress)} unit="/ 5" delta={stressDelta} valueColour={stressColour} />
          )}

          {/* Training Sessions */}
          {r?.sessions != null && (
            <SummaryCard label="Sessions" value={String(r.sessions)} delta={sessDelta} />
          )}

        </div>
      </div>

      {/* ── Weekly history table ── */}
      <div>
        <p
          className="text-xs font-medium uppercase tracking-[0.8px] mb-4"
          style={{ color: C.muted }}
        >
          Weekly History
        </p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[22%]">Week</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[8%]">Days</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Weight</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">Steps</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Sleep</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Quality</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Stress</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {visibleWeeks.map((week) => (
                  <WeekRow key={week.weekStart} week={week} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {hasMore && (
          <div className="flex justify-center mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(v => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showAll ? "Show less" : `Show all ${weeks.length} weeks`}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
