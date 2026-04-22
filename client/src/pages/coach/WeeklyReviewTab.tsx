import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  clientId: number;
  onWeekClick?: (weekNumber: number) => void;
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

// ─── ValueDeltaCell: value + inline delta (small, coloured) ─────────────────

interface ValueDeltaCellProps {
  value: number | null;
  delta?: number | null;        // raw numeric delta (curr - prev)
  deltaText?: string;           // override formatted delta string
  decimals?: number;
  higherIsBetter?: boolean | null; // null = neutral (no colour)
  borderLeft?: boolean;
}

function ValueDeltaCell({
  value,
  delta,
  deltaText,
  decimals = 1,
  higherIsBetter = null,
  borderLeft,
}: ValueDeltaCellProps) {
  const valueStr = value != null ? value.toFixed(decimals) : "—";

  let deltaStr: string | null = null;
  let deltaColor = "text-muted-foreground";

  if (delta != null) {
    deltaStr = deltaText ?? `${delta > 0 ? "+" : ""}${delta.toFixed(decimals)}`;
    if (higherIsBetter === true) {
      deltaColor = delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
    } else if (higherIsBetter === false) {
      deltaColor = delta < 0 ? "text-green-400" : delta > 0 ? "text-red-400" : "text-muted-foreground";
    }
  }

  return (
    <td
      className={`px-3 py-2.5 text-right text-sm tabular-nums whitespace-nowrap
        ${borderLeft ? "border-l border-border/30" : ""}
      `}
    >
      <span className={value == null ? "text-muted-foreground" : "text-foreground"}>
        {valueStr}
      </span>
      {/* Always render delta span so cell width is consistent across all rows */}
      <span
        className={`inline-block ml-1.5 text-[11px] min-w-[3.5rem] text-right ${
          deltaStr ? deltaColor : "invisible"
        }`}
      >
        {deltaStr ?? "—"}
      </span>
    </td>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function WeeklyReviewTab({ clientId, onWeekClick }: Props) {
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
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Weight (kg)</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Waist (cm)</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Skinfold (mm)</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Sessions</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Off-Plan</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Hunger /5</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Sleep Qual /5</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Sleep Hrs</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Caffeine (srv)</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Steps</th>
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week, idx) => {
              const hasData = week.daysLogged > 0;
              const isEven = idx % 2 === 0;

              const prev: Week | null = weeks[idx + 1] ?? null;
              const d = (curr: number | null, p: number | null) =>
                curr != null && p != null ? curr - p : null;

              const stepsValue = week.avgSteps != null
                ? (week.stepGoal != null
                  ? `${fmtK(Math.round(week.avgSteps))} / ${fmtK(week.stepGoal)}`
                  : fmtK(Math.round(week.avgSteps)))
                : "—";

              return (
                <tr
                  key={week.weekStart}
                  onClick={onWeekClick ? () => onWeekClick(week.weekNumber) : undefined}
                  className={`border-b border-border/50 last:border-0 transition-colors ${
                    onWeekClick ? "cursor-pointer" : ""
                  } ${
                    week.isInProgress
                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                      : !hasData
                      ? "opacity-40"
                      : isEven
                      ? "hover:bg-muted/30"
                      : "bg-muted/10 hover:bg-muted/20"
                  }`}
                >
                  {/* Week label — sticky left */}
                  <td className={`px-3 py-2.5 sticky left-0 z-10 ${week.isInProgress ? "bg-amber-500/5" : !hasData ? "bg-card" : isEven ? "bg-card" : "bg-muted/10"}`}>
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
                  <ValueDeltaCell
                    value={week.avgWeight}
                    delta={week.avgWeightPct}
                    deltaText={week.avgWeightPct != null ? `${week.avgWeightPct > 0 ? "+" : ""}${week.avgWeightPct.toFixed(2)}%` : undefined}
                    higherIsBetter={null}
                    borderLeft
                  />

                  {/* Waist */}
                  <ValueDeltaCell
                    value={week.avgWaist}
                    delta={d(week.avgWaist, prev?.avgWaist ?? null)}
                    higherIsBetter={false}
                  />

                  {/* Skinfold */}
                  <ValueDeltaCell
                    value={week.avgSkinfold}
                    delta={d(week.avgSkinfold, prev?.avgSkinfold ?? null)}
                    higherIsBetter={false}
                  />

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
