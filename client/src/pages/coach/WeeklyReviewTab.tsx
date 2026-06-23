import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowUp, ArrowDown, Minus, ChevronDown } from "lucide-react";

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
  mealLogAvgHunger?: number | null;
  mealLogAvgFullness?: number | null;
  mealLogIdealZonePct?: number | null;
};

const DEFAULT_VISIBLE = 6;

const DIET_LABEL_MAP: Record<string, string> = {
  every_meal: "Every meal or nearly every meal",
  most_meals: "Most meals",
  some_meals: "Some meals",
  rarely: "Rarely",
  never: "Never",
  one_two_days: "On 1–2 days",
  few_days: "On a few days",
  most_days: "On most days",
  every_day: "Every day",
  light_spray: "Light spray (e.g. cooking spray)",
  small_amount: "Small amount (less than 1 tsp)",
  one_tsp_or_more: "1 tsp or more",
  no_added_fats: "No added fats when cooking",
  very_close: "Very close",
  somewhat_close: "Somewhat close",
  not_very_close: "Not very close",
  very_different: "Very different",
};
const BARRIER_LABEL: Record<string, string> = {
  no_issues: "No issues", hunger: "Hunger", cravings: "Cravings",
  social_events: "Social events", busy_time: "Busy / time constraints",
  poor_planning: "Poor planning", low_motivation: "Low motivation",
  travel_disruption: "Travel / disruption", other: "Other",
};
const ASSESSMENT_LABEL: Record<string, string> = {
  executed_exactly: "Executed exactly as planned",
  mostly_followed: "Mostly followed",
  inconsistent: "Inconsistent",
  didnt_follow: "Didn't follow the plan",
};

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

function Delta({ delta, text, higherIsBetter = null }: {
  delta: number | null;
  text?: string;
  higherIsBetter?: boolean | null;
}) {
  if (delta == null) return null;
  let color = "text-muted-foreground";
  if (higherIsBetter === true) color = delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
  if (higherIsBetter === false) color = delta < 0 ? "text-green-400" : delta > 0 ? "text-red-400" : "text-muted-foreground";
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const label = text ?? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
      <Icon size={9} />{label}
    </span>
  );
}

function Tile({ label, value, muted, delta, deltaText, higherIsBetter, subtext }: {
  label: string;
  value: string;
  muted?: boolean;
  delta?: number | null;
  deltaText?: string;
  higherIsBetter?: boolean | null;
  subtext?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</span>
        {delta != null && <Delta delta={delta} text={deltaText} higherIsBetter={higherIsBetter} />}
      </div>
      {subtext && <span className="text-[10px] text-muted-foreground/50 leading-none">{subtext}</span>}
    </div>
  );
}

function MetricGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{label}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {children}
      </div>
    </div>
  );
}

export function WeeklyReviewTab({ clientId, onWeekClick }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInit, setExpandedInit] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = data?.weeks ?? [];

  useEffect(() => {
    if (expandedInit || weeks.length === 0) return;
    const toExpand = new Set<string>();
    if (weeks[0]) toExpand.add(weeks[0].weekStart);
    setExpanded(toExpand);
    setExpandedInit(true);
  }, [weeks.length, expandedInit]);

  function toggleCard(weekStart: string) {
    setExpanded(prev => {
      if (prev.has(weekStart)) return new Set<string>();
      return new Set<string>([weekStart]);
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-muted rounded-xl" />
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

  const d = (curr: number | null, p: number | null) =>
    curr != null && p != null ? +(curr - p).toFixed(2) : null;

  const visibleWeeks = showAll ? weeks : weeks.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="mt-2 space-y-2">
      {visibleWeeks.map((week, idx) => {
        const hasData = week.daysLogged > 0;
        const isExpanded = expanded.has(week.weekStart);
        const prev: Week | null = (weeks[idx + 1] as Week) ?? null;

        const stepsValue = week.avgSteps != null ? Math.round(week.avgSteps).toLocaleString() : "—";
        const stepsSubtext = week.stepGoal != null ? `Goal: ${week.stepGoal.toLocaleString()}` : undefined;

        const weightDeltaKg = d(week.avgWeight, prev?.avgWeight ?? null);
        const weightDeltaPct = weightDeltaKg != null && prev?.avgWeight != null && prev.avgWeight > 0
          ? parseFloat(((weightDeltaKg / prev.avgWeight) * 100).toFixed(1))
          : null;

        return (
          <div
            key={week.weekStart}
            className={`rounded-xl border transition-colors ${
              week.isInProgress
                ? "border-amber-500/40 bg-amber-500/5"
                : !hasData
                ? "border-border bg-card opacity-50"
                : "border-border bg-card"
            }`}
          >
            {/* Card header */}
            <button
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors rounded-xl ${
                week.isInProgress ? "hover:bg-amber-500/10" : "hover:bg-muted/20"
              }`}
              onClick={() => toggleCard(week.weekStart)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{week.label}</span>
                {week.isInProgress && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10 flex-shrink-0">
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <span className="text-[11px] text-muted-foreground">
                  {hasData ? `${week.daysLogged} day${week.daysLogged !== 1 ? "s" : ""}` : "No data"}
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              hasData ? (
                <div className="border-t border-border/40">
                  <div
                    className="px-4 pb-5 space-y-4 pt-4"
                    onClick={onWeekClick ? (e) => { e.stopPropagation(); onWeekClick(null); } : undefined}
                    style={onWeekClick ? { cursor: "pointer" } : undefined}
                  >
                    <MetricGroup label="Body Composition">
                      <Tile
                        label="Weight"
                        value={week.avgWeight != null ? `${fmt(week.avgWeight)} kg` : "—"}
                        muted={week.avgWeight == null}
                        delta={week.avgWeightPct}
                        deltaText={week.avgWeightPct != null ? `${week.avgWeightPct > 0 ? "+" : ""}${week.avgWeightPct.toFixed(2)}%` : undefined}
                        higherIsBetter={null}
                      />
                      <Tile
                        label="Waist"
                        value={week.avgWaist != null ? `${fmt(week.avgWaist)} cm` : "—"}
                        muted={week.avgWaist == null}
                        delta={d(week.avgWaist, prev?.avgWaist ?? null)}
                        higherIsBetter={false}
                      />
                      <Tile
                        label="Skinfold"
                        value={week.avgSkinfold != null ? `${fmt(week.avgSkinfold)} mm` : "—"}
                        muted={week.avgSkinfold == null}
                        delta={d(week.avgSkinfold, prev?.avgSkinfold ?? null)}
                        higherIsBetter={false}
                      />
                    </MetricGroup>

                    <MetricGroup label="Training">
                      <Tile label="Sessions" value={String(week.sessionsCompleted)} />
                    </MetricGroup>

                    <MetricGroup label="Nutrition">
                      <Tile
                        label="Meals logged"
                        value={week.mealLogCount != null && week.mealLogCount > 0 ? String(week.mealLogCount) : "—"}
                        muted={!week.mealLogCount}
                      />
                      <Tile
                        label="Treats"
                        value={week.mealLogTreats != null && week.mealLogTreats > 0 ? String(week.mealLogTreats) : "—"}
                        muted={!week.mealLogTreats}
                      />
                      <Tile
                        label="Avg hunger"
                        value={week.mealLogAvgHunger != null ? String(week.mealLogAvgHunger) : "—"}
                        muted={week.mealLogAvgHunger == null}
                      />
                      <Tile
                        label="Avg fullness"
                        value={week.mealLogAvgFullness != null ? String(week.mealLogAvgFullness) : "—"}
                        muted={week.mealLogAvgFullness == null}
                      />
                      <Tile
                        label="Ideal zone"
                        value={week.mealLogIdealZonePct != null ? `${week.mealLogIdealZonePct}%` : "—"}
                        muted={week.mealLogIdealZonePct == null}
                      />
                    </MetricGroup>

                    <MetricGroup label="Recovery">
                      <Tile
                        label="Sleep Quality"
                        value={week.avgSleepQuality != null ? `${fmt(week.avgSleepQuality)}/5` : "—"}
                        muted={week.avgSleepQuality == null}
                        delta={d(week.avgSleepQuality, prev?.avgSleepQuality ?? null)}
                        higherIsBetter={true}
                      />
                      <Tile
                        label="Sleep Hours"
                        value={week.avgSleepHours != null ? `${fmt(week.avgSleepHours)} h` : "—"}
                        muted={week.avgSleepHours == null}
                      />
                      <Tile
                        label="Hunger"
                        value={week.avgHunger != null ? `${fmt(week.avgHunger)}/5` : "—"}
                        muted={week.avgHunger == null}
                        delta={d(week.avgHunger, prev?.avgHunger ?? null)}
                        higherIsBetter={null}
                      />
                      <Tile
                        label="Stress"
                        value={week.avgStress != null ? `${fmt(week.avgStress)}/5` : "—"}
                        muted={week.avgStress == null}
                        delta={d(week.avgStress, prev?.avgStress ?? null)}
                        higherIsBetter={false}
                      />
                      <Tile
                        label="Caffeine"
                        value={week.avgCaffeine != null ? `${fmt(week.avgCaffeine)} srv` : "—"}
                        muted={week.avgCaffeine == null}
                      />
                    </MetricGroup>

                    <MetricGroup label="Activity">
                      <Tile
                        label="Steps"
                        value={stepsValue}
                        muted={week.avgSteps == null}
                        subtext={stepsSubtext}
                      />
                    </MetricGroup>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic px-4 pb-4 border-t border-border/40 pt-3">
                  No daily logs recorded this week.
                </p>
              )
            )}
          </div>
        );
      })}

      {weeks.length > DEFAULT_VISIBLE && (
        <div className="flex justify-center mt-1">
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
