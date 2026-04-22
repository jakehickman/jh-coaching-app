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

// ─── Numeric cell — right-aligned, fixed font for vertical alignment ─────────

interface NumCellProps {
  children: React.ReactNode;
  muted?: boolean;
  borderLeft?: boolean;
}

function NumCell({ children, muted, borderLeft }: NumCellProps) {
  return (
    <td
      className={`px-3 py-2.5 text-right text-sm tabular-nums whitespace-nowrap
        ${muted ? "text-muted-foreground" : "text-foreground"}
        ${borderLeft ? "border-l border-border/30" : ""}`}
    >
      {children}
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
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Avg Wt (kg)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Wt Δ%</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Waist (cm)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Sessions</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Off-Plan</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Caffeine (srv)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Hunger /5</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Sleep Qual /5</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Sleep Hrs</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Avg Steps</th>
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week) => {
              const hasData = week.daysLogged > 0;

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

                  {/* Avg Weight */}
                  <NumCell muted={!hasData || week.avgWeight == null} borderLeft>
                    {fmt(week.avgWeight, 1)}
                  </NumCell>

                  {/* Weight % change */}
                  <NumCell muted={week.avgWeightPct == null}>
                    {week.avgWeightPct != null
                      ? `${week.avgWeightPct > 0 ? "+" : ""}${week.avgWeightPct.toFixed(2)}%`
                      : "—"}
                  </NumCell>

                  {/* Waist */}
                  <NumCell muted={week.avgWaist == null}>
                    {fmt(week.avgWaist, 1)}
                  </NumCell>

                  {/* Sessions */}
                  <NumCell muted={!hasData} borderLeft>
                    {week.sessionsCompleted}
                  </NumCell>

                  {/* Off-Plan */}
                  <NumCell muted={week.totalOffPlan == null} borderLeft>
                    {week.totalOffPlan != null ? week.totalOffPlan : "—"}
                  </NumCell>

                  {/* Caffeine */}
                  <NumCell muted={week.avgCaffeine == null}>
                    {fmt(week.avgCaffeine, 1)}
                  </NumCell>

                  {/* Hunger */}
                  <NumCell muted={week.avgHunger == null} borderLeft>
                    {fmt(week.avgHunger, 1)}
                  </NumCell>

                  {/* Sleep Quality */}
                  <NumCell muted={week.avgSleepQuality == null}>
                    {fmt(week.avgSleepQuality, 1)}
                  </NumCell>

                  {/* Sleep Hours */}
                  <NumCell muted={week.avgSleepHours == null}>
                    {fmt(week.avgSleepHours, 1)}
                  </NumCell>

                  {/* Avg Steps */}
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums whitespace-nowrap border-l border-border/30">
                    <span className={week.avgSteps != null ? "text-foreground" : "text-muted-foreground"}>
                      {week.avgSteps != null ? Math.round(week.avgSteps).toLocaleString() : "—"}
                    </span>
                    {week.stepGoal != null && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        goal {week.stepGoal.toLocaleString()}
                      </div>
                    )}
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
