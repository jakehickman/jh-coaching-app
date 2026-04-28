import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { useViewAs } from "@/contexts/ViewAsContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionLabel, Card, MetricCard } from "./shared";
import { CheckSquare, Square, Check } from "lucide-react";

// ─── HabitsSummary (used only in OverviewTab) ─────────────────────────────────
function HabitsSummary() {
  const { viewAsUserId } = useViewAs();
  const { data: habitsOwn = [] } = trpc.habits.myHabits.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: habitsAdmin = [] } = trpc.habits.clientHabits.useQuery({ clientId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const habits = viewAsUserId ? habitsAdmin : habitsOwn;
  const from30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const { data: completionsOwn = [] } = trpc.habits.myCompletions.useQuery({ fromDate: from30 }, { enabled: !viewAsUserId });
  const { data: completionsAdmin = [] } = trpc.habits.clientCompletions.useQuery({ clientId: viewAsUserId!, fromDate: from30 }, { enabled: !!viewAsUserId });
  const completions = viewAsUserId ? completionsAdmin : completionsOwn;

  if (habits.length === 0) return null;

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  const normDate = (val: any): string => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const completedSet = new Set(
    completions.map((c: any) => `${c.habitId}:${normDate(c.completedDate)}`)
  );

  const habitStats = habits.map((h: any) => {
    const assignedDateStr = normDate(h.assignedAt);
    const eligible7 = last7.filter(d => d >= assignedDateStr);
    const last7Done = eligible7.filter(d => completedSet.has(`${h.id}:${d}`)).length;
    const pct7 = eligible7.length > 0 ? Math.round((last7Done / eligible7.length) * 100) : 0;

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
  const dayLabels = last7.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
  });
  const allDoneToday = todayDone === habits.length && habits.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Habits</p>
        <span className={`text-xs font-semibold ${allDoneToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {todayDone}/{habits.length} today
        </span>
      </div>
      <Card className="p-0 overflow-hidden">
        {habitStats.map((h: any, idx: number) => {
          const todayComplete = completedSet.has(`${h.id}:${today}`);
          return (
            <div
              key={h.id}
              className={`px-4 py-3 ${idx > 0 ? 'border-t border-border/50' : ''}`}
            >
              {/* Row 1: name + streak */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-foreground leading-snug">{h.name}</p>
                {h.streak > 1 && (
                  <span className="shrink-0 text-[10px] font-semibold text-primary/80">{h.streak} day streak</span>
                )}
              </div>
              {/* Row 2: day letters + dots aligned via grid */}
              <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {dayLabels.map((lbl, i) => (
                  <div key={i} className="text-center text-[10px] text-muted-foreground/50 font-medium mb-1">{lbl}</div>
                ))}
                {last7.map(d => {
                  const assignedDateStr = normDate(h.assignedAt);
                  const beforeAssignment = d < assignedDateStr;
                  const done = !beforeAssignment && completedSet.has(`${h.id}:${d}`);
                  const isToday = d === today;
                  return (
                    <div key={d} className="flex items-center justify-center py-0.5">
                      {beforeAssignment ? (
                        <div className="w-3 h-3" />
                      ) : (
                        <div
                          className={`w-4 h-4 rounded-sm ${
                            done
                              ? 'bg-primary'
                              : isToday
                              ? 'border border-primary/40'
                              : 'bg-muted-foreground/15'
                          }`}
                        />
                      )}
                    </div>
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

// ─── OverviewTab ──────────────────────────────────────────────────────────────
export default function OverviewTab() {
  const { viewAsUserId } = useViewAs();
  const { data: logsOwn } = trpc.dailyLog.list.useQuery({ limit: 30 }, { enabled: !viewAsUserId });
  const { data: logsAdmin } = trpc.dailyLog.listForClient.useQuery({ userId: viewAsUserId!, limit: 30 }, { enabled: !!viewAsUserId });
  const logs = viewAsUserId ? logsAdmin : logsOwn;
  const { data: profileOwn } = trpc.profile.get.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: profileAdmin } = trpc.profile.getById.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const profile = viewAsUserId ? profileAdmin : profileOwn;
  const { data: programOwn } = trpc.training.get.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: programAdmin } = trpc.training.getForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const program = viewAsUserId ? programAdmin : programOwn;

  const weightData = (logs ?? [])
    .filter(l => l.weight)
    .slice(0, 14)
    .reverse()
    .map(l => {
      const iso = toLocalDateStr(l.logDate);
      return { date: iso.slice(5), weight: l.weight };
    });

  const allLogs = logs ?? [];
  const DAY = 86400000;
  const localDateStr = (offsetDays: number) => {
    const d = new Date(Date.now() - offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = localDateStr(0);
  const day6ago = localDateStr(6);
  const day7ago = localDateStr(7);
  const day13ago = localDateStr(13);

  const thisWeekWeights = allLogs
    .filter(l => { const d = toLocalDateStr(l.logDate); return d >= day6ago && d <= today && l.weight != null; })
    .map(l => l.weight as number);
  const prevWeekWeights = allLogs
    .filter(l => { const d = toLocalDateStr(l.logDate); return d >= day13ago && d <= day7ago && l.weight != null; })
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

  const schedule: string[] = Array.isArray((program as any)?.schedule) ? (program as any).schedule : [];
  const rotationLength = schedule.length > 0 ? schedule.length : 7;
  const clientStartDate = profile?.startDate ? toLocalDateStr(profile.startDate) : null;
  const rotationWindowStart = localDateStr(rotationLength - 1);
  const effectiveWindowStart = clientStartDate && clientStartDate > rotationWindowStart
    ? clientStartDate : rotationWindowStart;
  const windowDays: string[] = [];
  const cursor = new Date(effectiveWindowStart + 'T00:00:00');
  const endDay = new Date(today + 'T00:00:00');
  while (cursor <= endDay) {
    windowDays.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  // Ratio-based prescribed count — avoids cycle-index anchor bug
  const trainingDaysInSchedule = schedule.length > 0
    ? schedule.filter(s => s && s.toLowerCase() !== 'off').length
    : rotationLength;
  const prescribedDays = Math.max(1, Math.round(windowDays.length * (trainingDaysInSchedule / rotationLength)));
  const trainedInRotation = allLogs.filter(l => {
    const d = toLocalDateStr(l.logDate);
    return d >= effectiveWindowStart && d <= today && l.trainingCompleted;
  }).length;
  const adherence = prescribedDays > 0 ? Math.min(100, Math.round((trainedInRotation / prescribedDays) * 100)) : 0;

  const cur7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day6ago && d <= today; });
  const prev7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day13ago && d <= day7ago; });
  const curOnPlan = cur7Logs.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  const mealAdherence = Math.round((curOnPlan / 7) * 100);
  const prevOnPlan = prev7Logs.filter(l => (l.offPlanMeals ?? 0) === 0).length;
  const prevMealAdherence = Math.round((prevOnPlan / 7) * 100);
  // Count days with any off-plan meal (boolean: 1 = yes)
  const offPlanTotal7 = cur7Logs.filter(l => (l.offPlanMeals ?? 0) > 0).length;

  // ── On-plan streak: consecutive logged days ending today with no off-plan meal ──
  // Build a map of date → offPlanMeals for fast lookup
  const logByDate: Record<string, number> = {};
  for (const l of allLogs) {
    const iso = toLocalDateStr(l.logDate);
    if (iso) logByDate[iso] = l.offPlanMeals ?? 0;
  }
  const onPlanStreak = (() => {
    let streak = 0;
    // Walk backwards from today; stop at first day that is off-plan OR unlogged
    for (let i = 0; i <= 90; i++) {
      const iso = localDateStr(i);
      // Respect client start date — don't count days before they started
      if (clientStartDate && iso < clientStartDate) break;
      if (!(iso in logByDate)) break; // unlogged day breaks the streak
      if (logByDate[iso] > 0) break;  // off-plan day breaks the streak
      streak++;
    }
    return streak;
  })();

  const stepGoal = (profile as any)?.stepGoal as number | null | undefined;
  const lissSessionsPerWeek = (profile as any)?.lissSessionsPerWeek as number | null | undefined;
  const lissMinutesPerSession = (profile as any)?.lissMinutesPerSession as number | null | undefined;
  const lissSet = lissSessionsPerWeek != null && lissMinutesPerSession != null;
  const lissLoggedMins7 = cur7Logs.reduce((sum, l) => sum + ((l as any).lissMinutes ?? 0), 0);
  const lissTargetMins = lissSet ? (lissSessionsPerWeek! * lissMinutesPerSession!) : null;
  const cur7Steps = cur7Logs.filter(l => l.stepsCount != null).map(l => l.stepsCount as number);
  const avgSteps7 = cur7Steps.length > 0 ? Math.round(cur7Steps.reduce((a, b) => a + b, 0) / cur7Steps.length) : null;

  const checkInDay = (profile as any)?.checkInDay as string | null | undefined;
  const todayDayName = new Date().toLocaleDateString('en-AU', { weekday: 'long' }).toLowerCase();
  const isStartDate = (() => {
    const startDate = (profile as any)?.startDate;
    if (!startDate) return false;
    const start = new Date(startDate);
    const today = new Date();
    return start.getFullYear() === today.getFullYear() &&
      start.getMonth() === today.getMonth() &&
      start.getDate() === today.getDate();
  })();
  const isCheckInDay = !!checkInDay && todayDayName === checkInDay && !isStartDate;
  const tomorrowDayName = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-AU', { weekday: 'long' }).toLowerCase();
  })();
  const isCheckInTomorrow = !!checkInDay && tomorrowDayName === checkInDay && !isStartDate;
  const getMondayStr = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [mondayStr] = useMemo(() => [getMondayStr()], []);
  const { data: currentCycleOwn } = trpc.checkIn.myCurrentCycle.useQuery(
    undefined,
    { enabled: isCheckInDay && !viewAsUserId, staleTime: 0 }
  );
  const { data: clientCycleAdmin } = trpc.checkIn.clientCurrentCycle.useQuery(
    { clientId: viewAsUserId! },
    { enabled: isCheckInDay && !!viewAsUserId, staleTime: 0 }
  );
  const currentCycle = viewAsUserId ? clientCycleAdmin : currentCycleOwn;
  // Also check via a direct submission lookup — covers the case where the coach has already
  // reviewed and advanced the cycle (resetting status to 'upcoming') on the same day.
  const { data: hasSubmittedThisWeek } = trpc.checkIn.myHasSubmittedThisWeek.useQuery(
    undefined,
    { enabled: isCheckInDay && !viewAsUserId, staleTime: 0 }
  );
  const alreadySubmittedThisWeek = currentCycle?.status === "submitted" || hasSubmittedThisWeek === true;

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
      {!isCheckInDay && isCheckInTomorrow && (
        <div className="bg-secondary border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Check-in is tomorrow</p>
            <p className="text-xs text-muted-foreground mt-0.5">Get ready to take your measurements and progress photos.</p>
          </div>
        </div>
      )}
      <div>
        <SectionLabel>Weekly Summary (last 7 days)</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Avg Weight" value={avgWeight !== "—" ? `${avgWeight} kg` : "—"} sub={weightChangePct ? `${Number(weightChangePct) > 0 ? '+' : ''}${weightChangePct}% vs prev 7 days` : undefined} />
          <MetricCard label="Training Adherence" value={`${adherence}%`} sub={schedule.length > 0 ? `${trainedInRotation}/${prescribedDays} sessions completed` : `${trainedInRotation} sessions completed`} />
          <MetricCard label="Off Plan Meals" value={offPlanTotal7.toString()} />
          {stepGoal && (
            <MetricCard
              label="Avg Daily Steps"
              value={avgSteps7 != null ? avgSteps7.toLocaleString() : "—"}
              sub={`Goal: ${stepGoal.toLocaleString()}`}
            />
          )}
          {lissSet && (
            <MetricCard
              label="LISS Cardio"
              value={`${lissLoggedMins7} min`}
              sub={`target: ${lissTargetMins} min / week`}
            />
          )}
        </div>
      </div>

      <div>
        <SectionLabel>Streaks</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Meal Streak"
            value={onPlanStreak === 0 ? "0" : `${onPlanStreak} day${onPlanStreak > 1 ? 's' : ''}`}
          />
        </div>
      </div>

      {weightData.length > 0 && (
        <div>
          <SectionLabel>Weight Trend (14 Days)</SectionLabel>
          <Card>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
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
