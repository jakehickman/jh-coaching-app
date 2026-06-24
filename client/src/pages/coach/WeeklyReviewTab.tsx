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

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

// ── Delta arrow ──────────────────────────────────────────────────────────────
function DeltaArrow({
  current,
  previous,
  lowerIsBetter = false,
}: {
  current: number | null | undefined;
  previous: number | null | undefined;
  lowerIsBetter?: boolean;
}) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return <Minus className="inline w-3 h-3 text-muted-foreground ml-1" />;
  const positive = diff > 0;
  const good = lowerIsBetter ? !positive : positive;
  return positive
    ? <ArrowUp className={`inline w-3 h-3 ml-1 ${good ? "text-green-400" : "text-red-400"}`} />
    : <ArrowDown className={`inline w-3 h-3 ml-1 ${good ? "text-green-400" : "text-red-400"}`} />;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? "bg-green-500/10 border-green-500/20" : "bg-card border-border"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
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
            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
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
          {stepsVal != null ? <>{stepsVal}{stepsGoal && <span className="text-muted-foreground">{stepsGoal}</span>}</> : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.mealLogCount != null && week.mealLogCount > 0 ? week.mealLogCount : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className={`text-xs tabular-nums ${(week.mealLogTreats ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
          {week.mealLogTreats != null && week.mealLogTreats > 0 ? week.mealLogTreats : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {week.avgSleepHours != null ? `${fmt(week.avgSleepHours)} h` : "—"}
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

// ── Main component ────────────────────────────────────────────────────────────
export function WeeklyReviewTab({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [days, setDays] = useState<7 | 30>(7);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = (data?.weeks ?? []) as Week[];

  // ── Aggregate current and previous periods from weekly data ──────────────
  const { cur, prev } = useMemo(() => {
    // weeks[0] = most recent (current) week, weeks[1] = previous, etc.
    // For 7d: use weeks[0] vs weeks[1]
    // For 30d: aggregate weeks[0..3] vs weeks[4..7]
    const weeksNeeded = days === 7 ? 1 : Math.ceil(days / 7);
    const curWeeks = weeks.slice(0, weeksNeeded);
    const prevWeeks = weeks.slice(weeksNeeded, weeksNeeded * 2);

    function aggAvg(arr: Week[], key: keyof Week): number | null {
      const vals = arr.map(w => w[key] as number | null | undefined).filter((v): v is number => v != null);
      return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    }
    function aggSum(arr: Week[], key: keyof Week): number | null {
      const vals = arr.map(w => w[key] as number | null | undefined).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }

    return {
      cur: {
        avgWeight: aggAvg(curWeeks, "avgWeight"),
        avgSleepHours: aggAvg(curWeeks, "avgSleepHours"),
        avgSleepQuality: aggAvg(curWeeks, "avgSleepQuality"),
        avgStress: aggAvg(curWeeks, "avgStress"),
        avgSteps: aggAvg(curWeeks, "avgSteps"),
        sessionsCompleted: aggSum(curWeeks, "sessionsCompleted"),
        mealLogCount: aggSum(curWeeks, "mealLogCount"),
        mealLogTreats: aggSum(curWeeks, "mealLogTreats"),
        mealLogIdealZonePct: aggAvg(curWeeks, "mealLogIdealZonePct"),
        stepGoal: curWeeks[0]?.stepGoal ?? null,
      },
      prev: {
        avgWeight: aggAvg(prevWeeks, "avgWeight"),
        avgSleepHours: aggAvg(prevWeeks, "avgSleepHours"),
        avgSleepQuality: aggAvg(prevWeeks, "avgSleepQuality"),
        avgStress: aggAvg(prevWeeks, "avgStress"),
        avgSteps: aggAvg(prevWeeks, "avgSteps"),
        sessionsCompleted: aggSum(prevWeeks, "sessionsCompleted"),
        mealLogCount: aggSum(prevWeeks, "mealLogCount"),
        mealLogTreats: aggSum(prevWeeks, "mealLogTreats"),
        mealLogIdealZonePct: aggAvg(prevWeeks, "mealLogIdealZonePct"),
      },
    };
  }, [weeks, days]);

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
  const periodLabel = `vs prev ${days}d`;

  return (
    <div className="space-y-6">
      {/* ── Toggle ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Overview</h3>
        <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
          {([7, 30] as const).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                days === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Weight */}
        {cur.avgWeight != null && (
          <StatCard
            label="Avg Weight"
            value={<>{cur.avgWeight} kg<DeltaArrow current={cur.avgWeight} previous={prev.avgWeight} lowerIsBetter /></>}
            sub={prev.avgWeight != null ? `${periodLabel}: ${prev.avgWeight} kg` : undefined}
          />
        )}
        {/* Training sessions */}
        {cur.sessionsCompleted != null && (
          <StatCard
            label="Sessions"
            value={<>{cur.sessionsCompleted}<DeltaArrow current={cur.sessionsCompleted} previous={prev.sessionsCompleted} /></>}
            sub={prev.sessionsCompleted != null ? `${periodLabel}: ${prev.sessionsCompleted}` : undefined}
          />
        )}
        {/* Steps */}
        {cur.avgSteps != null && (
          <StatCard
            label="Avg Steps"
            value={<>{fmtK(Math.round(cur.avgSteps))}<DeltaArrow current={cur.avgSteps} previous={prev.avgSteps} /></>}
            sub={cur.stepGoal != null ? `Goal: ${fmtK(cur.stepGoal)}` : prev.avgSteps != null ? `${periodLabel}: ${fmtK(Math.round(prev.avgSteps))}` : undefined}
          />
        )}
        {/* Sleep hours */}
        {cur.avgSleepHours != null && (
          <StatCard
            label="Avg Sleep"
            value={<>{fmt(cur.avgSleepHours)} h<DeltaArrow current={cur.avgSleepHours} previous={prev.avgSleepHours} /></>}
            sub={prev.avgSleepHours != null ? `${periodLabel}: ${fmt(prev.avgSleepHours)} h` : undefined}
          />
        )}
        {/* Sleep quality */}
        {cur.avgSleepQuality != null && (
          <StatCard
            label="Sleep Quality"
            value={<>{fmt(cur.avgSleepQuality)}/5<DeltaArrow current={cur.avgSleepQuality} previous={prev.avgSleepQuality} /></>}
            sub={prev.avgSleepQuality != null ? `${periodLabel}: ${fmt(prev.avgSleepQuality)}/5` : undefined}
          />
        )}
        {/* Stress */}
        {cur.avgStress != null && (
          <StatCard
            label="Avg Stress"
            value={<>{fmt(cur.avgStress)}/5<DeltaArrow current={cur.avgStress} previous={prev.avgStress} lowerIsBetter /></>}
            sub={prev.avgStress != null ? `${periodLabel}: ${fmt(prev.avgStress)}/5` : undefined}
          />
        )}

      </div>

      {/* ── Weekly table ── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weekly History</h3>
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
    </div>
  );
}
