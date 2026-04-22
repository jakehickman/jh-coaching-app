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

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

// ─── Simple cell ─────────────────────────────────────────────────────────────

interface CellProps {
  children: React.ReactNode;
  muted?: boolean;
  borderLeft?: boolean;
  className?: string;
}

function Cell({ children, muted, borderLeft, className = "" }: CellProps) {
  return (
    <td
      className={`px-3 py-2.5 text-right text-sm tabular-nums whitespace-nowrap
        ${borderLeft ? "border-l border-border/30" : ""}
        ${muted ? "text-muted-foreground" : "text-foreground"}
        ${className}
      `}
    >
      {children}
    </td>
  );
}

// ─── Weight cell: value + inline % change ────────────────────────────────────

function WeightCell({ weight, pct, borderLeft }: { weight: number | null; pct: number | null; borderLeft?: boolean }) {
  const weightStr = weight != null ? `${weight.toFixed(1)}` : "—";
  const pctColor = pct == null
    ? ""
    : "text-muted-foreground";

  const pctStr = pct != null
    ? `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`
    : null;

  return (
    <td
      className={`px-3 py-2.5 text-right text-sm tabular-nums whitespace-nowrap
        ${borderLeft ? "border-l border-border/30" : ""}
      `}
    >
      <span className={weight == null ? "text-muted-foreground" : "text-foreground"}>
        {weightStr}
      </span>
      {pctStr && (
        <span className={`ml-1.5 text-[11px] ${pctColor}`}>
          {pctStr}
        </span>
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
          <Skeleton key={i} className="h-10 w-full bg-muted rounded-md" />
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
        <table className="w-full text-sm border-collapse min-w-[860px]">
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
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Nutrition
              </th>
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
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
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Hunger /5</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Sleep Qual /5</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Sleep Hrs</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Caffeine (srv)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Steps</th>
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week) => {
              const hasData = week.daysLogged > 0;

              const stepsValue = week.avgSteps != null
                ? (week.stepGoal != null
                  ? `${fmtK(Math.round(week.avgSteps))} / ${fmtK(week.stepGoal)}`
                  : fmtK(Math.round(week.avgSteps)))
                : "—";

              return (
                <tr
                  key={week.weekStart}
                  className={`border-b border-border/50 last:border-0 transition-colors ${
                    week.isInProgress
                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                      : hasData
                      ? "hover:bg-muted/20"
                      : "opacity-40"
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

                  {/* Weight + inline % change */}
                  <WeightCell weight={week.avgWeight} pct={week.avgWeightPct} borderLeft />

                  {/* Waist */}
                  <Cell muted={week.avgWaist == null}>{fmt(week.avgWaist, 1)}</Cell>

                  {/* Skinfold */}
                  <Cell muted={week.avgSkinfold == null}>{fmt(week.avgSkinfold, 1)}</Cell>

                  {/* Sessions */}
                  <Cell borderLeft muted={!hasData}>{week.sessionsCompleted}</Cell>

                  {/* Off-Plan */}
                  <Cell borderLeft muted={week.totalOffPlan == null}>
                    {week.totalOffPlan != null ? week.totalOffPlan : "—"}
                  </Cell>

                  {/* Hunger */}
                  <Cell muted={week.avgHunger == null}>{fmt(week.avgHunger, 1)}</Cell>

                  {/* Sleep Quality */}
                  <Cell borderLeft muted={week.avgSleepQuality == null}>{fmt(week.avgSleepQuality, 1)}</Cell>

                  {/* Sleep Hours */}
                  <Cell muted={week.avgSleepHours == null}>{fmt(week.avgSleepHours, 1)}</Cell>

                  {/* Caffeine */}
                  <Cell muted={week.avgCaffeine == null}>{fmt(week.avgCaffeine, 1)}</Cell>

                  {/* Steps */}
                  <Cell borderLeft muted={week.avgSteps == null}>{stepsValue}</Cell>
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
