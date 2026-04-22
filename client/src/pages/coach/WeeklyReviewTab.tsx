import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ChevronUp, Minus, ArrowUp, ArrowDown,
  LayoutGrid, List,
} from "lucide-react";
// WeeklyPeriod type (mirrors server/routers/progress.ts)
interface WeeklyPeriod {
  weekNum: number;
  label: string;
  dateRange: string;
  startIso: string;
  endIso: string;
  isCurrentWeek: boolean;
  avgWeight: number | null;
  waist: number | null;
  skinfold: number | null;
  weightEntries: number;
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
  summary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null, unit: string, decimals = 1): string {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}${unit}`;
}

function fmtInt(v: number | null, unit = ""): string {
  if (v == null) return "—";
  return `${Math.round(v)}${unit}`;
}

function fmtSteps(v: number | null): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString();
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v)}%`;
}

// Delta badge: shows absolute change with arrow icon
function DeltaBadge({ value, unit = "", decimals = 1, invertColor = false }: {
  value: number | null;
  unit?: string;
  decimals?: number;
  invertColor?: boolean;
}) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (Math.abs(value) < 0.001) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus size={10} /> 0{unit}
      </span>
    );
  }
  const isUp = value > 0;
  // Neutral color — we don't assume up=bad or down=good
  const color = "text-muted-foreground";
  const formatted = `${isUp ? "+" : ""}${value.toFixed(decimals)}${unit}`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {isUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {formatted}
    </span>
  );
}

// ─── Metric cell: label + value + delta ──────────────────────────────────────

function MetricCell({
  label,
  value,
  delta,
  deltaUnit = "",
  deltaDecimals = 1,
  sub,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaUnit?: string;
  deltaDecimals?: number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
      <p className="text-sm font-semibold text-foreground leading-tight">{value}</p>
      <DeltaBadge value={delta} unit={deltaUnit} decimals={deltaDecimals} />
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 mt-1">
      {label}
    </p>
  );
}

// ─── Option 1: Weekly Card ────────────────────────────────────────────────────

function WeeklyCard({ week, stepGoal }: { week: WeeklyPeriod; stepGoal?: number | null }) {
  return (
    <div className={`rounded-xl border ${week.isCurrentWeek ? "border-primary/30 bg-primary/5" : "border-border bg-card"} p-4`}>
      {/* Card header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-bold ${week.isCurrentWeek ? "text-foreground" : "text-muted-foreground"}`}>
            {week.label}
          </span>
          <span className="text-xs text-muted-foreground truncate">{week.dateRange}</span>
          {week.isCurrentWeek && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">
              Current
            </Badge>
          )}
        </div>
        {week.summary && (
          <p className="text-xs text-muted-foreground italic hidden lg:block text-right max-w-xs truncate">
            {week.summary}
          </p>
        )}
      </div>

      {/* Metrics grid: 4 sections */}
      <div className="space-y-3">
        {/* Body Composition */}
        <div>
          <SectionHeader label="Body Composition" />
          <div className="grid grid-cols-3 gap-3">
            <MetricCell
              label="Avg Weight"
              value={fmt(week.avgWeight, " kg", 1)}
              delta={week.delta.avgWeight}
              deltaUnit=" kg"
              sub={week.weightEntries > 0 ? `${week.weightEntries} entries` : undefined}
            />
            <MetricCell
              label="Waist"
              value={week.waist != null ? `${week.waist} cm` : "—"}
              delta={week.delta.waist}
              deltaUnit=" cm"
            />
            <MetricCell
              label="Skinfold"
              value={week.skinfold != null ? `${week.skinfold} mm` : "—"}
              delta={week.delta.skinfold}
              deltaUnit=" mm"
            />
          </div>
        </div>

        {/* Adherence / Nutrition */}
        <div>
          <SectionHeader label="Adherence & Nutrition" />
          <div className="grid grid-cols-4 gap-3">
            <MetricCell
              label="Training"
              value={fmtPct(week.trainingAdherence)}
              delta={week.delta.trainingAdherence}
              deltaUnit="%"
              deltaDecimals={0}
              sub={week.prescribedSessions != null
                ? `${week.trainingSessions}/${week.prescribedSessions} sessions`
                : `${week.trainingSessions} sessions`}
            />
            <MetricCell
              label="Off-Plan Meals"
              value={String(week.offPlanMeals)}
              delta={week.delta.offPlanMeals}
              deltaUnit=""
              deltaDecimals={0}
            />
            <MetricCell
              label="Caffeine"
              value={fmt(week.avgCaffeine, " srv")}
              delta={week.delta.avgCaffeine}
              deltaUnit=" srv"
              sub="avg/day"
            />
            <MetricCell
              label="Habits"
              value={fmtPct(week.habitAdherence)}
              delta={week.delta.habitAdherence}
              deltaUnit="%"
              deltaDecimals={0}
            />
          </div>
        </div>

        {/* Recovery */}
        <div>
          <SectionHeader label="Recovery & Wellbeing" />
          <div className="grid grid-cols-3 gap-3">
            <MetricCell
              label="Hunger"
              value={fmt(week.avgHunger, "/5")}
              delta={week.delta.avgHunger}
              deltaUnit=""
            />
            <MetricCell
              label="Sleep Quality"
              value={fmt(week.avgSleepQuality, "/5")}
              delta={week.delta.avgSleepQuality}
              deltaUnit=""
            />
            <MetricCell
              label="Sleep Hours"
              value={fmt(week.avgSleepHours, " hrs")}
              delta={week.delta.avgSleepHours}
              deltaUnit=" hrs"
            />
          </div>
        </div>

        {/* Activity */}
        <div>
          <SectionHeader label="Activity" />
          <div className="grid grid-cols-2 gap-3">
            <MetricCell
              label="Avg Daily Steps"
              value={fmtSteps(week.avgSteps)}
              delta={week.delta.avgSteps}
              deltaUnit=""
              deltaDecimals={0}
              sub={stepGoal ? `Goal: ${stepGoal.toLocaleString()}` : undefined}
            />
          </div>
        </div>
      </div>

      {/* Summary on mobile */}
      {week.summary && (
        <p className="text-xs text-muted-foreground italic mt-3 lg:hidden">
          {week.summary}
        </p>
      )}
    </div>
  );
}

// ─── Option 2: Expandable Row ─────────────────────────────────────────────────

function ExpandableRow({ week, stepGoal }: { week: WeeklyPeriod; stepGoal?: number | null }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border transition-colors ${week.isCurrentWeek ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      {/* Collapsed header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className={`text-sm font-bold ${week.isCurrentWeek ? "text-foreground" : "text-muted-foreground"}`}>
            {week.label}
          </span>
          {week.isCurrentWeek && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">
              Current
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground w-28 shrink-0">{week.dateRange}</span>

        {/* Key metrics inline */}
        <div className="flex-1 grid grid-cols-5 gap-2 items-center">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Weight</p>
            <p className="text-xs font-semibold">{fmt(week.avgWeight, " kg", 1)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Waist</p>
            <p className="text-xs font-semibold">{week.waist != null ? `${week.waist} cm` : "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Skinfold</p>
            <p className="text-xs font-semibold">{week.skinfold != null ? `${week.skinfold} mm` : "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Training</p>
            <p className="text-xs font-semibold">{fmtPct(week.trainingAdherence)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Steps</p>
            <p className="text-xs font-semibold">{fmtSteps(week.avgSteps)}</p>
          </div>
        </div>

        <div className="ml-2 shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Body Composition */}
            <div>
              <SectionHeader label="Body Composition" />
              <div className="space-y-2">
                <MetricCell label="Avg Weight" value={fmt(week.avgWeight, " kg", 1)} delta={week.delta.avgWeight} deltaUnit=" kg" sub={week.weightEntries > 0 ? `${week.weightEntries} entries` : undefined} />
                <MetricCell label="Waist" value={week.waist != null ? `${week.waist} cm` : "—"} delta={week.delta.waist} deltaUnit=" cm" />
                <MetricCell label="Skinfold" value={week.skinfold != null ? `${week.skinfold} mm` : "—"} delta={week.delta.skinfold} deltaUnit=" mm" />
              </div>
            </div>

            {/* Adherence */}
            <div>
              <SectionHeader label="Adherence & Nutrition" />
              <div className="space-y-2">
                <MetricCell label="Training" value={fmtPct(week.trainingAdherence)} delta={week.delta.trainingAdherence} deltaUnit="%" deltaDecimals={0} sub={week.prescribedSessions != null ? `${week.trainingSessions}/${week.prescribedSessions} sessions` : `${week.trainingSessions} sessions`} />
                <MetricCell label="Off-Plan Meals" value={String(week.offPlanMeals)} delta={week.delta.offPlanMeals} deltaUnit="" deltaDecimals={0} />
                <MetricCell label="Caffeine" value={fmt(week.avgCaffeine, " srv")} delta={week.delta.avgCaffeine} deltaUnit=" srv" sub="avg/day" />
                <MetricCell label="Habits" value={fmtPct(week.habitAdherence)} delta={week.delta.habitAdherence} deltaUnit="%" deltaDecimals={0} />
              </div>
            </div>

            {/* Recovery */}
            <div>
              <SectionHeader label="Recovery & Wellbeing" />
              <div className="space-y-2">
                <MetricCell label="Hunger" value={fmt(week.avgHunger, "/5")} delta={week.delta.avgHunger} deltaUnit="" />
                <MetricCell label="Sleep Quality" value={fmt(week.avgSleepQuality, "/5")} delta={week.delta.avgSleepQuality} deltaUnit="" />
                <MetricCell label="Sleep Hours" value={fmt(week.avgSleepHours, " hrs")} delta={week.delta.avgSleepHours} deltaUnit=" hrs" />
              </div>
            </div>

            {/* Activity */}
            <div>
              <SectionHeader label="Activity" />
              <div className="space-y-2">
                <MetricCell label="Avg Daily Steps" value={fmtSteps(week.avgSteps)} delta={week.delta.avgSteps} deltaUnit="" deltaDecimals={0} sub={stepGoal ? `Goal: ${stepGoal.toLocaleString()}` : undefined} />
              </div>
            </div>
          </div>

          {week.summary && (
            <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-2">
              {week.summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WeeklyReviewTab({ clientId, stepGoal }: { clientId: number; stepGoal?: number | null }) {
  const [viewMode, setViewMode] = useState<"cards" | "rows">("cards");
  const [showAll, setShowAll] = useState(false);

  const { data: weeks = [], isLoading } = trpc.progress.weeklyReview.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No weekly data available yet.</p>
        <p className="text-muted-foreground text-xs mt-1">Data will appear once the client has logged at least one week.</p>
      </div>
    );
  }

  const INITIAL_SHOW = 4;
  const visibleWeeks = showAll ? weeks : weeks.slice(0, INITIAL_SHOW);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Weekly Review</p>
          <p className="text-xs text-muted-foreground">{weeks.length} week{weeks.length !== 1 ? "s" : ""} of data · newest first</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "cards" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={13} />
            Cards
          </button>
          <button
            onClick={() => setViewMode("rows")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "rows" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={13} />
            Rows
          </button>
        </div>
      </div>

      {/* Week list */}
      <div className="space-y-3">
        {visibleWeeks.map(week =>
          viewMode === "cards"
            ? <WeeklyCard key={week.weekNum} week={week} stepGoal={stepGoal} />
            : <ExpandableRow key={week.weekNum} week={week} stepGoal={stepGoal} />
        )}
      </div>

      {/* Show more / less */}
      {weeks.length > INITIAL_SHOW && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(v => !v)}
            className="text-xs"
          >
            {showAll ? (
              <><ChevronUp size={13} className="mr-1" />Show less</>
            ) : (
              <><ChevronDown size={13} className="mr-1" />Show {weeks.length - INITIAL_SHOW} more week{weeks.length - INITIAL_SHOW !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
