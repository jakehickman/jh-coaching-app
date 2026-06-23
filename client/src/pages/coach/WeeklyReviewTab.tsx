import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";

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
  avgWeight: number | null;
  avgWeightPct: number | null;
  avgWaist: number | null;
  avgSkinfold: number | null;
  sessionsCompleted: number;
  avgCaffeine: number | null;
  avgHunger: number | null;
  avgSleepQuality: number | null;
  avgSleepHours: number | null;
  avgStress?: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
  mealLogCount?: number | null;
  mealLogTreats?: number | null;
  weighIns?: { logDate: string; weight: number }[];
};

const DEFAULT_VISIBLE = 4;
const EXPAND_STEP = 4;

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

function WeekRow({ week, prev, isExpanded, onToggle }: {
  week: Week;
  prev: Week | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasData = week.daysLogged > 0 || (week.weighIns?.length ?? 0) > 0 || week.sessionsCompleted > 0;

  const weightDeltaPct = week.avgWeightPct;

  const stepsVal = week.avgSteps != null ? fmtK(Math.round(week.avgSteps)) : "—";
  const stepsGoal = week.stepGoal != null ? `/${fmtK(week.stepGoal)}` : "";

  return (
    <>
      {/* Summary row */}
      <tr
        className={`border-b border-border/40 transition-colors ${
          week.isInProgress
            ? "bg-amber-500/5"
            : hasData
            ? "hover:bg-muted/20 cursor-pointer"
            : "opacity-40"
        }`}
        onClick={() => hasData && onToggle()}
      >
        {/* Week label */}
        <td className="px-3 py-2.5 min-w-[140px]">
          <div className="flex items-center gap-1.5">
            {hasData ? (
              isExpanded
                ? <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                : <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
            ) : (
              <span className="w-3" />
            )}
            <div>
              <span className="text-xs font-semibold text-foreground">{week.label}</span>
              {week.isInProgress && (
                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Days logged */}
        <td className="px-3 py-2.5 text-center">
          <span className={`text-xs tabular-nums ${hasData ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {hasData ? `${week.daysLogged}/7` : "—"}
          </span>
        </td>

        {/* Avg weight */}
        <td className="px-3 py-2.5 text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {week.avgWeight != null ? `${fmt(week.avgWeight)} kg` : "—"}
            </span>
            {weightDeltaPct != null && (
              <span className={`text-[10px] font-semibold ${
                weightDeltaPct < 0 ? "text-green-400" : weightDeltaPct > 0 ? "text-red-400" : "text-muted-foreground"
              }`}>
                {weightDeltaPct > 0 ? "+" : ""}{weightDeltaPct.toFixed(2)}%
              </span>
            )}
          </div>
        </td>

        {/* Avg steps */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {stepsVal}{stepsGoal && <span className="text-muted-foreground">{stepsGoal}</span>}
          </span>
        </td>

        {/* Meals logged */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {week.mealLogCount != null && week.mealLogCount > 0 ? week.mealLogCount : "—"}
          </span>
        </td>

        {/* Treats */}
        <td className="px-3 py-2.5 text-right">
          <span className={`text-xs tabular-nums ${(week.mealLogTreats ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
            {week.mealLogTreats != null && week.mealLogTreats > 0 ? week.mealLogTreats : "—"}
          </span>
        </td>

        {/* Sleep (hours) */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgSleepHours != null ? `${fmt(week.avgSleepHours)} h` : "—"}
          </span>
        </td>

        {/* Sessions */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {week.sessionsCompleted > 0 ? week.sessionsCompleted : "—"}
          </span>
        </td>
      </tr>

      {/* Expanded daily weigh-ins */}
      {isExpanded && hasData && (
        <tr className="border-b border-border/40 bg-muted/10">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Daily weigh-ins */}
              {(week.weighIns ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Daily Weigh-ins</p>
                  <div className="space-y-0">
                    {[...(week.weighIns ?? [])].sort((a, b) => a.logDate.localeCompare(b.logDate)).map((wi) => {
                      const d = new Date(wi.logDate + "T00:00:00");
                      const label = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <div key={wi.logDate} className="flex items-center py-1 border-b border-border/30 last:border-0">
                          <span className="text-xs text-muted-foreground flex-1">{label}</span>
                          <span className="text-xs font-medium tabular-nums">{wi.weight.toFixed(1)} kg</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recovery detail */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recovery</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {week.avgSleepQuality != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Sleep quality</span>
                      <span className="text-[11px] font-medium tabular-nums">{fmt(week.avgSleepQuality)}/5</span>
                    </div>
                  )}
                  {week.avgStress != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Stress</span>
                      <span className="text-[11px] font-medium tabular-nums">{fmt(week.avgStress)}/5</span>
                    </div>
                  )}
                  {week.avgCaffeine != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Caffeine</span>
                      <span className="text-[11px] font-medium tabular-nums">{fmt(week.avgCaffeine)} srv</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function WeeklyReviewTab({ clientId, onWeekClick }: Props) {
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = (data?.weeks ?? []) as Week[];

  // Auto-expand the current in-progress week
  useEffect(() => {
    if (weeks.length === 0) return;
    const inProgress = weeks.find(w => w.isInProgress);
    if (inProgress) {
      setExpanded(new Set([inProgress.weekStart]));
    }
  }, [weeks.length]);

  function toggleRow(weekStart: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(weekStart)) next.delete(weekStart);
      else next.add(weekStart);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-muted rounded" />
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

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-base font-medium">No data logged yet for this client</p>
        <p className="text-sm mt-1">Weekly summaries will appear once the client starts logging.</p>
      </div>
    );
  }

  const visibleWeeks = weeks.slice(0, visibleCount);
  const remaining = weeks.length - visibleCount;
  const nextBatch = Math.min(EXPAND_STEP, remaining);

  return (
    <div className="mt-2">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[140px]">Week</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Days</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Weight</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Steps</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meals</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Treats</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sleep</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {visibleWeeks.map((week, idx) => (
                <WeekRow
                  key={week.weekStart}
                  week={week}
                  prev={(weeks[idx + 1] as Week) ?? null}
                  isExpanded={expanded.has(week.weekStart)}
                  onToggle={() => toggleRow(week.weekStart)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {remaining > 0 && (
        <div className="flex justify-center mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount(v => v + EXPAND_STEP)}
            className="text-muted-foreground hover:text-foreground"
          >
            Show {nextBatch} more {nextBatch === 1 ? "week" : "weeks"} ({remaining} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
