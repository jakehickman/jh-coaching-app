import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowUp, ArrowDown, Minus, ChevronDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

// ─── Submission Q&A ───────────────────────────────────────────────────────────

function SubmissionQA({ sub }: { sub: any }) {
  const sections = [
    {
      title: "Diet Execution",
      rows: [
        { q: "How often did you weigh all foods raw/uncooked with a digital scale?", val: sub.dietWeighedFoods },
        { q: "How often did you prepare meals exactly as written in your plan?", val: sub.dietMealPrepAccuracy },
        { q: "Excluding off-plan meals, how often did you eat/drink anything not in your plan?", val: sub.dietExtrasFrequency },
        { q: "How do you use added fats when cooking?", val: sub.dietAddedFats },
        { q: "How often did you eat meals more than 2 hours off schedule?", val: sub.dietMealTiming },
        { q: "When you had an off-plan meal, how close was it to your plan in calories/macros?", val: sub.dietOffPlanQuality },
      ].filter(r => r.val),
    },
    {
      title: "Sleep",
      rows: [
        { q: "How often did you go to bed more than 1 hour later than your planned bedtime?", val: sub.sleepBedtimeConsistency },
      ].filter(r => r.val),
    },
    {
      title: "Adherence Barrier",
      rows: [
        { q: "What was your biggest barrier to adherence this week?", val: sub.adherenceBarrier ? (BARRIER_LABEL[sub.adherenceBarrier] ?? sub.adherenceBarrier) : null, raw: true },
        ...(sub.barrierExplain ? [{ q: "Can you explain further?", val: sub.barrierExplain, raw: true }] : []),
      ].filter(r => r.val),
    },
    {
      title: "Weekly Self-Assessment",
      rows: [
        { q: "Overall, how well did you follow your plan this week?", val: sub.weeklyAssessment ? (ASSESSMENT_LABEL[sub.weeklyAssessment] ?? sub.weeklyAssessment) : null, raw: true },
      ].filter(r => r.val),
    },
  ].filter(s => s.rows.length > 0);

  if (sections.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 py-3">No answers recorded.</p>;
  }
  return (
    <div className="px-4 pt-3 pb-1 space-y-4">
      {sections.map(section => (
        <div key={section.title}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section.title}</p>
          <div className="space-y-3">
            {section.rows.map((row, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{row.q}</p>
                <p className="text-sm text-foreground font-medium">
                  {(row as any).raw ? row.val : (DIET_LABEL_MAP[(row.val as string)!] ?? row.val)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Coach Notes Field ────────────────────────────────────────────────────────

function CoachNotesField({ submissionId, initialNotes }: { submissionId: number; initialNotes: string | null | undefined }) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNotes = trpc.checkIn.saveCoachNotes.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    onError: () => toast.error("Failed to save notes"),
  });
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes.mutate({ submissionId, notes: e.target.value });
    }, 1200);
  };
  const handleBlur = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveNotes.mutate({ submissionId, notes: value });
  };
  return (
    <div className="px-4 py-3 border-t border-border/50 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coach Notes</p>
        {saved && <span className="text-[10px] text-green-400">Saved</span>}
        {saveNotes.isPending && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Add feedback, program adjustments, or observations…"
        rows={3}
        className="w-full text-sm bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
      />
    </div>
  );
}

// ─── Changes Notes Field ──────────────────────────────────────────────────────

function ChangesNotesField({ submissionId, initialNotes }: { submissionId: number; initialNotes: string | null | undefined }) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNotes = trpc.checkIn.saveChangesNotes.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    onError: () => toast.error("Failed to save changes"),
  });
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes.mutate({ submissionId, notes: e.target.value });
    }, 1200);
  };
  const handleBlur = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveNotes.mutate({ submissionId, notes: value });
  };
  return (
    <div className="px-4 py-3 border-t border-border/50 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Changes Made</p>
        {saved && <span className="text-[10px] text-green-400">Saved</span>}
        {saveNotes.isPending && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Record any adjustments made to meal plan, training, or other changes…"
        rows={3}
        className="w-full text-sm bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function WeeklyReviewTab({ clientId, onWeekClick }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInit, setExpandedInit] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  // Fetch check-in history to match submissions to weeks
  const { data: checkInHistory } = trpc.checkIn.clientHistory.useQuery(
    { clientId },
    { enabled: !!clientId, staleTime: 30_000 }
  );

  const markReviewed = trpc.checkIn.markReviewed.useMutation({
    onSuccess: () => trpc.useUtils().checkIn.clientHistory.invalidate(),
    onError: () => toast.error("Failed to update review status"),
  });

  const weeks = data?.weeks ?? [];

  // Build a map from weekNumber → history row
  const historyByWeek = useMemo(() => {
    const map = new Map<number, any>();
    for (const row of checkInHistory ?? []) {
      if (row.weekNumber != null) map.set(row.weekNumber, row);
    }
    return map;
  }, [checkInHistory]);

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
        const historyRow = historyByWeek.get(week.weekNumber);
        const submission = historyRow?.submission ?? null;
        const hasSubmission = !!submission;
        const isReviewed = !!(submission as any)?.reviewedAt;

        const stepsAvg = week.avgSteps != null ? Math.round(week.avgSteps).toLocaleString() : "—";
        const stepsValue = week.avgSteps != null ? stepsAvg : "—";
        const stepsSubtext = week.stepGoal != null ? `Goal: ${week.stepGoal.toLocaleString()}` : undefined;

        // Weight delta vs previous week (absolute kg)
        const weightDeltaKg = d(week.avgWeight, prev?.avgWeight ?? null);

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
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  W{week.weekNumber}
                </span>
                <span className="text-sm font-semibold text-foreground truncate">{week.label}</span>
                {week.isInProgress && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10 flex-shrink-0">
                    Current
                  </Badge>
                )}
                {hasSubmission && !isReviewed && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/50 text-blue-400 bg-blue-500/10 flex-shrink-0">
                    Unreviewed
                  </Badge>
                )}
                {hasSubmission && isReviewed && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-400 bg-green-500/10 flex-shrink-0">
                    Reviewed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {/* Avg weight + delta */}
                {week.avgWeight != null && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[11px] font-semibold tabular-nums text-foreground">{fmt(week.avgWeight)} kg</span>
                    {weightDeltaKg != null && (
                      <Delta delta={weightDeltaKg} text={`${weightDeltaKg > 0 ? "+" : ""}${weightDeltaKg.toFixed(1)}`} higherIsBetter={null} />
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
                        label="Caffeine"
                        value={week.avgCaffeine != null ? `${fmt(week.avgCaffeine)} srv` : "—"}
                        muted={week.avgCaffeine == null}
                      />
                    </MetricGroup>

                    {/* Activity */}
                    <MetricGroup label="Activity">
                      <Tile
                        label="Steps"
                        value={stepsValue}
                        muted={week.avgSteps == null}
                        subtext={stepsSubtext}
                      />
                    </MetricGroup>
                  </div>

                  {/* Check-in submission section */}
                  {hasSubmission && (
                    <div className="border-t border-border/40">
                      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Check-in Submission</p>
                        <span className="text-[10px] text-muted-foreground">
                          Submitted {new Date((submission as any).submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <SubmissionQA sub={submission} />
                      <CoachNotesField submissionId={(submission as any).id} initialNotes={(submission as any).coachNotes} />
                      <ChangesNotesField submissionId={(submission as any).id} initialNotes={(submission as any).changesNotes} />
                      <div className="px-4 py-3 border-t border-border/50">
                        <Button
                          size="sm"
                          variant={isReviewed ? "outline" : "default"}
                          onClick={() => markReviewed.mutate({ id: (submission as any).id, reviewed: !isReviewed })}
                          disabled={markReviewed.isPending}
                          className="gap-1.5"
                        >
                          <CheckCircle2 size={13} />
                          {isReviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* No submission note */}
                  {!hasSubmission && (
                    <div className="px-4 py-3 border-t border-border/40">
                      <p className="text-xs text-muted-foreground/60 italic">No check-in submitted for this week.</p>
                    </div>
                  )}
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
