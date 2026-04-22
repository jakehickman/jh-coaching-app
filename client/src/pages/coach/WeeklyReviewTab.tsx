import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  clientId: number;
}

type Week = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isInProgress: boolean;
  weekNumber: number;
  daysLogged: number;
  avgWeight: number | null;
  avgWeightPct: number | null;
  avgWaist: number | null;
  avgSkinfold: number | null;
  sessionsCompleted: number;
  totalOffPlan: number | null;
  avgCaffeine: number | null;
  avgHunger: number | null;
  avgSleepQuality: number | null;
  avgSleepHours: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
};

const DEFAULT_VISIBLE = 8;

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtDelta(d: number, decimals = 1): string {
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(decimals)}`;
}

function deltaColor(d: number, higherIsBetter: boolean | null): string {
  if (higherIsBetter === null) return "text-muted-foreground";
  if (higherIsBetter) return d > 0 ? "text-green-400" : d < 0 ? "text-red-400" : "text-muted-foreground";
  return d < 0 ? "text-green-400" : d > 0 ? "text-red-400" : "text-muted-foreground";
}

// ─── Stacked cell: main value on top, small delta below ──────────────────────

interface StackedCellProps {
  /** Formatted main value string */
  value: string;
  /** Raw numeric delta (curr - prev). null = no prev week. undefined = no chip. */
  delta?: number | null;
  /** Formatted delta string override */
  deltaText?: string;
  /** true = higher is better, false = lower is better, null = neutral */
  higherIsBetter?: boolean | null;
  /** Dim the main value (no data) */
  muted?: boolean;
  borderLeft?: boolean;
}

function StackedCell({
  value,
  delta,
  deltaText,
  higherIsBetter = null,
  muted,
  borderLeft,
}: StackedCellProps) {
  const showDelta = delta !== undefined; // undefined = never show delta row
  const hasDelta = delta != null && !isNaN(delta);
  const color = hasDelta ? deltaColor(delta!, higherIsBetter) : "text-muted-foreground";
  const text = hasDelta
    ? (deltaText ?? fmtDelta(delta!, 1))
    : "—";

  return (
    <td
      className={`px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap align-top
        ${borderLeft ? "border-l border-border/30" : ""}
      `}
    >
      {/* Main value */}
      <div className={muted ? "text-muted-foreground" : "text-foreground"}>
        {value}
      </div>
      {/* Delta row — always rendered when showDelta, keeps row height consistent */}
      {showDelta && (
        <div className={`text-[10px] leading-tight mt-0.5 ${color}`}>
          {text}
        </div>
      )}
    </td>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function WeeklyReviewTab({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-muted rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 mt-2 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Failed to load weekly review</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </div>
      </div>
    );
  }

  const weeks = data?.weeks ?? [];

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-base font-medium">No data logged yet for this client</p>
        <p className="text-sm mt-1">Weekly summaries will appear once the client starts logging.</p>
      </div>
    );
  }

  const visibleWeeks = showAll ? weeks : weeks.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="mt-2">
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            {/* Group headers */}
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/30 z-10 min-w-[180px]">
                Week
              </th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Body Composition
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Training
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Nutrition
              </th>
              <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Recovery
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Activity
              </th>
            </tr>
            {/* Column headers */}
            <tr className="border-b border-border bg-muted/10">
              <th className="px-3 py-1.5 sticky left-0 bg-muted/10 z-10" />
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Weight (kg)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Waist (cm)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Skinfold (mm)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Sessions</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Off-Plan</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Hunger /5</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Sleep Qual /5</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Sleep Hrs</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Caffeine (srv)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Steps</th>
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week, idx) => {
              const prev: Week | null = weeks[idx + 1] ?? null;
              const hasData = week.daysLogged > 0;

              // Helper: delta or null if either value is missing
              const d = (curr: number | null, p: number | null) =>
                curr != null && p != null ? curr - p : null;

              return (
                <tr
                  key={week.weekStart}
                  className={`border-b border-border/50 last:border-0 transition-colors ${
                    week.isInProgress
                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                      : hasData
                      ? "hover:bg-muted/20"
                      : "opacity-50"
                  }`}
                >
                  {/* Week label — sticky left */}
                  <td className={`px-3 py-2.5 sticky left-0 z-10 ${week.isInProgress ? "bg-amber-500/5" : "bg-card"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary min-w-[28px]">W{week.weekNumber}</span>
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground font-medium leading-tight">{week.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {hasData ? `${week.daysLogged}d logged` : "No data"}
                        </span>
                      </div>
                      {week.isInProgress && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10 ml-1">
                          Live
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Avg Weight — delta shown as % change */}
                  <StackedCell
                    value={fmt(week.avgWeight, 1)}
                    delta={week.avgWeightPct}
                    deltaText={
                      week.avgWeightPct != null
                        ? `${week.avgWeightPct > 0 ? "+" : ""}${week.avgWeightPct.toFixed(2)}%`
                        : undefined
                    }
                    higherIsBetter={null}
                    muted={!hasData || week.avgWeight == null}
                    borderLeft
                  />

                  {/* Waist */}
                  <StackedCell
                    value={fmt(week.avgWaist, 1)}
                    delta={d(week.avgWaist, prev?.avgWaist ?? null)}
                    higherIsBetter={false}
                    muted={week.avgWaist == null}
                  />

                  {/* Skinfold */}
                  <StackedCell
                    value={fmt(week.avgSkinfold, 1)}
                    delta={d(week.avgSkinfold, prev?.avgSkinfold ?? null)}
                    higherIsBetter={false}
                    muted={week.avgSkinfold == null}
                  />

                  {/* Sessions */}
                  <StackedCell
                    value={String(week.sessionsCompleted)}
                    delta={d(week.sessionsCompleted, prev?.sessionsCompleted ?? null)}
                    deltaText={
                      prev != null
                        ? fmtDelta(week.sessionsCompleted - prev.sessionsCompleted, 0)
                        : undefined
                    }
                    higherIsBetter={true}
                    muted={!hasData}
                    borderLeft
                  />

                  {/* Off-Plan */}
                  <StackedCell
                    value={week.totalOffPlan != null ? String(week.totalOffPlan) : "—"}
                    delta={d(week.totalOffPlan, prev?.totalOffPlan ?? null)}
                    deltaText={
                      prev?.totalOffPlan != null && week.totalOffPlan != null
                        ? fmtDelta(week.totalOffPlan - prev.totalOffPlan, 0)
                        : undefined
                    }
                    higherIsBetter={false}
                    muted={week.totalOffPlan == null}
                    borderLeft
                  />

                  {/* Hunger */}
                  <StackedCell
                    value={fmt(week.avgHunger, 1)}
                    delta={d(week.avgHunger, prev?.avgHunger ?? null)}
                    higherIsBetter={false}
                    muted={week.avgHunger == null}
                    borderLeft
                  />

                  {/* Sleep Quality */}
                  <StackedCell
                    value={fmt(week.avgSleepQuality, 1)}
                    delta={d(week.avgSleepQuality, prev?.avgSleepQuality ?? null)}
                    higherIsBetter={true}
                    muted={week.avgSleepQuality == null}
                  />

                  {/* Sleep Hours */}
                  <StackedCell
                    value={fmt(week.avgSleepHours, 1)}
                    delta={d(week.avgSleepHours, prev?.avgSleepHours ?? null)}
                    higherIsBetter={true}
                    muted={week.avgSleepHours == null}
                  />

                  {/* Caffeine — moved to Recovery, no delta (neutral metric) */}
                  <StackedCell
                    value={fmt(week.avgCaffeine, 1)}
                    muted={week.avgCaffeine == null}
                  />

                  {/* Steps — compact value / goal on one line, delta below */}
                  <td className="px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap border-l border-border/30 align-top">
                    {(() => {
                      const fmtK = (n: number) =>
                        n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
                      const stepDelta = d(week.avgSteps, prev?.avgSteps ?? null);
                      const color = stepDelta != null ? deltaColor(stepDelta, true) : "text-muted-foreground";
                      const deltaText = stepDelta != null
                        ? `${stepDelta > 0 ? "+" : ""}${fmtK(Math.round(stepDelta))}`
                        : "—";
                      const mainValue = week.avgSteps != null
                        ? (week.stepGoal != null
                          ? `${fmtK(Math.round(week.avgSteps))} / ${fmtK(week.stepGoal)}`
                          : fmtK(Math.round(week.avgSteps)))
                        : "—";
                      return (
                        <>
                          <div className={week.avgSteps != null ? "text-foreground" : "text-muted-foreground"}>
                            {mainValue}
                          </div>
                          <div className={`text-[10px] leading-tight mt-0.5 ${color}`}>
                            {deltaText}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show all / show less */}
      {weeks.length > DEFAULT_VISIBLE && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show less" : `Show all ${weeks.length} weeks`}
          </Button>
        </div>
      )}
    </div>
  );
}
