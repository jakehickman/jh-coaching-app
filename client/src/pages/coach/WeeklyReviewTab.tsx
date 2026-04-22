import { useState, useEffect } from "react";
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
  avgSteps: number | null;
  stepGoal: number | null;
};

const DEFAULT_VISIBLE = 6;

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

interface DeltaProps {
  delta: number | null;
  text?: string;
  higherIsBetter?: boolean | null; // null = neutral grey
}

function Delta({ delta, text, higherIsBetter = null }: DeltaProps) {
  if (delta == null) return null;

  let color = "text-muted-foreground";
  if (higherIsBetter === true) color = delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
  if (higherIsBetter === false) color = delta < 0 ? "text-green-400" : delta > 0 ? "text-red-400" : "text-muted-foreground";

  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const label = text ?? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
      <Icon size={9} />
      {label}
    </span>
  );
}

// ─── Metric tile ─────────────────────────────────────────────────────────────

interface TileProps {
  label: string;
  value: string;
  muted?: boolean;
  delta?: number | null;
  deltaText?: string;
  higherIsBetter?: boolean | null;
}

function Tile({ label, value, muted, delta, deltaText, higherIsBetter }: TileProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</span>
        {delta != null && (
          <Delta delta={delta} text={deltaText} higherIsBetter={higherIsBetter} />
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function WeeklyReviewTab({ clientId, onWeekClick }: Props) {
  const [showAll, setShowAll] = useState(false);
  // Set of expanded week starts; initialised once data loads
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInit, setExpandedInit] = useState(false);

  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = data?.weeks ?? [];

  // Initialise: expand the first two weeks (current + previous) once
  // Must be before any early returns to satisfy Rules of Hooks
  useEffect(() => {
    if (expandedInit || weeks.length === 0) return;
    const toExpand = new Set<string>();
    if (weeks[0]) toExpand.add(weeks[0].weekStart);
    if (weeks[1]) toExpand.add(weeks[1].weekStart);
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
          <Skeleton key={i} className="h-28 w-full bg-muted rounded-xl" />
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

  const visibleWeeks = showAll ? weeks : weeks.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="mt-2 space-y-2">
      {visibleWeeks.map((week, idx) => {
        const hasData = week.daysLogged > 0;
        const isExpanded = expanded.has(week.weekStart);
        const prev: Week | null = weeks[idx + 1] ?? null;
        const d = (curr: number | null, p: number | null) =>
          curr != null && p != null ? +(curr - p).toFixed(2) : null;

        const stepsValue = week.avgSteps != null
          ? (week.stepGoal != null
            ? `${fmtK(Math.round(week.avgSteps))} / ${fmtK(week.stepGoal)}`
            : fmtK(Math.round(week.avgSteps)))
          : "—";

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
            {/* Card header — always visible, click to collapse/expand */}
            <button
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors rounded-xl ${
                week.isInProgress ? "hover:bg-amber-500/10" : "hover:bg-muted/20"            }`}
              onClick={() => toggleCard(week.weekStart)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  W{week.weekNumber}
                </span>
                <span className="text-sm font-semibold text-foreground">{week.label}</span>
                {week.isInProgress && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10">
                    Live
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {hasData ? `${week.daysLogged} day${week.daysLogged !== 1 ? "s" : ""} logged` : "No data"}
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* Metrics grid — only visible when expanded */}
            {isExpanded && hasData ? (
              <div
                className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-x-4 gap-y-3 px-4 pb-4"
                onClick={onWeekClick ? (e) => { e.stopPropagation(); onWeekClick(week.weekNumber); } : undefined}
                style={onWeekClick ? { cursor: 'pointer' } : undefined}
              >
                {/* Body Composition */}
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
                {/* Training */}
                <Tile
                  label="Sessions"
                  value={String(week.sessionsCompleted)}
                  delta={d(week.sessionsCompleted, prev?.sessionsCompleted ?? null)}
                  higherIsBetter={true}
                />
                {/* Nutrition */}
                <Tile
                  label="Off-Plan"
                  value={week.totalOffPlan != null ? String(week.totalOffPlan) : "—"}
                  muted={week.totalOffPlan == null}
                  delta={d(week.totalOffPlan, prev?.totalOffPlan ?? null)}
                  higherIsBetter={false}
                />
                {/* Recovery */}
                <Tile
                  label="Hunger"
                  value={week.avgHunger != null ? `${fmt(week.avgHunger)}/5` : "—"}
                  muted={week.avgHunger == null}
                  delta={d(week.avgHunger, prev?.avgHunger ?? null)}
                  higherIsBetter={null}
                />
                <Tile
                  label="Sleep Qual"
                  value={week.avgSleepQuality != null ? `${fmt(week.avgSleepQuality)}/5` : "—"}
                  muted={week.avgSleepQuality == null}
                  delta={d(week.avgSleepQuality, prev?.avgSleepQuality ?? null)}
                  higherIsBetter={true}
                />
                <Tile
                  label="Sleep Hrs"
                  value={week.avgSleepHours != null ? `${fmt(week.avgSleepHours)} h` : "—"}
                  muted={week.avgSleepHours == null}
                  delta={d(week.avgSleepHours, prev?.avgSleepHours ?? null)}
                  higherIsBetter={true}
                />
                {/* Caffeine */}
                <Tile
                  label="Caffeine"
                  value={week.avgCaffeine != null ? `${fmt(week.avgCaffeine)} srv` : "—"}
                  muted={week.avgCaffeine == null}
                  delta={d(week.avgCaffeine, prev?.avgCaffeine ?? null)}
                  higherIsBetter={null}
                />
                {/* Activity */}
                <Tile
                  label="Steps"
                  value={stepsValue}
                  muted={week.avgSteps == null}
                  delta={d(week.avgSteps, prev?.avgSteps ?? null)}
                  higherIsBetter={true}
                />
              </div>
            ) : isExpanded && !hasData ? (
              <p className="text-xs text-muted-foreground italic px-4 pb-4">No daily logs recorded this week.</p>
            ) : null}
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
