import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionLabel, Card, MetricCard } from "./shared";

// ─── HabitsSummary ─────────────────────────────────────────────────────────────
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

    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (ds < assignedDateStr) break;
      if (completedSet.has(`${h.id}:${ds}`)) streak++;
      else break;
    }

    return { ...h, last7Done, streak, eligible7: eligible7.length };
  });

  const todayDone = habits.filter((h: any) => completedSet.has(`${h.id}:${today}`)).length;
  // Day labels — shown once as a shared header
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
        {/* Shared day-letter header */}
        <div className="px-4 pt-3 pb-1 grid" style={{ gridTemplateColumns: '1fr repeat(7, 1fr)' }}>
          <div />
          {dayLabels.map((lbl, i) => (
            <div key={i} className="text-center text-xs text-muted-foreground/50 font-medium">{lbl}</div>
          ))}
        </div>
        {habitStats.map((h: any, idx: number) => {
          const todayComplete = completedSet.has(`${h.id}:${today}`);
          return (
            <div
              key={h.id}
              className={`px-4 py-2.5 ${idx > 0 ? 'border-t border-border/50' : ''}`}
            >
              <div className="grid items-center gap-1" style={{ gridTemplateColumns: '1fr repeat(7, 1fr)' }}>
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <p className="text-sm font-medium text-foreground leading-snug truncate">{h.name}</p>
                  {h.streak > 1 && (
                    <span className="shrink-0 text-xs font-semibold text-primary/80">{h.streak}d</span>
                  )}
                </div>
                {last7.map(d => {
                  const assignedDateStr = normDate(h.assignedAt);
                  const beforeAssignment = d < assignedDateStr;
                  const done = !beforeAssignment && completedSet.has(`${h.id}:${d}`);
                  const isToday = d === today;
                  return (
                    <div key={d} className="flex items-center justify-center">
                      {beforeAssignment ? (
                        <div className="w-3 h-3" />
                      ) : (
                        <div
                          className={`w-4 h-4 rounded-full ${
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

  // Sessions in the last 7 days (from workout sessions table)
  const { data: sessionsOwn } = trpc.workoutSessions.list.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: sessionsAdmin } = trpc.workoutSessions.listForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const sessions = viewAsUserId ? sessionsAdmin : sessionsOwn;

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

  // Sessions in last 7 days
  const sessionsLast7 = (sessions ?? []).filter(s => {
    const d = toLocalDateStr(s.sessionDate);
    return d >= day6ago && d <= today;
  }).length;

  const stepGoal = (profile as any)?.stepGoal as number | null | undefined;
  const cur7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day6ago && d <= today; });
  const cur7Steps = cur7Logs.filter(l => l.stepsCount != null).map(l => l.stepsCount as number);
  const avgSteps7 = cur7Steps.length > 0 ? Math.round(cur7Steps.reduce((a, b) => a + b, 0) / cur7Steps.length) : null;

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Weekly Summary (last 7 days)</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Avg Weight"
            value={avgWeight !== "—" ? `${avgWeight} kg` : "—"}
            sub={weightChangePct ? `${Number(weightChangePct) > 0 ? '+' : ''}${weightChangePct}% vs prev 7 days` : undefined}
          />
          <MetricCard
            label="Training Sessions"
            value={String(sessionsLast7)}
            sub="sessions in last 7 days"
          />
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
    </div>
  );
}
