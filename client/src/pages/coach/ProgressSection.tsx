import React, { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { localToday, fmtDate, toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { pctChange as pctChangeNum } from "@/lib/stats";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Minus, Pencil, Save, Trash2, X, ArrowUp, ArrowDown, Check, Ruler, Utensils } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import {
  Card, SectionLabel, ClientCombobox, useClientSelector,
  MeasurementsCard, MuscleGroupSection, DailyLogRow, ProgressHistoryTable
} from "./shared";
import { CoachHabitsPanel } from "./HabitsSection";
import { WeeklyReviewTab } from "./WeeklyReviewTab";
import { CheckInsDetailPanel } from "./CheckInsSection";

// ─── Measurements Tab ────────────────────────────────────────────────────────
function MeasurementsTab({ measurements }: { measurements: any[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sorted = [...measurements].sort((a, b) =>
    toLocalDateStr(b.measureDate).localeCompare(toLocalDateStr(a.measureDate))
  );

  function avg(vals: (number | null | undefined)[]): number | null {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
  }

  const SITES = [
    { key: 'umbilical', label: 'Umbilical' },
    { key: 'suprailiac', label: 'Suprailiac' },
    { key: 'calf',       label: 'Calf' },
    { key: 'thigh',      label: 'Thigh' },
  ] as const;

  function siteAvg(m: any, site: string): number | null {
    return avg([m[`${site}1`], m[`${site}2`], m[`${site}3`], m[`${site}4`], m[`${site}5`]]);
  }

  function totalSkinfold(m: any): number | null {
    const vals = SITES.map(s => siteAvg(m, s.key)).filter((v): v is number => v != null);
    return vals.length > 0 ? parseFloat(vals.reduce((a, b) => a + b, 0).toFixed(1)) : null;
  }

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
  }

  function diffBadge(curr: number | null, prev: number | null, invertGood = false) {
    if (curr == null || prev == null) return null;
    const d = parseFloat((curr - prev).toFixed(1));
    if (d === 0) return null;
    const isGood = invertGood ? d > 0 : d < 0;
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
        isGood ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}>
        {d > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
        {d > 0 ? '+' : ''}{d} mm
      </span>
    );
  }

  function waistDiffBadge(curr: number | null, prev: number | null) {
    if (curr == null || prev == null) return null;
    const d = parseFloat((curr - prev).toFixed(1));
    if (d === 0) return null;
    const isGood = d < 0;
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
        isGood ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}>
        {d > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
        {d > 0 ? '+' : ''}{d} cm
      </span>
    );
  }

  // Build trend data (oldest first) for the chart
  const trendData = [...sorted].reverse().map(m => {
    const iso = toLocalDateStr(m.measureDate);
    const [, mo, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return {
      date: `${parseInt(d)} ${months[parseInt(mo)-1]}`,
      total: totalSkinfold(m),
      waist: m.waist ?? null,
      umbilical: siteAvg(m, 'umbilical'),
      suprailiac: siteAvg(m, 'suprailiac'),
      calf: siteAvg(m, 'calf'),
      thigh: siteAvg(m, 'thigh'),
    };
  });

  if (sorted.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Ruler className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No measurements recorded yet.</p>
      </div>
    );
  }

  const SITE_COLORS: Record<string, string> = {
    umbilical: '#22c55e',
    suprailiac: '#3b82f6',
    calf: '#f59e0b',
    thigh: '#a855f7',
  };

  return (
    <div className="space-y-5">
      {/* Site-by-site trend chart */}
      {trendData.length > 1 && (
        <div>
          <SectionLabel>Skinfold Trend (mm per site)</SectionLabel>
          <div className="bg-card border border-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} width={30} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(v: number, name: string) => [`${v} mm`, name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                {SITES.map(s => (
                  <Area key={s.key} type="monotone" dataKey={s.key} stroke={SITE_COLORS[s.key]}
                    fill={SITE_COLORS[s.key] + '22'} strokeWidth={2} dot={{ r: 3, fill: SITE_COLORS[s.key] }}
                    connectNulls />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 justify-center">
              {SITES.map(s => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: SITE_COLORS[s.key] }} />
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Session cards */}
      <div>
        <SectionLabel>All Measurement Sessions</SectionLabel>
        <div className="space-y-2">
          {sorted.map((m, i) => {
            const iso = toLocalDateStr(m.measureDate);
            const prev = sorted[i + 1] ?? null;
            const isExpanded = expandedId === m.id;
            const total = totalSkinfold(m);
            const prevTotal = prev ? totalSkinfold(prev) : null;
            const isLatest = i === 0;

            return (
              <div key={m.id} className={`rounded-xl border transition-colors ${
                isLatest ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
              }`}>
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {isLatest && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wide">Latest</span>}
                    <p className={`text-sm font-semibold ${isLatest ? 'text-foreground' : 'text-muted-foreground'}`}>{fmtDate(iso)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-right">
                      {m.waist != null && (
                        <span className="text-xs text-muted-foreground">Waist: <span className="text-foreground font-semibold">{m.waist} cm</span></span>
                      )}
                      {total != null && (
                        <span className="text-xs text-muted-foreground">Skinfold: <span className="text-foreground font-semibold">{total} mm</span></span>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    {/* Waist */}
                    <div className="pt-3 pb-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Waist Circumference</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-foreground">{m.waist != null ? `${m.waist} cm` : '—'}</span>
                        {waistDiffBadge(m.waist ?? null, prev?.waist ?? null)}
                      </div>
                    </div>

                    {/* Skinfold sites */}
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {SITES.map(s => {
                        const readings = [m[`${s.key}1`], m[`${s.key}2`], m[`${s.key}3`], m[`${s.key}4`], m[`${s.key}5`]];
                        const hasAny = readings.some(v => v != null);
                        const sAvg = siteAvg(m, s.key);
                        const prevAvg = prev ? siteAvg(prev, s.key) : null;
                        return (
                          <div key={s.key} className="bg-secondary rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                              <div className="flex items-center gap-1.5">
                                {sAvg != null && <span className="text-sm font-bold text-foreground">{sAvg} mm</span>}
                                {diffBadge(sAvg, prevAvg)}
                              </div>
                            </div>
                            {hasAny ? (
                              <div className="flex gap-1.5 flex-wrap">
                                {readings.map((v, ri) => (
                                  <span key={ri} className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                                    v != null ? 'bg-card text-foreground' : 'bg-card/50 text-muted-foreground'
                                  }`}>
                                    {v != null ? `${v}` : '—'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No readings</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Total skinfold summary */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Skinfold</p>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">{total != null ? `${total} mm` : '—'}</span>
                        {total != null && prevTotal != null && (() => {
                          const d = parseFloat((total - prevTotal).toFixed(1));
                          if (d === 0) return null;
                          const isGood = d < 0;
                          return (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                              isGood ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                            }`}>
                              {d > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                              {d > 0 ? '+' : ''}{d} mm vs prev
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
              {/* Middle: chips + note preview */}
              <div className="flex-1 flex flex-col gap-1 px-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {hasData ? (
                    <>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>{sessionLabel}</span>
                      {(log.offPlanMeals ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400" title="Off-plan meal">
                          <Utensils size={11} />
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No entry</span>
                  )}
                </div>
                {hasData && log.notes ? (
                  <p className="text-[11px] text-muted-foreground italic truncate max-w-[220px]">{log.notes}</p>
                ) : null}
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
  hams: 'Hamstrings', glutes: 'Glute Max', gluteMed: 'Glute Med', calves: 'Calves', abs: 'Abs',
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
        const sessionNotes = session.notes as string | null;
        const hasNotes = exercises.some((ex: any) => ex.exerciseNotes) || !!sessionNotes;
        const hasIncomplete = exercises.some((ex: any) => {
          const sets = ex.sets ?? [];
          const programmedSets = sets.length;
          const completedSets = sets.filter((s: any) => s.completed).length;
          return programmedSets > 0 && completedSets < programmedSets;
        });

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
                    {hasIncomplete && <span className="ml-1.5 text-amber-500/80">· incomplete</span>}
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
                  const machineName = ex.machinePreset ?? ex.equipmentDetails ?? null;
                  return (
                    <div key={i} className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground shrink-0">{ex.name}</p>
                      {ex.substitutedFor && (
                        <span className="text-[9px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded shrink-0">SUB</span>
                      )}
                      {completedSets.length > 0 && firstSet ? (
                        <span className="text-xs text-muted-foreground">
                          {firstSet.weight != null ? `${firstSet.weight}kg` : '—'} × {firstSet.reps != null ? firstSet.reps : '—'}
                          <span className="text-muted-foreground/50 ml-1">· {completedSets.length} set{completedSets.length !== 1 ? 's' : ''}</span>
                          {machineName && <span className="text-muted-foreground/40 ml-1">· {machineName}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400/70">incomplete</span>
                      )}
                      {ex.exerciseNotes && (
                        <span className="text-xs text-muted-foreground/60 italic">&ldquo;{ex.exerciseNotes}&rdquo;</span>
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
  const [presetFilter, setPresetFilter] = useState<Record<string, string>>({});

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
  const exerciseHistory: Record<string, Array<{ date: string; topSet: { weight: number | null; reps: number | null } | null; allSets: Array<{ weight: number | null; reps: number | null }>; substitutedFor?: string; equipmentDetails?: string; machinePreset?: string; machineSettings?: string }>> = {};
  for (const session of [...workoutSessions].reverse()) {
    const dateStr = toLocalDateStr(session.sessionDate);
    for (const ex of (session.exercises as any[])) {
      // Only include exercises that have at least one completed set
      const allSetsRaw: Array<{ weight: number | null; reps: number | null; completed?: boolean }> = ex.sets ?? [];
      const completedSets = allSetsRaw.filter(s => s.completed || s.weight != null || s.reps != null);
      if (completedSets.length === 0) continue;
      if (!exerciseHistory[ex.name]) exerciseHistory[ex.name] = [];
      const sets: Array<{ weight: number | null; reps: number | null }> = completedSets;
      // Top set = highest weight, or highest reps if no weights
      const topSet = sets.reduce<{ weight: number | null; reps: number | null } | null>((best, s) => {
        if (!best) return s;
        const bw = best.weight ?? 0, sw = s.weight ?? 0;
        if (sw > bw) return s;
        if (sw === bw && (s.reps ?? 0) > (best.reps ?? 0)) return s;
        return best;
      }, null);
      exerciseHistory[ex.name].push({ date: dateStr, topSet, allSets: sets, substitutedFor: ex.substitutedFor ?? undefined, equipmentDetails: ex.equipmentDetails ?? undefined, machinePreset: ex.machinePreset ?? undefined, machineSettings: ex.machineSettings ?? undefined });
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
              // Collect unique machine presets for this exercise
              const presets = Array.from(new Set(
                history.map(e => e.machinePreset ?? e.equipmentDetails ?? null).filter(Boolean)
              )) as string[];
              const activeMachineFilter = presetFilter[name] ?? 'All';
              const filteredHistory = activeMachineFilter === 'All'
                ? history
                : history.filter(e => (e.machinePreset ?? e.equipmentDetails) === activeMachineFilter);
              const last5 = filteredHistory.slice(-5).reverse();
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

                  {/* Machine preset filter — only shown when multiple presets exist */}
                  {presets.length > 1 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {['All', ...presets].map(p => (
                        <button
                          key={p}
                          onClick={() => setPresetFilter(prev => ({ ...prev, [name]: p }))}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            activeMachineFilter === p
                              ? 'bg-primary text-primary-foreground border-primary font-medium'
                              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Session history — single line per session */}
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
                      // When weight is equal, compare reps
                      const rUp = !wUp && !wDown && w != null && pw != null && w === pw && r != null && pr != null && r > pr;
                      const rDown = !wUp && !wDown && w != null && pw != null && w === pw && r != null && pr != null && r < pr;
                      // Build right-side detail string
                      const weightStr = w != null ? `${w} kg` : '—';
                      const repsStr = r != null ? ` × ${r}` : '';
                      // Show preset name only when single-preset (multi-preset uses filter above)
                      const presetStr = presets.length <= 1 && (entry.machinePreset || entry.equipmentDetails)
                        ? (entry.machinePreset ?? entry.equipmentDetails)
                        : null;
                      const detailParts = presetStr ?? '';
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 py-1 ${
                            i > 0 ? 'border-t border-border/40' : ''
                          } ${isLatest ? 'opacity-100' : 'opacity-50'}`}
                        >
                          {/* Date */}
                          <span className="text-xs text-muted-foreground w-[72px] flex-shrink-0">{dateLabel}</span>
                          {/* Weight × reps */}
                          <span className={`text-xs font-semibold flex-shrink-0 ${
                            isLatest ? 'text-foreground' : 'text-muted-foreground'
                          }`}>{weightStr}{repsStr}</span>
                          {/* Machine / settings detail */}
                          {detailParts && (
                            <span className="text-[10px] text-muted-foreground/60 truncate flex-1">{detailParts}</span>
                          )}
                          {/* Trend arrow */}
                          <div className="w-4 flex justify-end flex-shrink-0">
                            {(wUp || rUp) && <ArrowUp className="w-3 h-3 text-green-400" />}
                            {(wDown || rDown) && <ArrowDown className="w-3 h-3 text-red-400" />}
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

export default function ProgressSection() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const urlClientId = searchParams.get("clientId") ? parseInt(searchParams.get("clientId")!, 10) : null;
  const urlTab = searchParams.get("tab") ?? "overview";
  const [, navigate] = useLocation();

  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();

  // Sync URL clientId into selector once clients load
  const [urlSynced, setUrlSynced] = useState(false);
  useEffect(() => {
    if (!urlSynced && urlClientId && clients.length > 0) {
      const match = clients.find((c: any) => c.id === urlClientId);
      if (match) {
        setSelectedUserId(urlClientId);
        setUrlSynced(true);
      }
    }
  }, [urlClientId, clients, urlSynced]);
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
  const pctChange = pctChangeNum;

  // ── 7-day averages ──────────────────────────────────────────────────────────
  const curAvgWeight = avgOf(cur7.map(l => l.weight as number | null));
  const prevAvgWeight = avgOf(prev7.map(l => l.weight as number | null));
  const weightPct = pctChange(curAvgWeight, prevAvgWeight);

  const curAvgHunger = avgOf(cur7.map(l => l.hungerLevel as number | null));
  const prevAvgHunger = avgOf(prev7.map(l => l.hungerLevel as number | null));

  const curAvgSleep = avgOf(cur7.map(l => l.sleepQuality as number | null));
  const prevAvgSleep = avgOf(prev7.map(l => l.sleepQuality as number | null));

  const curAvgSleepHours = avgOf(cur7.map(l => l.sleepHours as number | null));
  const curAvgCaffeine = avgOf(cur7.map(l => l.caffeineServings as number | null));

  const curAvgSteps = avgOf(cur7.map(l => l.stepsCount as number | null));
  const prevAvgSteps = avgOf(prev7.map(l => l.stepsCount as number | null));

  // ── Meal adherence: on-plan days / 7 calendar days (unlogged = non-adherent) ──
  const curOnPlan = cur7.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  // Use 7 calendar days as denominator — missing logs count as non-adherent
  const mealAdherence = Math.round((curOnPlan / 7) * 100);
  const prevOnPlan = prev7.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  const prevMealAdherence = Math.round((prevOnPlan / 7) * 100);
  // Count days with any off-plan meal (boolean: 1 = yes)
  const offPlanTotal7 = cur7.filter(l => (l.offPlanMeals ?? 0) > 0).length;

  // ── Training adherence: ratio-based prescribed count (avoids cycle-index anchor bug) ──
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
  // Count training days in the schedule (ratio approach — no anchor date needed)
  const trainingDaysInSchedule = schedule
    ? schedule.filter(s => s && s.toLowerCase() !== 'off').length
    : programDays
      ? programDays.filter(d => !String(d?.name ?? d?.label ?? '').toLowerCase().includes('off')).length
      : rotationLen;
  // Prescribed = windowDays × (trainingDaysInSchedule / rotationLen), rounded, min 1
  const prescribedPerRotation = Math.max(1, Math.round(rotWindowDays.length * (trainingDaysInSchedule / rotationLen)));
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
          <Tabs defaultValue={urlTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="sessions">Training</TabsTrigger>
            <TabsTrigger value="exercise">Exercise Progress</TabsTrigger>
            <TabsTrigger value="notes">Coaching Notes</TabsTrigger>
            <TabsTrigger value="check-ins">Check-ins</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
          <div className="space-y-6">
          <WeeklyReviewTab clientId={selectedUserId!} />
          <CoachHabitsPanel clientId={selectedUserId!} />
          {(logs ?? []).length > 0 && (
            <RecentLogsWithViewMore logs={logs ?? []} startDate={clientStartDate} />
          )}
          </div>
          </TabsContent>

          <TabsContent value="measurements">
            <MeasurementsTab measurements={measurements ?? []} />
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

          <TabsContent value="check-ins">
            <CheckInsDetailPanel clientId={selectedUserId!} />
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}


