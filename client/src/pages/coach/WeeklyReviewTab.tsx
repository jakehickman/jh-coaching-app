import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

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
  mealLogCount?: number | null;
  mealLogTreats?: number | null;
};

const DEFAULT_VISIBLE = 4;

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

function WeekRow({ week }: { week: Week }) {
  const hasData = week.daysLogged > 0 || week.sessionsCompleted > 0;
  const stepsVal = week.avgSteps != null ? fmtK(Math.round(week.avgSteps)) : null;
  const stepsGoal = (week.stepGoal != null && stepsVal != null) ? `/${fmtK(week.stepGoal)}` : "";

  return (
    <tr
      className={`border-b border-border/40 transition-colors ${
        week.isInProgress
          ? "bg-amber-500/5"
          : !hasData
          ? "opacity-40"
          : ""
      }`}
    >
      {/* Week label */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
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

      {/* Avg steps */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {stepsVal != null ? <>{stepsVal}{stepsGoal && <span className="text-muted-foreground">{stepsGoal}</span>}</> : "—"}
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

      {/* Sleep hours */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.avgSleepHours != null ? `${fmt(week.avgSleepHours)} h` : "—"}
        </span>
      </td>

      {/* Sleep quality */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.avgSleepQuality != null ? `${fmt(week.avgSleepQuality)}/5` : "—"}
        </span>
      </td>

      {/* Stress */}
      <td className="px-3 py-2.5 text-right">
        <span className={`text-xs tabular-nums ${
          week.avgStress != null && week.avgStress >= 4
            ? "text-red-400"
            : week.avgStress != null && week.avgStress >= 3
            ? "text-amber-400"
            : "text-foreground"
        }`}>
          {week.avgStress != null ? `${fmt(week.avgStress)}/5` : "—"}
        </span>
      </td>

      {/* Sessions */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.sessionsCompleted > 0 ? week.sessionsCompleted : "—"}
        </span>
      </td>
    </tr>
  );
}

export function WeeklyReviewTab({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = (data?.weeks ?? []) as Week[];

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

  const visibleWeeks = showAll ? weeks : weeks.slice(0, DEFAULT_VISIBLE);
  const hasMore = weeks.length > DEFAULT_VISIBLE;

  return (
    <div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[24%]">Week</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[9%]">Days</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">Steps</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[9%]">Meals</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[9%]">Treats</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">Sleep</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">Quality</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">Stress</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">Sessions</th>
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
  );
}
