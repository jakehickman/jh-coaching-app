import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyPeriod {
  weekNum: number;
  label: string;
  dateRange: string;
  startIso: string;
  endIso: string;
  isCurrentWeek: boolean;
  avgWeight: number | null;
  weightEntries: number;
  waist: number | null;
  skinfold: number | null;
  trainingAdherence: number | null;
  trainingSessions: number;
  prescribedSessions: number | null;
  offPlanMeals: number;
  avgCaffeine: number | null;
  habitAdherence: number | null;
  avgHunger: number | null;
  avgSleepQuality: number | null;
  avgSleepHours: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
  delta: {
    avgWeight: number | null;
    avgWeightPct: number | null;
    waist: number | null;
    skinfold: number | null;
    trainingAdherence: number | null;
    offPlanMeals: number | null;
    avgCaffeine: number | null;
    habitAdherence: number | null;
    avgHunger: number | null;
    avgSleepQuality: number | null;
    avgSleepHours: number | null;
    avgSteps: number | null;
  };
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function Delta({
  value,
  unit = "",
  lowerIsBetter = false,
}: {
  value: number | null;
  unit?: string;
  lowerIsBetter?: boolean;
}) {
  if (value == null || value === 0) return null;
  const positive = value > 0;
  const good = lowerIsBetter ? !positive : positive;
  const sign = positive ? "+" : "";
  return (
    <span className={`text-xs font-medium ml-1 ${good ? "text-emerald-500" : "text-rose-400"}`}>
      {sign}{value}{unit}
    </span>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  delta,
  unit = "",
  lowerIsBetter = false,
  noData = false,
}: {
  label: string;
  value: string | number | null;
  delta?: number | null;
  unit?: string;
  lowerIsBetter?: boolean;
  noData?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium flex items-center gap-0.5">
        {noData || value == null ? (
          <span className="text-muted-foreground/40 text-xs">—</span>
        ) : (
          <>
            {value}{unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
            {delta != null && <Delta value={delta} unit={unit} lowerIsBetter={lowerIsBetter} />}
          </>
        )}
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 pt-3 pb-1">
      {children}
    </p>
  );
}

// ─── Week row ─────────────────────────────────────────────────────────────────

function WeekRow({ week }: { week: WeeklyPeriod }) {
  const [open, setOpen] = useState(false);

  const hasAnyData =
    week.avgWeight != null ||
    week.waist != null ||
    week.trainingSessions > 0 ||
    week.avgSleepHours != null ||
    week.avgSteps != null;

  return (
    <div className={`border rounded-lg overflow-hidden ${
      week.isCurrentWeek
        ? "border-primary/40 bg-primary/[0.03]"
        : "border-border/60 bg-card"
    }`}>
      {/* Collapsed header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-muted-foreground/60 shrink-0">
          {open
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />
          }
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{week.label}</span>
            <span className="text-xs text-muted-foreground">{week.dateRange}</span>
            {week.isCurrentWeek && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 opacity-70">
                In progress
              </Badge>
            )}
          </div>
        </div>

        {/* Summary chips */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          {week.avgWeight != null && (
            <span className="flex items-center">
              <span className="font-medium text-foreground">{week.avgWeight} kg</span>
              <Delta value={week.delta.avgWeight} unit=" kg" />
            </span>
          )}
          {week.trainingAdherence != null && (
            <span>
              <span className="font-medium text-foreground">{week.trainingAdherence}%</span>
              {" training"}
            </span>
          )}
          {!hasAnyData && (
            <span className="text-muted-foreground/40 italic">No data</span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 border-t border-border/40">
          {/* Body Composition */}
          <div>
            <SectionHeader>Body Composition</SectionHeader>
            <MetricRow
              label="Avg weight"
              value={week.avgWeight}
              delta={week.delta.avgWeight}
              unit=" kg"
              noData={week.avgWeight == null}
            />
            {week.delta.avgWeightPct != null && week.avgWeight != null && (
              <div className="flex items-center justify-between py-1 text-xs text-muted-foreground/60 border-b border-border/40">
                <span>Weight change %</span>
                <Delta value={week.delta.avgWeightPct} unit="%" />
              </div>
            )}
            <MetricRow
              label="Waist"
              value={week.waist}
              delta={week.delta.waist}
              unit=" cm"
              lowerIsBetter
              noData={week.waist == null}
            />
            <MetricRow
              label="Skinfold avg"
              value={week.skinfold}
              delta={week.delta.skinfold}
              unit=" mm"
              lowerIsBetter
              noData={week.skinfold == null}
            />
          </div>

          {/* Adherence */}
          <div>
            <SectionHeader>Adherence</SectionHeader>
            <MetricRow
              label="Training adherence"
              value={week.trainingAdherence != null ? `${week.trainingAdherence}%` : null}
              delta={week.delta.trainingAdherence}
              unit="%"
              noData={week.trainingAdherence == null}
            />
            <MetricRow
              label="Sessions completed"
              value={
                week.prescribedSessions != null
                  ? `${week.trainingSessions} / ${week.prescribedSessions}`
                  : week.trainingSessions > 0
                  ? String(week.trainingSessions)
                  : null
              }
              noData={week.trainingSessions === 0}
            />
            <MetricRow
              label="Off-plan meals"
              value={week.offPlanMeals > 0 ? week.offPlanMeals : null}
              delta={week.delta.offPlanMeals}
              lowerIsBetter
              noData={week.offPlanMeals === 0}
            />
            <MetricRow
              label="Habit adherence"
              value={week.habitAdherence != null ? `${week.habitAdherence}%` : null}
              delta={week.delta.habitAdherence}
              unit="%"
              noData={week.habitAdherence == null}
            />
          </div>

          {/* Recovery */}
          <div>
            <SectionHeader>Recovery</SectionHeader>
            <MetricRow
              label="Avg sleep hours"
              value={week.avgSleepHours}
              delta={week.delta.avgSleepHours}
              unit=" hrs"
              noData={week.avgSleepHours == null}
            />
            <MetricRow
              label="Sleep quality"
              value={week.avgSleepQuality != null ? `${week.avgSleepQuality} / 5` : null}
              delta={week.delta.avgSleepQuality}
              noData={week.avgSleepQuality == null}
            />
            <MetricRow
              label="Avg hunger"
              value={week.avgHunger != null ? `${week.avgHunger} / 5` : null}
              delta={week.delta.avgHunger}
              lowerIsBetter
              noData={week.avgHunger == null}
            />
            <MetricRow
              label="Avg caffeine"
              value={week.avgCaffeine}
              delta={week.delta.avgCaffeine}
              unit=" srv"
              lowerIsBetter
              noData={week.avgCaffeine == null}
            />
          </div>

          {/* Activity */}
          <div>
            <SectionHeader>Activity</SectionHeader>
            <MetricRow
              label="Avg daily steps"
              value={week.avgSteps != null ? week.avgSteps.toLocaleString() : null}
              delta={week.delta.avgSteps}
              noData={week.avgSteps == null}
            />
            {week.stepGoal != null && (
              <div className="flex items-center justify-between py-1 text-xs text-muted-foreground/60 border-b border-border/40">
                <span>Step goal</span>
                <span>{week.stepGoal.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 8;

export function WeeklyReviewTab({ clientId }: { clientId: number }) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-rose-400 text-sm py-4">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Failed to load weekly review: {error.message}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No data logged yet for this client. Weekly summaries will appear here once they start logging.
      </p>
    );
  }

  const visible = showAll ? data : data.slice(0, DEFAULT_VISIBLE);
  const hidden = data.length - DEFAULT_VISIBLE;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Weekly Review</h3>
        <span className="text-xs text-muted-foreground">{data.length} {data.length === 1 ? "week" : "weeks"}</span>
      </div>

      {visible.map(week => (
        <WeekRow key={week.weekNum} week={week} />
      ))}

      {!showAll && hidden > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground text-xs mt-1"
          onClick={() => setShowAll(true)}
        >
          Show {hidden} older {hidden === 1 ? "week" : "weeks"}
        </Button>
      )}
      {showAll && data.length > DEFAULT_VISIBLE && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground text-xs mt-1"
          onClick={() => setShowAll(false)}
        >
          Show less
        </Button>
      )}
    </div>
  );
}
