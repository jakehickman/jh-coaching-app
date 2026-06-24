import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  avgWeightPct: number | null;
  avgWaist: number | null;
  avgHip: number | null;
  avgSkinfold: number | null;
  weighIns?: { logDate: string; weight: number }[];
  measurementEntries?: {
    id: number;
    measureDate: string;
    waist: number | null;
    hips: number | null;
    totalSkinfold: number | null;
    umbilical: number | null;
    suprailiac: number | null;
    calf: number | null;
    thigh: number | null;
    umbilicalReadings: (number | null)[];
    suprailiacReadings: (number | null)[];
    calfReadings: (number | null)[];
    thighReadings: (number | null)[];
  }[];
};

const DEFAULT_VISIBLE = 4;

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function WeekRow({ week, isExpanded, onToggle }: {
  week: Week;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasData =
    week.avgWeight != null ||
    week.avgWaist != null ||
    week.avgHip != null ||
    week.avgSkinfold != null ||
    (week.weighIns?.length ?? 0) > 0;

  const weighInCount = week.weighIns?.length ?? 0;
  const weightDeltaPct = week.avgWeightPct;

  return (
    <>
      <tr
        className={`border-b border-border/40 transition-colors ${
          week.isInProgress
            ? "bg-amber-500/5"
            : hasData
            ? "hover:bg-muted/20 cursor-pointer"
            : "opacity-40"
        }`}
        onClick={() => hasData && onToggle()}
      >
        {/* Week label */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {hasData ? (
              isExpanded
                ? <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                : <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
            ) : (
              <span className="w-3" />
            )}
            <div>
              <span className="text-xs font-semibold text-foreground">{week.label}</span>
              {week.isInProgress && (
                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Avg weight + delta + count */}
        <td className="px-3 py-2.5 text-right w-[20%]">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {week.avgWeight != null ? `${fmt(week.avgWeight)} kg` : "—"}
              </span>
              {weighInCount > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  ({weighInCount}d)
                </span>
              )}
            </div>
            {weightDeltaPct != null && (
              <span className={`text-[10px] font-semibold ${
                weightDeltaPct < 0 ? "text-green-400" : weightDeltaPct > 0 ? "text-red-400" : "text-muted-foreground"
              }`}>
                {weightDeltaPct > 0 ? "+" : ""}{weightDeltaPct.toFixed(2)}%
              </span>
            )}
          </div>
        </td>

        {/* Avg waist */}
        <td className="px-3 py-2.5 text-right w-[20%]">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgWaist != null ? `${fmt(week.avgWaist)} cm` : "—"}
          </span>
        </td>

        {/* Avg hip */}
        <td className="px-3 py-2.5 text-right w-[20%]">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgHip != null ? `${fmt(week.avgHip)} cm` : "—"}
          </span>
        </td>

        {/* Avg skinfold total */}
        <td className="px-3 py-2.5 text-right w-[20%]">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgSkinfold != null ? `${fmt(week.avgSkinfold)} mm` : "—"}
          </span>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && hasData && (
        <tr className="border-b border-border/40 bg-muted/10">
          <td colSpan={5} className="px-6 py-3">
            <div className="flex flex-wrap gap-6">
              {/* Daily weigh-ins */}
              {(week.weighIns ?? []).length > 0 && (
                <div className="min-w-[160px]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Daily Weigh-ins</p>
                  <div>
                    {[...(week.weighIns ?? [])].sort((a, b) => a.logDate.localeCompare(b.logDate)).map((wi) => {
                      const d = new Date(wi.logDate + "T00:00:00");
                      const label = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <div key={wi.logDate} className="flex items-center py-1 border-b border-border/30 last:border-0">
                          <span className="text-xs text-muted-foreground flex-1">{label}</span>
                          <span className="text-xs font-medium tabular-nums ml-4">{wi.weight.toFixed(1)} kg</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Measurement entries */}
              {(week.measurementEntries ?? []).length > 0 && (
                <div className="min-w-[260px]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Measurements</p>
                  {(week.measurementEntries ?? []).map((m) => {
                    const d = new Date(m.measureDate + "T00:00:00");
                    const label = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
                    const umbReadings = m.umbilicalReadings?.filter((v: any) => v != null) ?? [];
                    const supReadings = m.suprailiacReadings?.filter((v: any) => v != null) ?? [];
                    const calfReadings = m.calfReadings?.filter((v: any) => v != null) ?? [];
                    const thighReadings = m.thighReadings?.filter((v: any) => v != null) ?? [];
                    return (
                      <div key={m.id} className="mb-3 last:mb-0">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">{label}</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                          {m.waist != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">Waist</span>
                              <span className="text-[11px] font-medium tabular-nums">{m.waist.toFixed(1)} cm</span>
                            </div>
                          )}
                          {m.hips != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">Hip</span>
                              <span className="text-[11px] font-medium tabular-nums">{m.hips.toFixed(1)} cm</span>
                            </div>
                          )}
                          {m.totalSkinfold != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">Skinfold total</span>
                              <span className="text-[11px] font-medium tabular-nums">{m.totalSkinfold.toFixed(1)} mm</span>
                            </div>
                          )}
                          {m.umbilical != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">
                                Umbilical{umbReadings.length > 1 ? ` (avg)` : ""}
                              </span>
                              <span className="text-[11px] font-medium tabular-nums">
                                {m.umbilical.toFixed(1)} mm
                                {umbReadings.length > 1 && (
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    [{umbReadings.map((v: any) => v.toFixed(1)).join(", ")}]
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          {m.suprailiac != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">
                                Suprailiac{supReadings.length > 1 ? ` (avg)` : ""}
                              </span>
                              <span className="text-[11px] font-medium tabular-nums">
                                {m.suprailiac.toFixed(1)} mm
                                {supReadings.length > 1 && (
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    [{supReadings.map((v: any) => v.toFixed(1)).join(", ")}]
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          {m.calf != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">
                                Calf{calfReadings.length > 1 ? ` (avg)` : ""}
                              </span>
                              <span className="text-[11px] font-medium tabular-nums">
                                {m.calf.toFixed(1)} mm
                                {calfReadings.length > 1 && (
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    [{calfReadings.map((v: any) => v.toFixed(1)).join(", ")}]
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          {m.thigh != null && (
                            <div className="flex justify-between">
                              <span className="text-[11px] text-muted-foreground">
                                Thigh{thighReadings.length > 1 ? ` (avg)` : ""}
                              </span>
                              <span className="text-[11px] font-medium tabular-nums">
                                {m.thigh.toFixed(1)} mm
                                {thighReadings.length > 1 && (
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    [{thighReadings.map((v: any) => v.toFixed(1)).join(", ")}]
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function BodyCompSummaryTable({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const { data, isLoading, error } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  const weeks = (data?.weeks ?? []) as Week[];

  useEffect(() => {
    if (weeks.length === 0) return;
    const inProgress = weeks.find(w => w.isInProgress);
    if (inProgress) setExpanded(new Set([inProgress.weekStart]));
  }, [weeks.length]);

  function toggleRow(weekStart: string) {
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
          <Skeleton key={i} className="h-10 w-full bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (error || weeks.length === 0) return null;

  const visibleWeeks = showAll ? weeks : weeks.slice(0, DEFAULT_VISIBLE);
  const hasMore = weeks.length > DEFAULT_VISIBLE;

  return (
    <div>
      <SectionLabel>Weekly Summary</SectionLabel>
      <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[30%]">Week</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[17.5%]">Avg Weight</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[17.5%]">Waist</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[17.5%]">Hip</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[17.5%]">Skinfold</th>
              </tr>
            </thead>
            <tbody>
              {visibleWeeks.map((week) => (
                <WeekRow
                  key={week.weekStart}
                  week={week}
                  isExpanded={expanded.has(week.weekStart)}
                  onToggle={() => toggleRow(week.weekStart)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(v => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show less" : `Show all ${weeks.length} weeks`}
          </Button>
        </div>
      )}
    </div>
  );
}
