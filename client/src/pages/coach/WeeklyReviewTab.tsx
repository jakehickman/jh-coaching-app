import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowUp, ArrowDown, Minus, ChevronDown } from "lucide-react";

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
  avgStress?: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
  totalLissMinutes: number | null;
  lissTarget: number | null;
  lissSessionsPerWeek: number | null;
  lissMinutesPerSession: number | null;
};

const DEFAULT_VISIBLE = 6;

// ─── Label maps ───────────────────────────────────────────────────────────────

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
  no_off_plan_meals: "No off-plan meals",
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

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

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

// ─── Metric tile ─────────────────────────────────────────────────────────────

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

// ─── Metric group ─────────────────────────────────────────────────────────────

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

// ─── Main component ──────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Fat Loss":          { bg: "bg-emerald-500/10",  text: "text-emerald-400",  border: "border-emerald-500/30" },
  "General Fat Loss":  { bg: "bg-emerald-500/10",  text: "text-emerald-400",  border: "border-emerald-500/30" },
  "Mini Cut":          { bg: "bg-orange-500/10",   text: "text-orange-400",   border: "border-orange-500/30" },
  "Contest Prep":      { bg: "bg-purple-500/10",   text: "text-purple-400",   border: "border-purple-500/30" },
  "Gaining":           { bg: "bg-blue-500/10",     text: "text-blue-400",     border: "border-blue-500/30" },
  "Maintenance":       { bg: "bg-slate-500/10",    text: "text-slate-400",    border: "border-slate-500/30" },
};

function getPhaseForWeek(phases: any[], weekStart: string, weekEnd: string): string | null {
  // Find the phase that overlaps with this week (use midpoint of week)
  const mid = new Date(weekStart + "T00:00:00").getTime() + 3 * 86400000;
  const midDate = new Date(mid).toISOString().slice(0, 10);
  const phase = phases.find((p: any) => p.startDate <= midDate && (!p.endDate || p.endDate >= midDate));
  return phase?.label ?? null;
}

function getPhaseWeekNumber(phases: any[], weekStart: string): number | null {
  const mid = new Date(weekStart + "T00:00:00").getTime() + 3 * 86400000;
  const midDate = new Date(mid).toISOString().slice(0, 10);
  const phase = phases.find((p: any) => p.startDate <= midDate && (!p.endDate || p.endDate >= midDate));
  if (!phase) return null;
  const phaseStart = new Date(phase.startDate + "T00:00:00").getTime();
  const weekStartMs = new Date(weekStart + "T00:00:00").getTime();
  return Math.floor((weekStartMs - phaseStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function WeeklyReviewTab({ clientId, onWeekClick }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInit, setExpandedInit] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data: phasesData } = trpc.phases.list.useQuery(
    { clientId },
    { enabled: !!clientId }
  );
  const phases = (phasesData as any[]) ?? [];
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = data?.weeks ?? [];

  // Initialise: expand only the most recent week once data loads
  useEffect(() => {
    if (expandedInit || weeks.length === 0) return;
    const toExpand = new Set<string>();
    if (weeks[0]) toExpand.add(weeks[0].weekStart);
    setExpanded(toExpand);
    setExpandedInit(true);
  }, [weeks.length, expandedInit]);

  function toggleCard(weekStart: string) {
    setExpanded(prev => {
      // Single-expand: if already open, close it; otherwise open only this one
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
        const prev: Week | null = weeks[idx + 1] ?? null;

        const stepsAvg = week.avgSteps != null ? Math.round(week.avgSteps).toLocaleString() : "—";
        const stepsValue = week.avgSteps != null ? stepsAvg : "—";
        const stepsSubtext = week.stepGoal != null ? `Goal: ${week.stepGoal.toLocaleString()}` : undefined;

        // Weight delta vs previous week (% BW change)
        const weightDeltaKg = d(week.avgWeight, prev?.avgWeight ?? null);
        const weightDeltaPct = weightDeltaKg != null && prev?.avgWeight != null && prev.avgWeight > 0
          ? parseFloat(((weightDeltaKg / prev.avgWeight) * 100).toFixed(1))
          : null;

        const phaseLabel = getPhaseForWeek(phases, week.weekStart, week.weekEnd);
        const phaseColor = phaseLabel ? (PHASE_COLORS[phaseLabel] ?? { bg: "bg-secondary", text: "text-muted-foreground", border: "border-border" }) : null;

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
            {/* Card header — always visible */}
            <button
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors rounded-xl ${
                week.isInProgress ? "hover:bg-amber-500/10" : "hover:bg-muted/20"
              }`}
              onClick={() => toggleCard(week.weekStart)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const phaseWk = getPhaseWeekNumber(phases, week.weekStart);
                  const wNum = phaseWk ?? week.weekNumber;
                  if (phaseLabel && phaseColor) {
                    return (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${phaseColor.bg} ${phaseColor.text} ${phaseColor.border}`}>
                        W{wNum} – {phaseLabel}
                      </span>
                    );
                  }
                  return (
                    <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex-shrink-0">
                      W{wNum}
                    </span>
                  );
                })()}
                <span className="text-sm font-semibold text-foreground truncate">{week.label}</span>
                {week.isInProgress && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10 flex-shrink-0">
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {/* Avg weight + delta */}
                {week.avgWeight != null && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[11px] font-semibold tabular-nums text-foreground">{fmt(week.avgWeight)} kg</span>
                    {weightDeltaPct != null && (
                      <Delta delta={weightDeltaPct} text={`${weightDeltaPct > 0 ? "+" : ""}${weightDeltaPct.toFixed(1)}%`} higherIsBetter={null} />
                    )}
                  </div>
                )}
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
                  {/* Weekly stats */}
                  <div
                    className="px-4 pb-5 space-y-4 pt-4"
                    onClick={onWeekClick ? (e) => { e.stopPropagation(); onWeekClick(week.weekNumber); } : undefined}
                    style={onWeekClick ? { cursor: "pointer" } : undefined}
                  >
                    {/* Body Composition */}
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

                    {/* Training */}
                    <MetricGroup label="Training">
                      <Tile
                        label="Sessions"
                        value={String(week.sessionsCompleted)}
                      />
                    </MetricGroup>

                    {/* Nutrition */}
                    <MetricGroup label="Nutrition">
                      <Tile
                        label="Off-Plan Meals"
                        value={week.totalOffPlan != null ? String(week.totalOffPlan) : "—"}
                        muted={week.totalOffPlan == null}
                      />
                    </MetricGroup>

                    {/* Recovery */}
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

                    {/* Activity */}
                    <MetricGroup label="Cardio &amp; Activity">
                      <Tile
                        label="Steps"
                        value={stepsValue}
                        muted={week.avgSteps == null}
                        subtext={stepsSubtext}
                      />
                      <Tile
                        label="LISS Cardio"
                        value={week.totalLissMinutes != null && week.totalLissMinutes > 0 ? `${week.totalLissMinutes} mins` : "—"}
                        muted={!week.totalLissMinutes}
                        subtext={week.lissSessionsPerWeek != null && week.lissMinutesPerSession != null
                          ? `Target: ${week.lissSessionsPerWeek} × ${week.lissMinutesPerSession} min`
                          : week.lissTarget != null ? `Target: ${week.lissTarget} mins/wk` : undefined}
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

      {/* Show all / show less */}
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
