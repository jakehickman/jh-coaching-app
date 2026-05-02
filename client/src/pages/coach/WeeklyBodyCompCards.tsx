import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

type DeltaProps = { delta: number | null; unit?: string; invert?: boolean; decimals?: number };

function Delta({ delta, unit = "", invert = false, decimals = 1 }: DeltaProps) {
  if (delta == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        {unit}
      </span>
    );
  }
  const isPositive = delta > 0;
  // For weight/waist/skinfold: down is good (invert=true)
  const isGood = invert ? !isPositive : isPositive;
  const colour = isGood ? "text-emerald-500" : "text-rose-500";
  const Icon = isPositive ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colour}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(delta).toFixed(decimals)}{unit}
    </span>
  );
}

// ── Skinfold site row ─────────────────────────────────────────────────────────

function SiteRow({ label, avg, readings }: { label: string; avg: number | null; readings: (number | null | undefined)[] }) {
  const valid = readings.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return (
    <div className="flex items-center py-1 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-medium tabular-nums text-right w-20">{fmt(avg)} mm</span>
    </div>
  );
}

// ── Phase helpers ───────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Fat Loss":          { bg: "bg-emerald-500/10",  text: "text-emerald-400",  border: "border-emerald-500/30" },
  "General Fat Loss":  { bg: "bg-emerald-500/10",  text: "text-emerald-400",  border: "border-emerald-500/30" },
  "Mini Cut":          { bg: "bg-orange-500/10",   text: "text-orange-400",   border: "border-orange-500/30" },
  "Contest Prep":      { bg: "bg-purple-500/10",   text: "text-purple-400",   border: "border-purple-500/30" },
  "Gaining":           { bg: "bg-blue-500/10",     text: "text-blue-400",     border: "border-blue-500/30" },
  "Maintenance":       { bg: "bg-slate-500/10",    text: "text-slate-400",    border: "border-slate-500/30" },
};

function getPhaseForWeek(phases: any[], weekStart: string): string | null {
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

// ── Single week card ──────────────────────────────────────────────────────────

type Week = {
  weekNumber: number;
  label: string;
  weekStart: string;
  weekEnd: string;
  isInProgress: boolean;
  avgWeight: number | null;
  avgWaist: number | null;
  avgSkinfold: number | null;
  weighIns: { logDate: string; weight: number }[];
  measurementEntries: {
    id: number;
    measureDate: string;
    waist: number | null;
    umbilical: number | null;
    suprailiac: number | null;
    calf: number | null;
    thigh: number | null;
    totalSkinfold: number | null;
    umbilicalReadings: (number | null | undefined)[];
    suprailiacReadings: (number | null | undefined)[];
    calfReadings: (number | null | undefined)[];
    thighReadings: (number | null | undefined)[];
  }[];
};

function WeekCard({ week, prevWeek, phases }: { week: Week; prevWeek: Week | null; phases: any[] }) {
  const [expanded, setExpanded] = useState(false);

  const weightDeltaKg = week.avgWeight != null && prevWeek?.avgWeight != null
    ? week.avgWeight - prevWeek.avgWeight
    : null;
  const weightDeltaPct2dp = weightDeltaKg != null && prevWeek?.avgWeight != null && prevWeek.avgWeight > 0
    ? parseFloat(((weightDeltaKg / prevWeek.avgWeight) * 100).toFixed(2))
    : null;
  const weightDelta = weightDeltaPct2dp != null ? parseFloat(weightDeltaPct2dp.toFixed(1)) : null;
  const waistDelta = week.avgWaist != null && prevWeek?.avgWaist != null
    ? parseFloat((week.avgWaist - prevWeek.avgWaist).toFixed(1))
    : null;
  const skinfoldDelta = week.avgSkinfold != null && prevWeek?.avgSkinfold != null
    ? parseFloat((week.avgSkinfold - prevWeek.avgSkinfold).toFixed(1))
    : null;

  const hasAnyData = week.avgWeight != null || week.avgWaist != null || week.avgSkinfold != null;
  const hasDetail = week.weighIns.length > 0 || week.measurementEntries.length > 0;

  const phaseLabel = getPhaseForWeek(phases, week.weekStart);
  const phaseColor = phaseLabel ? (PHASE_COLORS[phaseLabel] ?? { bg: "bg-secondary", text: "text-muted-foreground", border: "border-border" }) : null;

  return (
    <div className={`rounded-xl border ${week.isInProgress ? "border-primary/30 bg-primary/5" : "border-border bg-card"} overflow-hidden`}>
      {/* ── Collapsed header ── */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        onClick={() => hasDetail && setExpanded(e => !e)}
        disabled={!hasDetail}
      >
        {/* Week label */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
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
                <span className="text-xs font-bold text-foreground">
                  Week {wNum}
                </span>
              );
            })()}
            {week.isInProgress && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">In Progress</span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">{week.label}</span>
        </div>

        {/* Metrics */}
        {hasAnyData ? (
          <div className="flex items-center gap-4 shrink-0">
            {week.avgWeight != null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Wt</p>
                <p className="text-sm font-bold tabular-nums">{fmt(week.avgWeight)} kg</p>
                <Delta delta={weightDelta} unit="%" invert decimals={1} />
              </div>
            )}
            {week.avgWaist != null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waist</p>
                <p className="text-sm font-bold tabular-nums">{fmt(week.avgWaist)} cm</p>
                <Delta delta={waistDelta} unit=" cm" invert />
              </div>
            )}
            {week.avgSkinfold != null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Skinfold</p>
                <p className="text-sm font-bold tabular-nums">{fmt(week.avgSkinfold)} mm</p>
                <Delta delta={skinfoldDelta} unit=" mm" invert />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic shrink-0">No data</span>
        )}

        {/* Expand chevron */}
        {hasDetail && (
          <div className="ml-2 text-muted-foreground shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-3">
          {/* Weigh-ins — newest first */}
          {week.weighIns.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Daily Weigh-ins</p>
              <div className="space-y-0">
                {[...week.weighIns].sort((a, b) => b.logDate.localeCompare(a.logDate)).map((w) => (
                  <div key={w.logDate} className="flex items-center py-1 border-b border-border/40 last:border-0">
                    <span className="text-xs text-muted-foreground flex-1">{fmtDate(w.logDate)}</span>
                    <span className="text-xs font-medium tabular-nums text-right w-20">{w.weight.toFixed(1)} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Measurement entries — newest first */}
          {[...week.measurementEntries].sort((a, b) => b.measureDate.localeCompare(a.measureDate)).map((entry) => (
            <div key={entry.id}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Measurements — {fmtDate(entry.measureDate)}
              </p>
              <div className="space-y-0.5">
                {entry.waist != null && (
                  <div className="flex items-center py-1 border-b border-border/40">
                    <span className="text-xs text-muted-foreground flex-1">Waist</span>
                    <span className="text-xs font-medium tabular-nums text-right w-20">{entry.waist.toFixed(1)} cm</span>
                  </div>
                )}
                <SiteRow label="Umbilical" avg={entry.umbilical} readings={entry.umbilicalReadings} />
                <SiteRow label="Suprailiac" avg={entry.suprailiac} readings={entry.suprailiacReadings} />
                <SiteRow label="Calf" avg={entry.calf} readings={entry.calfReadings} />
                <SiteRow label="Thigh" avg={entry.thigh} readings={entry.thighReadings} />
                {entry.totalSkinfold != null && (
                  <div className="flex items-center py-1 pt-2">
                    <span className="text-xs font-semibold text-foreground flex-1">Total</span>
                    <span className="text-xs font-bold tabular-nums text-right w-20">{entry.totalSkinfold.toFixed(1)} mm</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WeeklyBodyCompCards({ clientId }: { clientId: number }) {
  const tzOffsetMinutes = -new Date().getTimezoneOffset();
  const { data: phasesData } = trpc.phases.list.useQuery(
    { clientId },
    { enabled: !!clientId }
  );
  const phases = (phasesData as any[]) ?? [];
  const { data, isLoading } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const weeks: Week[] = (data?.weeks ?? []) as Week[];

  // Filter to only weeks that have body-comp data, then sort newest-first
  const bodyCompWeeks = weeks
    .filter(
      w => w.avgWeight != null || w.avgWaist != null || w.avgSkinfold != null
        || w.weighIns?.length > 0 || w.measurementEntries?.length > 0
    )
    .slice()
    .sort((a, b) => b.weekNumber - a.weekNumber);

  if (bodyCompWeeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No body composition data yet</p>
        <p className="text-xs mt-1">Weigh-ins and measurements will appear here week by week.</p>
      </div>
    );
  }

  // Build a lookup so each card can find its previous (older) week for deltas
  const weekByNumber = Object.fromEntries(bodyCompWeeks.map(w => [w.weekNumber, w]));

  return (
    <div className="space-y-3">
      {bodyCompWeeks.map((week) => {
        // prevWeek is the week with weekNumber - 1 (the chronologically earlier week)
        const prevWeek = weekByNumber[week.weekNumber - 1] ?? null;
        return <WeekCard key={week.weekNumber} week={week} prevWeek={prevWeek} phases={phases} />;
      })}
    </div>
  );
}
