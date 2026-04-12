import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useDraft } from "@/hooks/useDraft";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { Check, Plus, Trash2, ChevronDown, ChevronUp, Play, X, Minus, Pencil, CheckSquare, Square, Shuffle, Tag } from "lucide-react";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday, fmtDate } from "@/lib/dates";

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
  const [, navigate] = useLocation();

  const handleEditDay = (iso: string) => {
    sessionStorage.setItem('editLogDate', iso);
    // Dispatch a custom event so DailyLogTab can react even when already mounted on this route
    window.dispatchEvent(new CustomEvent('editLogDate', { detail: { date: iso } }));
    navigate('/dashboard/daily-log');
  };

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
              <div className="flex-1 flex items-center gap-2 px-3 flex-wrap">
                {hasData ? (
                  <>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>{sessionLabel}</span>
                    {hasOffPlanMeals(log.offPlanMeals) ? <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400">{(log.offPlanMeals ?? 0) > 1 ? `${log.offPlanMeals} Off Plan Meals` : 'Off Plan Meal'}</span> : null}
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
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3">
                  {log.weight != null && <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p><p className="text-sm font-semibold text-foreground">{log.weight} kg</p></div>}
                  <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Training</p><p className="text-sm font-semibold text-foreground">{sessionLabel}</p></div>
                  <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Meals</p><p className="text-sm font-semibold text-foreground">{(log.offPlanMeals ?? 0) > 0 ? `${log.offPlanMeals} off-plan` : 'On Plan'}</p></div>
                  {log.stepsCount != null && <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Steps</p><p className="text-sm font-semibold text-foreground">{log.stepsCount.toLocaleString()}</p></div>}
                  {log.sleepHours != null && <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep</p><p className="text-sm font-semibold text-foreground">{log.sleepHours} hrs</p></div>}
                  {log.sleepQuality != null && <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Quality</p><p className="text-sm font-semibold text-foreground">{log.sleepQuality}/5</p></div>}
                  {log.hungerLevel != null && <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hunger</p><p className="text-sm font-semibold text-foreground">{log.hungerLevel}/5</p></div>}
                  {log.caffeineServings != null && <div className="min-w-[80px]"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Caffeine</p><p className="text-sm font-semibold text-foreground">{log.caffeineServings} srv</p></div>}
                </div>
                {log.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-foreground italic">{log.notes}</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => handleEditDay(iso)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Pencil size={13} />
                    Edit this day
                  </button>
                </div>
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
function ScoreInput({ label, value, onChange, max = 10 }: { label: string; value: number | null | undefined; onChange: (v: number) => void; max?: number }) {
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

  // Training adherence — one full rotation window, clamped to startDate
  // The schedule is e.g. ["A","B","Off","C","D","Off"] — rotation length = schedule.length
  const schedule: string[] = Array.isArray((program as any)?.schedule) ? (program as any).schedule : [];
  const rotationLength = schedule.length > 0 ? schedule.length : 7;
  // Clamp window start to the later of (today - rotationLength + 1) and startDate
  const clientStartDate = profile?.startDate ? toLocalDateStr(profile.startDate) : null;
  const rotationWindowStart = localDateStr(rotationLength - 1);
  const effectiveWindowStart = clientStartDate && clientStartDate > rotationWindowStart
    ? clientStartDate
    : rotationWindowStart;
  // Count elapsed training days in the clamped window (days where training was prescribed)
  // Build list of calendar days from effectiveWindowStart to today
  const windowDays: string[] = [];
  const cursor = new Date(effectiveWindowStart + 'T00:00:00');
  const endDay = new Date(today + 'T00:00:00');
  while (cursor <= endDay) {
    windowDays.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  // Count prescribed (non-Off) days within the window using rotation cycle
  const prescribedDays = schedule.length > 0
    ? windowDays.filter((_, i) => schedule[i % rotationLength] !== 'Off').length
    : windowDays.length;
  const trainedInRotation = allLogs.filter(l => {
    const d = toLocalDateStr(l.logDate);
    return d >= effectiveWindowStart && d <= today && l.trainingCompleted;
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

  // Check-in day reminder
  const checkInDay = (profile as any)?.checkInDay as string | null | undefined;
  const todayDayName = new Date().toLocaleDateString('en-AU', { weekday: 'long' }).toLowerCase();
  const isCheckInDay = !!checkInDay && todayDayName === checkInDay;
  // Check if they've already submitted this week
  const getMondayStr = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const { data: thisWeekCheckIn } = trpc.checkIn.myWeek.useQuery(
    { weekStartDate: getMondayStr() },
    { enabled: isCheckInDay }
  );
  const alreadySubmittedThisWeek = !!thisWeekCheckIn;

  return (
    <div className="space-y-6">
      {isCheckInDay && !alreadySubmittedThisWeek && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div>
            <p className="text-sm font-semibold text-primary">Today is your check-in day</p>
            <p className="text-xs text-muted-foreground mt-0.5">Head to the Check-in tab to submit your weekly check-in.</p>
          </div>
        </div>
      )}
      <div>
        <SectionLabel>Weekly Summary (last 7 days)</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Avg Weight" value={avgWeight !== "—" ? `${avgWeight} kg` : "—"} sub={weightChangePct ? `${Number(weightChangePct) > 0 ? '+' : ''}${weightChangePct}% vs prev 7 days` : undefined} />
          <MetricCard label="Training Adherence" value={`${adherence}%`} sub={schedule.length > 0 ? `${trainedInRotation}/${prescribedDays} sessions completed` : `${trainedInRotation} sessions completed`} />
          <MetricCard label="Off-Plan Meals" value={offPlanTotal7.toString()} />
          {stepGoal && (
            <MetricCard
              label="Avg Daily Steps"
              value={avgSteps7 != null ? avgSteps7.toLocaleString() : "—"}
              sub={`Goal: ${stepGoal.toLocaleString()}`}
            />
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

      {/* Getting Started Guide */}
      <a
        href="/getting-started"
        className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3.5 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#052E1A", color: "#59BE50" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Getting Started Guide</p>
          </div>
        </div>
        <svg className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>

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
                <p className="text-sm font-medium text-foreground leading-snug">{h.name}</p>
                {h.streak > 1 && (
                  <p className="text-[10px] text-primary/80">{h.streak}-day streak</p>
                )}
              </div>
              {/* 7-day dots */}
              <div className="flex gap-1.5 shrink-0">
                {last7.map(d => {
                  const assignedDateStr = normDate(h.assignedAt);
                  const beforeAssignment = d < assignedDateStr;
                  const done = !beforeAssignment && completedSet.has(`${h.id}:${d}`);
                  const isToday = d === today;
                  if (beforeAssignment) {
                    return <div key={d} className="w-5 h-5" />;
                  }
                  return (
                    <div
                      key={d}
                      className={`w-5 h-5 rounded-full ${
                        done
                          ? 'bg-primary'
                          : isToday
                          ? 'border-2 border-primary/50'
                          : 'border-2 border-muted-foreground/25'
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
  const [date, setDate] = useState(() => {
    const editDate = sessionStorage.getItem('editLogDate');
    if (editDate) {
      sessionStorage.removeItem('editLogDate');
      return editDate;
    }
    return today;
  });
  const blankDailyForm = { weight: "", sleepHours: "", caffeineServings: "", trainingCompleted: false, trainingType: "", stepsCount: "", sleepQuality: null as number | null, hungerLevel: null as number | null, offPlanMeals: 0, notes: "" };
  const [form, setForm, clearDraft] = useDraft(`draft:dailyLog:${date}`, blankDailyForm);
  // Track whether we've loaded server data for this date yet (avoid overwriting draft with blank)
  const serverLoadedRef = useRef<string | null>(null);
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: logs, refetch } = trpc.dailyLog.list.useQuery({ limit: 90 });
  const { data: workoutSessions = [] } = trpc.workoutSessions.list.useQuery();
  const upsert = trpc.dailyLog.upsert.useMutation({
    onSuccess: () => { clearDraft(blankDailyForm); toast.success("Log saved"); refetch(); }
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

  // Listen for editLogDate custom event dispatched by RecentLogsPanel when already on this tab
  useEffect(() => {
    const handler = (e: Event) => {
      const iso = (e as CustomEvent<{ date: string }>).detail?.date;
      if (iso) {
        sessionStorage.removeItem('editLogDate');
        setDate(iso);
        // Scroll the main content area to the top so the date picker is visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('editLogDate', handler);
    return () => window.removeEventListener('editLogDate', handler);
  }, []);

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
        sleepQuality: existing.sleepQuality ?? null,
        hungerLevel: existing.hungerLevel ?? null,
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
      sleepQuality: form.sleepQuality ?? undefined,
      hungerLevel: form.hungerLevel ?? undefined,
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
          <div className="space-y-3">
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
  { key: "calf", label: "Calf" },
  { key: "thigh", label: "Thigh" },
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
    calf: { ...emptySkinfold },
    thigh: { ...emptySkinfold },
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
      calf: { r1: toStr(m.calf1), r2: toStr(m.calf2), r3: toStr(m.calf3), r4: toStr(m.calf4), r5: toStr(m.calf5) },
      thigh: { r1: toStr(m.thigh1), r2: toStr(m.thigh2), r3: toStr(m.thigh3), r4: toStr(m.thigh4), r5: toStr(m.thigh5) },
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
            calf1: parseR(form.calf.r1), calf2: parseR(form.calf.r2), calf3: parseR(form.calf.r3), calf4: parseR(form.calf.r4), calf5: parseR(form.calf.r5),
            thigh1: parseR(form.thigh.r1), thigh2: parseR(form.thigh.r2), thigh3: parseR(form.thigh.r3), thigh4: parseR(form.thigh.r4), thigh5: parseR(form.thigh.r5),
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
              const calfAvg = avgReadings([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]);
              const thighAvg = avgReadings([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]);
              const siteAvgs = [umbAvg, supAvg, calfAvg, thighAvg];
              const presentAvgs = siteAvgs.filter(v => v !== null);
              const total = presentAvgs.length > 0 ? parseFloat(presentAvgs.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
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
                        calf1: parseRNull(editForm.calf.r1), calf2: parseRNull(editForm.calf.r2), calf3: parseRNull(editForm.calf.r3), calf4: parseRNull(editForm.calf.r4), calf5: parseRNull(editForm.calf.r5),
                        thigh1: parseRNull(editForm.thigh.r1), thigh2: parseRNull(editForm.thigh.r2), thigh3: parseRNull(editForm.thigh.r3), thigh4: parseRNull(editForm.thigh.r4), thigh5: parseRNull(editForm.thigh.r5),
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
                              { label: "Calf", avg: calfAvg },
                              { label: "Thigh", avg: thighAvg },
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
                    {[...(meal.items ?? [])].sort((a: any, b: any) => {
                        const fa = foodDb.find((f: any) => f.name === a.food);
                        const fb = foodDb.find((f: any) => f.name === b.food);
                        const gaRaw = parseFloat(a.grams) || 0;
                        const gbRaw = parseFloat(b.grams) || 0;
                        const gaG = fa ? (fa.servingGrams ? gaRaw * fa.servingGrams : gaRaw) : gaRaw;
                        const gbG = fb ? (fb.servingGrams ? gbRaw * fb.servingGrams : gbRaw) : gbRaw;
                        const pA = fa ? (fa.protein * gaG / 100) : 0;
                        const pB = fb ? (fb.protein * gbG / 100) : 0;
                        if (pB !== pA) return pB - pA;
                        return gbG - gaG;
                      }).map((item: any, j: number) => {
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
const SHOPPING_CHECKED_KEY = "jh_shopping_checked";

function ShoppingListTab() {
  const [trainingDays, setTrainingDays] = useState(4);
  const [restDays, setRestDays] = useState(3);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SHOPPING_CHECKED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Persist checked state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(SHOPPING_CHECKED_KEY, JSON.stringify(checked));
    } catch {}
  }, [checked]);

  function toggleItem(name: string) {
    setChecked(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function uncheckAll() {
    setChecked({});
  }

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

      {/* Progress bar + Uncheck All */}
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{checkedCount}/{items.length} items</p>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : "0%" }} />
            </div>
          </div>
          {checkedCount > 0 && (
            <button
              onClick={uncheckAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap underline underline-offset-2"
            >
              Uncheck all
            </button>
          )}
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
                onClick={() => toggleItem(name)}
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

// ─── Combined Meal Plan Tab (Meal Plan + Shopping List) ─────────────────────
function CombinedMealPlanTab({ defaultSub = "plan" }: { defaultSub?: "plan" | "shopping" }) {
  const [sub, setSub] = useState<"plan" | "shopping">(defaultSub);
  return (
    <div>
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
        {(["plan", "shopping"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "plan" ? "Meal Plan" : "Shopping List"}
          </button>
        ))}
      </div>
      {sub === "plan" ? <MealPlanTab /> : <ShoppingListTab />}
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
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
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
          <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5">
            {schedule.map((slot: string, i: number) => (
              <span key={i} className={`flex-shrink-0 px-3 py-1 rounded-lg text-sm font-semibold ${
                slot === "Off"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}>{slot === "Off" ? "OFF" : slot}</span>
            ))}
            <span className="flex-shrink-0 text-xs text-muted-foreground/50 ml-1">→ repeat</span>
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
  // exerciseData: { [exerciseName]: { equipmentDetails: string; sets: Array<{weight, reps, notes, completed}> } }
  // For backward compat we keep a flat sets array keyed by exercise name, plus a separate equipmentDetails map
  const [exerciseData, setExerciseData] = useState<Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>>>({})
  const [equipmentDetails, setEquipmentDetails] = useState<Record<string, string>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [sessionNotes, setSessionNotes] = useState("");

  // Persist in-progress workout to localStorage so tab switches don't lose data
  const workoutDraftKey = selectedDay ? `draft:workout:${sessionDate}:${selectedDay}` : null;
  useEffect(() => {
    if (!workoutDraftKey) return;
    try { localStorage.setItem(workoutDraftKey, JSON.stringify({ v: 2, exerciseData, sessionNotes, equipmentDetails, exerciseNotes, substitutions })); } catch {}
  }, [workoutDraftKey, exerciseData, sessionNotes]);
  function clearWorkoutDraft() {
    if (workoutDraftKey) { try { localStorage.removeItem(workoutDraftKey); } catch {} }
  }
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [equipmentOpen, setEquipmentOpen] = useState<Record<string, boolean>>({});
  // Collapse state for exercise cards — persisted in sessionStorage keyed by date:dayLabel:exerciseName
  const [collapsedExercises, setCollapsedExercisesRaw] = useState<Record<string, boolean>>({});
  function getCollapseKey(date: string, dayLabel: string) {
    return `collapse:workout:${date}:${dayLabel}`;
  }
  function loadCollapsed(date: string, dayLabel: string): Record<string, boolean> {
    try {
      const stored = sessionStorage.getItem(getCollapseKey(date, dayLabel));
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  }
  function saveCollapsed(date: string, dayLabel: string, state: Record<string, boolean>) {
    try { sessionStorage.setItem(getCollapseKey(date, dayLabel), JSON.stringify(state)); } catch {}
  }
  function toggleExerciseCollapse(exName: string) {
    setCollapsedExercisesRaw(prev => {
      const next = { ...prev, [exName]: !prev[exName] };
      if (selectedDay) saveCollapsed(sessionDate, selectedDay, next);
      return next;
    });
  }
  // Auto-collapse an exercise card when every one of its sets is marked complete.
  // Uses a ref to track which exercises have already been auto-collapsed so the
  // effect doesn't re-collapse cards the user has manually re-expanded.
  const autoCollapsedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setCollapsedExercisesRaw(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [exName, sets] of Object.entries(exerciseData)) {
        const allDone = sets.length > 0 && sets.every(s => s.completed);
        if (allDone && !autoCollapsedRef.current.has(exName) && !prev[exName]) {
          next[exName] = true;
          autoCollapsedRef.current.add(exName);
          changed = true;
        }
        // Reset the auto-collapse tracker if the exercise is no longer all-done
        // so it can auto-collapse again if the user completes it a second time.
        if (!allDone) {
          autoCollapsedRef.current.delete(exName);
        }
      }
      if (changed && selectedDay) saveCollapsed(sessionDate, selectedDay, next);
      return changed ? next : prev;
    });
  }, [exerciseData, sessionDate, selectedDay]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Substitution state: { [originalExName]: substituteName }
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  // Sub picker modal state
  const [subPicker, setSubPicker] = useState<{ originalName: string } | null>(null);
  const [subSearch, setSubSearch] = useState("");

  // Similarity scoring: dot-product of muscle activation vectors
  const MUSCLE_KEYS = ["chest","frontDelts","sideDelts","triceps","lats","upperBack","rearDelts","biceps","quads","hams","glutes","calves","abs"] as const;
  function muscleScore(a: any, b: any): number {
    return MUSCLE_KEYS.reduce((sum, k) => sum + (a[k] ?? 0) * (b[k] ?? 0), 0);
  }
  function getSimilarExercises(originalName: string): any[] {
    const original = (exerciseLib as any[]).find(e => e.name === originalName);
    if (!original) return (exerciseLib as any[]).filter(e => e.name !== originalName);
    return (exerciseLib as any[])
      .filter(e => e.name !== originalName)
      .map(e => ({ ...e, _score: muscleScore(original, e) }))
      .sort((a, b) => b._score - a._score);
  }

  // When a sub is applied, migrate exerciseData key from old name to new name
  function applySubstitution(originalName: string, newName: string) {
    setSubstitutions(prev => ({ ...prev, [originalName]: newName }));
    setExerciseData(prev => {
      const existing = prev[originalName] ?? [{ weight: "", reps: "", notes: "" }];
      const next = { ...prev };
      delete next[originalName];
      next[newName] = existing;
      return next;
    });
    setSubPicker(null);
    setSubSearch("");
  }

  // Resolve effective exercise name (substituted or original)
  function effectiveName(originalName: string): string {
    return substitutions[originalName] ?? originalName;
  }

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
      const exData: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
      const eqData: Record<string, string> = {};
      const enData: Record<string, string> = {};
      const subData: Record<string, string> = {};
      for (const ex of (existing.exercises as any[])) {
        // If this exercise was a substitution, record it and key data by the substituted name
        if (ex.substitutedFor) {
          subData[ex.substitutedFor] = ex.name;
        }
        exData[ex.name] = (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
          notes: s.notes ?? "",
          completed: s.completed ?? (s.weight != null || s.reps != null),
        }));
        if (ex.equipmentDetails) eqData[ex.name] = ex.equipmentDetails;
        if (ex.exerciseNotes) enData[ex.name] = ex.exerciseNotes;
      }
      setExerciseData(exData);
      setEquipmentDetails(eqData);
      setExerciseNotes(enData);
      setSubstitutions(subData);
      setSessionNotes((existing.notes as string) ?? "");
      // Restore persisted collapse state; default all to collapsed for saved sessions
      const persisted = loadCollapsed(sessionDate, label);
      const defaultCollapsed: Record<string, boolean> = {};
      for (const ex of (existing.exercises as any[])) {
        defaultCollapsed[ex.name] = persisted[ex.name] !== undefined ? persisted[ex.name] : true;
      }
      setCollapsedExercisesRaw(defaultCollapsed);
      saveCollapsed(sessionDate, label, defaultCollapsed);
    } else {
      // Try to restore an in-progress draft first
      const draftKey = `draft:workout:${sessionDate}:${label}`;
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Discard stale drafts saved before the sets-count fix (v2+)
          if ((parsed.v ?? 1) < 2) {
            localStorage.removeItem(draftKey);
          } else {
            // Migrate old drafts that may lack the completed field
            const migratedData: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
            for (const [k, sets] of Object.entries(parsed.exerciseData ?? {})) {
              migratedData[k] = (sets as any[]).map(s => ({ ...s, completed: s.completed ?? (s.weight !== "" || s.reps !== "") }));
            }
            setExerciseData(migratedData);
            setSessionNotes(parsed.sessionNotes ?? "");
            setEquipmentDetails(parsed.equipmentDetails ?? {});
            setExerciseNotes(parsed.exerciseNotes ?? {});
            setSubstitutions(parsed.substitutions ?? {});
            return;
          }
        }
      } catch {}
      // No draft — init blank sets from program definition (pre-populate all sets)
      const blank: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
      for (const ex of (dayDef?.exercises ?? [])) {
        const setCount = Math.max(1, parseInt(String(ex.sets ?? 1), 10) || 1);
        blank[ex.name] = Array.from({ length: setCount }, () => ({ weight: "", reps: "", notes: "", completed: false }));
      }
      setExerciseData(blank);
      setSessionNotes("");
      setEquipmentDetails({});
      setExerciseNotes({});
      setSubstitutions({});
      // New session — restore persisted collapse state or default all expanded
      const persistedNew = loadCollapsed(sessionDate, label);
      setCollapsedExercisesRaw(persistedNew);
    }
  }

  // Re-load when date changes
  useEffect(() => {
    if (selectedDay) selectDay(selectedDay);
  }, [sessionDate, sessions.length]);

  function setSet(exName: string, idx: number, field: "weight" | "reps" | "notes", val: string) {
    setExerciseData(prev => {
      const sets = [...(prev[exName] ?? [{ weight: "", reps: "", notes: "", completed: false }])];
      const updated = { ...sets[idx], [field]: val };
      // Auto-mark as done when weight or reps are entered
      if ((field === "weight" || field === "reps") && val !== "") {
        updated.completed = true;
      }
      sets[idx] = updated;
      return { ...prev, [exName]: sets };
    });
  }

  function addSet(exName: string) {
    setExerciseData(prev => ({
      ...prev,
      [exName]: [...(prev[exName] ?? []), { weight: "", reps: "", notes: "", completed: false }],
    }));
  }

  function toggleSetCompleted(exName: string, idx: number) {
    setExerciseData(prev => {
      const sets = [...(prev[exName] ?? [])];
      sets[idx] = { ...sets[idx], completed: !sets[idx].completed };
      return { ...prev, [exName]: sets };
    });
  }

  function removeSet(exName: string, idx: number) {
    setExerciseData(prev => {
      const sets = (prev[exName] ?? []).filter((_, i) => i !== idx);
      return { ...prev, [exName]: sets.length ? sets : [{ weight: "", reps: "", notes: "", completed: false }] };
    });
  }

  function handleSave() {
    if (!selectedDay) return;
    setSaving(true);
    const dayDef = days.find(d => d.label === selectedDay);
    const exercises = (dayDef?.exercises ?? []).map(ex => {
      const subName = substitutions[ex.name];
      const nameToUse = subName ?? ex.name;
      return {
        name: nameToUse,
        substitutedFor: subName ? ex.name : undefined,
        equipmentDetails: equipmentDetails[nameToUse] || null,
        exerciseNotes: exerciseNotes[nameToUse] || null,
        sets: (exerciseData[nameToUse] ?? []).map(s => ({
          weight: s.weight !== "" ? parseFloat(s.weight) : null,
          reps: s.reps !== "" ? parseInt(s.reps) : null,
          notes: s.notes || null,
          completed: s.completed || s.weight !== "" || s.reps !== "",
        })),
      };
    });
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
        const prevEquipmentMap: Record<string, string> = {};
        if (prevSession) {
          for (const ex of (prevSession.exercises as any[])) {
            prevExMap[ex.name] = (ex.sets ?? []).filter((s: any) => s.weight != null || s.reps != null);
            if (ex.equipmentDetails) prevEquipmentMap[ex.name] = ex.equipmentDetails;
          }
        }

        return (
          <div className="space-y-3">
            {(dayDef?.exercises ?? []).map((ex, i) => {
              const subName = substitutions[ex.name];
              const displayName = subName ?? ex.name;
              const sets = exerciseData[displayName] ?? [{ weight: "", reps: "", notes: "" }];
              const isExpanded = expandedSets[displayName];
              const isCollapsed = collapsedExercises[displayName] ?? false;
              const prevSets = prevExMap[displayName] ?? prevExMap[ex.name] ?? [];
              const exVideoUrl = videoMap[displayName] ?? videoMap[ex.name];
              const exEmbedUrl = exVideoUrl ? getYouTubeEmbedUrl(exVideoUrl) : null;
              const hasEquipment = !!(equipmentDetails[displayName]?.trim());
              const isEquipmentOpen = equipmentOpen[displayName] || hasEquipment;
              return (
                <Card key={i}>
                  {/* Card header — tap to collapse/expand */}
                  <div
                    onClick={() => toggleExerciseCollapse(displayName)}
                    className="w-full flex items-center justify-between gap-2 mb-3 text-left cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-foreground">{displayName}</p>
                        {subName && (
                          <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">SUB</span>
                        )}
                        {exEmbedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: displayName, embedUrl: exEmbedUrl })}
                            className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-1.5 py-0.5 rounded"
                          >
                            <Play size={10} fill="currentColor" /> Demo
                          </button>
                        )}
                      </div>
                      {subName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Substituting: {ex.name}</p>
                      )}
                      {ex.notes && !subName && <p className="text-xs text-muted-foreground mt-0.5">{ex.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{ex.sets} sets × {ex.reps}</p>
                      {prevSets.length > 0 && (
                        <p className="text-xs text-primary/80 mt-1">
                          Last: {prevSets[0].weight ?? '—'}kg × {prevSets[0].reps ?? '—'}
                          {(prevEquipmentMap[displayName] ?? prevEquipmentMap[ex.name]) && (
                            <span className="text-muted-foreground/60 ml-1">· {prevEquipmentMap[displayName] ?? prevEquipmentMap[ex.name]}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Equipment details toggle */}
                      <button
                        onClick={e => { e.stopPropagation(); setEquipmentOpen(prev => ({ ...prev, [displayName]: !prev[displayName] })); }}
                        title="Equipment details"
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                          hasEquipment
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Tag size={13} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setSubPicker({ originalName: ex.name }); setSubSearch(""); }}
                        className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors bg-secondary px-2 py-1.5 rounded-lg"
                      >
                        <Shuffle size={11} /> Sub
                      </button>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                    </div>
                  </div>
                  {/* COMPLETE label — shown on collapsed cards where all sets are done */}
                  {isCollapsed && sets.length > 0 && sets.every(s => s.completed) && (
                    <p className="text-xs font-semibold tracking-widest text-green-500 text-center pt-0 pb-1">COMPLETE</p>
                  )}
                  {/* Collapsible body */}
                  {!isCollapsed && (<>
                  {/* Equipment details inline input */}
                  {isEquipmentOpen && (
                    <div className="mb-3 -mt-1">
                      <input
                        type="text"
                        value={equipmentDetails[displayName] ?? ""}
                        onChange={e => setEquipmentDetails(prev => ({ ...prev, [displayName]: e.target.value }))}
                        placeholder=""
                        autoFocus={!hasEquipment}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Equipment details</p>
                    </div>
                  )}

                  {/* All sets — unified layout with checkbox */}
                  {sets.length > 0 && (
                    <div className="mb-2">
                      {/* Column headers */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 flex-shrink-0" />
                        <p className="text-[10px] text-muted-foreground flex-1 text-center">Weight (kg)</p>
                        <p className="text-[10px] text-muted-foreground flex-1 text-center">Reps</p>
                        <div className="w-5 flex-shrink-0" />
                      </div>
                      <div className="space-y-1.5">
                        {sets.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleSetCompleted(displayName, idx)}
                              className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded border-2 transition-colors ${
                                s.completed
                                  ? "border-green-500 bg-green-500/20 text-green-400"
                                  : "border-border text-transparent hover:border-primary"
                              }`}
                            >
                              <Check size={12} />
                            </button>
                            <div className="flex-1">
                              <input
                                type="number" inputMode="decimal"
                                placeholder={idx === 0 ? "" : ""}
                                value={s.weight ?? ""}
                                onChange={e => setSet(displayName, idx, "weight", e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="number" inputMode="numeric"
                                value={s.reps ?? ""}
                                onChange={e => setSet(displayName, idx, "reps", e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            {/* Remove button — only show if more than 1 set */}
                            {sets.length > 1 ? (
                              <button onClick={() => removeSet(displayName, idx)} className="w-5 flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                                <Minus size={14} />
                              </button>
                            ) : (
                              <div className="w-5 flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => addSet(displayName)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus size={13} /> Add Set
                  </button>

                  {/* Exercise notes */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Exercise notes</p>
                    <input
                      type="text"
                      value={exerciseNotes[displayName] ?? ""}
                      onChange={e => setExerciseNotes(prev => ({ ...prev, [displayName]: e.target.value }))}
                      placeholder=""
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  </>)}
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

      {/* Substitution picker modal */}
      {subPicker && (() => {
        const similar = getSimilarExercises(subPicker.originalName);
        const filtered = subSearch.trim()
          ? similar.filter(e => e.name.toLowerCase().includes(subSearch.toLowerCase()))
          : similar;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setSubPicker(null)}>
            <div className="bg-card rounded-t-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Substitute Exercise</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Replacing: {subPicker.originalName}</p>
                </div>
                <button onClick={() => setSubPicker(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <div className="px-4 pb-2">
                <input
                  type="text"
                  value={subSearch}
                  onChange={e => setSubSearch(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1">
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No exercises found</p>
                )}
                {filtered.map((e: any) => {
                  const primaryMuscle = ([
                    ["chest","Chest"],["frontDelts","Front Delts"],["sideDelts","Side Delts"],["triceps","Triceps"],
                    ["lats","Lats"],["upperBack","Upper Back"],["rearDelts","Rear Delts"],["biceps","Biceps"],
                    ["quads","Quads"],["hams","Hamstrings"],["glutes","Glutes"],["calves","Calves"],["abs","Abs"]
                  ] as [string, string][]).reduce<[number, string]>((best, [k, label]) =>
                    (e[k] ?? 0) > best[0] ? [(e[k] ?? 0) as number, label] : best, [0, ""]
                  )[1];
                  const isCurrentSub = substitutions[subPicker.originalName] === e.name;
                  return (
                    <button
                      key={e.id}
                      onClick={() => applySubstitution(subPicker.originalName, e.name)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors ${
                        isCurrentSub ? "bg-primary/15 border border-primary/30" : "bg-secondary hover:bg-secondary/70"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{e.name}</p>
                        {primaryMuscle && <p className="text-xs text-muted-foreground mt-0.5">{primaryMuscle}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {e._score >= 1 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                            Recommended
                          </span>
                        )}
                        {isCurrentSub && <Check size={14} className="text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {substitutions[subPicker.originalName] && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <button
                    onClick={() => {
                      const origName = subPicker.originalName;
                      const subName = substitutions[origName];
                      if (subName) {
                        setSubstitutions(prev => { const n = { ...prev }; delete n[origName]; return n; });
                        setExerciseData(prev => {
                          const existing = prev[subName] ?? [{ weight: "", reps: "", notes: "", completed: false }];
                          const next = { ...prev };
                          delete next[subName];
                          next[origName] = existing;
                          return next;
                        });
                      }
                      setSubPicker(null);
                    }}
                    className="w-full py-2.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remove substitution (use original)
                  </button>
                </div>
              )}
            </div>
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
                  // Count sets that are marked completed OR have weight/reps data
                  const completedSets = (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null);
                  if (!completedSets.length) return null;
                  // Show top set = first set with actual data, fallback to first completed
                  const firstSet = completedSets.find((st: any) => st.weight != null || st.reps != null) ?? completedSets[0];
                  const setCount = completedSets.length;
                  return (
                    <div key={i}>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">{ex.name}</span>
                        {ex.substitutedFor && (
                          <span className="ml-1.5 text-[9px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded align-middle">SUB</span>
                        )}
                        {': '}
                        {firstSet.weight != null ? `${firstSet.weight}kg` : '—'}
                        {' × '}
                        {firstSet.reps != null ? `${firstSet.reps}` : '—'}
                        <span className="text-muted-foreground/60 ml-1">({setCount} {setCount === 1 ? 'set' : 'sets'})</span>
                      </p>
                      {ex.substitutedFor && (
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5 pl-0.5">↳ for {ex.substitutedFor}</p>
                      )}
                    </div>
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
            {s === "program" ? "Program" : "Log"}
          </button>
        ))}
      </div>
      {sub === "program" ? <TrainingTab /> : <WorkoutLogTab />}
    </div>
  );
}

// ─── Check-ins Tab ─────────────────────────────────────────────────────────
type CheckInFormState = {
  sleepBedtimeConsistency: string;
  dietWeighedFoods: string;
  dietMealPrepAccuracy: string;
  dietExtrasFrequency: string;
};

function ChoiceQuestion({ label, subtext, field, options, form, setForm, hasError, scrollRef }: {
  label: string;
  subtext?: string;
  field: keyof CheckInFormState;
  options: { value: string; label: string }[];
  form: CheckInFormState;
  setForm: React.Dispatch<React.SetStateAction<CheckInFormState>>;
  hasError?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={scrollRef}>
      <p className={`text-sm mb-1 ${hasError && !form[field] ? 'text-destructive font-semibold' : 'text-foreground'}`}>{label}</p>
      {subtext && <p className="text-sm text-muted-foreground mb-2.5 leading-relaxed">{subtext}</p>}
      {!subtext && <div className="mb-2.5" />}
      {hasError && !form[field] && (
        <p className="text-xs text-destructive mb-2">Please answer this question</p>
      )}
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setForm(p => ({ ...p, [field]: opt.value }))}
            className={`w-full py-3 px-3 rounded-lg border text-sm font-medium transition-all text-left ${
              form[field] === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : hasError && !form[field]
                  ? 'border-destructive/60 text-muted-foreground hover:border-destructive'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckInsTab() {
  const [, navigate] = useLocation();
  const { data: profile } = trpc.profile.get.useQuery();
  const today = localToday();

  const getMondayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const currentWeekStart = getMondayOfWeek(today);
  const { data: existingCheckIn, refetch } = trpc.checkIn.myWeek.useQuery({ weekStartDate: currentWeekStart });
  const { data: allCheckIns = [] } = trpc.checkIn.myList.useQuery();

  const blankForm: CheckInFormState = {
    dietWeighedFoods: '',
    dietMealPrepAccuracy: '',
    dietExtrasFrequency: '',
    sleepBedtimeConsistency: '',
  };
  const [form, setForm] = useState(blankForm);
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Refs for auto-scrolling to first unanswered question
  const q1Ref = useRef<HTMLDivElement>(null);
  const q2Ref = useRef<HTMLDivElement>(null);
  const q3Ref = useRef<HTMLDivElement>(null);
  const q4Ref = useRef<HTMLDivElement>(null);
  const questionRefs: [keyof CheckInFormState, React.RefObject<HTMLDivElement | null>][] = [
    ['dietWeighedFoods', q1Ref],
    ['dietMealPrepAccuracy', q2Ref],
    ['dietExtrasFrequency', q3Ref],
    ['sleepBedtimeConsistency', q4Ref],
  ];

  useEffect(() => {
    if (existingCheckIn) {
      setForm({
        dietWeighedFoods: existingCheckIn.dietWeighedFoods ?? '',
        dietMealPrepAccuracy: existingCheckIn.dietMealPrepAccuracy ?? '',
        dietExtrasFrequency: existingCheckIn.dietExtrasFrequency ?? '',
        sleepBedtimeConsistency: existingCheckIn.sleepBedtimeConsistency ?? '',
      });
      setSubmitted(true);
    } else {
      setForm(blankForm);
      setSubmitted(false);
    }
  }, [existingCheckIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = trpc.checkIn.submit.useMutation({
    onSuccess: () => {
      refetch();
      setSubmitted(true);
      toast.success('Your check-in has been submitted', { duration: 3000 });
    },
    onError: () => toast.error('Failed to submit. Please try again.'),
  });

  const handleSubmit = () => {
    const dietFields = [form.dietWeighedFoods, form.dietMealPrepAccuracy, form.dietExtrasFrequency, form.sleepBedtimeConsistency];
    if (dietFields.some(f => !f)) {
      setShowErrors(true);
      // Scroll to first unanswered question
      const firstUnanswered = questionRefs.find(([field]) => !form[field]);
      if (firstUnanswered) {
        firstUnanswered[1].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    submitMutation.mutate({
      weekStartDate: currentWeekStart,
      dietWeighedFoods: form.dietWeighedFoods as any,
      dietMealPrepAccuracy: form.dietMealPrepAccuracy as any,
      dietExtrasFrequency: form.dietExtrasFrequency as any,
      sleepBedtimeConsistency: form.sleepBedtimeConsistency as any,
    });
  };

  const checkInDay = (profile as any)?.checkInDay;
  const dayLabel = checkInDay ? checkInDay.charAt(0).toUpperCase() + checkInDay.slice(1) : null;

  const fmtWeekStart = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };



  const [subTab, setSubTab] = useState<'form' | 'measurements'>('form');
  const [isEditing, setIsEditing] = useState(false);

  // When a new submission lands, exit edit mode
  useEffect(() => {
    if (submitted) setIsEditing(false);
  }, [submitted]);



  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(['form', 'measurements'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              subTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'form' ? 'Check-in' : 'Measurements'}
          </button>
        ))}
      </div>

      {subTab === 'measurements' ? <MeasurementsTab /> : (
      <>
      {/* Check-in Day Banner */}
      <div className="bg-card border border-border rounded-xl px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="text-primary text-lg mt-0.5">📅</span>
          <div className="flex-1">
            {dayLabel ? (
              <>
                <p className="text-sm font-semibold text-foreground">Your check-in day: {dayLabel}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Complete your weekly check-in on your assigned day. Start by logging your measurements, then fill in the form below and send your progress photos, form clips, and a voice note to me on WhatsApp.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Your coach hasn't assigned a check-in day yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* What to send each check-in */}
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What to send each check-in</p>
        {[
          { num: '1', title: 'Log your measurements', sub: 'Use the Measurements tab above.' },
          { num: '2', title: 'Complete the check-in form below', sub: 'Questions about your week.' },
          { num: '3', title: 'Send progress photos on WhatsApp', sub: 'Front, side, and back.' },
          { num: '4', title: 'Send form clips on WhatsApp', sub: 'One full session from the week.' },
          { num: '5', title: 'Voice note on WhatsApp', sub: 'A summary of how your week went.' },
        ].map(item => (
          <div key={item.num} className="flex gap-3 items-start">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.num}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.sub
                ? <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.sub}</p>
                : <p className="text-sm text-muted-foreground/0 mt-0.5 leading-relaxed select-none">&nbsp;</p>
              }
            </div>
          </div>
        ))}
      </Card>

      {/* ── Submitted summary card (shown when submitted and not editing) ── */}
      {submitted && !isEditing && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-primary text-lg">✓</span>
              <p className="text-sm font-semibold text-foreground">You've submitted this week's check-in</p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-primary hover:opacity-80 font-medium"
            >
              Edit
            </button>
          </div>
        </Card>
      )}

      {/* ── Check-in Form (shown when not submitted, or when editing) ── */}
      {(!submitted || isEditing) && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Check-in Form — Week of {fmtWeekStart(currentWeekStart)}</p>

        {/* Section 1: Diet Execution — 6 questions */}
        <Card className="space-y-6 mb-4">

          <ChoiceQuestion
            label="How often did you weigh all of your foods raw/uncooked with a digital scale this week?"
            field="dietWeighedFoods"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q1Ref}
            options={[
              { value: 'every_meal', label: 'Every meal or nearly every meal' },
              { value: 'most_meals', label: 'Most meals' },
              { value: 'some_meals', label: 'Some meals' },
              { value: 'rarely', label: 'Rarely' },
              { value: 'never', label: 'Never' },
            ]}
          />

          <ChoiceQuestion
            label="How often did you prepare your meals exactly as written in your plan?"
            field="dietMealPrepAccuracy"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q2Ref}
            options={[
              { value: 'every_meal', label: 'Every meal or nearly every meal' },
              { value: 'most_meals', label: 'Most meals' },
              { value: 'some_meals', label: 'Some meals' },
              { value: 'rarely', label: 'Rarely' },
              { value: 'never', label: 'Never' },
            ]}
          />

          <ChoiceQuestion
            label="Excluding any off-plan meals, how often did you eat or drink anything that was not in your meal plan this week?"
            subtext="e.g. snacks, bites while cooking, handfuls of food, drinks with calories, finishing someone else's food, sauces, dressings, spreads, toppings"
            field="dietExtrasFrequency"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q3Ref}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'one_two_days', label: 'On 1–2 days' },
              { value: 'few_days', label: 'On a few days' },
              { value: 'most_days', label: 'On most days' },
              { value: 'every_day', label: 'Every day' },
            ]}
          />

          <ChoiceQuestion
            label="How often did you go to bed more than 1 hour later than your planned bedtime?"
            field="sleepBedtimeConsistency"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q4Ref}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'one_two_days', label: 'On 1–2 days' },
              { value: 'few_days', label: 'On a few days' },
              { value: 'most_days', label: 'On most days' },
              { value: 'every_day', label: 'Every day' },
            ]}
          />
        </Card>


        <div className="flex gap-3">
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-4 border border-border text-muted-foreground font-semibold text-base rounded-xl hover:opacity-80 transition-opacity"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="flex-1 py-4 bg-primary text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit Check-in'}
          </button>
        </div>
      </div>
      )}

      {/* WhatsApp reminder */}
      <Card className="space-y-3.5 border-border/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">After submitting, send on WhatsApp:</p>
        {[
          { icon: '📸', text: 'Progress photos' },
          { icon: '🎥', text: 'Form clips' },
          { icon: '🎙️', text: 'Voice note' },
        ].map(item => (
          <div key={item.text} className="flex gap-3 items-center">
            <span className="text-base">{item.icon}</span>
            <p className="text-sm text-foreground">{item.text}</p>
          </div>
        ))}
       </Card>

      {/* Past Check-ins */}
      {allCheckIns.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Past Check-ins</p>
          <div className="space-y-2">
            {allCheckIns.slice(1).map(ci => (
              <Card key={ci.id} className="opacity-80">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Week of {fmtWeekStart(toLocalDateStr(ci.weekStartDate))}</p>

                </div>

              </Card>
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ─── Main ClientDashboard ─────────────────────────────────────────────────────
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

  const renderTab = () => {
    switch (tab) {
      case "overview":     return <OverviewTab key="overview" />;
      case "daily-log":    return <DailyLogTab key="daily-log" />;
      case "check-ins":    return <CheckInsTab key="check-ins" />;
      case "measurements": return <MeasurementsTab key="measurements" />;
      case "meal-plan":    return <CombinedMealPlanTab key="meal-plan" defaultSub="plan" />;
      case "shopping":     return <CombinedMealPlanTab key="shopping" defaultSub="shopping" />;
      case "training":     return <CombinedTrainingTab key="training" defaultSub="program" />;
      case "workout-log":  return <CombinedTrainingTab key="workout-log" defaultSub="log" />;
      default:             return <OverviewTab key="overview" />;
    }
  };

  return (
    <DashboardShell mode="client">
      {renderTab()}
    </DashboardShell>
  );
}
