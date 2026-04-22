import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

interface Props {
  clientId: number;
}

type Week = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isInProgress: boolean;
  daysLogged: number;
  avgWeight: number | null;
  avgWaist: number | null;
  avgSkinfold: number | null;
  trainingAdherence: number | null;
  trainedDays: number;
  sessionsCompleted: number;
  totalOffPlan: number | null;
  avgCaffeine: number | null;
  habitAdherence: number | null;
  avgHunger: number | null;
  avgSleepQuality: number | null;
  avgSleepHours: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
};

const DEFAULT_VISIBLE = 8;

function fmt(val: number | null | undefined, decimals = 1, suffix = ""): string {
  if (val == null) return "—";
  return `${val.toFixed(decimals)}${suffix}`;
}

function fmtInt(val: number | null | undefined, suffix = ""): string {
  if (val == null) return "—";
  return `${Math.round(val).toLocaleString()}${suffix}`;
}

function deltaStr(curr: number | null, prev: number | null, decimals = 1, suffix = ""): string | null {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(decimals)}${suffix}`;
}

function deltaClass(curr: number | null, prev: number | null, higherIsBetter = true): string {
  if (curr == null || prev == null) return "text-muted-foreground";
  const d = curr - prev;
  if (Math.abs(d) < 0.001) return "text-muted-foreground";
  const improved = higherIsBetter ? d > 0 : d < 0;
  return improved ? "text-green-400" : "text-red-400";
}

interface MetricRowProps {
  label: string;
  value: string;
  delta?: string | null;
  deltaGood?: boolean | null;
}

function MetricRow({ label, value, delta, deltaGood }: MetricRowProps) {
  const deltaColor =
    delta == null
      ? ""
      : deltaGood === true
      ? "text-green-400"
      : deltaGood === false
      ? "text-red-400"
      : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-1 text-sm border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        {value}
        {delta && (
          <span className={`text-xs ${deltaColor}`}>{delta}</span>
        )}
      </span>
    </div>
  );
}

interface ExpandedRowProps {
  week: Week;
  prev: Week | null;
}

function ExpandedRow({ week, prev }: ExpandedRowProps) {
  const w = week;
  const p = prev;

  const weightDelta = deltaStr(w.avgWeight, p?.avgWeight ?? null);
  const weightGood = w.avgWeight != null && p?.avgWeight != null
    ? null // neutral — weight direction depends on goal
    : null;

  const waistDelta = deltaStr(w.avgWaist, p?.avgWaist ?? null);
  const waistGood = w.avgWaist != null && p?.avgWaist != null
    ? w.avgWaist < p.avgWaist
    : null;

  const skinfoldDelta = deltaStr(w.avgSkinfold, p?.avgSkinfold ?? null);
  const skinfoldGood = w.avgSkinfold != null && p?.avgSkinfold != null
    ? w.avgSkinfold < p.avgSkinfold
    : null;

  const adherenceDelta = deltaStr(w.trainingAdherence, p?.trainingAdherence ?? null, 0, "%");
  const adherenceGood = w.trainingAdherence != null && p?.trainingAdherence != null
    ? w.trainingAdherence >= p.trainingAdherence
    : null;

  const habitDelta = deltaStr(w.habitAdherence, p?.habitAdherence ?? null, 0, "%");
  const habitGood = w.habitAdherence != null && p?.habitAdherence != null
    ? w.habitAdherence >= p.habitAdherence
    : null;

  const hungerDelta = deltaStr(w.avgHunger, p?.avgHunger ?? null);
  const hungerGood = w.avgHunger != null && p?.avgHunger != null
    ? w.avgHunger <= p.avgHunger
    : null;

  const sleepQualityDelta = deltaStr(w.avgSleepQuality, p?.avgSleepQuality ?? null);
  const sleepQualityGood = w.avgSleepQuality != null && p?.avgSleepQuality != null
    ? w.avgSleepQuality >= p.avgSleepQuality
    : null;

  const sleepHoursDelta = deltaStr(w.avgSleepHours, p?.avgSleepHours ?? null);
  const sleepHoursGood = w.avgSleepHours != null && p?.avgSleepHours != null
    ? w.avgSleepHours >= p.avgSleepHours
    : null;

  const stepsDelta = deltaStr(w.avgSteps, p?.avgSteps ?? null, 0);
  const stepsGood = w.avgSteps != null && p?.avgSteps != null
    ? w.avgSteps >= p.avgSteps
    : null;

  return (
    <div className="px-4 pb-4 pt-2 bg-muted/20 border-t border-border/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-0">
        {/* Body Composition */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">Body Composition</p>
          <MetricRow
            label="Avg Weight"
            value={fmt(w.avgWeight, 1, " kg")}
            delta={weightDelta ?? undefined}
            deltaGood={weightGood}
          />
          <MetricRow
            label="Avg Waist"
            value={fmt(w.avgWaist, 1, " cm")}
            delta={waistDelta ?? undefined}
            deltaGood={waistGood}
          />
          <MetricRow
            label="Avg Skinfold"
            value={fmt(w.avgSkinfold, 1, " mm")}
            delta={skinfoldDelta ?? undefined}
            deltaGood={skinfoldGood}
          />
        </div>

        {/* Training */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">Training</p>
          <MetricRow
            label="Adherence"
            value={w.trainingAdherence != null ? `${w.trainingAdherence}%` : "—"}
            delta={adherenceDelta ?? undefined}
            deltaGood={adherenceGood}
          />
          <MetricRow
            label="Trained Days"
            value={`${w.trainedDays} / ${w.daysLogged}`}
          />
          <MetricRow
            label="Sessions Logged"
            value={fmtInt(w.sessionsCompleted)}
          />
        </div>

        {/* Nutrition & Habits */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">Nutrition & Habits</p>
          <MetricRow
            label="Off-Plan Meals"
            value={w.totalOffPlan != null ? String(w.totalOffPlan) : "—"}
          />
          <MetricRow
            label="Avg Caffeine"
            value={fmt(w.avgCaffeine, 1, " srv")}
          />
          <MetricRow
            label="Habit Adherence"
            value={w.habitAdherence != null ? `${w.habitAdherence}%` : "—"}
            delta={habitDelta ?? undefined}
            deltaGood={habitGood}
          />
        </div>

        {/* Recovery & Activity */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-2">Recovery & Activity</p>
          <MetricRow
            label="Avg Hunger"
            value={fmt(w.avgHunger, 1, "/5")}
            delta={hungerDelta ?? undefined}
            deltaGood={hungerGood}
          />
          <MetricRow
            label="Sleep Quality"
            value={fmt(w.avgSleepQuality, 1, "/5")}
            delta={sleepQualityDelta ?? undefined}
            deltaGood={sleepQualityGood}
          />
          <MetricRow
            label="Sleep Hours"
            value={fmt(w.avgSleepHours, 1, " hrs")}
            delta={sleepHoursDelta ?? undefined}
            deltaGood={sleepHoursGood}
          />
          <MetricRow
            label="Avg Steps"
            value={w.avgSteps != null ? Math.round(w.avgSteps).toLocaleString() : "—"}
            delta={stepsDelta ?? undefined}
            deltaGood={stepsGood}
          />
          {w.stepGoal != null && (
            <div className="text-xs text-muted-foreground mt-0.5 text-right">
              Goal: {w.stepGoal.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WeeklyReviewTab({ clientId }: Props) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  function toggleWeek(weekStart: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekStart)) {
        next.delete(weekStart);
      } else {
        next.add(weekStart);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-muted rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
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
    <div className="mt-4">
      <div className="rounded-lg border border-border overflow-hidden">
        {visibleWeeks.map((week, idx) => {
          const isExpanded = expandedWeeks.has(week.weekStart);
          // prev = next item in the array (older week, since weeks are newest-first)
          const prevWeek = weeks[idx + 1] ?? null;
          const hasData = week.daysLogged > 0;

          return (
            <div key={week.weekStart} className="border-b border-border last:border-0">
              {/* Row header */}
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${week.isInProgress ? "bg-muted/10" : ""}`}
                onClick={() => toggleWeek(week.weekStart)}
                disabled={!hasData}
              >
                <span className="text-muted-foreground">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>

                <span className="flex-1 font-medium text-sm">{week.label}</span>

                {week.isInProgress && (
                  <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400 bg-amber-500/10">
                    In progress
                  </Badge>
                )}

                {/* Quick summary: weight + adherence */}
                <span className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  {week.avgWeight != null && (
                    <span>
                      {week.avgWeight.toFixed(1)} kg
                      {prevWeek?.avgWeight != null && (() => {
                        const d = week.avgWeight! - prevWeek.avgWeight!;
                        const sign = d > 0 ? "+" : "";
                        return (
                          <span className={`ml-1 text-xs ${d < 0 ? "text-green-400" : d > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            ({sign}{d.toFixed(1)})
                          </span>
                        );
                      })()}
                    </span>
                  )}
                  {week.trainingAdherence != null && (
                    <span>{week.trainingAdherence}% adherence</span>
                  )}
                  {!hasData && (
                    <span className="italic text-xs">No data</span>
                  )}
                </span>

                <span className="text-xs text-muted-foreground">
                  {hasData ? `${week.daysLogged} day${week.daysLogged !== 1 ? "s" : ""} logged` : "No data"}
                </span>
              </button>

              {/* Expanded detail */}
              {isExpanded && hasData && (
                <ExpandedRow week={week} prev={prevWeek} />
              )}
            </div>
          );
        })}
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
            {showAll ? `Show less` : `Show all ${weeks.length} weeks`}
          </Button>
        </div>
      )}
    </div>
  );
}
