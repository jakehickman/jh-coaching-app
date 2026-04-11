import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDraft } from "@/hooks/useDraft";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Users, Dumbbell, Zap, ClipboardList, TrendingUp, GripVertical, BookOpen, Search, Pencil, X, Play, ExternalLink, Check, ChevronsUpDown, ArrowUp, ArrowDown, Minus, CheckSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Convert a DB date value (ISO timestamp or plain date string) to local yyyy-mm-dd
function toLocalDateStr(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s);
    // Use UTC date parts — MySQL DATE columns are stored as the correct calendar date
    // and returned as UTC midnight timestamps. Using local date parts would shift the
    // date back by one day for users in positive UTC offsets (e.g. AEST UTC+10).
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return s.slice(0, 10);
}

// Native HTML date picker — value and onChange use yyyy-mm-dd strings
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}
function MeasurementsCard({ latestM, prevM, latestSkinfold, prevSkinfold, skinfoldDiff, waistDiff, toLocalDateStr: toDateStr }: {
  latestM: Record<string, unknown>;
  prevM: Record<string, unknown> | null;
  latestSkinfold: number | null;
  prevSkinfold: number | null;
  skinfoldDiff: number | null;
  waistDiff: number | null;
  toLocalDateStr: (d: unknown) => string;
}) {
  const [showMeasureDetail, setShowMeasureDetail] = useState(false);
  const latestDate = toDateStr(latestM.measureDate).split("-").reverse().join("/");
  const prevDate = prevM ? toDateStr(prevM.measureDate).split("-").reverse().join("/") : null;

  function siteAvg(vals: (number | null | undefined)[]): number | null {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
  }
  const umbAvg = siteAvg([latestM.umbilical1 as number, latestM.umbilical2 as number, latestM.umbilical3 as number, latestM.umbilical4 as number, latestM.umbilical5 as number]);
  const supAvg = siteAvg([latestM.suprailiac1 as number, latestM.suprailiac2 as number, latestM.suprailiac3 as number, latestM.suprailiac4 as number, latestM.suprailiac5 as number]);
  const calfAvg = siteAvg([latestM.calf1 as number, latestM.calf2 as number, latestM.calf3 as number, latestM.calf4 as number, latestM.calf5 as number]);
  const thighAvg = siteAvg([latestM.thigh1 as number, latestM.thigh2 as number, latestM.thigh3 as number, latestM.thigh4 as number, latestM.thigh5 as number]);
  const prevUmbAvg = prevM ? siteAvg([prevM.umbilical1 as number, prevM.umbilical2 as number, prevM.umbilical3 as number, prevM.umbilical4 as number, prevM.umbilical5 as number]) : null;
  const prevSupAvg = prevM ? siteAvg([prevM.suprailiac1 as number, prevM.suprailiac2 as number, prevM.suprailiac3 as number, prevM.suprailiac4 as number, prevM.suprailiac5 as number]) : null;

  return (
    <div>
      <SectionLabel>Measurements</SectionLabel>
      <Card className="space-y-0 p-0 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Waist Circumference</p>
            <p className="text-xs text-muted-foreground mb-1">{latestDate}</p>
            {latestM.waist != null ? (
              <p className="text-2xl font-bold text-foreground">{latestM.waist as number}<span className="text-sm font-normal text-muted-foreground ml-1">cm</span></p>
            ) : (
              <p className="text-sm text-muted-foreground">&mdash;</p>
            )}
            {waistDiff != null && prevDate && (
              <p className={`text-xs font-semibold mt-1 ${waistDiff < 0 ? "text-green-400" : waistDiff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {waistDiff > 0 ? "+" : ""}{waistDiff} cm vs {prevDate}
              </p>
            )}
          </div>
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Skinfold Total</p>
            <p className="text-xs text-muted-foreground mb-1">{latestDate}</p>
            {latestSkinfold != null ? (
              <p className="text-2xl font-bold text-foreground">{latestSkinfold}<span className="text-sm font-normal text-muted-foreground ml-1">mm</span></p>
            ) : (
              <p className="text-sm text-muted-foreground">&mdash;</p>
            )}
            {skinfoldDiff != null && prevDate && (
              <p className={`text-xs font-semibold mt-1 ${skinfoldDiff < 0 ? "text-green-400" : skinfoldDiff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {skinfoldDiff > 0 ? "+" : ""}{skinfoldDiff} mm vs {prevDate}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowMeasureDetail(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-muted/20 transition-colors"
        >
          {showMeasureDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showMeasureDetail ? "Hide details" : "View site details"}
        </button>
        {showMeasureDetail && (
          <div className="border-t border-border bg-muted/10 p-4">
            <div className="grid grid-cols-2 gap-3">
              {([{ label: "Umbilical avg", value: umbAvg }, { label: "Suprailiac avg", value: supAvg }, { label: "Calf avg", value: calfAvg }, { label: "Thigh avg", value: thighAvg }] as { label: string; value: number | null }[]).map(({ label, value }) => (
                <div key={label} className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-lg font-bold text-foreground">
                    {value != null ? <>{value}<span className="text-xs font-normal text-muted-foreground ml-1">mm</span></> : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function MuscleGroupSection({ group, children, globalToggle }: { group: string; children: React.ReactNode; globalToggle?: { expanded: boolean; gen: number } | null }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [lastGen, setLastGen] = useState(0);
  // When a new global toggle fires (gen changed), sync local state to it
  useEffect(() => {
    if (globalToggle && globalToggle.gen !== lastGen) {
      setLocalOpen(globalToggle.expanded);
      setLastGen(globalToggle.gen);
    }
  }, [globalToggle, lastGen]);
  const open = localOpen;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setLocalOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3 bg-card">{children}</div>}
    </div>
  );
}

// ─── Progress History Table ─────────────────────────────────────────────────
// One row per week. Dual-line trend chart above the table.
// Change column = % of bodyweight gain/loss vs previous week.
function ProgressHistoryTable({
  logs,
  measurements,
  startDate,
}: {
  logs: DailyLogRow[];
  measurements: any[];
  startDate?: string | null;
}) {
  function siteAvg(vals: (number | null | undefined)[]): number | null {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
  }

  // ── Build weight and measurement maps ──────────────────────────────────────
  const weightByDate: Record<string, number> = {};
  for (const log of logs) {
    const iso = toLocalDateStr(log.logDate);
    if (!iso || log.weight == null) continue;
    if (startDate && iso < startDate) continue;
    weightByDate[iso] = log.weight as number;
  }

  const measByDate: Record<string, any> = {};
  for (const m of measurements) {
    const iso = toLocalDateStr(m.measureDate);
    if (!iso) continue;
    if (startDate && iso < startDate) continue;
    measByDate[iso] = m;
  }

  // ── Determine date range ────────────────────────────────────────────────────
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const allDates = [...Object.keys(weightByDate), ...Object.keys(measByDate)].sort();
  if (allDates.length === 0) return null;
  const firstDate = startDate && startDate <= allDates[0] ? startDate : allDates[0];

  // Generate every calendar day
  const days: string[] = [];
  const cursor = new Date(firstDate + "T00:00:00");
  const end = new Date(todayIso + "T00:00:00");
  while (cursor <= end) {
    days.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  // ── Group into Mon-Sun weeks ────────────────────────────────────────────────
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  for (const iso of days) {
    const dow = new Date(iso + "T00:00:00").getDay();
    if (dow === 1 && currentWeek.length > 0) { weeks.push(currentWeek); currentWeek = []; }
    currentWeek.push(iso);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // ── Compute per-week stats ──────────────────────────────────────────────────
  function weekAvg(wkDays: string[]): number | null {
    const ws = wkDays.map(d => weightByDate[d]).filter((v): v is number => v != null);
    return ws.length ? parseFloat((ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(2)) : null;
  }
  function weekEntries(wkDays: string[]): number {
    return wkDays.filter(d => weightByDate[d] != null).length;
  }
  // Best measurement in the week (prefer most recent)
  function weekMeas(wkDays: string[]): any | null {
    for (let i = wkDays.length - 1; i >= 0; i--) {
      if (measByDate[wkDays[i]]) return measByDate[wkDays[i]];
    }
    return null;
  }
  function fmtWeekLabel(wkDays: string[]): string {
    const fmt = (iso: string) => {
      const [, m, d] = iso.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${parseInt(d)} ${months[parseInt(m)-1]}`;
    };
    return `${fmt(wkDays[0])} – ${fmt(wkDays[wkDays.length-1])}`;
  }

  // Build rows oldest→newest for chart, newest→oldest for table display
  type WeekRow = {
    label: string;
    avg: number | null;
    entries: number;
    waist: number | null;
    skinfold: number | null;
    pctChange: number | null; // % vs previous week
  };
  const weekRows: WeekRow[] = weeks.map((wkDays, i) => {
    const avg = weekAvg(wkDays);
    const prevAvg = i > 0 ? weekAvg(weeks[i - 1]) : null;
    const pctChange = avg != null && prevAvg != null && prevAvg !== 0
      ? parseFloat(((avg - prevAvg) / prevAvg * 100).toFixed(2))
      : null;
    const m = weekMeas(wkDays);
    const umbAvg = m ? siteAvg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]) : null;
    const supAvg = m ? siteAvg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]) : null;
    const calfAvg = m ? siteAvg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]) : null;
    const thighAvg = m ? siteAvg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]) : null;
    const skinfoldSites = [umbAvg, supAvg, calfAvg, thighAvg].filter(v => v != null) as number[];
    const skinfold = skinfoldSites.length > 0 ? parseFloat(skinfoldSites.reduce((a, b) => a + b, 0).toFixed(1)) : null;
    return {
      label: fmtWeekLabel(wkDays),
      avg,
      entries: weekEntries(wkDays),
      waist: m?.waist ?? null,
      skinfold,
      pctChange,
    };
  });

  if (weekRows.length === 0) return null;

  // Chart data: oldest first
  const chartData = weekRows.map(r => ({
    week: r.label,
    weight: r.avg,
    skinfold: r.skinfold,
  }));

  // Table rows: newest first
  const tableRows = [...weekRows].reverse();

  const INITIAL_WEEKS = 4;
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const visibleRows = showAllWeeks ? tableRows : tableRows.slice(0, INITIAL_WEEKS);

  return (
    <div>
      <SectionLabel>Body Composition History</SectionLabel>
      <div className="space-y-3">
        {visibleRows.map((row, i) => {
          const isFirst = i === 0;
          const pctDown = row.pctChange != null && row.pctChange < 0;
          const pctUp = row.pctChange != null && row.pctChange > 0;
          const pctColor = row.pctChange == null ? 'text-muted-foreground' : pctDown ? 'text-green-400' : pctUp ? 'text-red-400' : 'text-muted-foreground';
          const pctBg = row.pctChange == null ? 'bg-secondary' : pctDown ? 'bg-green-500/15' : pctUp ? 'bg-red-500/15' : 'bg-secondary';
          const pctLabel = row.pctChange != null ? `${row.pctChange > 0 ? '+' : ''}${row.pctChange}%` : null;
          return (
            <div
              key={i}
              className={`rounded-xl border transition-colors ${
                isFirst ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              {/* Week header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  {isFirst && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wide">Latest</span>}
                  <p className={`text-sm font-semibold ${isFirst ? 'text-foreground' : 'text-muted-foreground'}`}>{row.label}</p>
                </div>
                <div className="flex items-center gap-2">
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-px bg-border mx-4 mb-3 rounded-lg overflow-hidden">
                <div className="bg-card px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Avg Weight</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-base font-bold ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                      {row.avg != null ? `${row.avg} kg` : <span className="text-muted-foreground text-sm">—</span>}
                    </p>
                    {pctLabel && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${pctColor} ${pctBg}`}>
                        {pctDown ? <ArrowDown size={9} /> : pctUp ? <ArrowUp size={9} /> : <Minus size={9} />}
                        {pctLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Waist Circumference</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-base font-bold ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                      {row.waist != null ? `${row.waist} cm` : <span className="text-muted-foreground text-sm">—</span>}
                    </p>
                    {(() => {
                      const prev = tableRows[i + 1]?.waist;
                      if (row.waist == null || prev == null) return null;
                      const diff = parseFloat((row.waist - prev).toFixed(1));
                      if (diff === 0) return null;
                      const isDown = diff < 0;
                      return (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                          isDown ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isDown ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
                          {diff > 0 ? '+' : ''}{diff} cm
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Skinfold Thickness</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-base font-bold ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                      {row.skinfold != null ? `${row.skinfold} mm` : <span className="text-muted-foreground text-sm">—</span>}
                    </p>
                    {(() => {
                      const prev = tableRows[i + 1]?.skinfold;
                      if (row.skinfold == null || prev == null) return null;
                      const diff = parseFloat((row.skinfold - prev).toFixed(1));
                      if (diff === 0) return null;
                      const isDown = diff < 0;
                      return (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                          isDown ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isDown ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
                          {diff > 0 ? '+' : ''}{diff} mm
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {tableRows.length > INITIAL_WEEKS && (
        <button
          onClick={() => setShowAllWeeks(v => !v)}
          className="mt-3 text-xs text-primary hover:underline w-full text-center"
        >
          {showAllWeeks ? `Show less` : `View ${tableRows.length - INITIAL_WEEKS} more week${tableRows.length - INITIAL_WEEKS !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

// ─── Recent Logs Panel ──────────────────────────────────────────────────────
type DailyLogRow = {
  id: number;
  logDate: unknown;
  weight?: number | null;
  sleepHours?: number | null;
  caffeineServings?: number | null;
  trainingCompleted?: boolean | number | null;
  trainingType?: string | null;
  stepsCount?: number | null;
  sleepQuality?: number | null;
  hungerLevel?: number | null;
  offPlanMeals?: number | null;
  notes?: string | null;
};

function RecentLogsPanel({ logs, visibleDays }: { logs: DailyLogRow[]; visibleDays?: string[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build a map of yyyy-mm-dd -> log
  const logMap: Record<string, DailyLogRow> = {};
  for (const log of logs) {
    const key = toLocalDateStr(log.logDate);
    if (key) logMap[key] = log;
  }

  // Use provided visibleDays or generate last 14 calendar days (today first)
  const days: string[] = visibleDays ?? (() => {
    const result: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    return result;
  })();

  function fmtDay(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function dayLabel(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { weekday: 'short' });
  }

  const isOffPlan = (v: unknown) => v === true || v === 1 || v === '1';
  const isTrained = (v: unknown) => v === true || v === 1 || v === '1';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {days.map((iso) => {
        const log = logMap[iso] ?? null;
        const isExpanded = expandedId === iso;
        const hasData = !!log;
        const trained = log ? isTrained(log.trainingCompleted) : false;
        const sessionLabel = log?.trainingType && log.trainingType !== 'Off'
          ? log.trainingType
          : (trained ? 'Training' : 'Rest');

        return (
          <div key={iso} className="border-b border-border last:border-0">
            {/* Summary row */}
            <button
              onClick={() => hasData && setExpandedId(isExpanded ? null : iso)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                hasData ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default opacity-50'
              }`}
            >
              {/* Left: date + day */}
              <div className="w-20 flex-shrink-0">
                <p className="text-sm font-semibold text-foreground">{fmtDay(iso)}</p>
                <p className="text-[10px] text-muted-foreground">{dayLabel(iso)}</p>
              </div>
              {/* Middle: chips */}
              <div className="flex-1 flex items-center gap-2 px-3 flex-wrap">
                {hasData ? (
                  <>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>{sessionLabel}</span>
                    {(log.offPlanMeals ?? 0) > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400">{(log.offPlanMeals ?? 0) > 1 ? `${log.offPlanMeals} Off Plan Meals` : 'Off Plan Meal'}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No entry</span>
                )}
              </div>
              {/* Right: weight + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasData && log.weight != null && (
                  <span className="text-sm font-semibold text-foreground">{log.weight} kg</span>
                )}
                {hasData && (isExpanded
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && log && (
              <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3">
                  {log.weight != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p><p className="text-sm font-semibold text-foreground">{log.weight} kg</p></div>
                  )}
                  {log.stepsCount != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Steps</p><p className="text-sm font-semibold text-foreground">{log.stepsCount.toLocaleString()}</p></div>
                  )}
                  {log.sleepHours != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Hours</p><p className="text-sm font-semibold text-foreground">{log.sleepHours} hrs</p></div>
                  )}
                  {log.sleepQuality != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Quality</p><p className="text-sm font-semibold text-foreground">{log.sleepQuality}/5</p></div>
                  )}
                  {log.hungerLevel != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hunger</p><p className="text-sm font-semibold text-foreground">{log.hungerLevel}/5</p></div>
                  )}
                  {log.caffeineServings != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Caffeine</p><p className="text-sm font-semibold text-foreground">{log.caffeineServings} srv</p></div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Training</p>
                    <p className="text-sm font-semibold text-foreground">{sessionLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Meals</p>
                    <p className="text-sm font-semibold text-foreground">{(log.offPlanMeals ?? 0) > 0 ? `${log.offPlanMeals} off-plan` : 'On Plan'}</p>
                  </div>
                </div>
                {log.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-foreground italic">{log.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sortable Schedule Slot ─────────────────────────────────────────────────
function SortableScheduleSlot({
  id, slot, index, dayOptions, onUpdate, onRemove, isLast
}: {
  id: string;
  slot: string;
  index: number;
  dayOptions: string[];
  onUpdate: (i: number, val: string) => void;
  onRemove: (i: number) => void;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5 touch-none"
      >
        <GripVertical size={12} />
      </div>
      <select
        value={slot}
        onChange={e => onUpdate(index, e.target.value)}
        className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {dayOptions.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive">
        <Trash2 size={12} />
      </button>
      {!isLast && (
        <span className="text-muted-foreground/40 text-xs select-none">/</span>
      )}
    </div>
  );
}

// ─── Sortable Exercise Row ───────────────────────────────────────────────────
function SortableExerciseRow({
  id, ex, dayIdx, exIdx, updateExercise, removeExercise, exerciseNames, addExercise, totalExercises
}: {
  id: string;
  ex: any;
  dayIdx: number;
  exIdx: number;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  removeExercise: (d: number, e: number) => void;
  exerciseNames: string[];
  addExercise: (dayIdx: number) => void;
  totalExercises: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [showNotes, setShowNotes] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const setsRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const filtered = searchTerm.length > 0
    ? exerciseNames.filter(n => n.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 8)
    : exerciseNames.slice(0, 8);

  // Focus the exercise input on the next row, or add a new row if this is the last one
  const focusNextRow = () => {
    const isLastRow = exIdx === totalExercises - 1;
    if (isLastRow) {
      addExercise(dayIdx);
      // After state update, focus will be handled by the new row mounting
      setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(
          `[data-day="${dayIdx}"][data-ex="${exIdx + 1}"][data-field="exercise"]`
        );
        nextInput?.focus();
      }, 50);
    } else {
      const nextInput = document.querySelector<HTMLInputElement>(
        `[data-day="${dayIdx}"][data-ex="${exIdx + 1}"][data-field="exercise"]`
      );
      nextInput?.focus();
    }
  };

  const handleExerciseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightedIdx >= 0 ? highlightedIdx : 0;
        updateExercise(dayIdx, exIdx, "name", filtered[idx]);
        setSearchTerm("");
        setDropdownOpen(false);
        setHighlightedIdx(-1);
        setTimeout(() => setsRef.current?.focus(), 0);
      } else if (e.key === "Escape") {
        setDropdownOpen(false);
        setHighlightedIdx(-1);
      } else if (e.key === "Tab") {
        // Let Tab close dropdown and move to sets naturally
        setDropdownOpen(false);
        setHighlightedIdx(-1);
      }
    } else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      if (e.key === "Enter") e.preventDefault();
      setsRef.current?.focus();
    }
  };

  const handleSetsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      if (e.key === "Enter") { e.preventDefault(); repsRef.current?.focus(); }
    }
  };

  const handleRepsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNextRow();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="grid grid-cols-12 gap-1 items-center">
        <div
          {...attributes}
          {...listeners}
          className="col-span-1 flex justify-center text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground touch-none"
        >
          <GripVertical size={13} />
        </div>
        {/* Searchable exercise dropdown */}
        <div className="col-span-6 relative">
          <input
            type="text"
            data-day={dayIdx}
            data-ex={exIdx}
            data-field="exercise"
            value={dropdownOpen ? searchTerm : ex.name}
            onChange={e => { setSearchTerm(e.target.value); setDropdownOpen(true); setHighlightedIdx(-1); }}
            onFocus={() => { setSearchTerm(""); setDropdownOpen(true); setHighlightedIdx(-1); }}
            onBlur={() => setTimeout(() => { setDropdownOpen(false); setHighlightedIdx(-1); }, 150)}
            onKeyDown={handleExerciseKeyDown}
            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {dropdownOpen && filtered.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {filtered.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => {
                    updateExercise(dayIdx, exIdx, "name", name);
                    setSearchTerm("");
                    setDropdownOpen(false);
                    setHighlightedIdx(-1);
                    setTimeout(() => setsRef.current?.focus(), 0);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    idx === highlightedIdx
                      ? "bg-primary/20 text-primary"
                      : "text-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={setsRef}
          type="text"
          value={ex.sets}
          onChange={e => updateExercise(dayIdx, exIdx, "sets", e.target.value)}
          onKeyDown={handleSetsKeyDown}
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
        <input
          ref={repsRef}
          type="text"
          value={ex.reps}
          onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
          onKeyDown={handleRepsKeyDown}
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="col-span-1 flex items-center gap-0.5">
          <button
            onClick={() => setShowNotes(n => !n)}
            title="Toggle notes"
            className={`flex justify-center transition-colors ${showNotes || ex.notes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ChevronDown size={12} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => removeExercise(dayIdx, exIdx)} className="flex justify-center text-destructive hover:opacity-80">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {showNotes && (
        <div className="pl-6">
          <input
            type="text"
            value={ex.notes ?? ""}
            onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)}

            className="w-full bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:text-foreground"
          />
        </div>
      )}
    </div>
  );
}

// ─── Food Combobox ──────────────────────────────────────────────────────────
function FoodCombobox({
  value, onChange, foodNames, onSelectAdvance, mealIdx, itemIdx
}: {
  value: string;
  onChange: (v: string) => void;
  foodNames: string[];
  onSelectAdvance?: () => void;
  mealIdx?: number;
  itemIdx?: number;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const filtered = search.length > 0
    ? foodNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : foodNames.slice(0, 10);

  const selectItem = (name: string) => {
    onChange(name);
    setSearch("");
    setOpen(false);
    setHighlightedIdx(-1);
    setTimeout(() => onSelectAdvance?.(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectItem(filtered[highlightedIdx >= 0 ? highlightedIdx : 0]);
      } else if (e.key === "Escape") {
        setOpen(false);
        setHighlightedIdx(-1);
      } else if (e.key === "Tab") {
        setOpen(false);
        setHighlightedIdx(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelectAdvance?.();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        data-meal={mealIdx}
        data-item={itemIdx}
        data-field="food"
        value={open ? search : value}
        onChange={e => { setSearch(e.target.value); setOpen(true); setHighlightedIdx(-1); }}
        onFocus={() => { setSearch(""); setOpen(true); setHighlightedIdx(-1); }}
        onBlur={() => setTimeout(() => { setOpen(false); setHighlightedIdx(-1); }, 150)}
        onKeyDown={handleKeyDown}
        placeholder="Search food…"
        className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={() => selectItem(name)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                idx === highlightedIdx
                  ? "bg-primary/20 text-primary"
                  : "text-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {open && search.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl px-3 py-2">
          <p className="text-xs text-muted-foreground">No foods match "{search}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Client Selector ──────────────────────────────────────────────────────────
function useClientSelector() {
  const { data: allUsers } = trpc.users.list.useQuery();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const clients = allUsers ?? [];

  useEffect(() => {
    if (clients.length > 0 && !selectedUserId) {
      setSelectedUserId(clients[0].id);
    }
  }, [clients]);

  return { clients, selectedUserId, setSelectedUserId };
}

// ─── Searchable Client Combobox ────────────────────────────────────────────────
function ClientCombobox({
  clients,
  selectedUserId,
  onSelect,
  latestCheckIns = [],
}: {
  clients: { id: number; name?: string | null }[];
  selectedUserId: number | null;
  onSelect: (id: number) => void;
  latestCheckIns?: { clientId: number; submittedAt: Date | string }[];
}) {
  const [open, setOpen] = useState(false);
  const [seenKeys, setSeenKeys] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(k.replace('coach:seen:checkin:', ''), 10);
        out[id] = parseInt(localStorage.getItem(k) ?? '0', 10);
      }
    }
    return out;
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(e.key.replace('coach:seen:checkin:', ''), 10);
        setSeenKeys(prev => ({ ...prev, [id]: parseInt(e.newValue ?? '0', 10) }));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const selected = clients.find(c => c.id === selectedUserId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-xs justify-between bg-card border-border text-foreground hover:bg-secondary"
        >
          <span className="truncate">{selected ? (selected.name ?? `User ${selected.id}`) : "Select client…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {clients.map(c => {
                const ci = latestCheckIns.find(x => x.clientId === c.id);
                const ciTime = ci ? new Date(ci.submittedAt).getTime() : 0;
                const seenTime = seenKeys[c.id] ?? 0;
                const hasRecentCheckIn = ci && Math.floor((Date.now() - ciTime) / 86400000) <= 7 && ciTime > seenTime;
                return (
                  <CommandItem
                    key={c.id}
                    value={c.name ?? `User ${c.id}`}
                    onSelect={() => {
                      onSelect(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${selectedUserId === c.id ? "opacity-100" : "opacity-0"}`} />
                    <span className="flex items-center gap-1.5">
                      {c.name ?? `User ${c.id}`}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Section: Clients ─────────────────────────────────────────────────────────
function ClientsSection() {
  const { data: allUsers, refetch } = trpc.users.list.useQuery();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const [seenKeys, setSeenKeys] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(k.replace('coach:seen:checkin:', ''), 10);
        out[id] = parseInt(localStorage.getItem(k) ?? '0', 10);
      }
    }
    return out;
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(e.key.replace('coach:seen:checkin:', ''), 10);
        setSeenKeys(prev => ({ ...prev, [id]: parseInt(e.newValue ?? '0', 10) }));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  const utils = trpc.useUtils();
  const setApproved = trpc.users.setApproved.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Access updated");
    },
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setSelectedId(null);
      toast.success("User deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: profile } = trpc.profile.getById.useQuery(
    { userId: selectedId! },
    { enabled: !!selectedId }
  );
  const upsertProfile = trpc.profile.upsertForClient.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const updateClientConfig = trpc.clientConfig.update.useMutation({
    onSuccess: () => {
      toast.success("Config updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const [form, setForm] = useState({
    displayName: "",
    startDate: "", notes: "",
    checkInDay: "" as "" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
    stepGoal: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: (profile as any).displayName ?? "",
        startDate: profile.startDate ? toLocalDateStr(profile.startDate) : "",
        notes: profile.notes ?? "",
        checkInDay: ((profile as any).checkInDay ?? "") as any,
        stepGoal: (profile as any).stepGoal?.toString() ?? "",
      });
    } else {
      setForm({ displayName: "", startDate: "", notes: "", checkInDay: "", stepGoal: "" });
    }
  }, [profile, selectedId]);

  const clients = allUsers ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center gap-3">
          <Users size={16} className="text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Clients</p>
            <p className="text-xl font-bold text-foreground">{clients.length}</p>
          </div>
        </div>
      </div>

      {/* Two-column desktop layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Left: client list */}
        <div>
          <SectionLabel>All Users</SectionLabel>
          <div className="space-y-1.5">
            {(allUsers ?? []).map(user => (
              <div
                key={user.id}
                onClick={() => setSelectedId(user.id === selectedId ? null : user.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === user.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  {null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name ?? "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email ?? "No email"}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${user.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {user.role}
                  </span>
                  {user.role !== "admin" && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setApproved.mutate({ userId: user.id, approved: !(user as any).approved });
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                          (user as any).approved
                            ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20"
                            : "border-border text-muted-foreground bg-secondary hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        {(user as any).approved ? "Approved" : "Approve"}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Delete ${user.name ?? 'this user'}? This cannot be undone.`)) {
                            deleteUser.mutate({ userId: user.id });
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete user"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: profile form */}
        {selectedId ? (
          <div className="space-y-4">
            {(
              <Card className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                    <DateInput value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Check-in Day</label>
                    <select
                      value={form.checkInDay}
                      onChange={e => setForm(p => ({ ...p, checkInDay: e.target.value as any }))}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Not set</option>
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Daily Step Goal</label>
                    <input
                      type="number"
                      value={form.stepGoal}
                      onChange={e => setForm(p => ({ ...p, stepGoal: e.target.value }))}
                      placeholder="e.g. 10000"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <button
                  onClick={() => {
                    upsertProfile.mutate({
                      userId: selectedId,
                      displayName: form.displayName || undefined,
                      startDate: form.startDate || undefined,
                      notes: form.notes || null,
                    });
                    updateClientConfig.mutate({
                      userId: selectedId,
                      checkInDay: form.checkInDay || null,
                      stepGoal: form.stepGoal ? parseInt(form.stepGoal) : null,
                    });
                  }}
                  disabled={upsertProfile.isPending || updateClientConfig.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {(upsertProfile.isPending || updateClientConfig.isPending) ? 'Saving...' : 'Save Profile'}
                </button>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            Select a client to view their profile
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Training Programs ───────────────────────────────────────────────
function SortableDayCard({
  id, day, dayIdx, sensors, updateDay, removeDay, addExercise, removeExercise, updateExercise, handleExDragEnd, exerciseNames
}: {
  id: string; day: any; dayIdx: number; sensors: any;
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  handleExDragEnd: (dayIdx: number) => (event: DragEndEvent) => void;
  exerciseNames: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div {...attributes} {...listeners} className="text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground touch-none flex-shrink-0">
            <GripVertical size={15} />
          </div>
          <input type="text" value={day.name} onChange={e => updateDay(dayIdx, "name", e.target.value)}
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium" />
          <button onClick={() => removeDay(dayIdx)} className="text-destructive hover:opacity-80 flex-shrink-0">
            <Trash2 size={15} />
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1 px-1">
            <p className="col-span-1"></p>
            <p className="col-span-6 text-[10px] text-muted-foreground">Exercise</p>
            <p className="col-span-2 text-[10px] text-muted-foreground text-center">Sets</p>
            <p className="col-span-2 text-[10px] text-muted-foreground text-center">Reps</p>
            <p className="col-span-1"></p>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExDragEnd(dayIdx)}>
            <SortableContext
              items={(day.exercises ?? []).map((_: any, j: number) => `ex-${dayIdx}-${j}`)}
              strategy={verticalListSortingStrategy}
            >
              {(day.exercises ?? []).map((ex: any, j: number) => (
                <SortableExerciseRow
                  key={`ex-${dayIdx}-${j}`}
                  id={`ex-${dayIdx}-${j}`}
                  ex={ex}
                  dayIdx={dayIdx}
                  exIdx={j}
                  updateExercise={updateExercise}
                  removeExercise={removeExercise}
                  exerciseNames={exerciseNames}
                  addExercise={addExercise}
                  totalExercises={(day.exercises ?? []).length}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button onClick={() => addExercise(dayIdx)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
            <Plus size={12} /> Add Exercise
          </button>
        </div>
      </Card>
    </div>
  );
}

function TrainingSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const { data: program, refetch } = trpc.training.getForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const trainingDraftKey = selectedUserId ? `draft:training:${selectedUserId}` : null;

  const [programName, setProgramName] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<string[]>([]);

  // Snapshot of the last server-saved state — used to detect genuine changes
  const trainingSavedSnapshot = useRef<{ programName: string; notes: string; days: any[]; schedule: string[] } | null>(null);

  const upsert = trpc.training.upsert.useMutation({
    onSuccess: () => {
      // Update snapshot to current state and clear draft
      trainingSavedSnapshot.current = { programName, notes, days, schedule };
      if (trainingDraftKey) { try { localStorage.removeItem(trainingDraftKey); } catch {} }
      toast.success("Training program saved"); refetch();
    }
  });

  // Write draft only when state genuinely differs from the saved snapshot
  useEffect(() => {
    if (!trainingDraftKey || !trainingSavedSnapshot.current) return;
    const snap = trainingSavedSnapshot.current;
    const isDirty =
      programName !== snap.programName ||
      notes !== snap.notes ||
      JSON.stringify(days) !== JSON.stringify(snap.days) ||
      JSON.stringify(schedule) !== JSON.stringify(snap.schedule);
    if (isDirty) {
      try { localStorage.setItem(trainingDraftKey, JSON.stringify({ programName, notes, days, schedule })); window.dispatchEvent(new Event("draft-changed")); } catch {}
    } else {
      try { localStorage.removeItem(trainingDraftKey); } catch {}
    }
  }, [trainingDraftKey, programName, notes, days, schedule]);
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();

  // ── Volume calculation ──────────────────────────────────────────────────────
  const volumeTable = (() => {
    if (!days.length) return null;
    // Frequency multiplier: 7 / number of slots in the rotation (Off counts as a slot)
    const cycleLengthDays = schedule.length > 0 ? schedule.length : days.length;
    const multiplier = 7 / cycleLengthDays;

    // Build a map of exercise name -> muscle contributions from the library
    const libMap = new Map<string, Record<string, number>>();
    for (const ex of exerciseLib) {
      const contributions: Record<string, number> = {};
      for (const mg of MUSCLE_GROUPS) {
        const val = (ex as any)[mg.key] as number ?? 0;
        if (val > 0) contributions[mg.key] = val;
      }
      libMap.set(ex.name.toLowerCase(), contributions);
    }

    // Per-day totals
    const dayTotals: Record<string, Record<string, number>> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      dayTotals[dayName] = {};
      for (const ex of (day.exercises ?? [])) {
        const sets = parseFloat(ex.sets) || 0;
        const contrib = libMap.get((ex.name ?? "").toLowerCase());
        if (!contrib || sets === 0) continue;
        for (const [mgKey, val] of Object.entries(contrib)) {
          dayTotals[dayName][mgKey] = (dayTotals[dayName][mgKey] ?? 0) + sets * val;
        }
      }
    }

    // Weekly totals
    const weeklyTotals: Record<string, number> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      // How many times does this day appear in the schedule?
      const occurrences = schedule.length > 0
        ? schedule.filter(s => s === dayName).length
        : 1;
      for (const [mgKey, val] of Object.entries(dayTotals[dayName] ?? {})) {
        weeklyTotals[mgKey] = (weeklyTotals[mgKey] ?? 0) + val * occurrences;
      }
    }
    // Apply multiplier to weekly totals
    for (const key of Object.keys(weeklyTotals)) {
      weeklyTotals[key] = Math.round(weeklyTotals[key] * multiplier);
    }

    return { dayTotals, weeklyTotals, multiplier };
  })();
  const trainingServerLoadedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedUserId) return;
    if (trainingServerLoadedRef.current === selectedUserId) return; // already loaded
    if (program === undefined) return; // still fetching
    const serverName = program?.programName ?? "";
    const serverNotes = program?.notes ?? "";
    const serverDays = (program?.days as any[]) ?? [];
    const serverSchedule = (program?.schedule as string[]) ?? [];
    setProgramName(serverName);
    setNotes(serverNotes);
    setDays(serverDays);
    setSchedule(serverSchedule);
    trainingSavedSnapshot.current = { programName: serverName, notes: serverNotes, days: serverDays, schedule: serverSchedule };
    // Clear any stale draft since we just loaded fresh server data
    if (trainingDraftKey) { try { localStorage.removeItem(trainingDraftKey); } catch {} }
    trainingServerLoadedRef.current = selectedUserId;
  }, [program, selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addDay = () => setDays(d => [...d, { name: `Day ${d.length + 1}`, focus: "", exercises: [] }]);
  const removeDay = (i: number) => setDays(d => d.filter((_, idx) => idx !== i));
  const updateDay = (i: number, field: string, value: string) =>
    setDays(d => d.map((day, idx) => idx === i ? { ...day, [field]: value } : day));
  const addExercise = (dayIdx: number) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: [...(day.exercises ?? []), { name: "", sets: "", reps: "", notes: "" }] }
      : day));
  const removeExercise = (dayIdx: number, exIdx: number) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: day.exercises.filter((_: any, i: number) => i !== exIdx) }
      : day));
  const updateExercise = (dayIdx: number, exIdx: number, field: string, value: string) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: day.exercises.map((ex: any, i: number) => i === exIdx ? { ...ex, [field]: value } : ex) }
      : day));
  const reorderExercises = (dayIdx: number, oldIndex: number, newIndex: number) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: arrayMove(day.exercises, oldIndex, newIndex) }
      : day));
  const reorderDays = (oldIndex: number, newIndex: number) =>
    setDays(d => arrayMove(d, oldIndex, newIndex));
  const reorderSchedule = (oldIndex: number, newIndex: number) =>
    setSchedule(s => arrayMove(s, oldIndex, newIndex));
  const handleScheduleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('slot-', ''));
      const newIndex = parseInt(String(over.id).replace('slot-', ''));
      if (!isNaN(oldIndex) && !isNaN(newIndex)) reorderSchedule(oldIndex, newIndex);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleExDragEnd = (dayIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const exercises = days[dayIdx]?.exercises ?? [];
      const oldIndex = exercises.findIndex((_: any, i: number) => `ex-${dayIdx}-${i}` === active.id);
      const newIndex = exercises.findIndex((_: any, i: number) => `ex-${dayIdx}-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorderExercises(dayIdx, oldIndex, newIndex);
    }
  };
  const handleDayDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = days.findIndex((_: any, i: number) => `day-${i}` === active.id);
      const newIndex = days.findIndex((_: any, i: number) => `day-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorderDays(oldIndex, newIndex);
    }
  };
  // Schedule helpers
  const dayOptions = ["Off", ...days.map(d => d.name || `Day ${days.indexOf(d) + 1}`)];
  const addScheduleSlot = () => setSchedule(s => [...s, days[0]?.name || "Day 1"]);
  const removeScheduleSlot = (i: number) => setSchedule(s => s.filter((_, idx) => idx !== i));
  const updateScheduleSlot = (i: number, val: string) => setSchedule(s => s.map((v, idx) => idx === i ? val : v));

  return (
    <div className="space-y-6">
      <div>
        <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} />
      </div>
      {selectedUserId && (
        <div className="space-y-6">
          {/* ── Training Schedule ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Training Schedule</label>
              <span className="text-[10px] text-muted-foreground/60">defines the rotation for this client</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleScheduleDragEnd}>
              <SortableContext items={schedule.map((_, i) => `slot-${i}`)} strategy={horizontalListSortingStrategy}>
                <div className="flex flex-wrap gap-2 items-center">
                  {schedule.map((slot, i) => (
                    <SortableScheduleSlot
                      key={`slot-${i}`}
                      id={`slot-${i}`}
                      slot={slot}
                      index={i}
                      dayOptions={dayOptions}
                      onUpdate={updateScheduleSlot}
                      onRemove={removeScheduleSlot}
                      isLast={i === schedule.length - 1}
                    />
                  ))}
                  <button
                    onClick={addScheduleSlot}
                    className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  >
                    <Plus size={11} /> Add
                  </button>
                  {schedule.length > 0 && (
                    <span className="text-[10px] text-primary/70 ml-1">→ repeat</span>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            {schedule.length > 0 && (
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                {schedule.join(" / ")} / repeat
              </p>
            )}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
            <SortableContext items={days.map((_: any, i: number) => `day-${i}`)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {days.map((day, i) => (
                  <SortableDayCard
                    key={`day-${i}`}
                    id={`day-${i}`}
                    day={day}
                    dayIdx={i}
                    sensors={sensors}
                    updateDay={updateDay}
                    removeDay={removeDay}
                    addExercise={addExercise}
                    removeExercise={removeExercise}
                    updateExercise={updateExercise}
                    handleExDragEnd={handleExDragEnd}
                    exerciseNames={(exerciseLib as any[]).map((e: any) => e.name).sort()}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button onClick={addDay}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center">
            <Plus size={14} /> Add Training Day
          </button>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Coach Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
           <button
            onClick={() => upsert.mutate({ userId: selectedUserId, programName: programName || null, days, schedule: schedule.length > 0 ? schedule : undefined, notes: notes || null })}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {upsert.isPending ? "Saving..." : "Save Training Program"}
          </button>
          {/* ── Weekly Volume Table ── */}
          {volumeTable && (
            <div>
              <SectionLabel>Weekly Volume Summary</SectionLabel>
              <p className="text-xs text-muted-foreground mb-3">
                Cycle: {schedule.length > 0 ? schedule.length : days.length} days · Multiplier: ×{volumeTable.multiplier.toFixed(3)} · Values = sets per week
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[120px]">Muscle</th>
                      {days.map(d => (
                        <th key={d.name} className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">{d.name || "Unnamed"}</th>
                      ))}
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-primary font-semibold text-center min-w-[80px]">Weekly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...MUSCLE_GROUPS]
                      .sort((a, b) => (volumeTable.weeklyTotals[b.key] ?? 0) - (volumeTable.weeklyTotals[a.key] ?? 0))
                      .map(mg => {
                      const weekly = volumeTable.weeklyTotals[mg.key] ?? 0;
                      if (weekly === 0) return null;
                      return (
                        <tr key={mg.key} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-4 py-2 font-medium text-foreground text-sm sticky left-0 bg-card">{mg.label}</td>
                          {days.map(d => {
                            const val = volumeTable.dayTotals[d.name || "Unnamed"]?.[mg.key] ?? 0;
                            return (
                              <td key={d.name} className="px-3 py-2 text-center">
                                {val > 0 ? (
                                  <span className="text-sm text-foreground/80">{Math.round(val * 10) / 10}</span>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              weekly >= 10 ? "bg-primary/20 text-primary" :
                              weekly >= 6 ? "bg-primary/10 text-primary/80" :
                              "bg-secondary text-muted-foreground"
                            }`}>{weekly}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Only muscle groups with &gt;0 weekly sets are shown. Match exercise names exactly to the Exercise Library for accurate tracking.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ─── Section: Meal Plans ──────────────────────────────────────────────────────
// Helper: compute macros for a single item given food db and grams (or servings)
// item.grams stores either grams (per-100g foods) or servings count (unit-based foods)
function calcItemMacros(foodDb: any[], foodName: string, amount: number) {
  const food = foodDb.find(f => f.name === foodName);
  if (!food || !amount) return { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
  // If food has a serving unit, amount = number of servings; convert to grams
  const grams = food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor),
    carbs: Math.round(food.carbs * factor),
    fiber: Math.round(food.fiber * factor),
    fat: Math.round(food.fat * factor),
  };
}
// Helper: get the effective grams for a food item (for display)
function getItemGrams(foodDb: any[], foodName: string, amount: number): number | null {
  const food = foodDb.find(f => f.name === foodName);
  if (!food || !amount) return null;
  return food.servingUnit && food.servingGrams ? Math.round(amount * food.servingGrams) : amount;
}

function MacroChip({ label, value, displayValue, unit = "g", highlight = false }: { label: string; value?: number; displayValue?: string; unit?: string; highlight?: boolean }) {
  const shown = displayValue ?? (value !== undefined ? `${value}` : "—");
  const suffix = shown === "—" ? "" : unit === "kcal" ? " kcal" : "g";
  return (
    <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${highlight ? "bg-primary/15 border border-primary/30" : "bg-secondary/60"}` }>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{shown}{suffix}</span>
    </div>
  );
}

function MealPlansSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: plan, refetch } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType },
    { enabled: !!selectedUserId }
  );
  const oppositeDay = dayType === "training" ? "rest" : "training";
  const { data: oppositePlan } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType: oppositeDay },
    { enabled: !!selectedUserId }
  );
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();
  const mealDraftKey = selectedUserId ? `draft:mealPlan:${selectedUserId}:${dayType}` : null;

  const [planNotes, setPlanNotes] = useState("");
  const [meals, setMeals] = useState<any[]>([]);

  // Snapshot of the last server-saved state — used to detect genuine changes
  const mealSavedSnapshot = useRef<{ planNotes: string; meals: any[] } | null>(null);

  const upsert = trpc.mealPlan.upsert.useMutation({
    onSuccess: () => {
      // Update snapshot to current state and clear draft
      mealSavedSnapshot.current = { planNotes, meals };
      if (mealDraftKey) { try { localStorage.removeItem(mealDraftKey); } catch {} }
      toast.success("Meal plan saved"); refetch();
    }
  });

  // Load server data into state and update snapshot when plan or client/dayType changes
  const mealLoadKey = selectedUserId ? `${selectedUserId}:${dayType}` : null;
  const mealServerLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mealLoadKey) return;
    if (mealServerLoadedRef.current === mealLoadKey) return; // already loaded for this key
    if (plan === undefined) return; // still fetching
    const serverNotes = plan?.notes ?? "";
    const serverMeals = (plan?.meals as any[]) ?? [];
    setPlanNotes(serverNotes);
    setMeals(serverMeals);
    mealSavedSnapshot.current = { planNotes: serverNotes, meals: serverMeals };
    // Clear any stale draft for this key since we just loaded fresh server data
    const draftKey = `draft:mealPlan:${mealLoadKey}`;
    try { localStorage.removeItem(draftKey); } catch {}
    mealServerLoadedRef.current = mealLoadKey;
  }, [plan, mealLoadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Write draft only when state genuinely differs from the saved snapshot
  useEffect(() => {
    if (!mealDraftKey || !mealSavedSnapshot.current) return;
    const snap = mealSavedSnapshot.current;
    const isDirty =
      planNotes !== snap.planNotes ||
      JSON.stringify(meals) !== JSON.stringify(snap.meals);
    if (isDirty) {
      try { localStorage.setItem(mealDraftKey, JSON.stringify({ planNotes, meals })); window.dispatchEvent(new Event("draft-changed")); } catch {}
    } else {
      try { localStorage.removeItem(mealDraftKey); } catch {}
    }
  }, [mealDraftKey, planNotes, meals]);

  // Auto-calculate macros from food db (specific_foods) or from targets (macro_targets)
  // For macro_targets meals:
  //   calories: use max (ceiling), prefix ~
  //   protein: use min (floor), prefix ≥
  //   carbs/fat: use max if set, else min; if any meal has no value → show — for that macro
  const mealMacros = meals.map(meal => {
    if (meal.type === "macro_targets") {
      return {
        calories: parseFloat(meal.targetCaloriesMax) || parseFloat(meal.targetCaloriesMin) || 0,
        protein: Math.round(parseFloat(meal.targetProteinMin) || parseFloat(meal.targetProteinMax) || 0),
        carbs: Math.round(parseFloat(meal.targetCarbsMax) || parseFloat(meal.targetCarbsMin) || 0),
        fat: Math.round(parseFloat(meal.targetFatMax) || parseFloat(meal.targetFatMin) || 0),
        fiber: 0,
        // track whether each macro has any value set
        _hasCalories: !!(meal.targetCaloriesMax || meal.targetCaloriesMin),
        _hasProtein: !!(meal.targetProteinMin || meal.targetProteinMax),
        _hasCarbs: !!(meal.targetCarbsMax || meal.targetCarbsMin),
        _hasFat: !!(meal.targetFatMax || meal.targetFatMin),
        _isMacroTarget: true,
      };
    }
    return (meal.items ?? []).reduce((acc: any, item: any) => {
      const m = calcItemMacros(foodDb, item.food, parseFloat(item.grams) || 0);
      return {
        calories: acc.calories + m.calories,
        protein: Math.round(acc.protein + m.protein),
        carbs: Math.round(acc.carbs + m.carbs),
        fiber: Math.round(acc.fiber + m.fiber),
        fat: Math.round(acc.fat + m.fat),
        _hasCalories: true, _hasProtein: true, _hasCarbs: true, _hasFat: true, _isMacroTarget: false,
      };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0, _hasCalories: true, _hasProtein: true, _hasCarbs: true, _hasFat: true, _isMacroTarget: false });
  });

  const hasMacroTargetMeal = meals.some(m => m.type === "macro_targets");
  const dailyTotals = mealMacros.reduce((acc: any, m: any) => ({
    calories: acc.calories + m.calories,
    protein: Math.round(acc.protein + m.protein),
    carbs: Math.round(acc.carbs + m.carbs),
    fiber: Math.round(acc.fiber + m.fiber),
    fat: Math.round(acc.fat + m.fat),
    _allHaveCalories: acc._allHaveCalories && m._hasCalories,
    _allHaveProtein: acc._allHaveProtein && m._hasProtein,
    _allHaveCarbs: acc._allHaveCarbs && m._hasCarbs,
    _allHaveFat: acc._allHaveFat && m._hasFat,
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0, _allHaveCalories: true, _allHaveProtein: true, _allHaveCarbs: true, _allHaveFat: true });

  // Format daily total display values
  const fmtDailyCalories = !dailyTotals._allHaveCalories ? "—" : hasMacroTargetMeal ? `~${dailyTotals.calories}` : `${dailyTotals.calories}`;
  const fmtDailyProtein = !dailyTotals._allHaveProtein ? "—" : hasMacroTargetMeal ? `≥${dailyTotals.protein}` : `${dailyTotals.protein}`;
  const fmtDailyCarbs = !dailyTotals._allHaveCarbs ? "—" : `${dailyTotals.carbs}`;
  const fmtDailyFat = !dailyTotals._allHaveFat ? "—" : `${dailyTotals.fat}`;

  const addMeal = () => setMeals(m => [...m, { name: `Meal ${m.length + 1}`, time: "", type: "specific_foods", items: [] }]);
  const toggleMealType = (i: number) => setMeals(m => m.map((meal, idx) => idx === i
    ? { ...meal, type: meal.type === "macro_targets" ? "specific_foods" : "macro_targets" }
    : meal));
  const updateMealMacroTarget = (i: number, field: string, value: string) =>
    setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, [field]: value } : meal));
  const removeMeal = (i: number) => setMeals(m => m.filter((_, idx) => idx !== i));
  const moveMeal = (from: number, to: number) => setMeals(m => {
    const next = [...m];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });
  const updateMealName = (i: number, name: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, name } : meal));
  const updateMealTime = (i: number, time: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, time } : meal));
  const addItem = (mealIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: [...(meal.items ?? []), { food: "", grams: "" }] }
    : meal));
  const removeItem = (mealIdx: number, itemIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: meal.items.filter((_: any, i: number) => i !== itemIdx) }
    : meal));
  const updateItem = (mealIdx: number, itemIdx: number, field: string, value: string) =>
    setMeals(m => m.map((meal, idx) => idx === mealIdx
      ? { ...meal, items: meal.items.map((item: any, i: number) => i === itemIdx ? { ...item, [field]: value } : item) }
      : meal));

  const foodNames = foodDb.map(f => f.name).sort();

  return (
    <div className="space-y-6">
      <div>
        <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} />
      </div>

      {selectedUserId && (
        <div className="xl:grid xl:grid-cols-[1fr_280px] xl:gap-6 xl:items-start">
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            {(["training", "rest"] as const).map(t => (
              <button key={t} onClick={() => setDayType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                {t === "training" ? "Training Day" : "Rest Day"}
              </button>
            ))}
            {oppositePlan && (oppositePlan.meals as any[])?.length > 0 && (
              <button
                onClick={() => {
                  if (!window.confirm(`Copy meals from ${oppositeDay} day plan? This will replace the current meals.`)) return;
                  setMeals(JSON.parse(JSON.stringify((oppositePlan.meals as any[]) ?? [])));
                  setPlanNotes(oppositePlan.notes ?? "");
                  toast.success(`Copied from ${oppositeDay} day plan`);
                }}
                className="ml-auto px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                Copy from {oppositeDay} day
              </button>
            )}
          </div>

          {/* Daily totals summary */}
          {meals.length > 0 && (
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals</p>
              <div className="flex gap-2 flex-wrap">
                <MacroChip label="Calories" displayValue={fmtDailyCalories} unit="kcal" highlight />
                <MacroChip label="Protein" displayValue={fmtDailyProtein} />
                <MacroChip label="Carbs" displayValue={fmtDailyCarbs} />
                <MacroChip label="Fiber" value={dailyTotals.fiber} />
                <MacroChip label="Fat" displayValue={fmtDailyFat} />
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {meals.map((meal, i) => (
              <Card key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => i > 0 && moveMeal(i, i - 1)} disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none">
                      <ArrowUp size={12} />
                    </button>
                    <button onClick={() => i < meals.length - 1 && moveMeal(i, i + 1)} disabled={i === meals.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none">
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <input type="text" value={meal.name} onChange={e => updateMealName(i, e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="time" value={meal.time ?? ""} onChange={e => updateMealTime(i, e.target.value)}
                    className="w-28 bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button
                    onClick={() => toggleMealType(i)}
                    title={meal.type === "macro_targets" ? "Switch to Specific Foods" : "Switch to Macro Targets"}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide border transition-colors ${
                      meal.type === "macro_targets"
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    }`}>
                    {meal.type === "macro_targets" ? "Macros" : "Foods"}
                  </button>
                  <button onClick={() => removeMeal(i)} className="text-destructive hover:opacity-80">
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Macro Targets mode */}
                {meal.type === "macro_targets" ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Set macro targets for this meal</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { minField: "targetCaloriesMin", maxField: "targetCaloriesMax", label: "Calories", unit: "kcal" },
                        { minField: "targetProteinMin", maxField: "targetProteinMax", label: "Protein", unit: "g" },
                        { minField: "targetCarbsMin", maxField: "targetCarbsMax", label: "Carbs", unit: "g" },
                        { minField: "targetFatMin", maxField: "targetFatMax", label: "Fat", unit: "g" },
                      ].map(({ minField, maxField, label, unit }) => (
                        <div key={label}>
                          <label className="text-[10px] text-muted-foreground block mb-1">{label} ({unit})</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <span className="text-[9px] text-muted-foreground block mb-0.5">Min</span>
                              <input
                                type="number" min="0" step="1"
                                value={meal[minField] ?? ""}
                                onChange={e => updateMealMacroTarget(i, minField, e.target.value)}
                                placeholder="—"
                                className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <span className="text-muted-foreground text-xs mt-4">–</span>
                            <div className="flex-1">
                              <span className="text-[9px] text-muted-foreground block mb-0.5">Max</span>
                              <input
                                type="number" min="0" step="1"
                                value={meal[maxField] ?? ""}
                                onChange={e => updateMealMacroTarget(i, maxField, e.target.value)}
                                placeholder="—"
                                className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 px-1">
                    <p className="col-span-6 text-[10px] text-muted-foreground">Food</p>
                    <p className="col-span-2 text-[10px] text-muted-foreground">Amount</p>
                    <p className="col-span-3 text-[10px] text-muted-foreground">Macros</p>
                    <p className="col-span-1"></p>
                  </div>
                  {(meal.items ?? []).map((item: any, j: number) => {
                    const selectedFood = foodDb.find(f => f.name === item.food);
                    const isServingBased = !!(selectedFood?.servingUnit && selectedFood?.servingGrams);
                    const amount = parseFloat(item.grams) || 0;
                    const m = calcItemMacros(foodDb, item.food, amount);
                    const hasData = item.food && amount > 0;
                    const effectiveGrams = isServingBased ? getItemGrams(foodDb, item.food, amount) : null;
                    const totalItems = (meal.items ?? []).length;
                    const isLastItem = j === totalItems - 1;
                    const focusNextFoodInput = () => {
                      if (isLastItem) {
                        addItem(i);
                        setTimeout(() => {
                          const next = document.querySelector<HTMLInputElement>(
                            `[data-meal="${i}"][data-item="${j + 1}"][data-field="food"]`
                          );
                          next?.focus();
                        }, 50);
                      } else {
                        const next = document.querySelector<HTMLInputElement>(
                          `[data-meal="${i}"][data-item="${j + 1}"][data-field="food"]`
                        );
                        next?.focus();
                      }
                    };
                    const focusQtyInput = () => {
                      const qty = document.querySelector<HTMLInputElement>(
                        `[data-meal="${i}"][data-item="${j}"][data-field="qty"]`
                      );
                      qty?.focus();
                    };
                    return (
                      <div key={j} className="grid grid-cols-12 gap-1 items-start">
                        <div className="col-span-6">
                          <FoodCombobox
                            value={item.food}
                            onChange={v => updateItem(i, j, "food", v)}
                            foodNames={foodNames}
                            onSelectAdvance={focusQtyInput}
                            mealIdx={i}
                            itemIdx={j}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number" min="0" step={isServingBased ? "0.5" : "1"}
                            data-meal={i}
                            data-item={j}
                            data-field="qty"
                            value={item.grams}
                            onChange={e => updateItem(i, j, "grams", e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusNextFoodInput(); } }}
                            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          {isServingBased && (
                            <span className="text-[9px] text-muted-foreground block text-center mt-0.5">{selectedFood.servingUnit}{effectiveGrams ? ` (${effectiveGrams}g)` : ""}</span>
                          )}
                          {!isServingBased && <span className="text-[9px] text-muted-foreground block text-center mt-0.5">g</span>}
                        </div>
                        <div className="col-span-3 text-[10px] text-muted-foreground leading-tight pt-1.5">
                          {hasData ? (
                            <span className="text-foreground font-medium">{m.calories} kcal</span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                          {hasData && <div className="text-[9px] text-muted-foreground">P{m.protein} C{m.carbs} F{m.fat}</div>}
                        </div>
                        <button onClick={() => removeItem(i, j)} className="col-span-1 flex justify-center text-destructive hover:opacity-80 pt-1.5">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <button onClick={() => addItem(i)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                )}
                {/* Meal subtotal — shown for both modes when there are values */}
                {meal.type === "macro_targets" ? (
                  (() => {
                    const hasAny = meal.targetCaloriesMin || meal.targetCaloriesMax || meal.targetProteinMin || meal.targetProteinMax ||
                      meal.targetCarbsMin || meal.targetCarbsMax || meal.targetFatMin || meal.targetFatMax;
                    if (!hasAny) return null;
                    const fmtRange = (min: any, max: any) => {
                      const lo = parseFloat(min); const hi = parseFloat(max);
                      if (!isNaN(lo) && !isNaN(hi)) return `${lo}–${hi}`;
                      if (!isNaN(lo)) return `≥${lo}`;
                      if (!isNaN(hi)) return `≤${hi}`;
                      return "—";
                    };
                    return (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Targets</p>
                        <div className="flex gap-2 flex-wrap">
                          {[{label:"Cal",min:meal.targetCaloriesMin,max:meal.targetCaloriesMax,unit:"kcal",highlight:true},
                            {label:"P",min:meal.targetProteinMin,max:meal.targetProteinMax,unit:"g"},
                            {label:"C",min:meal.targetCarbsMin,max:meal.targetCarbsMax,unit:"g"},
                            {label:"F",min:meal.targetFatMin,max:meal.targetFatMax,unit:"g"}]
                            .map(({label,min,max,unit,highlight}: any) => (
                            <div key={label} className={`flex flex-col items-center px-2 py-1 rounded text-center ${ highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/60" }`}>
                              <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</span>
                              <span className={`text-[11px] font-semibold ${ highlight ? "text-primary" : "text-foreground" }`}>{fmtRange(min,max)} {unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  (meal.items ?? []).some((it: any) => it.food && parseFloat(it.grams) > 0) && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Meal Total</p>
                      <div className="flex gap-2 flex-wrap">
                        <MacroChip label="Calories" value={mealMacros[i].calories} unit="kcal" highlight />
                        <MacroChip label="Protein" value={mealMacros[i].protein} />
                        <MacroChip label="Carbs" value={mealMacros[i].carbs} />
                        <MacroChip label="Fiber" value={mealMacros[i].fiber} />
                        <MacroChip label="Fat" value={mealMacros[i].fat} />
                      </div>
                    </div>
                  )
                )}
              </Card>
            ))}
          </div>

          <button onClick={addMeal}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center">
            <Plus size={14} /> Add Meal
          </button>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Notes</label>
            <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} rows={2}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          <button
            onClick={() => upsert.mutate({
              userId: selectedUserId, dayType, meals,
              totalCalories: dailyTotals.calories || undefined,
              totalProtein: dailyTotals.protein ? Math.round(dailyTotals.protein) : undefined,
              totalCarbs: dailyTotals.carbs ? Math.round(dailyTotals.carbs) : undefined,
              totalFat: dailyTotals.fat ? Math.round(dailyTotals.fat) : undefined,
              notes: planNotes || null,
            })}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {upsert.isPending ? "Saving..." : "Save Meal Plan"}
          </button>
        </div>{/* end left column */}

        {/* Right column: macro summary sticky panel */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            {meals.length > 0 ? (
              <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Daily Totals</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Calories</p>
                  <p className="text-xl font-bold text-primary">{fmtDailyCalories} <span className="text-xs font-normal">kcal</span></p>
                </div>
                {[{l:'Protein',v:fmtDailyProtein},{l:'Carbs',v:fmtDailyCarbs},{l:'Fiber',v:`${dailyTotals.fiber}`},{l:'Fat',v:fmtDailyFat}].map(({l,v}) => (
                  <div key={l} className="bg-secondary rounded-lg px-2 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
                    <p className="text-sm font-bold text-foreground">{v}{v !== '—' ? 'g' : ''}</p>
                  </div>
                ))}
              </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Add meals to see daily totals</p>
            )}
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}


// ─── Recent Logs with View More ─────────────────────────────────────────────
function RecentLogsWithViewMore({ logs, startDate }: { logs: DailyLogRow[]; startDate?: string | null }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DAYS = 7;
  const TOTAL_DAYS = 14;

  // Build a map of yyyy-mm-dd -> log
  const logMap: Record<string, DailyLogRow> = {};
  for (const log of logs) {
    const key = toLocalDateStr(log.logDate);
    if (key) logMap[key] = log;
  }

  // Generate last N calendar days (today first), filtered to on/after client start date
  const allDays: string[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!startDate || iso >= startDate) allDays.push(iso);
  }
  const visibleDays = showAll ? allDays : allDays.slice(0, INITIAL_DAYS);

  return (
    <div>
      <SectionLabel>Recent Daily Logs</SectionLabel>
      <RecentLogsPanel logs={logs} visibleDays={visibleDays} />
      {!showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:border-border/80 transition-colors"
        >
          View more (14 days)
        </button>
      )}
      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:border-border/80 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// ─── Exercise Progress Tab ───────────────────────────────────────────────────
const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest', frontDelts: 'Front Delts', sideDelts: 'Side Delts',
  triceps: 'Triceps', lats: 'Lats', upperBack: 'Upper Back',
  rearDelts: 'Rear Delts', biceps: 'Biceps', quads: 'Quads',
  hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs',
};
const MUSCLE_KEYS = Object.keys(MUSCLE_LABELS);

// ─── Section: Workout Sessions Tab ──────────────────────────────────────────
function WorkoutSessionsTab({ workoutSessions }: { workoutSessions: any[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!workoutSessions.length) {
    return <p className="text-sm text-muted-foreground">No workout sessions logged yet.</p>;
  }

  const sorted = [...workoutSessions].sort((a, b) =>
    toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate))
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`;
  const recent = sorted.filter(s => toLocalDateStr(s.sessionDate) >= sevenDaysAgoStr);
  const older = sorted.filter(s => toLocalDateStr(s.sessionDate) < sevenDaysAgoStr);
  const visible = showAll ? sorted : recent;

  return (
    <div className="space-y-2">
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No sessions in the last 7 days.</p>
      )}
      {visible.map((session) => {
        const dateStr = toLocalDateStr(session.sessionDate);
        const [y, m, d] = dateStr.split('-');
        const dateLabel = `${d}/${m}/${y}`;
        const isOpen = expandedId === session.id;
        const exercises = (session.exercises as any[]) ?? [];
        const hasNotes = exercises.some((ex: any) => ex.exerciseNotes);
        const sessionNotes = session.notes as string | null;

        return (
          <div key={session.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setExpandedId(isOpen ? null : session.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(() => {
                      const totalSets = exercises.reduce((acc: number, ex: any) =>
                        acc + (ex.sets ?? []).filter((s: any) => s.completed || s.weight != null || s.reps != null).length, 0);
                      return <>{session.dayLabel} &middot; {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} &middot; {totalSets} set{totalSets !== 1 ? 's' : ''}</>;
                    })()}
                    {hasNotes && <span className="ml-1.5 text-primary/70">· notes</span>}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="px-4 pb-4 border-t border-border/50 space-y-4 pt-3">
                {exercises.map((ex: any, i: number) => {
                  const completedSets = (ex.sets ?? []).filter((s: any) => s.completed || s.weight != null || s.reps != null);
                  const firstSet = completedSets.find((s: any) => s.weight != null || s.reps != null) ?? completedSets[0];
                  return (
                    <div key={i}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{ex.name}</p>
                            {ex.substitutedFor && (
                              <span className="text-[9px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">SUB</span>
                            )}
                            {completedSets.length > 0 && firstSet && (
                              <span className="text-xs text-muted-foreground">
                                {firstSet.weight != null ? `${firstSet.weight}kg` : '—'} × {firstSet.reps != null ? firstSet.reps : '—'}
                                <span className="text-muted-foreground/50 ml-1">· {completedSets.length} set{completedSets.length !== 1 ? 's' : ''}</span>
                              </span>
                            )}
                          </div>
                          {ex.equipmentDetails && (
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{ex.equipmentDetails}</p>
                          )}
                        </div>
                      </div>
                      {ex.exerciseNotes && (
                        <p className="text-xs text-muted-foreground/80 italic mt-1">&ldquo;{ex.exerciseNotes}&rdquo;</p>
                      )}
                    </div>
                  );
                })}
                {sessionNotes && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Session notes</p>
                    <p className="text-xs text-muted-foreground/80 italic">&ldquo;{sessionNotes}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {older.length > 0 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
        >
          {showAll ? 'Show less' : `View ${older.length} older session${older.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

function ExerciseProgressTab({
  workoutSessions, exerciseLib
}: {
  workoutSessions: any[];
  exerciseLib: any[];
}) {
  const [selectedGroup, setSelectedGroup] = useState<string>('All');

  // Build lookup: exerciseName -> primary muscle label
  const exToMuscle: Record<string, string> = {};
  for (const ex of exerciseLib) {
    let best = 'Other', bestVal = 0;
    for (const m of MUSCLE_KEYS) {
      if ((ex[m] ?? 0) > bestVal) { bestVal = ex[m]; best = m; }
    }
    exToMuscle[ex.name] = MUSCLE_LABELS[best] ?? 'Other';
  }

  // Build per-exercise history (chronological)
  const exerciseHistory: Record<string, Array<{ date: string; topSet: { weight: number | null; reps: number | null } | null; allSets: Array<{ weight: number | null; reps: number | null }>; substitutedFor?: string; equipmentDetails?: string }>> = {};
  for (const session of [...workoutSessions].reverse()) {
    const dateStr = toLocalDateStr(session.sessionDate);
    for (const ex of (session.exercises as any[])) {
      if (!exerciseHistory[ex.name]) exerciseHistory[ex.name] = [];
      const sets: Array<{ weight: number | null; reps: number | null }> = ex.sets ?? [];
      // Top set = highest weight, or highest reps if no weights
      const topSet = sets.reduce<{ weight: number | null; reps: number | null } | null>((best, s) => {
        if (!best) return s;
        const bw = best.weight ?? 0, sw = s.weight ?? 0;
        if (sw > bw) return s;
        if (sw === bw && (s.reps ?? 0) > (best.reps ?? 0)) return s;
        return best;
      }, null);
      exerciseHistory[ex.name].push({ date: dateStr, topSet, allSets: sets, substitutedFor: ex.substitutedFor ?? undefined, equipmentDetails: ex.equipmentDetails ?? undefined });
    }
  }

  // Group exercises by muscle
  const byMuscle: Record<string, string[]> = {};
  for (const name of Object.keys(exerciseHistory)) {
    const group = exToMuscle[name] ?? 'Other';
    if (!byMuscle[group]) byMuscle[group] = [];
    if (!byMuscle[group].includes(name)) byMuscle[group].push(name);
  }
  const muscleGroups = ['All', ...Object.keys(byMuscle).sort()];

  const visibleExercises = selectedGroup === 'All'
    ? Object.keys(exerciseHistory).sort()
    : (byMuscle[selectedGroup] ?? []).sort();

  if (workoutSessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No workout sessions logged yet.</p>;
  }

  return (
    <div className="flex gap-5 min-h-0">
      {/* Left: muscle group sidebar */}
      <div className="w-36 flex-shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Muscle Group</p>
        <div className="flex flex-col gap-0.5">
          {muscleGroups.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedGroup === g
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {g}
              {g !== 'All' && byMuscle[g] && (
                <span className="ml-1.5 text-[10px] opacity-60">{byMuscle[g].length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: exercise cards grid */}
      <div className="flex-1 min-w-0">
        {visibleExercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercises in this group yet.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {visibleExercises.map(name => {
              const history = exerciseHistory[name];
              const last5 = history.slice(-5).reverse();
              const latest = last5[0];
              const prev = last5.length > 1 ? last5[1] : null;
              const latestW = latest?.topSet?.weight ?? null;
              const prevW = prev?.topSet?.weight ?? null;
              const trend = latestW != null && prevW != null
                ? latestW > prevW ? 'up' : latestW < prevW ? 'down' : 'flat'
                : null;

              return (
                <div key={name} className="bg-card border border-border rounded-xl p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{exToMuscle[name] ?? 'Other'} &middot; {history.length} session{history.length !== 1 ? 's' : ''}</p>
                    </div>
                    {trend === 'up' && <ArrowUp className="w-4 h-4 text-green-400 flex-shrink-0" />}
                    {trend === 'down' && <ArrowDown className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    {trend === 'flat' && <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </div>

                  {/* Session history table */}
                  <div className="space-y-0">
                    {last5.map((entry, i) => {
                      const [y, m, d] = entry.date.split('-');
                      const dateLabel = `${d}/${m}/${y}`;
                      const isLatest = i === 0;
                      const prevEntry = i < last5.length - 1 ? last5[i + 1] : null;
                      const w = entry.topSet?.weight ?? null;
                      const r = entry.topSet?.reps ?? null;
                      const pw = prevEntry?.topSet?.weight ?? null;
                      const pr = prevEntry?.topSet?.reps ?? null;
                      const wUp = w != null && pw != null && w > pw;
                      const wDown = w != null && pw != null && w < pw;
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between py-1.5 ${
                            i > 0 ? 'border-t border-border/50' : ''
                          } ${isLatest ? 'opacity-100' : 'opacity-60'}`}
                        >
                          <div className="w-20 flex-shrink-0">
                            <p className="text-xs text-muted-foreground">{dateLabel}</p>
                            {entry.substitutedFor && (
                              <span className="text-[9px] font-semibold bg-amber-500/15 text-amber-400 px-1 py-0.5 rounded">SUB</span>
                            )}
                          </div>
                          <div className="flex-1 text-right">
                            <p className={`text-xs font-medium ${
                              isLatest ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {w != null ? `${w} kg` : '—'}
                              {r != null ? ` × ${r}` : ''}
                            </p>
                            {entry.equipmentDetails && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{entry.equipmentDetails}</p>
                            )}
                          </div>
                          <div className="w-5 flex justify-end flex-shrink-0">
                            {wUp && <ArrowUp className="w-3 h-3 text-green-400" />}
                            {wDown && <ArrowDown className="w-3 h-3 text-red-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>


                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Client Progress ─────────────────────────────────────────────────
const NOTE_CATEGORIES = ["General", "Nutrition", "Training", "Check-in", "Adjustment", "Milestone"];

function CoachingNotesTab({ clientId }: { clientId: number }) {
  const { data: notes = [], refetch } = trpc.notes.list.useQuery({ clientId });
  const add = trpc.notes.add.useMutation({ onSuccess: () => { refetch(); setForm({ noteDate: localToday(), content: "", category: "General" }); toast.success("Note saved"); } });
  const del = trpc.notes.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Note deleted"); } });
  const update = trpc.notes.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); toast.success("Note updated"); } });
  const [form, setForm] = useState({ noteDate: localToday(), content: "", category: "General" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ noteDate: "", content: "", category: "General" });

  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fmtDate(val: unknown) {
    const s = String(val ?? "").slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }
  function startEdit(note: any) {
    setEditingId(note.id);
    setEditForm({
      noteDate: String(note.noteDate ?? "").slice(0, 10),
      content: note.content ?? "",
      category: note.category ?? "General",
    });
  }
  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div className="space-y-5">
      {/* Add note form */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add Note</p>
        <div className="flex gap-3">
          <input type="date" value={form.noteDate} onChange={e => setForm(p => ({ ...p, noteDate: e.target.value }))}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          rows={3} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        <button onClick={() => { if (!form.content.trim()) { toast.error("Note content required"); return; } add.mutate({ clientId, ...form }); }}
          disabled={add.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
          {add.isPending ? "Saving..." : "Save Note"}
        </button>
      </div>
      {/* Notes history */}
      {notes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No notes yet. Add the first note above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note: any) => (
            <div key={note.id} className="bg-card border border-border rounded-xl p-4">
              {editingId === note.id ? (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input type="date" value={editForm.noteDate} onChange={e => setEditForm(p => ({ ...p, noteDate: e.target.value }))}
                      className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                      className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                      {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <textarea value={editForm.content} onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))}
                    rows={3} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (!editForm.content.trim()) { toast.error("Note content required"); return; } update.mutate({ id: note.id, ...editForm }); }}
                      disabled={update.isPending}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                      <Check size={13} />{update.isPending ? "Saving..." : "Save"}
                    </button>
                    <button onClick={cancelEdit}
                      className="px-3 py-1.5 bg-secondary text-foreground text-sm rounded-lg hover:opacity-80 flex items-center gap-1.5">
                      <X size={13} />Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground">{fmtDate(note.noteDate)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-primary/20 text-primary">{note.category ?? "General"}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <button onClick={() => startEdit(note)}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => del.mutate({ id: note.id })} disabled={del.isPending}
                      className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared check-in helpers (used in both Clients section and standalone tab) ─────────

// Label maps for new diet execution fields
const DIET_LABEL_MAP: Record<string, string> = {
  // Q1 & Q2 (weigh foods / meal prep accuracy)
  every_meal: 'Every meal or nearly every meal',
  most_meals: 'Most meals',
  some_meals: 'Some meals',
  rarely: 'Rarely',
  never: 'Never',
  // Q3 & Q5 (extras frequency / meal timing)
  one_two_days: 'On 1–2 days',
  few_days: 'On a few days',
  most_days: 'On most days',
  every_day: 'Every day',
  // Q4 (added fats)
  light_spray: 'Light spray (e.g. cooking spray)',
  small_amount: 'Small amount (less than 1 tsp)',
  one_tsp_or_more: '1 tsp or more',
  no_added_fats: 'No added fats when cooking',
  // Q6 (off-plan quality)
  very_close: 'Very close',
  somewhat_close: 'Somewhat close',
  not_very_close: 'Not very close',
  very_different: 'Very different',
  no_off_plan_meals: 'No off-plan meals',
};


const fmtCheckInDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Progress Section ────────────────────────────────────────────────

function ProgressSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const { data: logs } = trpc.dailyLog.listForClient.useQuery(
    { userId: selectedUserId!, limit: 60 },
    { enabled: !!selectedUserId }
  );
  const { data: measurements } = trpc.measurements.listForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: trainingProgram } = trpc.training.getForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: workoutSessions = [] } = trpc.workoutSessions.listForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const { data: clientProfile } = trpc.profile.getById.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const clientStartDate = clientProfile?.startDate ? toLocalDateStr(clientProfile.startDate) : null;
  // allExpandedState: null = no global action, true/false = last global action
  const [globalToggle, setGlobalToggle] = useState<{ expanded: boolean; gen: number } | null>(null);

  // ── Calendar-day helpers ────────────────────────────────────────────────────
  const DAY = 86400000;
  function localDateStr(offsetDays: number): string {
    const d = new Date(Date.now() - offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const today = localDateStr(0);
  const day7 = localDateStr(7);   // start of current 7-day window
  const day14 = localDateStr(14); // start of previous 7-day window

  const allLogs = logs ?? [];
  // Current 7 calendar days (today - 6 days)
  const cur7 = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day7 && d <= today; });
  // Previous 7 calendar days (today - 13 days to today - 7 days)
  const prev7 = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day14 && d < day7; });

  // ── Metric helpers ──────────────────────────────────────────────────────────
  function avgOf(arr: (number | null | undefined)[]): number | null {
    const nums = arr.filter((v): v is number => v != null);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  }
  function pctChange(cur: number | null, prev: number | null): string | null {
    if (cur == null || prev == null || prev === 0) return null;
    const pct = ((cur - prev) / prev) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
  }

  // ── 7-day averages ──────────────────────────────────────────────────────────
  const curAvgWeight = avgOf(cur7.map(l => l.weight as number | null));
  const prevAvgWeight = avgOf(prev7.map(l => l.weight as number | null));
  const weightPct = pctChange(curAvgWeight, prevAvgWeight);

  const curAvgHunger = avgOf(cur7.map(l => l.hungerLevel as number | null));
  const prevAvgHunger = avgOf(prev7.map(l => l.hungerLevel as number | null));

  const curAvgSleep = avgOf(cur7.map(l => l.sleepQuality as number | null));
  const prevAvgSleep = avgOf(prev7.map(l => l.sleepQuality as number | null));

  const curAvgSteps = avgOf(cur7.map(l => l.stepsCount as number | null));
  const prevAvgSteps = avgOf(prev7.map(l => l.stepsCount as number | null));

  // ── Meal adherence: on-plan days / 7 calendar days (unlogged = non-adherent) ──
  const curOnPlan = cur7.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  // Use 7 calendar days as denominator — missing logs count as non-adherent
  const mealAdherence = Math.round((curOnPlan / 7) * 100);
  const prevOnPlan = prev7.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  const prevMealAdherence = Math.round((prevOnPlan / 7) * 100);
  const offPlanTotal7 = cur7.reduce((sum, l) => sum + (l.offPlanMeals ?? 0), 0);

  // ── Training adherence: calendar-day window vs rotation length, clamped to startDate ──
  const schedule = (trainingProgram?.schedule as string[] | null) ?? null;
  const programDays = (trainingProgram?.days as any[] | null) ?? null;
  const rotationLen = schedule?.length ?? programDays?.length ?? 7;
  // Clamp window start to the later of (today - rotationLen + 1) and clientStartDate
  const rotationWindowStart = localDateStr(rotationLen - 1);
  const effectiveRotationStart = clientStartDate && clientStartDate > rotationWindowStart
    ? clientStartDate
    : rotationWindowStart;
  // Build list of calendar days in the clamped window
  const rotWindowDays: string[] = [];
  const rotCursor = new Date(effectiveRotationStart + 'T00:00:00');
  const rotEnd = new Date(today + 'T00:00:00');
  while (rotCursor <= rotEnd) {
    rotWindowDays.push(`${rotCursor.getFullYear()}-${String(rotCursor.getMonth()+1).padStart(2,'0')}-${String(rotCursor.getDate()).padStart(2,'0')}`);
    rotCursor.setDate(rotCursor.getDate() + 1);
  }
  // Count prescribed days in the clamped window using rotation cycle
  const prescribedPerRotation = schedule
    ? rotWindowDays.filter((_, i) => schedule[i % rotationLen] && schedule[i % rotationLen].toLowerCase() !== 'off').length
    : programDays
      ? rotWindowDays.filter((_, i) => !String((programDays[i % programDays.length]?.name ?? programDays[i % programDays.length]?.label ?? '')).toLowerCase().includes('off')).length
      : rotWindowDays.length;
  const rotationLogs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= effectiveRotationStart && d <= today; });
  const trainedInRotation = rotationLogs.filter(l => l.trainingCompleted).length;
  const trainingAdherence = prescribedPerRotation > 0
    ? Math.min(100, Math.round((trainedInRotation / prescribedPerRotation) * 100))
    : null;
  const trainingAdherenceLabel = schedule || programDays
    ? `${trainedInRotation}/${prescribedPerRotation} prescribed (${rotationLen}-day rotation)`
    : `${trainedInRotation} trained days`;

  // ── Weight trend chart: last 14 days ────────────────────────────────────────
  const weightData = allLogs
    .filter(l => l.weight != null)
    .slice(0, 14)
    .reverse()
    .map(l => {
      const d = toLocalDateStr(l.logDate);
      const [y, mo, dy] = d.split("-");
      return { date: `${dy} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]}`, weight: l.weight };
    });

  // ── Measurements comparison ─────────────────────────────────────────────────
  const sortedMeasurements = [...(measurements ?? [])].sort((a, b) =>
    toLocalDateStr(b.measureDate).localeCompare(toLocalDateStr(a.measureDate))
  );
  const latestM = sortedMeasurements[0] ?? null;
  const prevM = sortedMeasurements[1] ?? null;
  function skinfoldTotal(m: typeof latestM): number | null {
    if (!m) return null;
    const avg = (vals: (number | null | undefined)[]) => {
      const nums = vals.filter((v): v is number => v != null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };
    const sites = [
      avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
      avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
      avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]),
      avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]),
    ];
    const withData = sites.filter(v => v != null);
    return withData.length > 0 ? parseFloat(withData.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
  }
  const latestSkinfold = skinfoldTotal(latestM);
  const prevSkinfold = skinfoldTotal(prevM);
  const skinfoldDiff = latestSkinfold != null && prevSkinfold != null
    ? parseFloat((latestSkinfold - prevSkinfold).toFixed(1))
    : null;
  const waistDiff = latestM?.waist != null && prevM?.waist != null
    ? parseFloat(((latestM.waist as number) - (prevM.waist as number)).toFixed(1))
    : null;

  // ── Metric card helper ──────────────────────────────────────────────────────
  function ProgCard({ label, value, sub }: {
    label: string; value: string; sub?: string;
  }) {
    return (
      <div className="bg-secondary rounded-xl p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} />
      </div>

      {selectedUserId && (
          <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions">Training</TabsTrigger>
            <TabsTrigger value="exercise">Exercise Progress</TabsTrigger>
            <TabsTrigger value="notes">Coaching Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
          <div className="space-y-6">
          {/* ── Desktop two-column: metrics left, chart+measurements right ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
            {/* Left: metric cards */}
            <div>
              <SectionLabel>7-Day Averages</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <ProgCard
                  label="Avg Weight"
                  value={curAvgWeight != null ? `${curAvgWeight.toFixed(1)} kg` : "—"}
                  sub={weightPct ? `${weightPct} vs prev 7 days` : undefined}
                />
                <ProgCard
                  label="Training Adherence"
                  value={trainingAdherence != null ? `${trainingAdherence}%` : "—"}
                  sub={prescribedPerRotation != null
                    ? `${trainedInRotation}/${prescribedPerRotation} sessions completed`
                    : `${trainedInRotation} sessions completed`}
                />
                <ProgCard
                  label="Off-Plan Meals (7d)"
                  value={String(offPlanTotal7)}
                  sub={offPlanTotal7 === 0 ? "All on-plan" : `${cur7.filter(l => (l.offPlanMeals ?? 0) > 0).length} days with off-plan meals`}
                />
                <ProgCard
                  label="Avg Hunger"
                  value={curAvgHunger != null ? `${curAvgHunger.toFixed(1)}/5` : "—"}
                />
                <ProgCard
                  label="Avg Sleep Quality"
                  value={curAvgSleep != null ? `${curAvgSleep.toFixed(1)}/5` : "—"}
                />
                {(curAvgSteps != null || (clientProfile as any)?.stepGoal) && (
                  <ProgCard
                    label="Avg Steps"
                    value={(() => {
                      const goal = (clientProfile as any)?.stepGoal as number | null;
                      const avg = curAvgSteps != null ? Math.round(curAvgSteps).toLocaleString() : "—";
                      return goal ? `${avg} / ${goal.toLocaleString()}` : avg;
                    })()}
                    sub={(() => {
                      const goal = (clientProfile as any)?.stepGoal as number | null;
                      if (!goal || curAvgSteps == null) return undefined;
                      const pct = Math.round((curAvgSteps / goal) * 100);
                      return `${pct}% of goal`;
                    })()}
                  />
                )}
              </div>
            </div>

            {/* Right: weight chart + measurements */}
            <div className="space-y-4">
              {weightData.length > 1 && (
                <div>
                  <SectionLabel>Weight Trend (last 14 entries)</SectionLabel>
                  <Card>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={weightData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                        <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 10 }} width={36} />
                        <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#22c55e" }} formatter={(v: number) => [`${v} kg`, "Weight"]} />
                        <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}

            </div>
          </div>

          <ProgressHistoryTable
            logs={allLogs}
            measurements={measurements ?? []}
            startDate={clientStartDate}
          />

          <CoachHabitsPanel clientId={selectedUserId!} />

          {(logs ?? []).length > 0 && (
            <RecentLogsWithViewMore logs={logs ?? []} startDate={clientStartDate} />
          )}
          </div>
          </TabsContent>

          <TabsContent value="exercise">
            <ExerciseProgressTab workoutSessions={workoutSessions} exerciseLib={exerciseLib} />
          </TabsContent>

          <TabsContent value="sessions">
            <WorkoutSessionsTab workoutSessions={workoutSessions} />
          </TabsContent>

          <TabsContent value="notes">
            <CoachingNotesTab clientId={selectedUserId!} />
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}

// ─── Section: Exercise Library ───────────────────────────────────────────────
const MUSCLE_GROUPS = [
  { key: "chest", label: "Chest" },
  { key: "frontDelts", label: "Front Delts" },
  { key: "sideDelts", label: "Side Delts" },
  { key: "triceps", label: "Triceps" },
  { key: "lats", label: "Lats" },
  { key: "upperBack", label: "Upper Back" },
  { key: "rearDelts", label: "Rear Delts" },
  { key: "biceps", label: "Biceps" },
  { key: "quads", label: "Quads" },
  { key: "hams", label: "Hams" },
  { key: "glutes", label: "Glutes" },
  { key: "calves", label: "Calves" },
  { key: "abs", label: "Abs" },
] as const;

type MuscleKey = typeof MUSCLE_GROUPS[number]["key"];

type ExerciseRow = {
  id?: number;
  name: string;
  chest: number; frontDelts: number; sideDelts: number; triceps: number;
  lats: number; upperBack: number; rearDelts: number; biceps: number;
  quads: number; hams: number; glutes: number; calves: number; abs: number;
  videoUrl?: string;
};
const EMPTY_EXERCISE: ExerciseRow = {
  name: "", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0,
  lats: 0, upperBack: 0, rearDelts: 0, biceps: 0,
  quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0,
  videoUrl: "",
};

function ExerciseLibrarySection() {
  const { data: exercises = [], refetch } = trpc.exerciseLibrary.list.useQuery();
  const upsert = trpc.exerciseLibrary.upsert.useMutation({ 
    onSuccess: () => { refetch(); setEditing(null); toast.success("Saved"); },
    onError: (err) => { toast.error(err.message || "Save failed"); }
  });
  const del = trpc.exerciseLibrary.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Deleted"); } });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  function startNew() {
    setEditing({ ...EMPTY_EXERCISE });
    setIsNew(true);
  }

  function startEdit(ex: ExerciseRow) {
    setEditing({ ...ex });
    setIsNew(false);
  }

  function saveEditing() {
    if (!editing || !editing.name.trim()) { toast.error("Exercise name is required"); return; }
    const payload = { ...editing, videoUrl: editing.videoUrl || undefined };
    upsert.mutate(payload as any);
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> Add Exercise
        </button>
        <p className="ml-auto text-xs text-muted-foreground">{filtered.length} exercise{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Desktop: side-by-side form + table when editing */}
      <div className={editing ? "grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5 items-start" : ""}>

      {/* Edit / Add form */}
      {editing && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{isNew ? "Add New Exercise" : `Edit: ${editing.name}`}</p>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Exercise Name</label>
            <input
              value={editing.name}
              onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Demo Video URL (YouTube)</label>
            <input
              value={editing.videoUrl ?? ""}
              onChange={e => setEditing(prev => prev ? { ...prev, videoUrl: e.target.value } : prev)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MUSCLE_GROUPS.map(mg => (
              <div key={mg.key}>
                <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{mg.label}</label>
                <input
                  type="number" step="0.25" min="0" max="2"
                  value={(editing as any)[mg.key] ?? 0}
                  onChange={e => setEditing(prev => prev ? { ...prev, [mg.key]: parseFloat(e.target.value) || 0 } : prev)}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
            <button onClick={saveEditing} disabled={upsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> {upsert.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </Card>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[260px]">Exercise</th>
              {MUSCLE_GROUPS.map(mg => (
                <th key={mg.key} className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[70px]">{mg.label}</th>
              ))}
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={MUSCLE_GROUPS.length + 2} className="text-center py-8 text-muted-foreground text-sm">No exercises found</td></tr>
            )}
            {filtered.map((ex, i) => (
              <tr key={ex.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span>{ex.name}</span>
                    {(ex as any).videoUrl && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400"><Play size={8} />Video</span>}
                  </div>
                </td>
                {MUSCLE_GROUPS.map(mg => {
                  const val = (ex as any)[mg.key] as number ?? 0;
                  return (
                    <td key={mg.key} className="px-3 py-2.5 text-center">
                      {val > 0 ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                          val >= 1 ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/70"
                        }`}>{val}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => startEdit(ex as ExerciseRow)} className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Pencil size={16} /></button>
                    <button onClick={() => del.mutate({ id: ex.id! })} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>{/* end grid wrapper */}
      <p className="text-xs text-muted-foreground">Values represent sets contributed per set performed (e.g. 0.5 = half a set)</p>
    </div>
  );
}

// ─── Section: Nutrition Data ────────────────────────────────────────────────
type FoodRow = {
  id?: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  servingUnit?: string | null;
  servingGrams?: number | null;
};
const EMPTY_FOOD: FoodRow = { name: "", calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0, servingUnit: null, servingGrams: null };
const MACRO_FIELDS = [
  { key: "calories" as const, label: "Calories", unit: "kcal", step: 1 },
  { key: "protein" as const, label: "Protein", unit: "g", step: 0.1 },
  { key: "carbs" as const, label: "Carbs", unit: "g", step: 0.1 },
  { key: "fiber" as const, label: "Fiber", unit: "g", step: 0.1 },
  { key: "fat" as const, label: "Fat", unit: "g", step: 0.1 },
];

function NutritionDataSection() {
  const { data: foods = [], refetch } = trpc.nutritionFoods.list.useQuery();
  const upsert = trpc.nutritionFoods.upsert.useMutation({ onSuccess: () => { refetch(); setEditing(null); toast.success("Saved"); } });
  const del = trpc.nutritionFoods.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Deleted"); } });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  function startNew() { setEditing({ ...EMPTY_FOOD }); setIsNew(true); }
  function startEdit(f: FoodRow) { setEditing({ ...f }); setIsNew(false); }
  function saveEditing() {
    if (!editing || !editing.name.trim()) { toast.error("Food name is required"); return; }
    upsert.mutate(editing as any);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search foods…"
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> Add Food
        </button>
      </div>

      {editing && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{isNew ? "Add New Food" : `Edit: ${editing.name}`}</p>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
          <input
            value={editing.name}
            onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MACRO_FIELDS.map(f => (
              <div key={f.key}>
                <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{f.label} ({f.unit})</label>
                <input
                  type="number" step={f.step} min="0"
                  value={(editing as any)[f.key] ?? 0}
                  onChange={e => setEditing(prev => prev ? { ...prev, [f.key]: parseFloat(e.target.value) || 0 } : prev)}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          {/* Serving size fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Serving Unit <span className="normal-case font-normal">(e.g. egg, slice, tbsp)</span></label>
              <input
                type="text"
                value={(editing as any).servingUnit ?? ""}
                onChange={e => setEditing(prev => prev ? { ...prev, servingUnit: e.target.value || null } : prev)}
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Grams per serving</label>
              <input
                type="number" step="0.1" min="0"
                value={(editing as any).servingGrams ?? ""}
                onChange={e => setEditing(prev => prev ? { ...prev, servingGrams: e.target.value ? parseFloat(e.target.value) : null } : prev)}
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">All macro values are per 100g. Serving unit is optional — used in meal plans for unit-based foods.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
            <button onClick={saveEditing} disabled={upsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> {upsert.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[200px]">Food</th>
              {MACRO_FIELDS.map(f => (
                <th key={f.key} className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right min-w-[80px]">{f.label}<br /><span className="text-[9px] normal-case font-normal">(per 100g)</span></th>
              ))}
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left min-w-[100px]">Serving</th>
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No foods found</td></tr>
            )}
            {filtered.map((food, i) => (
              <tr key={food.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card">{food.name}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.calories}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.protein}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.carbs}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.fiber}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.fat}</td>
                <td className="px-3 py-2.5 text-left text-foreground text-xs">
                  {(food as any).servingUnit ? <span className="text-muted-foreground">1 {(food as any).servingUnit} = {(food as any).servingGrams}g</span> : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => startEdit(food as FoodRow)} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => del.mutate({ id: food.id! })} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} food{filtered.length !== 1 ? "s" : ""} · All nutritional values sourced from USDA FoodData Central (per 100g)</p>
    </div>
  );
}

// ─── Coach Habits Panel (inside Client Progress tab) ───────────────────────────
function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const { data: habits = [] } = trpc.habits.clientHabits.useQuery({ clientId }, { enabled: !!clientId });
  const from28 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 27);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const { data: completions = [] } = trpc.habits.clientCompletions.useQuery({ clientId, fromDate: from28 }, { enabled: !!clientId });

  if (!clientId || habits.length === 0) return null;

  // Build last 28 days
  const last28: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last28.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const last7 = last28.slice(-7);

  // Helper: normalise a date value (Date object or ISO string) to yyyy-mm-dd using LOCAL timezone
  // Must match last28 which is also built with local date parts
  const normCompDate = (val: any): string => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const completedSet = new Set(
    completions.map((c: any) => `${c.habitId}:${normCompDate(c.completedDate)}`)
  );

  // Today's date string (last element of last28) — cap eligible days so future days aren't counted
  const todayStr = last28[last28.length - 1];

  const habitStats = habits.map((h: any) => {
    // Only count days on/after assignment date AND on/before today as eligible
    const assignedDateStr = normCompDate(h.assignedAt);
    const eligible28 = last28.filter(d => d >= assignedDateStr && d <= todayStr);
    const eligible7 = last7.filter(d => d >= assignedDateStr && d <= todayStr);
    const done28 = eligible28.filter(d => completedSet.has(`${h.id}:${d}`)).length;
    const done7 = eligible7.filter(d => completedSet.has(`${h.id}:${d}`)).length;
    const pct28 = eligible28.length > 0 ? Math.round((done28 / eligible28.length) * 100) : 0;
    const pct7 = eligible7.length > 0 ? Math.round((done7 / eligible7.length) * 100) : 0;
    // Streak: walk backwards from today, skipping today if not yet completed
    // (a client who completed yesterday but not yet today should not lose their streak)
    let streak = 0;
    let startedCounting = false;
    for (let i = 0; i < 28; i++) {
      const d = last28[last28.length - 1 - i];
      if (!d || d < assignedDateStr) break;
      const done = completedSet.has(`${h.id}:${d}`);
      if (!startedCounting) {
        // Skip today if not completed — don't break the streak for an incomplete day yet
        if (!done && i === 0) continue;
        startedCounting = true;
      }
      if (done) streak++;
      else break;
    }
    return { ...h, pct28, pct7, streak, done28, done7 };
  });

  // Group last28 into 4 weeks
  const weeks = [last28.slice(0, 7), last28.slice(7, 14), last28.slice(14, 21), last28.slice(21, 28)];
  const weekLabels = weeks.map((w, i) => {
    const start = w[0].slice(5).replace('-', '/');
    return i === 3 ? 'This week' : start;
  });

  return (
    <div>
      <SectionLabel>Habit Adherence (4 Weeks)</SectionLabel>
      <div className="space-y-3">
        {habitStats.map((h: any) => (
          <div key={h.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.frequency === 'daily' ? 'Daily' : `${h.targetDays}x/week`}
                  {' · '}{h.pct28}% last 28 days
                  {h.streak > 0 ? ` · ${h.streak}-day streak` : ''}
                </p>
              </div>
              <span className={`text-sm font-bold ${
                h.pct28 >= 80 ? 'text-green-500' : h.pct28 >= 50 ? 'text-amber-500' : 'text-red-500'
              }`}>{h.pct28}%</span>
            </div>
            {/* 4-week heatmap */}
            <div className="space-y-1.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">{weekLabels[wi]}</span>
                  <div className="flex gap-1">
                    {week.map(d => {
                      const done = completedSet.has(`${h.id}:${d}`);
                      return (
                        <div
                          key={d}
                          title={d}
                          className={`w-5 h-5 rounded-sm ${
                            done ? 'bg-primary' : 'bg-muted'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {week.filter(d => completedSet.has(`${h.id}:${d}`)).length}/7
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Habits ────────────────────────────────────────────────────────
function HabitsSection() {
  const utils = trpc.useUtils();
  const { data: habits = [], isLoading } = trpc.habits.list.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const clients = allUsers;

  const [showForm, setShowForm] = useState(false);
  const [editHabit, setEditHabit] = useState<any | null>(null);
  const [assignHabit, setAssignHabit] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", frequency: "daily" as "daily" | "x_per_week", targetDays: 3 });
  const [assignedClientIds, setAssignedClientIds] = useState<number[]>([]);

  const createMutation = trpc.habits.create.useMutation({ onSuccess: () => { utils.habits.list.invalidate(); setShowForm(false); resetForm(); } });
  const updateMutation = trpc.habits.update.useMutation({ onSuccess: () => { utils.habits.list.invalidate(); setEditHabit(null); resetForm(); } });
  const deleteMutation = trpc.habits.delete.useMutation({ onSuccess: () => utils.habits.list.invalidate() });
  const setAssignmentsMutation = trpc.habits.setAssignments.useMutation({ onSuccess: () => { utils.habits.list.invalidate(); setAssignHabit(null); } });

  function resetForm() { setForm({ name: "", description: "", frequency: "daily", targetDays: 3 }); }

  function openEdit(h: any) {
    setEditHabit(h);
    setForm({ name: h.name, description: h.description ?? "", frequency: h.frequency, targetDays: h.targetDays ?? 3 });
  }

  async function openAssign(h: any) {
    setAssignHabit(h);
    const assignments = await utils.habits.getAssignments.fetch({ habitId: h.id });
    setAssignedClientIds(assignments.filter((a: any) => a.active).map((a: any) => a.clientId));
  }

  function handleSubmit() {
    const payload = { ...form, targetDays: form.frequency === "x_per_week" ? form.targetDays : 7 };
    if (editHabit) {
      updateMutation.mutate({ id: editHabit.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleClientAssign(clientId: number) {
    setAssignedClientIds(prev => prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]);
  }

  function freqLabel(h: any) {
    if (h.frequency === "daily") return "Daily";
    return `${h.targetDays}x per week`;
  }

  return (
    <div className="xl:grid xl:grid-cols-[1fr_360px] xl:gap-6 xl:items-start">
      {/* Left: habits list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{habits.length} habit{habits.length !== 1 ? "s" : ""} created</p>
          <Button size="sm" onClick={() => { setShowForm(true); setEditHabit(null); resetForm(); }}>
            <Plus size={14} className="mr-1" /> New Habit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Click <strong>New Habit</strong> to create a habit, or <strong>Assign</strong> on any habit to manage client assignments.</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading habits...</p>
        ) : habits.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No habits yet. Create your first habit to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((h: any) => (
              <div key={h.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">{freqLabel(h)}</span>
                    {h.description && <span className="text-xs text-muted-foreground truncate">{h.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => openAssign(h)}>Assign</Button>
                  <button onClick={() => openEdit(h)} className="text-muted-foreground hover:text-foreground transition-colors p-1"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm(`Delete "${h.name}"?`)) deleteMutation.mutate({ id: h.id }); }} className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: create/edit form or assign panel */}
      <div className="space-y-4">
        {/* Create / Edit Form */}
        {(showForm || editHabit) && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 sticky top-20">
            <p className="text-sm font-semibold text-foreground">{editHabit ? "Edit Habit" : "New Habit"}</p>
            <div>
              <label className="text-xs text-muted-foreground">Habit Name *</label>
              <input className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Frequency</label>
              <select className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value as any }))}>
                <option value="daily">Daily</option>
                <option value="x_per_week">X times per week</option>
              </select>
            </div>
            {form.frequency === "x_per_week" && (
              <div>
                <label className="text-xs text-muted-foreground">Target days per week</label>
                <input type="number" min={1} max={7} className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" value={form.targetDays} onChange={e => setForm(p => ({ ...p, targetDays: parseInt(e.target.value) || 1 }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Description (optional)</label>
              <textarea className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditHabit(null); resetForm(); }}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}>
                {editHabit ? "Save Changes" : "Create Habit"}
              </Button>
            </div>
          </div>
        )}

        {/* Assign panel */}
        {assignHabit && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 sticky top-20">
            <p className="text-sm font-semibold text-foreground">Assign "{assignHabit.name}"</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {clients.length === 0 && <p className="text-xs text-muted-foreground">No clients found.</p>}
              {clients.map((c: any) => (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-primary" checked={assignedClientIds.includes(c.id)} onChange={() => toggleClientAssign(c.id)} />
                  <span className="text-sm text-foreground">{c.name ?? c.email ?? `User ${c.id}`}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setAssignHabit(null)}>Cancel</Button>
              <Button size="sm" onClick={() => setAssignmentsMutation.mutate({ habitId: assignHabit.id, clientIds: assignedClientIds })} disabled={setAssignmentsMutation.isPending}>
                Save Assignments
              </Button>
            </div>
          </div>
        )}

        {!showForm && !editHabit && !assignHabit && (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">Select a habit to edit or assign it to clients.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main CoachPanel ──────────────────────────────────────────────────────────
// ─── Section: Check-ins ─────────────────────────────────────────────────────
function CheckInsSection() {
  const { user: currentUser } = useAuth();
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  // Show regular clients + the current admin (for testing their own check-in flow)
  const clients = (allUsers ?? []).filter((u: any) => u.role !== 'admin' || u.id === currentUser?.id);

  // Fetch client profiles to get checkInDay for pill display
  const { data: clientProfiles = [] } = trpc.users.clients.useQuery();
  // Server-side overdue clients list
  const { data: overdueList = [] } = trpc.checkIn.overdueClients.useQuery();

  // UTC-based Monday for this week (used for unreviewed check)
  const mondayUtc = (() => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const daysFromMonday = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
    const m = new Date(todayUtc);
    m.setUTCDate(todayUtc.getUTCDate() - daysFromMonday);
    return m;
  })();

  // Helper: is a client overdue? Uses server-side list.
  const isOverdue = (clientId: number): boolean =>
    (overdueList as any[]).some((o: any) => o.clientId === clientId);

  const sortBucket = (ci: any, reviewed: boolean, id: number): number => {
    if (isOverdue(id)) return 0;                                                // overdue = highest priority
    if (!reviewed && ci) {
      const submittedUtc = new Date(Date.UTC(
        new Date(ci.submittedAt).getUTCFullYear(),
        new Date(ci.submittedAt).getUTCMonth(),
        new Date(ci.submittedAt).getUTCDate()
      ));
      if (submittedUtc >= mondayUtc) return 1;                                  // unreviewed this week
    }
    if (!ci) return 2;                                                          // no check-ins yet
    return 3;                                                                   // reviewed / complete
  };
  const sortedClients = [...clients].sort((a, b) => {
    const ciA = latestCheckIns.find((x: any) => x.clientId === a.id);
    const ciB = latestCheckIns.find((x: any) => x.clientId === b.id);
    const bA = sortBucket(ciA, !!(ciA as any)?.reviewedAt, a.id);
    const bB = sortBucket(ciB, !!(ciB as any)?.reviewedAt, b.id);
    if (bA !== bB) return bA - bB;
    const tA = ciA ? new Date((ciA as any).submittedAt).getTime() : 0;
    const tB = ciB ? new Date((ciB as any).submittedAt).getTime() : 0;
    return tB - tA;
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: clientCheckIns = [], refetch: refetchCheckIns } = trpc.checkIn.clientList.useQuery(
    { clientId: selectedId! },
    { enabled: !!selectedId }
  );
  const deleteCheckIn = trpc.checkIn.delete.useMutation({
    onSuccess: () => { toast.success('Check-in deleted'); refetchCheckIns(); utils.checkIn.latestPerClient.invalidate(); },
    onError: () => toast.error('Failed to delete check-in'),
  });
  const markReviewed = trpc.checkIn.markReviewed.useMutation({
    onSuccess: () => { refetchCheckIns(); utils.checkIn.latestPerClient.invalidate(); },
    onError: () => toast.error('Failed to update status'),
  });
  const [expandedCheckIns, setExpandedCheckIns] = useState<Set<number>>(new Set());

  // Mark as seen in localStorage when client's check-ins load
  useEffect(() => {
    if (!selectedId || clientCheckIns.length === 0) return;
    const latest = clientCheckIns.reduce((a: any, b: any) => {
      return new Date(b.submittedAt).getTime() > new Date(a.submittedAt).getTime() ? b : a;
    });
    const seenAt = new Date((latest as any).submittedAt ?? Date.now()).getTime();
    localStorage.setItem(`coach:seen:checkin:${selectedId}`, String(seenAt));
    window.dispatchEvent(new StorageEvent('storage', { key: `coach:seen:checkin:${selectedId}` }));
  }, [selectedId, clientCheckIns]);

  const selectedClient = clients.find(c => c.id === selectedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      {/* Left: client list */}
      <div className="space-y-1">
        {sortedClients.filter(c => c.id !== undefined).map(client => {
          const ci = latestCheckIns.find((x: any) => x.clientId === client.id);
          const isReviewed = !!(ci as any)?.reviewedAt;
          const hasCheckIn = !!ci;
          const isSelected = selectedId === client.id;
          return (
            <button
              key={client.id}
              onClick={() => setSelectedId(client.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                isSelected ? 'bg-primary/15 border border-primary/30' : 'hover:bg-secondary border border-transparent'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
                  {(client.name ?? 'U').charAt(0).toUpperCase()}
                </div>
                {hasCheckIn && !isReviewed && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{client.name ?? `User ${client.id}`}</p>
                  {(() => {
                    const p = (clientProfiles as any[]).find((x: any) => x.userId === client.id);
                    const day = p?.checkInDay as string | undefined;
                    if (!day) return null;
                    const abbr: Record<string,string> = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };
                    const todayDayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];
                    const todayIsoLocal = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
                    const clientStart = p?.startDate ? (typeof p.startDate === 'string' ? p.startDate.slice(0,10) : new Date(p.startDate).toISOString().slice(0,10)) : null;
                    const isStartDay = clientStart === todayIsoLocal;
                    const isToday = day === todayDayName && !isStartDay;
                    const overdue = isOverdue(client.id);
                    const pillClass = overdue
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : isToday
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-secondary text-muted-foreground border-border';
                    return <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${pillClass}`}>{abbr[day] ?? day}</span>;
                  })()}
                </div>
                {isOverdue(client.id) ? (
                  <p className="text-xs text-amber-400 font-medium">
                    {(() => {
                      const o = (overdueList as any[]).find((x: any) => x.clientId === client.id);
                      if (!o?.dueDate) return 'Overdue';
                      const dateStr = new Date(o.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
                      return `Overdue · ${dateStr}`;
                    })()}
                  </p>
                ) : ci ? (
                  <p className={`text-xs truncate ${isReviewed ? 'text-muted-foreground' : 'text-primary'}`}>
                    {isReviewed ? 'Complete' : 'Awaiting review'} · {new Date((ci as any).submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No check-ins yet</p>
                )}
              </div>
            </button>
          );
        })}
        {sortedClients.length === 0 && (
          <p className="text-sm text-muted-foreground px-3 py-4">No clients yet.</p>
        )}
      </div>

      {/* Right: check-in history */}
      {selectedId ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">{selectedClient?.name ?? `User ${selectedId}`}</h2>
            <span className="text-xs text-muted-foreground">{clientCheckIns.length} check-in{clientCheckIns.length !== 1 ? 's' : ''}</span>
          </div>
          {clientCheckIns.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No check-ins submitted yet
            </div>
          ) : (
            clientCheckIns.map((ci: any) => {
              const isExpanded = expandedCheckIns.has(ci.id);
              const isReviewed = !!ci.reviewedAt;
              return (
                <div key={ci.id} className={`border rounded-xl overflow-hidden bg-card transition-colors ${isReviewed ? 'border-border/50 opacity-80' : 'border-border'}`}>
                  {/* Header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                    onClick={() => setExpandedCheckIns(prev => {
                      const next = new Set(prev);
                      if (next.has(ci.id)) next.delete(ci.id); else next.add(ci.id);
                      return next;
                    })}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">Week of {fmtCheckInDate(toLocalDateStr(ci.weekStartDate))}</span>

                      {isReviewed && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-green-500/15 text-green-400">Complete</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(ci.submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                      <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Diet Execution — 6 questions */}
                      {(ci.dietWeighedFoods || ci.dietMealPrepAccuracy || ci.dietExtrasFrequency || ci.dietAddedFats || ci.dietMealTiming || ci.dietOffPlanQuality) && (
                        <div className="px-4 pt-3 pb-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Diet Execution</p>
                          <div className="space-y-2">
                            {[
                              { q: 'How often did you weigh all foods raw/uncooked with a digital scale?', val: ci.dietWeighedFoods },
                              { q: 'How often did you prepare meals exactly as written in your plan?', val: ci.dietMealPrepAccuracy },
                              { q: 'Excluding off-plan meals, how often did you eat/drink anything not in your plan?', val: ci.dietExtrasFrequency },
                              { q: 'When cooking, how do you use added fats (oil, butter)?', val: ci.dietAddedFats },
                              { q: 'How often did you eat meals more than 2 hours off schedule?', val: ci.dietMealTiming },
                              { q: 'When you had an off-plan meal, how close was it to your plan?', val: ci.dietOffPlanQuality },
                            ].filter(r => r.val).map(row => (
                              <div key={row.q} className="flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">{row.q}</span>
                                <span className="text-sm font-medium text-foreground">{DIET_LABEL_MAP[row.val!] ?? row.val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sleep — Q7 */}
                      {ci.sleepBedtimeConsistency && (
                        <div className="px-4 pt-3 pb-2 border-t border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sleep</p>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">How often did you go to bed more than 1 hour later than your planned bedtime?</span>
                            <span className="text-sm font-medium text-foreground">{DIET_LABEL_MAP[(ci as any).sleepBedtimeConsistency] ?? (ci as any).sleepBedtimeConsistency}</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between gap-2">
                        <button
                          onClick={() => markReviewed.mutate({ id: ci.id, reviewed: !isReviewed })}
                          disabled={markReviewed.isPending}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                            isReviewed
                              ? 'border-border text-muted-foreground hover:text-foreground'
                              : 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                          }`}
                        >
                          {isReviewed ? 'Mark as Incomplete' : 'Mark as Complete'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this check-in? This cannot be undone.')) {
                              deleteCheckIn.mutate({ id: ci.id });
                            }
                          }}
                          disabled={deleteCheckIn.isPending}
                          className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Select a client to view their check-ins
        </div>
      )}
    </div>
  );
}

const SECTION_MAP: Record<string, () => React.ReactNode> = {
  clients: () => <ClientsSection />,
  "check-ins": () => <CheckInsSection />,
  training: () => <TrainingSection />,
  "meal-plans": () => <MealPlansSection />,
  progress: () => <ProgressSection />,
  "exercise-library": () => <ExerciseLibrarySection />,
  "nutrition-data": () => <NutritionDataSection />,
  habits: () => <HabitsSection />,
};
const SECTION_TITLES: Record<string, string> = {
  clients: "Clients",
  "check-ins": "Check-ins",
  training: "Training Programs",
  "meal-plans": "Meal Plans",
  progress: "Client Progress",
  "exercise-library": "Exercise Library",
  "nutrition-data": "Nutrition Data",
  habits: "Habits",
};

export default function CoachPanel() {
  const params = useParams<{ section?: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const section = params.section ?? "clients";

  useEffect(() => {
    if (!params.section) navigate("/coach/clients");
  }, [params.section]);

  if (!loading && isAuthenticated && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Access denied. Coach accounts only.</p>
      </div>
    );
  }

  return (
    <DashboardShell mode="coach">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coach Panel</p>
        <h1 className="text-xl font-bold text-foreground mt-0.5">{SECTION_TITLES[section] ?? "Coach Panel"}</h1>
      </div>
      {(SECTION_MAP[section] ?? (() => <ClientsSection />))()}
    </DashboardShell>
  );
}
