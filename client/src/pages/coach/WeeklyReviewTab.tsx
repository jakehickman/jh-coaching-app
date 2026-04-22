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

function fmt(val: number | null | undefined, decimals = 1, suffix = ""): string {
  if (val == null) return "—";
  return `${val.toFixed(decimals)}${suffix}`;
}

function fmtInt(val: number | null | undefined, suffix = ""): string {
  if (val == null) return "—";
  return `${Math.round(val).toLocaleString()}${suffix}`;
}

// ─── Delta chip ──────────────────────────────────────────────────────────────

interface DeltaChipProps {
  curr: number | null;
  prev: number | null;
  /** Format the delta value for display */
  format?: (d: number) => string;
  /** true = higher is better, false = lower is better, null = neutral */
  higherIsBetter?: boolean | null;
}

function DeltaChip({ curr, prev, format, higherIsBetter = null }: DeltaChipProps) {
  if (curr == null || prev == null) return null;
  const d = curr - prev;

  // Zero change — show a neutral dash for consistency
  if (Math.abs(d) < 0.001) {
    return (
      <span className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded text-muted-foreground bg-muted/40">
        –
      </span>
    );
  }

  const sign = d > 0 ? "+" : "";
  const text = format ? format(d) : `${sign}${d.toFixed(1)}`;

  let colorClass = "text-muted-foreground bg-muted/40";
  if (higherIsBetter === true) {
    colorClass = d > 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10";
  } else if (higherIsBetter === false) {
    colorClass = d < 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10";
  }

  return (
    <span className={`ml-1 text-[10px] font-semibold px-1 py-0.5 rounded ${colorClass}`}>
      {text}
    </span>
  );
}

// ─── Cell ────────────────────────────────────────────────────────────────────

interface CellProps {
  value: string;
  chip?: React.ReactNode;
  muted?: boolean;
  center?: boolean;
}

function Cell({ value, chip, muted, center }: CellProps) {
  return (
    <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${center ? "text-center" : "text-right"} ${muted ? "text-muted-foreground" : "text-foreground"}`}>
      <span className="inline-flex items-center gap-0.5">
        {value}
        {chip}
      </span>
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
      {/* Horizontally scrollable table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {/* Week column */}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/30 z-10 min-w-[160px]">
                Week
              </th>
              {/* Body Composition group */}
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Body Composition
              </th>
              {/* Training */}
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Training
              </th>
              {/* Nutrition */}
              <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Nutrition
              </th>
              {/* Recovery */}
              <th colSpan={3} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Recovery
              </th>
              {/* Activity */}
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/50">
                Activity
              </th>
            </tr>
            <tr className="border-b border-border bg-muted/10">
              <th className="px-3 py-1.5 text-left text-[11px] text-muted-foreground sticky left-0 bg-muted/10 z-10"></th>
              {/* Body Composition sub-headers */}
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Avg Wt (kg)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Waist (cm)</th>
              <th className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">Skinfold (mm)</th>
              {/* Training */}
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Sessions</th>
              {/* Nutrition */}
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Off-Plan</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Caffeine (srv)</th>
              {/* Recovery */}
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Hunger /5</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Sleep Qual /5</th>
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">Sleep Hrs</th>
              {/* Activity */}
              <th className="px-3 py-1.5 text-center text-[11px] text-muted-foreground border-l border-border/50 whitespace-nowrap">Avg Steps</th>
            </tr>
          </thead>
          <tbody>
            {visibleWeeks.map((week, idx) => {
              const prev: Week | null = weeks[idx + 1] ?? null;
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
                  <td className="px-3 py-2.5 text-right text-sm whitespace-nowrap border-l border-border/30">
                    <span className="inline-flex items-center gap-0.5 justify-end">
                      <span className={hasData && week.avgWeight != null ? "text-foreground" : "text-muted-foreground"}>
                        {fmt(week.avgWeight, 1)}
                      </span>
                      {week.avgWeightPct != null && (() => {
                        const pct = week.avgWeightPct;
                        const sign = pct > 0 ? "+" : "";
                        // neutral — weight direction depends on goal, no colour
                        return (
                          <span className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded text-muted-foreground bg-muted/40">
                            {sign}{pct.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </span>
                  </td>

                  {/* Waist */}
                  <td className="px-3 py-2.5 text-right text-sm whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5 justify-end">
                      <span className={week.avgWaist != null ? "text-foreground" : "text-muted-foreground"}>
                        {fmt(week.avgWaist, 1)}
                      </span>
                      <DeltaChip
                        curr={week.avgWaist}
                        prev={prev?.avgWaist ?? null}
                        format={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                        higherIsBetter={false}
                      />
                    </span>
                  </td>

                  {/* Skinfold */}
                  <td className="px-3 py-2.5 text-right text-sm whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5 justify-end">
                      <span className={week.avgSkinfold != null ? "text-foreground" : "text-muted-foreground"}>
                        {fmt(week.avgSkinfold, 1)}
                      </span>
                      <DeltaChip
                        curr={week.avgSkinfold}
                        prev={prev?.avgSkinfold ?? null}
                        format={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                        higherIsBetter={false}
                      />
                    </span>
                  </td>

                  {/* Sessions */}
                  <Cell
                    center
                    value={String(week.sessionsCompleted)}
                    muted={!hasData}
                    chip={
                      prev != null ? (
                        <DeltaChip
                          curr={week.sessionsCompleted}
                          prev={prev.sessionsCompleted}
                          format={(d) => `${d > 0 ? "+" : ""}${Math.round(d)}`}
                          higherIsBetter={true}
                        />
                      ) : undefined
                    }
                  />

                  {/* Off-Plan Meals */}
                  <Cell
                    center
                    value={week.totalOffPlan != null ? String(week.totalOffPlan) : "—"}
                    muted={!hasData}
                    chip={
                      prev != null ? (
                        <DeltaChip
                          curr={week.totalOffPlan}
                          prev={prev.totalOffPlan}
                          format={(d) => `${d > 0 ? "+" : ""}${Math.round(d)}`}
                          higherIsBetter={false}
                        />
                      ) : undefined
                    }
                  />

                  {/* Caffeine */}
                  <Cell
                    center
                    value={fmt(week.avgCaffeine, 1)}
                    muted={!hasData}
                  />

                  {/* Hunger */}
                  <Cell
                    center
                    value={fmt(week.avgHunger, 1)}
                    muted={!hasData}
                    chip={
                      prev != null ? (
                        <DeltaChip
                          curr={week.avgHunger}
                          prev={prev.avgHunger}
                          format={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                          higherIsBetter={false}
                        />
                      ) : undefined
                    }
                  />

                  {/* Sleep Quality */}
                  <Cell
                    center
                    value={fmt(week.avgSleepQuality, 1)}
                    muted={!hasData}
                    chip={
                      prev != null ? (
                        <DeltaChip
                          curr={week.avgSleepQuality}
                          prev={prev.avgSleepQuality}
                          format={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                          higherIsBetter={true}
                        />
                      ) : undefined
                    }
                  />

                  {/* Sleep Hours */}
                  <Cell
                    center
                    value={fmt(week.avgSleepHours, 1)}
                    muted={!hasData}
                    chip={
                      prev != null ? (
                        <DeltaChip
                          curr={week.avgSleepHours}
                          prev={prev.avgSleepHours}
                          format={(d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                          higherIsBetter={true}
                        />
                      ) : undefined
                    }
                  />

                  {/* Avg Steps */}
                  <td className="px-3 py-2.5 text-center text-sm whitespace-nowrap border-l border-border/30">
                    <span className="inline-flex items-center gap-0.5 justify-center">
                      <span className={week.avgSteps != null ? "text-foreground" : "text-muted-foreground"}>
                        {week.avgSteps != null ? Math.round(week.avgSteps).toLocaleString() : "—"}
                      </span>
                      {prev != null && (
                        <DeltaChip
                          curr={week.avgSteps}
                          prev={prev.avgSteps}
                          format={(d) => `${d > 0 ? "+" : ""}${Math.round(d).toLocaleString()}`}
                          higherIsBetter={true}
                        />
                      )}
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
