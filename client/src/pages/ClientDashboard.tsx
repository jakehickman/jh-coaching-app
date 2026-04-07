import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef } from "react";
import { useDraft } from "@/hooks/useDraft";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { Check, Plus, Trash2, ChevronDown, ChevronUp, Play, X, Minus, Pencil, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Convert a DB date value (ISO timestamp or plain date string) to yyyy-mm-dd.
// MySQL DATE columns are stored as the correct calendar date and returned as
// UTC midnight timestamps (e.g. "2026-04-06T04:00:00.000Z" for April 6 AEST).
// We MUST use UTC date parts to avoid the local timezone shifting the date back.
function toLocalDateStr(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  // If it's a full ISO timestamp, use UTC date parts to preserve the stored date
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  // Plain date string like "2026-04-06" — use as-is
  return s.slice(0, 10);
}

// Get today's date as yyyy-mm-dd in the user's LOCAL timezone (not UTC)
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Display a DB date value as dd/mm/yyyy in local time
function fmtDate(val: unknown): string {
  if (!val) return "";
  const iso = toLocalDateStr(val);
  const [y, m, d] = iso.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return iso;
}

// Native HTML date picker — value and onChange use yyyy-mm-dd strings
// The browser's date input always produces a yyyy-mm-dd string in local time,
// so no timezone conversion is needed.
function DateInput({ value, onChange, className = "", min, max }: { value: string; onChange: (v: string) => void; className?: string; min?: string; max?: string }) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(e.target.value)}
      className={`bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    />
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

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

function RecentLogsPanel({ logs, startDate }: { logs: DailyLogRow[]; startDate?: string | null }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const logMap: Record<string, DailyLogRow> = {};
  for (const log of logs) {
    const key = toLocalDateStr(log.logDate);
    if (key) logMap[key] = log;
  }

  const allDays: string[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    // Stop going back further than the client's start date
    if (startDate && iso < startDate) break;
    allDays.push(iso);
  }
  // Only include days that have a log entry, up to the limit
  const loggedDays = allDays.filter(iso => !!logMap[iso]);
  const days = showAll ? loggedDays : loggedDays.slice(0, 7);

  function fmtDay(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function dayLabel(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { weekday: 'short' });
  }
  const hasOffPlanMeals = (v: unknown) => typeof v === 'number' ? v > 0 : (v === true || v === 1 || v === '1');
  const isTrained = (v: unknown) => v === true || v === 1 || v === '1';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {days.map((iso) => {
        const log = logMap[iso] ?? null;
        const isExpanded = expandedId === iso;
        const hasData = !!log; // always true since we filter to logged days only
        const trained = log ? isTrained(log.trainingCompleted) : false;
        const sessionLabel = log?.trainingType && log.trainingType !== 'Off'
          ? log.trainingType
          : (trained ? 'Training' : 'Rest');
        return (
          <div key={iso} className="border-b border-border last:border-0">
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
              <div className="flex-1 flex items-center gap-2 flex-wrap px-3">
                {hasData ? (
                  <>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>{sessionLabel}</span>
                    {hasOffPlanMeals(log.offPlanMeals) && <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400">{(log.offPlanMeals ?? 0) > 1 ? `${log.offPlanMeals} Off Plan Meals` : 'Off Plan Meal'}</span>}
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
            {isExpanded && log && (
              <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3">
                  {log.weight != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p><p className="text-sm font-semibold text-foreground">{log.weight} kg</p></div>}
                  {log.stepsCount != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Steps</p><p className="text-sm font-semibold text-foreground">{log.stepsCount.toLocaleString()}</p></div>}
                  {log.sleepHours != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Hours</p><p className="text-sm font-semibold text-foreground">{log.sleepHours} hrs</p></div>}
                  {log.sleepQuality != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Quality</p><p className="text-sm font-semibold text-foreground">{log.sleepQuality}/5</p></div>}
                  {log.hungerLevel != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hunger</p><p className="text-sm font-semibold text-foreground">{log.hungerLevel}/5</p></div>}
                  {log.caffeineServings != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Caffeine</p><p className="text-sm font-semibold text-foreground">{log.caffeineServings} srv</p></div>}
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Training</p><p className="text-sm font-semibold text-foreground">{sessionLabel}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Meals</p><p className="text-sm font-semibold text-foreground">{(log.offPlanMeals ?? 0) > 0 ? `${log.offPlanMeals} off-plan` : 'On Plan'}</p></div>
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
      {loggedDays.length > 7 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-muted/20 transition-colors"
        >
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            : <><ChevronDown className="w-3.5 h-3.5" /> View more ({loggedDays.length - 7} older entries)</>}
        </button>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1 leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
    </Card>
  );
}
function ScoreInput({ label, value, onChange, max = 10 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-11 rounded-lg text-sm font-semibold transition-colors touch-manipulation ${
              value === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Overview / Dashboard ────────────────────────────────────────────────
function OverviewTab() {
  const { data: logs } = trpc.dailyLog.list.useQuery({ limit: 30 });
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: program } = trpc.training.get.useQuery();
  const { data: measurements } = trpc.measurements.list.useQuery();

  const weightData = (logs ?? [])
    .filter(l => l.weight)
    .slice(0, 14)
    .reverse()
    .map(l => {
      const iso = toLocalDateStr(l.logDate);
      return { date: iso.slice(5), weight: l.weight };
    });

  // 7-day avg weight using true calendar days (string comparison avoids timezone shifts)
  const allLogs = logs ?? [];
  const DAY = 86400000;
  // Build date strings for the window boundaries using local time
  const localDateStr = (offsetDays: number) => {
    const d = new Date(Date.now() - offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = localDateStr(0);
  const day6ago = localDateStr(6);
  const day7ago = localDateStr(7);
  const day13ago = localDateStr(13);

  const thisWeekWeights = allLogs
    .filter(l => {
      const d = toLocalDateStr(l.logDate);
      return d >= day6ago && d <= today && l.weight != null;
    })
    .map(l => l.weight as number);

  const prevWeekWeights = allLogs
    .filter(l => {
      const d = toLocalDateStr(l.logDate);
      return d >= day13ago && d <= day7ago && l.weight != null;
    })
    .map(l => l.weight as number);

  const avgWeight = thisWeekWeights.length > 0
    ? (thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length).toFixed(1)
    : "—";

  const prevAvgWeight = prevWeekWeights.length > 0
    ? prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length
    : null;

  const weightChangePct = prevAvgWeight && thisWeekWeights.length > 0
    ? (((thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length) - prevAvgWeight) / prevAvgWeight * 100).toFixed(1)
    : null;

  const latestLog = logs?.[0];

  // Training adherence — one full rotation window
  // The schedule is e.g. ["A","B","Off","C","D","Off"] — rotation length = schedule.length
  const schedule: string[] = Array.isArray((program as any)?.schedule) ? (program as any).schedule : [];
  const rotationLength = schedule.length > 0 ? schedule.length : 7;
  const prescribedDays = schedule.length > 0
    ? schedule.filter((s: string) => s !== 'Off').length
    : rotationLength;
  // Look back exactly one rotation length in calendar days
  const rotationStartDate = localDateStr(rotationLength - 1);
  const trainedInRotation = allLogs.filter(l => {
    const d = toLocalDateStr(l.logDate);
    return d >= rotationStartDate && d <= today && l.trainingCompleted;
  }).length;
  const adherence = prescribedDays > 0 ? Math.min(100, Math.round((trainedInRotation / prescribedDays) * 100)) : 0;
  const adherenceSub = schedule.length > 0
    ? `${trainedInRotation}/${prescribedDays} days (last ${rotationLength}-day rotation)`
    : `${trainedInRotation} sessions this rotation`;

  // Meal adherence — last 7 calendar days (unlogged days count as non-adherent)
  const hasOffPlanMeals = (v: unknown) => typeof v === 'number' ? v > 0 : (v === true || v === 1 || v === '1');
  const cur7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day6ago && d <= today; });
  const prev7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day13ago && d <= day7ago; });
  // A day is "on plan" if logged with 0 off-plan meals
  const curOnPlan = cur7Logs.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  // Denominator is always 7 calendar days — unlogged days count as non-adherent
  const mealAdherence = Math.round((curOnPlan / 7) * 100);
  const prevOnPlan = prev7Logs.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  const prevMealAdherence = Math.round((prevOnPlan / 7) * 100);
  // 7-day off-plan meal total
  const offPlanTotal7 = cur7Logs.reduce((sum, l) => sum + (l.offPlanMeals ?? 0), 0);
  const mealAdherenceSub = `${curOnPlan}/7 on-plan days · ${offPlanTotal7} off-plan meals${` · prev ${prevMealAdherence}%`}`;

  // Recent logs for display (last 7 entries)
  const recentLogs = allLogs.slice(0, 7);

  // Step goal metrics
  const stepGoal = (profile as any)?.stepGoal as number | null | undefined;
  const cur7Steps = cur7Logs.filter(l => l.stepsCount != null).map(l => l.stepsCount as number);
  const avgSteps7 = cur7Steps.length > 0 ? Math.round(cur7Steps.reduce((a, b) => a + b, 0) / cur7Steps.length) : null;
  const stepsGoalDays = stepGoal ? cur7Logs.filter(l => (l.stepsCount ?? 0) >= stepGoal).length : null;

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Weekly Summary</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="7-Day Avg Weight" value={avgWeight !== "—" ? `${avgWeight} kg` : "—"} sub={weightChangePct ? `${Number(weightChangePct) > 0 ? '+' : ''}${weightChangePct}% vs prev 7 days` : undefined} />
          <MetricCard label="Training Adherence" value={`${adherence}%`} />
          <MetricCard label="Off-Plan Meals (7d)" value={offPlanTotal7.toString()} />
          {stepGoal ? (
            <MetricCard
              label="Avg Daily Steps"
              value={avgSteps7 != null ? avgSteps7.toLocaleString() : "—"}
              sub={`Goal: ${stepGoal.toLocaleString()}`}
            />
          ) : (
            <MetricCard label="Goal Weight" value={profile?.goalWeight ? `${profile.goalWeight} kg` : "—"} sub={profile?.startWeight ? `Started: ${profile.startWeight} kg` : undefined} />
          )}
        </div>
      </div>

      {weightData.length > 0 && (
        <div>
          <SectionLabel>Weight Trend (14 Days)</SectionLabel>
          <Card>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#666", fontSize: 10 }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#22c55e" }}
                />
                <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}



      <HabitsSummary />

      <div>
        <SectionLabel>Recent Logs</SectionLabel>
        <RecentLogsPanel logs={allLogs} startDate={profile?.startDate ? toLocalDateStr(profile.startDate) : undefined} />
      </div>
    </div>
  );
}

// ─── Habits Summary (Overview tab) ─────────────────────────────────────────
function HabitsSummary() {
  const { data: habits = [] } = trpc.habits.myHabits.useQuery();
  const from30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const { data: completions = [] } = trpc.habits.myCompletions.useQuery({ fromDate: from30 });

  if (habits.length === 0) return null;

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

  // Build last 7 days array
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  // Helper: normalise a date value (Date object or ISO string) to yyyy-mm-dd using LOCAL timezone
  // Must match last7 which is also built with local date parts
  const normDate = (val: any): string => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Completion set: "habitId:date"
  const completedSet = new Set(
    completions.map((c: any) => `${c.habitId}:${normDate(c.completedDate)}`)
  );

  // Per-habit stats
  const habitStats = habits.map((h: any) => {
    // Only count days on/after assignment date as eligible
    const assignedDateStr = normDate(h.assignedAt);
    const eligible7 = last7.filter(d => d >= assignedDateStr);
    const last7Done = eligible7.filter(d => completedSet.has(`${h.id}:${d}`)).length;
    const pct7 = eligible7.length > 0 ? Math.round((last7Done / eligible7.length) * 100) : 0;

    // Streak: count consecutive completed days ending today (only from assignedDate)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (ds < assignedDateStr) break;
      if (completedSet.has(`${h.id}:${ds}`)) streak++;
      else break;
    }

    return { ...h, last7Done, pct7, streak, eligible7: eligible7.length };
  });

  const todayDone = habits.filter((h: any) => completedSet.has(`${h.id}:${today}`)).length;

  // Day-of-week labels (single letter)
  const dayLabels = last7.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
  });

  const allDoneToday = todayDone === habits.length && habits.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Habits</p>
        <span className={`text-xs font-semibold ${
          allDoneToday ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {todayDone}/{habits.length} today
        </span>
      </div>
      <Card className="p-0 overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1.5 border-b border-border/50">
          <div className="flex-1 min-w-0" />
          <div className="flex gap-1">
            {dayLabels.map((lbl, i) => (
              <div key={i} className="w-6 text-center text-[10px] text-muted-foreground/60 font-medium">{lbl}</div>
            ))}
          </div>
        </div>
        {/* Habit rows */}
        {habitStats.map((h: any, idx: number) => {
          const todayComplete = completedSet.has(`${h.id}:${today}`);
          return (
            <div
              key={h.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx > 0 ? 'border-t border-border/50' : ''
              }`}
            >
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                todayComplete ? 'bg-primary' : 'bg-muted-foreground/30'
              }`} />
              {/* Name + streak */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                {h.streak > 1 && (
                  <p className="text-[10px] text-primary/80">{h.streak}-day streak</p>
                )}
              </div>
              {/* 7-day cells */}
              <div className="flex gap-1 shrink-0">
                {last7.map(d => {
                  const done = completedSet.has(`${h.id}:${d}`);
                  const isToday = d === today;
                  return (
                    <div
                      key={d}
                      className={`w-6 h-6 rounded ${
                        done
                          ? 'bg-primary'
                          : isToday
                          ? 'bg-muted ring-1 ring-primary/30'
                          : 'bg-muted'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── Tab: Daily Log ───────────────────────────────────────────────────────────
// ─── Habits Card (inside Daily Log) ─────────────────────────────────────────
function HabitsCard({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const { data: habits = [] } = trpc.habits.myHabits.useQuery();
  // Fetch last 90 days of completions with a stable cache key (no date dependency)
  const from90 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 89);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const { data: completions = [], refetch } = trpc.habits.myCompletions.useQuery({ fromDate: from90 });

  // Helper: normalise completedDate (Date object or ISO string) to yyyy-mm-dd using LOCAL timezone
  // Must match the date prop (localToday) which is also in local timezone
  const normDate = (val: any): string => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Local optimistic state: map of "habitId:date" -> boolean
  // We never clear this map — once the server confirms, serverDone takes over and the
  // optimistic entry is simply ignored (serverDone === optimistic[key] so no visual diff).
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const toggleMutation = trpc.habits.toggleCompletion.useMutation({
    onMutate: ({ habitId, date: d }) => {
      const key = `${habitId}:${d}`;
      const serverDone = completions.some(
        (c: any) => c.habitId === habitId && normDate(c.completedDate) === d
      );
      const currentDone = key in optimistic ? optimistic[key] : serverDone;
      setOptimistic(prev => ({ ...prev, [key]: !currentDone }));
    },
    onSettled: () => {
      // Refetch to sync server state — do NOT clear optimistic map here,
      // the optimistic value stays until the component unmounts (no flicker).
      refetch();
    },
  });

  if (habits.length === 0) return null;

  return (
    <div>
      <SectionLabel>Habits</SectionLabel>
      <Card className="space-y-1 p-0 overflow-hidden">
        {habits.map((h: any, i: number) => {
          const key = `${h.id}:${date}`;
          const serverDone = completions.some(
            (c: any) => c.habitId === h.id && normDate(c.completedDate) === date
          );
          const done = key in optimistic ? optimistic[key] : serverDone;
          return (
            <button
              key={h.id}
              onClick={() => toggleMutation.mutate({ habitId: h.id, date })}
              disabled={toggleMutation.isPending}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                i > 0 ? "border-t border-border" : ""
              } ${done ? "bg-primary/5" : "hover:bg-muted/30"} disabled:opacity-70`}
            >
              {done
                ? <CheckSquare size={20} className="text-primary shrink-0" />
                : <Square size={20} className="text-muted-foreground shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? "text-primary" : "text-foreground"}`}>{h.name}</p>
                {h.description && <p className="text-xs text-muted-foreground truncate">{h.description}</p>}
              </div>
              {done && <Check size={14} className="text-primary shrink-0" />}
            </button>
          );
        })}
      </Card>
    </div>
  );
}

function DailyLogTab() {
  const today = localToday();
  const [date, setDate] = useState(today);
  const blankDailyForm = { weight: "", sleepHours: "", caffeineServings: "", trainingCompleted: false, trainingType: "", stepsCount: "", sleepQuality: 3, hungerLevel: 3, offPlanMeals: 0, notes: "" };
  const [form, setForm, clearDraft] = useDraft(`draft:dailyLog:${date}`, blankDailyForm);
  // Track whether we've loaded server data for this date yet (avoid overwriting draft with blank)
  const serverLoadedRef = useRef<string | null>(null);
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: logs, refetch } = trpc.dailyLog.list.useQuery({ limit: 90 });
  const { data: workoutSessions = [] } = trpc.workoutSessions.list.useQuery();
  const upsert = trpc.dailyLog.upsert.useMutation({
    onSuccess: () => { clearDraft(); toast.success("Log saved"); refetch(); }
  });
  const del = trpc.dailyLog.delete.useMutation({
    onSuccess: () => { toast.success("Log deleted"); refetch(); }
  });

  // Auto-derive training status from workout sessions for the selected date
  // sessionDate may be a Date object or a string depending on the driver
  const toDateStr = (v: Date | string | null | undefined): string => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    return v.toISOString().slice(0, 10);
  };
  const todaysSessions = workoutSessions.filter(s => toDateStr(s.sessionDate as Date | string) === date);
  const autoTrained = todaysSessions.length > 0;
  const autoTrainingType = todaysSessions.map(s => s.dayLabel).filter(Boolean).join(", ") || undefined;

  // Load existing log for selected date — only overwrite if no local draft exists
  useEffect(() => {
    if (!logs) return;
    const cacheKey = `draft:dailyLog:${date}`;
    const hasDraft = !!localStorage.getItem(cacheKey);
    if (hasDraft && serverLoadedRef.current === date) return; // user has unsaved changes, keep them
    const existing = logs.find(l => toLocalDateStr(l.logDate) === date);
    if (existing) {
      setForm({
        weight: existing.weight?.toString() ?? "",
        sleepHours: existing.sleepHours?.toString() ?? "",
        caffeineServings: existing.caffeineServings?.toString() ?? "",
        trainingCompleted: existing.trainingCompleted ?? false,
        trainingType: existing.trainingType ?? "",
        stepsCount: existing.stepsCount?.toString() ?? "",
        sleepQuality: existing.sleepQuality ?? 3,
        hungerLevel: existing.hungerLevel ?? 3,
        offPlanMeals: existing.offPlanMeals ?? 0,
        notes: existing.notes ?? "",
      });
    } else if (!hasDraft) {
      setForm(blankDailyForm);
    }
    serverLoadedRef.current = date;
  }, [date, logs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync auto-derived training fields whenever date or workout sessions change
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      trainingCompleted: autoTrained,
      trainingType: autoTrainingType ?? prev.trainingType,
    }));
  }, [date, autoTrained, autoTrainingType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    upsert.mutate({
      logDate: date,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : undefined,
      caffeineServings: form.caffeineServings ? parseFloat(form.caffeineServings) : undefined,
      trainingCompleted: form.trainingCompleted,
      trainingType: form.trainingType || undefined,
      stepsCount: form.stepsCount ? parseInt(form.stepsCount) : undefined,
      sleepQuality: form.sleepQuality,
      hungerLevel: form.hungerLevel,
      offPlanMeals: form.offPlanMeals ?? 0,
      notes: form.notes || undefined,
    });
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Date</SectionLabel>
        <DateInput
          value={date}
          onChange={setDate}
          min={profile?.startDate ? toLocalDateStr(profile.startDate) : undefined}
          max={today}
          className="w-full"
        />
      </div>

      <div>
        <SectionLabel>Body Metrics</SectionLabel>
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={f("weight")} className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Sleep (hours)</label>
              <input type="number" step="0.5" value={form.sleepHours} onChange={f("sleepHours")} className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Caffeine (servings)</label>
              <input type="number" step="0.5" min="0" value={form.caffeineServings} onChange={f("caffeineServings")} className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <p className="text-[10px] text-muted-foreground mt-0.5">1 serving ≈ 80–100mg</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">Steps</label>
                {(profile as any)?.stepGoal && (
                  <span className="text-xs text-primary font-medium">Goal: {((profile as any).stepGoal as number).toLocaleString()}</span>
                )}
              </div>
              <input type="number" value={form.stepsCount} onChange={f("stepsCount")} className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Training</SectionLabel>
        <Card>
          {autoTrained ? (
            <div className="flex items-center gap-3 py-1">
              <div className="w-6 h-6 rounded border-2 bg-primary border-primary flex items-center justify-center flex-shrink-0">
                <Check size={14} className="text-primary-foreground" />
              </div>
              <div>
                <span className="text-base text-foreground">Training logged</span>
                {autoTrainingType && (
                  <p className="text-xs text-muted-foreground mt-0.5">{autoTrainingType}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="w-6 h-6 rounded border-2 border-border flex items-center justify-center flex-shrink-0" />
              <div>
                <span className="text-base text-muted-foreground">No training logged</span>
                <p className="text-xs text-muted-foreground mt-0.5">Log a workout in Training → Workout Log to mark this day</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div>
        <SectionLabel>Biofeedback (1–5)</SectionLabel>
        <Card className="space-y-4">
          <ScoreInput label="Sleep Quality" value={form.sleepQuality} onChange={v => setForm(p => ({ ...p, sleepQuality: v }))} max={5} />
          <ScoreInput label="Hunger Level" value={form.hungerLevel} onChange={v => setForm(p => ({ ...p, hungerLevel: v }))} max={5} />
        </Card>
      </div>

      <div>
        <SectionLabel>Nutrition</SectionLabel>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base text-foreground font-medium">Off-Plan Meals</p>
              <p className="text-xs text-muted-foreground mt-0.5">Meals outside your plan today</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, offPlanMeals: Math.max(0, (p.offPlanMeals ?? 0) - 1) }))}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors text-lg font-medium"
              >−</button>
              <span className={`text-xl font-bold w-6 text-center ${
                (form.offPlanMeals ?? 0) > 0 ? 'text-amber-400' : 'text-muted-foreground'
              }`}>{form.offPlanMeals ?? 0}</span>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, offPlanMeals: (p.offPlanMeals ?? 0) + 1 }))}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors text-lg font-medium"
              >+</button>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Notes</SectionLabel>
        <textarea value={form.notes} onChange={f("notes")} rows={3} className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>

      <HabitsCard date={date} />

      <button onClick={handleSave} disabled={upsert.isPending}
        className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
        {upsert.isPending ? "Saving..." : "Save Log"}
      </button>

      <div>
        <SectionLabel>Recent Logs</SectionLabel>
        <RecentLogsPanel logs={logs ?? []} startDate={profile?.startDate ? toLocalDateStr(profile.startDate) : undefined} />
      </div>
    </div>
  );
}

// ─── Tab: Measurements ────────────────────────────────────────────────────────
const SKINFOLD_SITES = [
  { key: "umbilical", label: "Umbilical" },
  { key: "suprailiac", label: "Suprailiac" },

] as const;

function avgReadings(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null && v !== undefined);
  return nums.length > 0 ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
}

function MeasurementsTab() {
  const { data: measurements, refetch } = trpc.measurements.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const emptySkinfold = { r1: "", r2: "", r3: "", r4: "", r5: "" };
  const blankForm = () => ({
    measureDate: localToday(),
    waist: "",
    umbilical: { ...emptySkinfold },
    suprailiac: { ...emptySkinfold },
    notes: "",
  });
  const [form, setForm] = useState(blankForm);
  const [editForm, setEditForm] = useState(blankForm);

  const add = trpc.measurements.add.useMutation({
    onSuccess: () => { toast.success("Measurements saved"); setShowForm(false); setForm(blankForm()); refetch(); }
  });
  const update = trpc.measurements.update.useMutation({
    onSuccess: () => { toast.success("Entry updated"); setEditingId(null); refetch(); }
  });
  const del = trpc.measurements.delete.useMutation({
    onSuccess: () => { toast.success("Entry deleted"); refetch(); }
  });

  const setReading = (site: string, r: string, val: string) =>
    setForm(p => ({ ...p, [site]: { ...(p as any)[site], [r]: val } }));
  const setEditReading = (site: string, r: string, val: string) =>
    setEditForm(p => ({ ...p, [site]: { ...(p as any)[site], [r]: val } }));

  const parseR = (v: string) => v ? parseFloat(v) : undefined;
  const parseRNull = (v: string) => v ? parseFloat(v) : null;

  const startEdit = (m: any) => {
    const toStr = (v: number | null | undefined) => v != null ? String(v) : "";
    setEditForm({
      measureDate: toLocalDateStr(m.measureDate),
      waist: toStr(m.waist),
      umbilical: { r1: toStr(m.umbilical1), r2: toStr(m.umbilical2), r3: toStr(m.umbilical3), r4: toStr(m.umbilical4), r5: toStr(m.umbilical5) },
      suprailiac: { r1: toStr(m.suprailiac1), r2: toStr(m.suprailiac2), r3: toStr(m.suprailiac3), r4: toStr(m.suprailiac4), r5: toStr(m.suprailiac5) },
      notes: m.notes ?? "",
    });
    setEditingId(m.id);
  };

  const waistData = (measurements ?? []).slice(0, 8).reverse().map(m => ({
    date: String(m.measureDate).slice(5, 10),
    waist: m.waist,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Measurements</SectionLabel>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
          <Plus size={14} /> Add Measurement
        </button>
      </div>

      {showForm && (
        <Card className="space-y-5">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Date</label>
            <DateInput value={form.measureDate} onChange={v => setForm(p => ({ ...p, measureDate: v }))} />
          </div>

          {/* Waist */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Waist Circumference (cm)</p>
            <input type="number" step="0.1" value={form.waist} onChange={e => setForm(p => ({ ...p, waist: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Skinfold sites */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-foreground">Skinfold Thickness — enter 5 readings per site (mm)</p>
            {SKINFOLD_SITES.map(({ key, label }) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground mb-2">{label}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["r1","r2","r3","r4","r5"] as const).map((r, i) => (
                    <div key={r}>
                      <label className="text-[10px] text-muted-foreground block mb-1 text-center">{i+1}</label>
                      <input type="number" step="0.1" value={(form as any)[key][r]}
                        onChange={e => setReading(key, r, e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-1.5 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <button onClick={() => add.mutate({
            measureDate: form.measureDate,
            waist: parseR(form.waist),
            umbilical1: parseR(form.umbilical.r1), umbilical2: parseR(form.umbilical.r2), umbilical3: parseR(form.umbilical.r3), umbilical4: parseR(form.umbilical.r4), umbilical5: parseR(form.umbilical.r5),
            suprailiac1: parseR(form.suprailiac.r1), suprailiac2: parseR(form.suprailiac.r2), suprailiac3: parseR(form.suprailiac.r3), suprailiac4: parseR(form.suprailiac.r4), suprailiac5: parseR(form.suprailiac.r5),

            notes: form.notes || undefined,
          })} disabled={add.isPending}
            className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 disabled:opacity-50">
            {add.isPending ? "Saving..." : "Save Measurements"}
          </button>
        </Card>
      )}

      {waistData.length > 1 && (
        <div>
          <SectionLabel>Waist Trend</SectionLabel>
          <Card>
            <div style={{ width: "100%", height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waistData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#666", fontSize: 10 }}
                    interval="preserveStartEnd"
                    tickLine={false}
                  />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 11 }} width={40} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#22c55e" }} />
                  <Line type="monotone" dataKey="waist" stroke="#22c55e" strokeWidth={2} dot={false} name="Waist (cm)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {(measurements ?? []).length > 0 && (
        <div>
          <SectionLabel>History</SectionLabel>
          <div className="space-y-3">
            {measurements!.map(m => {
              const umbAvg = avgReadings([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]);
              const supAvg = avgReadings([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]);
              const siteAvgs = [umbAvg, supAvg];
              const total = siteAvgs.every(v => v !== null) ? parseFloat(siteAvgs.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
              const isEditing = editingId === m.id;
              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-base font-semibold text-foreground">{fmtDate(m.measureDate)}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => isEditing ? setEditingId(null) : startEdit(m)}
                        className="text-muted-foreground hover:text-primary transition-colors p-1 rounded" title={isEditing ? "Cancel edit" : "Edit entry"}>
                        {isEditing ? <X size={14} /> : <Pencil size={14} />}
                      </button>
                      <button onClick={() => { if (confirm("Delete this measurement entry?")) del.mutate({ id: m.id }); }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" title="Delete entry">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1.5">Date</label>
                        <DateInput value={editForm.measureDate} onChange={v => setEditForm(p => ({ ...p, measureDate: v }))} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2">Waist Circumference (cm)</p>
                        <input type="number" step="0.1" value={editForm.waist}
                          onChange={e => setEditForm(p => ({ ...p, waist: e.target.value }))}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-foreground">Skinfold Thickness — 5 readings per site (mm)</p>
                        {SKINFOLD_SITES.map(({ key, label }) => (
                          <div key={key}>
                            <p className="text-xs text-muted-foreground mb-2">{label}</p>
                            <div className="grid grid-cols-5 gap-1.5">
                              {(["r1","r2","r3","r4","r5"] as const).map((r, i) => (
                                <div key={r}>
                                  <label className="text-[10px] text-muted-foreground block mb-1 text-center">{i+1}</label>
                                  <input type="number" step="0.1" value={(editForm as any)[key][r]}
                                    onChange={e => setEditReading(key, r, e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-lg px-1.5 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1.5">Notes (optional)</label>
                        <input type="text" value={editForm.notes}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <button onClick={() => update.mutate({
                        id: m.id,
                        measureDate: editForm.measureDate,
                        waist: parseRNull(editForm.waist),
                        umbilical1: parseRNull(editForm.umbilical.r1), umbilical2: parseRNull(editForm.umbilical.r2), umbilical3: parseRNull(editForm.umbilical.r3), umbilical4: parseRNull(editForm.umbilical.r4), umbilical5: parseRNull(editForm.umbilical.r5),
                        suprailiac1: parseRNull(editForm.suprailiac.r1), suprailiac2: parseRNull(editForm.suprailiac.r2), suprailiac3: parseRNull(editForm.suprailiac.r3), suprailiac4: parseRNull(editForm.suprailiac.r4), suprailiac5: parseRNull(editForm.suprailiac.r5),
                        notes: editForm.notes || null,
                      })} disabled={update.isPending}
                        className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50">
                        {update.isPending ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {m.waist && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Waist</p>
                          <p className="text-lg font-bold text-foreground">{m.waist} <span className="text-sm font-normal text-muted-foreground">cm</span></p>
                        </div>
                      )}
                      {siteAvgs.some(v => v !== null) && (
                        <>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Skinfold (avg mm)</p>
                          <div className="grid grid-cols-4 gap-2 mb-2">
                            {[
                              { label: "Umbilical", avg: umbAvg },
                              { label: "Suprailiac", avg: supAvg },
                            ].map(({ label, avg }) => (
                              <div key={label} className="text-center">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="text-base font-semibold text-foreground">{avg ?? "—"}</p>
                              </div>
                            ))}
                          </div>
                          {total !== null && (
                            <div className="border-t border-border pt-2 flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="text-sm font-bold text-primary">{total} mm</p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Meal Plan ───────────────────────────────────────────────────────────
function MealPlanTab() {
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: plan } = trpc.mealPlan.get.useQuery({ dayType });
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();

  const meals = (plan?.meals as any[]) ?? [];

  // Helper: convert item amount to grams (handles serving-based foods)
  function itemToGrams(food: any, amount: number): number {
    if (!food) return amount;
    return food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  }

  // Calculate macros per meal and daily totals from food DB
  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const food = foodDb.find((f: any) => f.name === item.food);
      if (!food || !parseFloat(item.grams)) return acc;
      const grams = itemToGrams(food, parseFloat(item.grams));
      const factor = grams / 100;
      return {
        calories: acc.calories + Math.round(food.calories * factor),
        protein: Math.round(acc.protein + food.protein * factor),
        carbs: Math.round(acc.carbs + food.carbs * factor),
        fiber: Math.round(acc.fiber + food.fiber * factor),
        fat: Math.round(acc.fat + food.fat * factor),
      };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 })
  );
  const dailyTotals = mealMacros.reduce((acc: any, m: any) => ({
    calories: acc.calories + m.calories,
    protein: Math.round(acc.protein + m.protein),
    carbs: Math.round(acc.carbs + m.carbs),
    fiber: Math.round(acc.fiber + m.fiber),
    fat: Math.round(acc.fat + m.fat),
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["training", "rest"] as const).map(t => (
          <button key={t} onClick={() => setDayType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {t === "training" ? "Training Day" : "Rest Day"}
          </button>
        ))}
      </div>

      {plan && (
        <div className="space-y-4">
          {/* Daily totals */}
          {meals.length > 0 && dailyTotals.calories > 0 && (
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Calories", value: dailyTotals.calories, unit: "kcal", highlight: true },
                  { label: "Protein", value: dailyTotals.protein, unit: "g" },
                  { label: "Carbs", value: dailyTotals.carbs, unit: "g" },
                  { label: "Fiber", value: dailyTotals.fiber, unit: "g" },
                  { label: "Fat", value: dailyTotals.fat, unit: "g" },
                ].map(({ label, value, unit, highlight }) => (
                  <div key={label} className={`flex flex-col items-center px-2 py-2 rounded-lg ${ highlight ? "bg-primary/15 border border-primary/30" : "bg-secondary/60" }`}>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
                    <span className={`text-sm font-bold mt-0.5 ${ highlight ? "text-primary" : "text-foreground" }`}>{value} {unit}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {meals.length > 0 ? (
            <div className="space-y-4">
              {meals.map((meal: any, i: number) => {
                const mm = mealMacros[i];
                const hasMacros = mm.calories > 0;
                return (
                  <Card key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">{meal.name ?? `Meal ${i + 1}`}</p>
                      {meal.time && (
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                          {(() => { try { const [h, m] = meal.time.split(":"); const d = new Date(); d.setHours(+h, +m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return meal.time; } })()}
                        </span>
                      )}
                    </div>
                    {(meal.items ?? []).map((item: any, j: number) => {
                      const food = foodDb.find((f: any) => f.name === item.food);
                      const rawAmount = parseFloat(item.grams) || 0;
                      const effectiveGrams = food ? itemToGrams(food, rawAmount) : rawAmount;
                      const factor = effectiveGrams / 100;
                      const isServingBased = !!(food?.servingUnit && food?.servingGrams);
                      const displayQty = isServingBased
                        ? `${rawAmount} ${food.servingUnit}${rawAmount !== 1 ? "s" : ""} (${effectiveGrams}g)`
                        : rawAmount > 0 ? `${rawAmount}g` : "";
                      const itemCal = food && rawAmount ? Math.round(food.calories * factor) : null;
                      const itemP = food && rawAmount ? Math.round(food.protein * factor * 10) / 10 : null;
                      const itemC = food && rawAmount ? Math.round(food.carbs * factor * 10) / 10 : null;
                      const itemF = food && rawAmount ? Math.round(food.fat * factor * 10) / 10 : null;
                      return (
                        <div key={j} className="py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-foreground">{item.food || <span className="text-muted-foreground italic">Unknown food</span>}</p>
                            <p className="text-xs text-muted-foreground">{displayQty}</p>
                          </div>
                          {itemCal !== null && (
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-xs font-medium text-foreground">{itemCal} kcal</span>
                              <span className="text-xs text-muted-foreground">P {itemP}g</span>
                              <span className="text-xs text-muted-foreground">C {itemC}g</span>
                              <span className="text-xs text-muted-foreground">F {itemF}g</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {hasMacros && (
                      <div className="mt-3 pt-2 border-t border-border/40">
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground self-center">Total:</span>
                          <span className="text-xs font-semibold text-primary">{mm.calories} kcal</span>
                          <span className="text-xs text-muted-foreground">P {mm.protein}g</span>
                          <span className="text-xs text-muted-foreground">C {mm.carbs}g</span>
                          <span className="text-xs text-muted-foreground">Fiber {mm.fiber}g</span>
                          <span className="text-xs text-muted-foreground">F {mm.fat}g</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-8">
              <p className="text-muted-foreground text-sm">No meal plan set for {dayType} days yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan here.</p>
            </Card>
          )}

          {plan.notes && (
            <Card>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
              <p className="text-sm text-foreground">{plan.notes}</p>
            </Card>
          )}
        </div>
      )}

      {!plan && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No meal plan set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan here.</p>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Shopping List ───────────────────────────────────────────────────────
function ShoppingListTab() {
  const [trainingDays, setTrainingDays] = useState(4);
  const [restDays, setRestDays] = useState(3);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const { data: trainingPlan } = trpc.mealPlan.get.useQuery({ dayType: "training" });
  const { data: restPlan } = trpc.mealPlan.get.useQuery({ dayType: "rest" });
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();

  // Helper: convert serving amount to grams
  function itemToGrams(food: any, amount: number): number {
    if (!food) return amount;
    return food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  }

  // Aggregate all food quantities across both plan types × day counts
  const shoppingMap = useMemo(() => {
    const map: Record<string, { totalGrams: number; food: any }> = {};

    const addItems = (plan: any, multiplier: number) => {
      if (!plan || multiplier === 0) return;
      const meals = (plan.meals as any[]) ?? [];
      meals.forEach(meal => {
        (meal.items ?? []).forEach((item: any) => {
          if (!item.food || !parseFloat(item.grams)) return;
          const food = foodDb.find((f: any) => f.name === item.food);
          const grams = itemToGrams(food, parseFloat(item.grams)) * multiplier;
          if (!map[item.food]) map[item.food] = { totalGrams: 0, food };
          map[item.food].totalGrams += grams;
        });
      });
    };

    addItems(trainingPlan, trainingDays);
    addItems(restPlan, restDays);
    return map;
  }, [trainingPlan, restPlan, foodDb, trainingDays, restDays]);

  const items = Object.entries(shoppingMap).sort(([a], [b]) => a.localeCompare(b));
  const checkedCount = items.filter(([name]) => checked[name]).length;

  // Format display quantity: prefer serving units when available
  function formatQty(name: string, totalGrams: number, food: any): string {
    if (food?.servingUnit && food?.servingGrams) {
      const servings = totalGrams / food.servingGrams;
      const rounded = Math.ceil(servings * 2) / 2; // round up to nearest 0.5
      return `${rounded} ${food.servingUnit}${rounded !== 1 ? "s" : ""}`;
    }
    // Round up to nearest 10g for cleaner shopping quantities
    const rounded = Math.ceil(totalGrams / 10) * 10;
    return `${rounded}g`;
  }

  return (
    <div className="space-y-6">
      {/* Day count inputs */}
      <Card>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Shopping For</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Training Days</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setTrainingDays(d => Math.max(0, d - 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">−</button>
              <span className="text-lg font-bold text-foreground w-6 text-center">{trainingDays}</span>
              <button onClick={() => setTrainingDays(d => Math.min(14, d + 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">+</button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Rest Days</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setRestDays(d => Math.max(0, d - 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">−</button>
              <span className="text-lg font-bold text-foreground w-6 text-center">{restDays}</span>
              <button onClick={() => setRestDays(d => Math.min(14, d + 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">+</button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{trainingDays + restDays} day total · quantities calculated from your meal plan</p>
      </Card>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{checkedCount}/{items.length} items checked</p>
          <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : "0%" }} />
          </div>
        </div>
      )}

      {items.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No meal plan set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan and quantities will appear here.</p>
        </Card>
      )}

      {items.length > 0 && (
        <Card className="space-y-1">
          {items.map(([name, entry]) => {
            const { totalGrams, food } = entry as { totalGrams: number; food: any };
            const qty = formatQty(name, totalGrams, food);
            const isChecked = !!checked[name];
            return (
              <button
                key={name}
                onClick={() => setChecked(prev => ({ ...prev, [name]: !prev[name] }))}
                className="flex items-center gap-3 py-2.5 w-full text-left group"
              >
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                }`}>
                  {isChecked && <Check size={12} className="text-primary-foreground" />}
                </div>
                <span className={`text-sm flex-1 ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {name}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{qty}</span>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Training Program ────────────────────────────────────────────────────
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  // Handle: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\.\w-]+)/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
}

function TrainingTab() {
  const { data: program } = trpc.training.get.useQuery();
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);

  const days = (program?.days as any[]) ?? [];
  const schedule = Array.isArray(program?.schedule) ? (program!.schedule as string[]) : [];

  // Build a lookup map: exercise name → videoUrl
  const videoMap = Object.fromEntries(
    exerciseLib
      .filter((e: any) => e.videoUrl)
      .map((e: any) => [e.name, e.videoUrl as string])
  );

  return (
    <div className="space-y-4">
      {program?.programName && (
        <p className="text-sm font-semibold text-foreground">{program.programName}</p>
      )}

      {schedule.length > 0 && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Training Schedule</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {schedule.map((slot: string, i: number) => (
              <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                slot === "Off"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}>{slot}</span>
            ))}
            <span className="text-[10px] text-muted-foreground/50 ml-1">→ repeat</span>
          </div>
        </Card>
      )}

      {days.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No training program set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your program here.</p>
        </Card>
      )}

      {days.map((day: any, i: number) => (
        <Card key={i} className="overflow-hidden">
          <button
            onClick={() => setExpandedDay(expandedDay === i ? null : i)}
            className="w-full flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{day.name ?? `Day ${i + 1}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(day.exercises ?? []).length} exercises</span>
              {expandedDay === i ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </button>

          {expandedDay === i && (
              <div className="mt-4 space-y-2">
              <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                <p className="col-span-6 text-[10px] text-muted-foreground uppercase tracking-wider">Exercise</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Sets</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Reps</p>
              </div>
              {(day.exercises ?? []).map((ex: any, j: number) => {
                const videoUrl = videoMap[ex.name];
                const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
                return (
                  <div key={j} className="border-t border-border">
                    <div className="grid grid-cols-12 gap-2 items-center py-2">
                      <div className="col-span-6 flex items-center gap-2">
                        <p className="text-sm text-foreground flex-1 min-w-0">{ex.name}</p>
                        {embedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: ex.name, embedUrl })}
                            className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Watch demo"
                          >
                            <Play size={10} />
                            <span className="text-[9px] font-semibold">Demo</span>
                          </button>
                        )}
                      </div>
                      <p className="col-span-3 text-sm text-foreground text-center">{ex.sets}</p>
                      <p className="col-span-3 text-sm text-foreground text-center">{ex.reps}</p>
                    </div>
                    {ex.notes && (
                      <p className="text-xs text-muted-foreground pb-2 leading-relaxed">{ex.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}

      {program?.notes && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
          <p className="text-sm text-foreground">{program.notes}</p>
        </Card>
      )}

      {/* Video Modal */}
      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-card rounded-xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={videoModal.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoModal.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Tab: Workout Log ────────────────────────────────────────────────────────
function WorkoutLogTab() {
  const { data: program } = trpc.training.get.useQuery();
  const { data: sessions = [], refetch } = trpc.workoutSessions.list.useQuery();
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const utils = trpc.useUtils();

  // Build video URL lookup map from exercise library
  const videoMap: Record<string, string> = Object.fromEntries(
    (exerciseLib as any[]).filter((e: any) => e.videoUrl).map((e: any) => [e.name, e.videoUrl as string])
  );
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Build list of program days — DB uses 'name' field (e.g. "A", "B"), map to label for consistency
  const days: Array<{ label: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }> }> =
    ((program?.days as any[]) ?? []).map((d: any) => ({ ...d, label: d.label ?? d.name }));

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(today);
  // exerciseData: { [exerciseName]: Array<{weight: string, reps: string, notes: string}> }
  const [exerciseData, setExerciseData] = useState<Record<string, Array<{ weight: string; reps: string; notes: string }>>>({});
  const [sessionNotes, setSessionNotes] = useState("");

  // Persist in-progress workout to localStorage so tab switches don't lose data
  const workoutDraftKey = selectedDay ? `draft:workout:${sessionDate}:${selectedDay}` : null;
  useEffect(() => {
    if (!workoutDraftKey) return;
    try { localStorage.setItem(workoutDraftKey, JSON.stringify({ exerciseData, sessionNotes })); } catch {}
  }, [workoutDraftKey, exerciseData, sessionNotes]);
  function clearWorkoutDraft() {
    if (workoutDraftKey) { try { localStorage.removeItem(workoutDraftKey); } catch {} }
  }
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const dailyLogMutation = trpc.dailyLog.upsert.useMutation();

  const saveMutation = trpc.workoutSessions.save.useMutation({
    onSuccess: () => {
      utils.workoutSessions.list.invalidate();
      utils.dailyLog.list.invalidate();
      setSaving(false);
      toast.success("Session saved!");
      // Auto-link to Daily Log: tick training completed + set session type
      if (selectedDay) {
        dailyLogMutation.mutate({
          logDate: sessionDate,
          trainingCompleted: true,
          trainingType: selectedDay,
        });
      }
    },
    onError: () => { setSaving(false); toast.error("Failed to save session."); },
  });
  const deleteMutation = trpc.workoutSessions.delete.useMutation({
    onSuccess: () => { utils.workoutSessions.list.invalidate(); setDeleting(null); toast.success("Session deleted."); },
    onError: () => { setDeleting(null); toast.error("Failed to delete."); },
  });

  // When user picks a day, load existing session, or restore draft, or init blank
  function selectDay(label: string) {
    setSelectedDay(label);
    const dayDef = days.find(d => d.label === label);
    const existing = sessions.find(s => toLocalDateStr(s.sessionDate) === sessionDate && s.dayLabel === label);
    if (existing) {
      const exData: Record<string, Array<{ weight: string; reps: string; notes: string }>> = {};
      for (const ex of (existing.exercises as any[])) {
        exData[ex.name] = (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
          notes: s.notes ?? "",
        }));
      }
      setExerciseData(exData);
      setSessionNotes((existing.notes as string) ?? "");
    } else {
      // Try to restore an in-progress draft first
      const draftKey = `draft:workout:${sessionDate}:${label}`;
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          setExerciseData(parsed.exerciseData ?? {});
          setSessionNotes(parsed.sessionNotes ?? "");
          return;
        }
      } catch {}
      // No draft — init blank sets from program definition
      const blank: Record<string, Array<{ weight: string; reps: string; notes: string }>> = {};
      for (const ex of (dayDef?.exercises ?? [])) {
        blank[ex.name] = [{ weight: "", reps: "", notes: "" }];
      }
      setExerciseData(blank);
      setSessionNotes("");
    }
  }

  // Re-load when date changes
  useEffect(() => {
    if (selectedDay) selectDay(selectedDay);
  }, [sessionDate, sessions.length]);

  function setSet(exName: string, idx: number, field: "weight" | "reps" | "notes", val: string) {
    setExerciseData(prev => {
      const sets = [...(prev[exName] ?? [{ weight: "", reps: "", notes: "" }])];
      sets[idx] = { ...sets[idx], [field]: val };
      return { ...prev, [exName]: sets };
    });
  }

  function addSet(exName: string) {
    setExerciseData(prev => ({
      ...prev,
      [exName]: [...(prev[exName] ?? []), { weight: "", reps: "", notes: "" }],
    }));
  }

  function removeSet(exName: string, idx: number) {
    setExerciseData(prev => {
      const sets = (prev[exName] ?? []).filter((_, i) => i !== idx);
      return { ...prev, [exName]: sets.length ? sets : [{ weight: "", reps: "", notes: "" }] };
    });
  }

  function handleSave() {
    if (!selectedDay) return;
    setSaving(true);
    const dayDef = days.find(d => d.label === selectedDay);
    const exercises = (dayDef?.exercises ?? []).map(ex => ({
      name: ex.name,
      sets: (exerciseData[ex.name] ?? []).map(s => ({
        weight: s.weight !== "" ? parseFloat(s.weight) : null,
        reps: s.reps !== "" ? parseInt(s.reps) : null,
        notes: s.notes || null,
      })),
    }));
    saveMutation.mutate({ sessionDate, dayLabel: selectedDay, exercises, notes: sessionNotes || null });
    clearWorkoutDraft();
  }

  const inputCls = "bg-secondary border border-border rounded-lg px-2 py-3 text-base text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary w-full";

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <Card>
        <SectionLabel>Date</SectionLabel>
        <DateInput value={sessionDate} onChange={v => { setSessionDate(v); setSelectedDay(null); }} />
      </Card>

      {/* Day selector */}
      {days.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">No training program assigned yet.</p></Card>
      ) : (
        <Card>
          <SectionLabel>Select Session</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {days.map(d => (
              <button
                key={d.label}
                onClick={() => selectDay(d.label)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === d.label
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Exercise logging */}
      {selectedDay && (() => {
        const dayDef = days.find(d => d.label === selectedDay);

        // Build last-session lookup: find the most recent session for this day BEFORE sessionDate
        const prevSession = [...sessions]
          .filter(s => s.dayLabel === selectedDay && toLocalDateStr(s.sessionDate) < sessionDate)
          .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)))[0];
        const prevExMap: Record<string, Array<{ weight: number | null; reps: number | null }>> = {};
        if (prevSession) {
          for (const ex of (prevSession.exercises as any[])) {
            prevExMap[ex.name] = (ex.sets ?? []).filter((s: any) => s.weight != null || s.reps != null);
          }
        }

        return (
          <div className="space-y-3">
            {(dayDef?.exercises ?? []).map((ex, i) => {
              const sets = exerciseData[ex.name] ?? [{ weight: "", reps: "", notes: "" }];
              const isExpanded = expandedSets[ex.name];
              const prevSets = prevExMap[ex.name] ?? [];
              const exVideoUrl = videoMap[ex.name];
              const exEmbedUrl = exVideoUrl ? getYouTubeEmbedUrl(exVideoUrl) : null;
              return (
                <Card key={i}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{ex.name}</p>
                        {exEmbedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: ex.name, embedUrl: exEmbedUrl })}
                            className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-1.5 py-0.5 rounded"
                          >
                            <Play size={10} fill="currentColor" /> Demo
                          </button>
                        )}
                      </div>
                      {ex.notes && <p className="text-xs text-muted-foreground mt-0.5">{ex.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{ex.sets} sets × {ex.reps}</p>
                      {prevSets.length > 0 && (
                        <p className="text-xs text-primary/80 mt-1">
                          Last: {prevSets[0].weight ?? '—'}kg × {prevSets[0].reps ?? '—'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Primary set — always visible, visually prominent */}
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1.5">Set 1</p>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Weight (kg)</p>
                        <input
                          type="number" inputMode="decimal"
                          value={sets[0]?.weight ?? ""}
                          onChange={e => setSet(ex.name, 0, "weight", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Reps</p>
                        <input
                          type="number" inputMode="numeric"
                          value={sets[0]?.reps ?? ""}
                          onChange={e => setSet(ex.name, 0, "reps", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional sets — collapsible */}
                  {sets.length > 1 && (
                    <div className="space-y-2 mb-2">
                      {sets.slice(1).map((s, idx) => (
                        <div key={idx + 1} className="border-t border-border pt-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Set {idx + 2}</p>
                            <button onClick={() => removeSet(ex.name, idx + 1)} className="text-muted-foreground hover:text-destructive transition-colors"><Minus size={14} /></button>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <input
                                type="number" inputMode="decimal"
                                value={s.weight ?? ""}
                                onChange={e => setSet(ex.name, idx + 1, "weight", e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="number" inputMode="numeric"
                                value={s.reps ?? ""}
                                onChange={e => setSet(ex.name, idx + 1, "reps", e.target.value)}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => addSet(ex.name)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus size={13} /> Add Set
                  </button>
                </Card>
              );
            })}

            {/* Session notes */}
            <Card>
              <SectionLabel>Session Notes</SectionLabel>
              <textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                
                rows={3}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </Card>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Session"}
            </button>
          </div>
        );
      })()}

      {/* Video modal */}
      {videoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setVideoModal(null)}>
          <div className="bg-card rounded-xl overflow-hidden w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="aspect-video">
              <iframe
                src={videoModal.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoModal.name}
              />
            </div>
          </div>
        </div>
      )}

      {/* Past sessions */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Past Sessions</SectionLabel>
          {sessions.slice(0, 20).map(s => (
            <Card key={s.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.dayLabel}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(s.sessionDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSessionDate(toLocalDateStr(s.sessionDate)); selectDay(s.dayLabel); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-sm font-medium text-primary hover:bg-secondary/70 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this session?")) { setDeleting(s.id); deleteMutation.mutate({ id: s.id }); } }}
                    disabled={deleting === s.id}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {/* Summary of sets */}
              <div className="mt-2 space-y-1">
                {(s.exercises as any[]).map((ex: any, i: number) => {
                  const validSets = (ex.sets ?? []).filter((st: any) => st.weight != null || st.reps != null);
                  if (!validSets.length) return null;
                  const firstSet = validSets[0];
                  const setCount = validSets.length;
                  return (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">{ex.name}</span>: 
                      {firstSet.weight != null ? `${firstSet.weight}kg` : '—'}
                      {' × '}
                      {firstSet.reps != null ? `${firstSet.reps}` : '—'}
                      <span className="text-muted-foreground/60 ml-1">({setCount} {setCount === 1 ? 'set' : 'sets'})</span>
                    </p>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Combined Training Tab ───────────────────────────────────────────────────
function CombinedTrainingTab({ defaultSub = "program" }: { defaultSub?: "program" | "log" }) {
  const [sub, setSub] = useState<"program" | "log">(defaultSub);
  return (
    <div>
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
        {(["program", "log"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "program" ? "Program" : "Workout Log"}
          </button>
        ))}
      </div>
      {sub === "program" ? <TrainingTab /> : <WorkoutLogTab />}
    </div>
  );
}

// ─── Check-ins Tab ─────────────────────────────────────────────────────────
function CheckInsTab() {
  const { data: profile } = trpc.profile.get.useQuery();
  const today = localToday();
  // Compute Monday of the current week
  const getMondayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const currentWeekStart = getMondayOfWeek(today);
  const { data: existingCheckIn, refetch } = trpc.checkIn.myWeek.useQuery({ weekStartDate: currentWeekStart });
  const { data: allCheckIns = [] } = trpc.checkIn.myList.useQuery();

  const blankForm = { dietAdherence: '' as '' | 'fully' | 'mostly' | 'partially' | 'poorly', dietAdherenceReason: '', wentWell: '', challenges: '', wins: '', overallFeeling: 3 };
  const [form, setForm] = useState(blankForm);
  const [submitted, setSubmitted] = useState(false);

  // Hydrate form from existing check-in
  useEffect(() => {
    if (existingCheckIn) {
      setForm({
        dietAdherence: (existingCheckIn.dietAdherence ?? '') as any,
        dietAdherenceReason: existingCheckIn.dietAdherenceReason ?? '',
        wentWell: existingCheckIn.wentWell ?? '',
        challenges: existingCheckIn.challenges ?? '',
        wins: existingCheckIn.wins ?? '',
        overallFeeling: existingCheckIn.overallFeeling ?? 3,
      });
      setSubmitted(true);
    } else {
      setForm(blankForm);
      setSubmitted(false);
    }
  }, [existingCheckIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = trpc.checkIn.submit.useMutation({
    onSuccess: () => { toast.success('Check-in submitted!'); refetch(); setSubmitted(true); },
    onError: () => toast.error('Failed to submit. Please try again.'),
  });

  const handleSubmit = () => {
    if (!form.dietAdherence) { toast.error('Please select your diet adherence level.'); return; }
    submitMutation.mutate({
      weekStartDate: currentWeekStart,
      dietAdherence: form.dietAdherence as any,
      dietAdherenceReason: form.dietAdherenceReason || undefined,
      wentWell: form.wentWell || undefined,
      challenges: form.challenges || undefined,
      wins: form.wins || undefined,
      overallFeeling: form.overallFeeling,
    });
  };

  const checkInDay = (profile as any)?.checkInDay;
  const dayLabel = checkInDay ? checkInDay.charAt(0).toUpperCase() + checkInDay.slice(1) : null;

  const fmtWeekStart = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const adherenceOptions = [
    { value: 'fully', label: '✅ Fully adherent', desc: 'Followed the plan completely' },
    { value: 'mostly', label: '🟡 Mostly adherent', desc: 'Minor deviations, stayed on track overall' },
    { value: 'partially', label: '🟠 Partially adherent', desc: 'Struggled to follow the plan' },
    { value: 'poorly', label: '🔴 Poor adherence', desc: 'Significantly off plan this week' },
  ];

  const feelingLabels = ['', 'Very Low', 'Low', 'Okay', 'Good', 'Great'];

  return (
    <div className="space-y-6">
      {/* Check-in Day Banner */}
      {dayLabel && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-sm font-bold">📅</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Check-in Day: {dayLabel}</p>
            <p className="text-xs text-muted-foreground">Your coach expects your check-in every {dayLabel}</p>
          </div>
        </div>
      )}

      {/* What to Submit */}
      <div>
        <SectionLabel>What to Submit Each Week</SectionLabel>
        <Card className="space-y-3">
          {[
            { icon: '🎥', title: 'Video or Voice Note', desc: 'A short review of your week — what went well, what was hard, your energy and mood.' },
            { icon: '📸', title: 'Progress Photos & Form Clips', desc: 'Front, side, and back photos. Include form clips for any exercises you want feedback on.' },
            { icon: '📋', title: 'Check-in Form', desc: 'Complete the form below every week. Your coach reviews all submissions and will reply with a video response.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Expectation Setting */}
      <Card className="bg-muted/40 border-border">
        <div className="flex gap-3 items-start">
          <span className="text-lg flex-shrink-0">💬</span>
          <div>
            <p className="text-sm font-semibold text-foreground">What happens after you submit?</p>
            <p className="text-xs text-muted-foreground mt-1">Your coach will review your submission, watch your videos, and reply with a personalised video check-in response. Expect a reply within 24–48 hours.</p>
          </div>
        </div>
      </Card>

      {/* Check-in Form */}
      <div>
        <SectionLabel>Weekly Check-in Form — Week of {fmtWeekStart(currentWeekStart)}</SectionLabel>
        {submitted && existingCheckIn?.coachReply && (
          <div className="mb-4 bg-primary/10 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Coach Reply</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{existingCheckIn.coachReply}</p>
          </div>
        )}
        <Card className="space-y-5">
          {/* Diet Adherence */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">How was your diet adherence this week?</p>
            <div className="space-y-2">
              {adherenceOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, dietAdherence: opt.value as any }))}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    form.dietAdherence === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Adherence reason — shown if not fully adherent */}
          {form.dietAdherence && form.dietAdherence !== 'fully' && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">If you struggled with adherence, why?</p>
              <textarea
                value={form.dietAdherenceReason}
                onChange={e => setForm(p => ({ ...p, dietAdherenceReason: e.target.value }))}
                rows={3}
                placeholder="Social events, stress, travel, cravings..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          )}

          {/* What went well */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">What went well this week?</p>
            <textarea
              value={form.wentWell}
              onChange={e => setForm(p => ({ ...p, wentWell: e.target.value }))}
              rows={3}
              placeholder="Training sessions, nutrition wins, habits..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Challenges */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">What were your challenges?</p>
            <textarea
              value={form.challenges}
              onChange={e => setForm(p => ({ ...p, challenges: e.target.value }))}
              rows={3}
              placeholder="What made this week hard?"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Wins */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">What were your wins?</p>
            <textarea
              value={form.wins}
              onChange={e => setForm(p => ({ ...p, wins: e.target.value }))}
              rows={2}
              placeholder="PRs, consistency, mindset shifts..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Overall feeling */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">Overall feeling this week: <span className="text-primary">{feelingLabels[form.overallFeeling]}</span></p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, overallFeeling: n }))}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${
                    form.overallFeeling === n
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >{n}</button>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">Very Low</span>
              <span className="text-[10px] text-muted-foreground">Great</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : submitted ? 'Update Check-in' : 'Submit Check-in'}
          </button>
        </Card>
      </div>

      {/* Past Check-ins */}
      {allCheckIns.length > 1 && (
        <div>
          <SectionLabel>Past Check-ins</SectionLabel>
          <div className="space-y-2">
            {allCheckIns.slice(1).map(ci => (
              <Card key={ci.id} className="opacity-80">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Week of {fmtWeekStart(toLocalDateStr(ci.weekStartDate))}</p>
                  {ci.coachReply && <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">Replied</span>}
                </div>
                {ci.dietAdherence && <p className="text-xs text-muted-foreground mt-1">Diet: {ci.dietAdherence}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ClientDashboard ─────────────────────────────────────────────────────
const TAB_MAP: Record<string, React.ReactNode> = {
  overview: <OverviewTab />,
  "daily-log": <DailyLogTab />,
  "check-ins": <CheckInsTab />,
  measurements: <MeasurementsTab />,
  "meal-plan": <MealPlanTab />,
  shopping: <ShoppingListTab />,
  training: <CombinedTrainingTab defaultSub="program" />,
  "workout-log": <CombinedTrainingTab defaultSub="log" />,
};

const TAB_TITLES: Record<string, string> = {
  overview: "Dashboard",
  "daily-log": "Daily Log",
  "check-ins": "Check-ins",
  measurements: "Measurements",
  "meal-plan": "Meal Plan",
  shopping: "Shopping List",
  training: "Training",
  "workout-log": "Training",
};

export default function ClientDashboard() {
  const params = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();
  const tab = params.tab ?? "overview";

  useEffect(() => {
    if (!params.tab) navigate("/dashboard/overview");
  }, [params.tab]);

  return (
    <DashboardShell mode="client">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Client Dashboard</p>
        <h1 className="text-xl font-bold text-foreground mt-0.5">{TAB_TITLES[tab] ?? "Dashboard"}</h1>
      </div>
      {TAB_MAP[tab] ?? <OverviewTab />}
    </DashboardShell>
  );
}
