import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus } from "lucide-react";

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

type Week = {
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

function WeekCard({ week, prevWeek }: { week: Week; prevWeek: Week | null }) {
  const [expanded, setExpanded] = useState(false);

  const weightDeltaKg = week.avgWeight != null && prevWeek?.avgWeight != null
    ? week.avgWeight - prevWeek.avgWeight
    : null;
  const weightDeltaPct = weightDeltaKg != null && prevWeek?.avgWeight != null && prevWeek.avgWeight > 0
    ? parseFloat(((weightDeltaKg / prevWeek.avgWeight) * 100).toFixed(1))
    : null;
  const waistDelta = week.avgWaist != null && prevWeek?.avgWaist != null
    ? parseFloat((week.avgWaist - prevWeek.avgWaist).toFixed(1))
    : null;
  const skinfoldDelta = week.avgSkinfold != null && prevWeek?.avgSkinfold != null
    ? parseFloat((week.avgSkinfold - prevWeek.avgSkinfold).toFixed(1))
    : null;

  const hasAnyData = week.avgWeight != null || week.avgWaist != null || week.avgSkinfold != null;
  const hasDetail = week.weighIns.length > 0 || week.measurementEntries.length > 0;

  return (
    <div className={`rounded-xl border ${week.isInProgress ? "border-primary/30 bg-primary/5" : "border-border bg-card"} overflow-hidden`}>
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        onClick={() => hasDetail && setExpanded(e => !e)}
        disabled={!hasDetail}
      >
        <div className="min-w-0 flex-1">
          {week.isInProgress && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 mb-1 inline-block">In Progress</span>
          )}
          <span className="text-sm font-semibold text-foreground block">{week.label}</span>
        </div>

        {hasAnyData ? (
          <div className="flex items-center gap-4 shrink-0">
            {week.avgWeight != null && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Wt</p>
                <p className="text-sm font-bold tabular-nums">{fmt(week.avgWeight)} kg</p>
                <Delta delta={weightDeltaPct} unit="%" invert decimals={1} />
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

        {hasDetail && (
          <div className="ml-2 text-muted-foreground shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-3">
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

export function WeeklyBodyCompCards({ clientId }: { clientId: number }) {
  const tzOffsetMinutes = -new Date().getTimezoneOffset();
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

  const weeks: Week[] = (data?.weeks ?? []) as unknown as Week[];

  const bodyCompWeeks = weeks
    .filter(
      w => w.avgWeight != null || w.avgWaist != null || w.avgSkinfold != null
        || w.weighIns?.length > 0 || w.measurementEntries?.length > 0
    )
    .slice()
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  if (bodyCompWeeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No body composition data yet</p>
        <p className="text-xs mt-1">Weigh-ins and measurements will appear here week by week.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bodyCompWeeks.map((week, idx) => {
        const prevWeek = bodyCompWeeks[idx + 1] ?? null;
        return <WeekCard key={week.weekStart} week={week} prevWeek={prevWeek} />;
      })}
    </div>
  );
}
