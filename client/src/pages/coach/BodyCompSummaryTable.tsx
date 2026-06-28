import { useState, useMemo } from "react";
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

        {/* Weigh-in count */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {weighInCount > 0 ? weighInCount : "—"}
          </span>
        </td>

        {/* Avg weight + delta */}
        <td className="px-3 py-2.5 text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {week.avgWeight != null ? `${fmt(week.avgWeight)} kg` : "—"}
            </span>
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
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgWaist != null ? `${fmt(week.avgWaist)} cm` : "—"}
          </span>
        </td>

        {/* Avg hip */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgHip != null ? `${fmt(week.avgHip)} cm` : "—"}
          </span>
        </td>

        {/* Avg skinfold total */}
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">
            {week.avgSkinfold != null ? `${fmt(week.avgSkinfold)} mm` : "—"}
          </span>
        </td>
      </tr>

      {/* Expanded detail — per-date sub-rows aligned to parent columns */}
      {isExpanded && hasData && (() => {
        // Build a map of date -> { weight, waist, hip, skinfold, sites }
        const byDate: Record<string, {
          weight?: number;
          waist?: number | null;
          hip?: number | null;
          skinfold?: number | null;
          sites?: { name: string; val: number }[];
        }> = {};

        for (const wi of (week.weighIns ?? [])) {
          byDate[wi.logDate] = { ...byDate[wi.logDate], weight: wi.weight };
        }
        for (const m of (week.measurementEntries ?? [])) {
          const sites = [
            m.umbilical != null ? { name: "Umbilical", val: m.umbilical } : null,
            m.suprailiac != null ? { name: "Suprailiac", val: m.suprailiac } : null,
            m.calf != null ? { name: "Calf", val: m.calf } : null,
            m.thigh != null ? { name: "Thigh", val: m.thigh } : null,
          ].filter(Boolean) as { name: string; val: number }[];
          byDate[m.measureDate] = {
            ...byDate[m.measureDate],
            waist: m.waist,
            hip: m.hips,
            skinfold: m.totalSkinfold,
            sites,
          };
        }

        const sortedDates = Object.keys(byDate).sort();

        return sortedDates.map((date) => {
          const row = byDate[date];
          const d = new Date(date + "T00:00:00");
          const dateLabel = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
          return (
            <tr key={date} className="border-b border-border/20 bg-muted/5 last:border-b-0">
              {/* Date — indented under Week column */}
              <td className="px-3 py-2">
                <span className="pl-5 text-[11px] text-muted-foreground">{dateLabel}</span>
              </td>
              {/* Weight (Weigh-ins column) */}
              <td className="px-3 py-2 text-right">
                <span className="text-[11px] tabular-nums text-foreground">
                  {row.weight != null ? `${row.weight.toFixed(1)} kg` : "—"}
                </span>
              </td>
              {/* Avg Weight column — blank for daily rows */}
              <td className="px-3 py-2" />
              {/* Waist */}
              <td className="px-3 py-2 text-right">
                <span className="text-[11px] tabular-nums text-foreground">
                  {row.waist != null ? `${row.waist.toFixed(1)} cm` : "—"}
                </span>
              </td>
              {/* Hip */}
              <td className="px-3 py-2 text-right">
                <span className="text-[11px] tabular-nums text-foreground">
                  {row.hip != null ? `${row.hip.toFixed(1)} cm` : "—"}
                </span>
              </td>
              {/* Skinfold */}
              <td className="px-3 py-2 text-right">
                <span className="text-[11px] tabular-nums text-foreground">
                  {row.skinfold != null ? `${row.skinfold.toFixed(1)} mm` : "—"}
                </span>
              </td>
            </tr>
          );
        });
      })()}
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
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[26%]">Week</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[14%]">Weigh-ins</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[15%]">Avg Weight</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[15%]">Waist</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[15%]">Hip</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[15%]">Skinfold</th>
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
