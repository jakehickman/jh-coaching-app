import { trpc } from "@/lib/trpc";
import { useEffect, useState, useMemo } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday, dayLabel } from "@/lib/dates";
import { SectionLabel, Card, ScoreInput, DailyLogRow } from "./shared";

// ─── WeekSummaryPanel ────────────────────────────────────────────────────────
function WeekSummaryPanel({
  weekDays,
  logs,
  workoutSessions,
  selectedDate,
  onSelectDate,
  startDate,
}: {
  weekDays: string[];
  logs: DailyLogRow[];
  workoutSessions: Array<{ sessionDate: Date | string; dayLabel?: string | null }>;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  startDate?: string | null;
}) {
  const today = localToday();

  const logMap: Record<string, DailyLogRow> = {};
  for (const log of logs) {
    const key = toLocalDateStr(log.logDate);
    if (key) logMap[key] = log;
  }

  const toDateStr = (v: Date | string | null | undefined): string => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    return (v as Date).toISOString().slice(0, 10);
  };

  // Build a map of date → session labels from actual workout sessions
  const sessionMap: Record<string, string[]> = {};
  for (const s of workoutSessions) {
    const key = toDateStr(s.sessionDate);
    if (!key) continue;
    if (!sessionMap[key]) sessionMap[key] = [];
    if (s.dayLabel) sessionMap[key].push(s.dayLabel);
  }

  function fmtShort(iso: string) {
    const [, , d] = iso.split('-');
    return `${parseInt(d)} ${new Date(iso + 'T12:00:00Z').toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' })}`;
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {weekDays.map((iso) => {
        const log = logMap[iso] ?? null;
        const hasData = !!log;
        const isFuture = iso > today;
        const isPast = startDate ? iso < startDate : false;
        const isSelected = iso === selectedDate;
        const isToday = iso === today;
        const sessions = sessionMap[iso] ?? [];
        const trained = sessions.length > 0;
        const sessionLabel = trained ? (sessions.join(', ') || 'Training') : 'Rest';
        const weekdayShort = dayLabel(iso).slice(0, 3);

        return (
          <button
            key={iso}
            onClick={() => !isFuture && !isPast && onSelectDate(iso)}
            disabled={isFuture || isPast}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-0 touch-manipulation ${
              isSelected
                ? 'bg-primary/10'
                : isFuture || isPast
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-muted/30 cursor-pointer'
            }`}
          >
            {/* Status indicator */}
            <div className="flex-shrink-0 w-5 flex justify-center">
              {isFuture || isPast ? (
                <span className="w-1.5 h-1.5 rounded-full bg-border" />
              ) : hasData ? (
                <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                </span>
              ) : (
                <span className="w-4 h-4 rounded-full border border-amber-500/60 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                </span>
              )}
            </div>

            {/* Day label */}
            <div className="w-16 flex-shrink-0">
              <p className={`text-sm font-semibold ${
                isSelected ? 'text-primary' : isToday ? 'text-primary' : 'text-foreground'
              }`}>{weekdayShort}</p>
              <p className="text-[10px] text-muted-foreground">{fmtShort(iso)}</p>
            </div>

            {/* Content — training badge only if logged */}
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {hasData ? (
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>{sessionLabel}</span>
              ) : !isFuture && !isPast ? (
                <span className="text-xs text-amber-500/80 font-medium">Missing</span>
              ) : null}
            </div>

            {/* Weight */}
            <div className="flex-shrink-0 text-right">
              {hasData && log.weight != null ? (
                <span className="text-sm font-semibold text-foreground">{log.weight} kg</span>
              ) : (
                <span className="text-sm text-muted-foreground/30">—</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── HabitsCard ────────────────────────────────────────────────────────────────
// Day letters shown once as a shared header row; dots only for subsequent habits.
function HabitsCard({ date, weekDays }: { date: string; weekDays: string[] }) {
  const { viewAsUserId } = useViewAs();
  const { data: habitsOwn = [] } = trpc.habits.myHabits.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: habitsAdmin = [] } = trpc.habits.clientHabits.useQuery({ clientId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const habits = viewAsUserId ? habitsAdmin : habitsOwn;

  const from90 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 89);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const { data: completionsOwn = [], refetch: refetchOwn } = trpc.habits.myCompletions.useQuery({ fromDate: from90 }, { enabled: !viewAsUserId });
  const { data: completionsAdmin = [], refetch: refetchAdmin } = trpc.habits.clientCompletions.useQuery({ clientId: viewAsUserId!, fromDate: from90 }, { enabled: !!viewAsUserId });
  const completions = viewAsUserId ? completionsAdmin : completionsOwn;
  const refetch = viewAsUserId ? refetchAdmin : refetchOwn;

  const today = localToday();

  const normDate = (val: any): string => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

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
    onSettled: () => { refetch(); },
  });

  if (habits.length === 0) return null;

  const dayLetters = weekDays.map(iso => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-AU', { weekday: 'narrow' });
  });

  return (
    <div>
      <SectionLabel>Habits</SectionLabel>
      <Card className="p-0 overflow-hidden">
        {/* Day letter header — shown once above all habits */}
        <div className="px-4 pt-3 pb-1 flex gap-1.5">
          {/* spacer to align with habit name column — empty, just pushes dots into position */}
          {weekDays.map((iso, idx) => (
            <div key={iso} className="flex-1 flex justify-center">
              <span className={`text-[10px] font-semibold ${
                iso === date ? 'text-primary' : iso === today ? 'text-primary/70' : 'text-muted-foreground'
              }`}>{dayLetters[idx]}</span>
            </div>
          ))}
        </div>

        {habits.map((h: any, habitIdx: number) => {
          return (
            <div
              key={h.id}
              className={`px-4 py-3 space-y-2 ${habitIdx > 0 ? 'border-t border-border' : ''}`}
            >
              {/* Habit name */}
              <p className="text-sm font-medium text-foreground">{h.name}</p>

              {/* Dots row */}
              <div className="flex gap-1.5">
                {weekDays.map((iso) => {
                  const key = `${h.id}:${iso}`;
                  const serverDone = completions.some(
                    (c: any) => c.habitId === h.id && normDate(c.completedDate) === iso
                  );
                  const done = key in optimistic ? optimistic[key] : serverDone;
                  const isFuture = iso > today;
                  const isSelected = iso === date;
                  const canToggle = !viewAsUserId && !isFuture;

                  return (
                    <div key={iso} className="flex-1 flex justify-center">
                      <button
                        onClick={() => canToggle && toggleMutation.mutate({ habitId: h.id, date: iso })}
                        disabled={!canToggle || toggleMutation.isPending}
                        title={canToggle ? (done ? 'Mark incomplete' : 'Mark complete') : undefined}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all touch-manipulation ${
                          isFuture
                            ? 'opacity-20 cursor-not-allowed'
                            : canToggle
                            ? 'hover:scale-110 active:scale-95 cursor-pointer'
                            : 'cursor-default'
                        } ${
                          done
                            ? 'bg-primary'
                            : isSelected
                            ? 'bg-muted border-2 border-primary/40'
                            : 'bg-muted/50 border border-border'
                        }`}
                      >
                        {done && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-primary-foreground">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
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

// ─── DailyLogTab ──────────────────────────────────────────────────────────────
// Simplified form:
//   Morning  → weight, sleep hours, sleep quality
//   Habits   → interactive sparkline
//   Evening  → steps, stress level
//   Notes    → free text summary
type DailyForm = {
  weight: string;
  sleepHours: string;
  stepsCount: string;
  sleepQuality: number | null;
  stressLevel: number | null;
  notes: string;
};

const blank: DailyForm = {
  weight: "", sleepHours: "", stepsCount: "",
  sleepQuality: null, stressLevel: null, notes: "",
};

export default function DailyLogTab() {
  const today = localToday();
  const { viewAsUserId } = useViewAs();

  const [date, setDateRaw] = useState(() => {
    if (viewAsUserId) return today;
    const editDate = sessionStorage.getItem('editLogDate');
    if (editDate) { sessionStorage.removeItem('editLogDate'); return editDate; }
    return today;
  });

  const draftKey = `draft:dailyLog:${date}`;

  const saveDraft = (data: DailyForm, key = draftKey) => {
    if (viewAsUserId) return;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
  };
  const removeDraft = () => {
    if (viewAsUserId) return;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  };
  const loadDraft = (key: string): DailyForm | null => {
    if (viewAsUserId) return null;
    try {
      const s = localStorage.getItem(key);
      if (s) return JSON.parse(s) as DailyForm;
    } catch { /* ignore */ }
    return null;
  };

  const [form, setFormRaw] = useState<DailyForm>(() => viewAsUserId ? blank : (loadDraft(draftKey) ?? blank));

  const hasDraft = () => !viewAsUserId && localStorage.getItem(draftKey) !== null;

  const setForm = (updater: DailyForm | ((prev: DailyForm) => DailyForm)) => {
    setFormRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveDraft(next);
      return next;
    });
  };

  const loadServerData = (data: DailyForm, key = draftKey) => {
    setFormRaw(data);
    saveDraft(data, key);
  };

  const { data: profileOwn } = trpc.profile.get.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: profileAdmin } = trpc.profile.getById.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const profile = viewAsUserId ? profileAdmin : profileOwn;
  const { data: logsOwn, refetch: refetchOwn } = trpc.dailyLog.list.useQuery({ limit: 90 }, { enabled: !viewAsUserId });
  const { data: logsAdmin, refetch: refetchAdmin } = trpc.dailyLog.listForClient.useQuery({ userId: viewAsUserId!, limit: 90 }, { enabled: !!viewAsUserId });
  const logs = viewAsUserId ? logsAdmin : logsOwn;
  const refetch = viewAsUserId ? refetchAdmin : refetchOwn;

  const { data: workoutSessionsOwn = [] } = trpc.workoutSessions.list.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: workoutSessionsAdmin = [] } = trpc.workoutSessions.listForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const workoutSessions = viewAsUserId ? workoutSessionsAdmin : workoutSessionsOwn;

  const upsert = trpc.dailyLog.upsert.useMutation({
    onSuccess: () => { toast.success("Log saved"); refetch(); }
  });

  const setDate = (newDate: string) => {
    setDateRaw(newDate);
    const newKey = `draft:dailyLog:${newDate}`;
    const draft = loadDraft(newKey);
    setFormRaw(draft ?? blank);
  };

  // Load server data when date or logs change
  useEffect(() => {
    if (!logs) return;
    const toLocalStr = (v: any) => toLocalDateStr(v);
    const log = logs.find(l => toLocalStr(l.logDate) === date);
    if (log) {
      const serverData: DailyForm = {
        weight: log.weight != null ? String(log.weight) : "",
        sleepHours: log.sleepHours != null ? String(log.sleepHours) : "",
        stepsCount: log.stepsCount != null ? String(log.stepsCount) : "",
        sleepQuality: log.sleepQuality ?? null,
        stressLevel: (log as any).stressLevel ?? null,
        notes: log.notes ?? "",
      };
      loadServerData(serverData);
    } else if (!hasDraft()) {
      setFormRaw(blank);
    }
  }, [date, logs]);

  const handleSave = async () => {
    await upsert.mutateAsync({
      logDate: date,
      weight: form.weight !== "" ? parseFloat(form.weight) : undefined,
      sleepHours: form.sleepHours !== "" ? parseFloat(form.sleepHours) : undefined,
      stepsCount: form.stepsCount !== "" ? parseInt(form.stepsCount) : undefined,
      sleepQuality: form.sleepQuality ?? undefined,
      stressLevel: form.stressLevel ?? undefined,
      notes: form.notes || undefined,
    });
    removeDraft();
  };

  const f = (field: keyof DailyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  // ── Week strip helpers ──
  const [weekBack, setWeekBack] = useState(() => {
    const todayD = new Date(today + 'T12:00:00');
    const dow = todayD.getDay();
    const mondayOffset = (dow === 0 ? 6 : dow - 1);
    const mondayMs = todayD.getTime() - mondayOffset * 86400000;
    const dateMondayMs = new Date(date + 'T12:00:00').getTime();
    const weekDiff = Math.floor((mondayMs - dateMondayMs) / (7 * 86400000));
    return Math.max(0, weekDiff);
  });

  const weekDays = useMemo(() => {
    const todayD = new Date(today + 'T12:00:00');
    const dow = todayD.getDay();
    const mondayOffset = (dow === 0 ? 6 : dow - 1);
    const mondayMs = todayD.getTime() - mondayOffset * 86400000 - weekBack * 7 * 86400000;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mondayMs + i * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [today, weekBack]);

  const startDate = profile?.startDate ? toLocalDateStr(profile.startDate) : undefined;

  const canGoBack = useMemo(() => {
    if (!startDate) return weekBack < 52;
    return weekDays[0] > startDate;
  }, [weekBack, weekDays, startDate]);

  const canGoForward = weekBack > 0;

  const loggedDates = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs ?? []) {
      const d = toLocalDateStr(l.logDate);
      if (d) s.add(d);
    }
    return s;
  }, [logs]);

  const weekLabel = useMemo(() => {
    if (weekBack === 0) return 'This week';
    if (weekBack === 1) return 'Last week';
    return `${weekBack} weeks ago`;
  }, [weekBack]);

  return (
    <div className="space-y-5 pb-8">
      {/* ── Week strip ── */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setWeekBack(w => w + 1)}
            disabled={!canGoBack}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-medium text-muted-foreground">{weekLabel}</span>
          <button
            onClick={() => setWeekBack(w => Math.max(0, w - 1))}
            disabled={!canGoForward}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(iso => {
            const isSelected = iso === date;
            const isToday = iso === today;
            const isFuture = iso > today;
            const isPast = startDate ? iso < startDate : false;
            const hasLog = loggedDates.has(iso);
            const disabled = isFuture || isPast;
            const label = dayLabel(iso);
            const dayNum = parseInt(iso.slice(8), 10);
            return (
              <button
                key={iso}
                onClick={() => !disabled && setDate(iso)}
                disabled={disabled}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors touch-manipulation ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : disabled
                    ? 'opacity-25 cursor-not-allowed'
                    : 'hover:bg-muted/40 text-foreground'
                }`}
              >
                <span className={`text-[10px] font-medium uppercase ${
                  isSelected ? 'text-primary-foreground' : isToday ? 'text-primary' : 'text-muted-foreground'
                }`}>{label.slice(0, 2)}</span>
                <span className={`text-sm font-bold leading-none ${
                  isSelected ? 'text-primary-foreground' : isToday ? 'text-primary' : 'text-foreground'
                }`}>{dayNum}</span>
                <span className={`w-1 h-1 rounded-full ${
                  isSelected ? 'bg-primary-foreground/70' : hasLog ? 'bg-primary' : 'bg-transparent'
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Single form card ── */}
      <Card className="p-0 overflow-hidden divide-y divide-border">
        {/* Morning block */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Weight (kg)</label>
            <input type="number" step="0.1" value={form.weight} onChange={f("weight")}
              className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.weight === '' ? 'border-amber-500/50' : 'border-border'}`} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Sleep (hours)</label>
            <input type="number" step="0.5" value={form.sleepHours} onChange={f("sleepHours")}
              className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.sleepHours === '' ? 'border-amber-500/50' : 'border-border'}`} />
          </div>
          <ScoreInput label="Sleep Quality (1–5)" value={form.sleepQuality} onChange={v => setForm(p => ({ ...p, sleepQuality: v }))} max={5} />
        </div>

        {/* Evening block */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Steps</label>
            <input type="number" value={form.stepsCount} onChange={f("stepsCount")}
              className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.stepsCount === '' ? 'border-amber-500/50' : 'border-border'}`} />
          </div>
          <ScoreInput label="Stress Level (1–5)" value={form.stressLevel} onChange={v => setForm(p => ({ ...p, stressLevel: v }))} max={5} />
        </div>

        {/* Notes block */}
        <div className="px-4 py-4">
          <label className="text-sm text-muted-foreground block mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={f("notes")} rows={3}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
      </Card>

      {/* ── Habits ── */}
      <HabitsCard date={date} weekDays={weekDays} />

      {!viewAsUserId && (
        <button onClick={handleSave} disabled={upsert.isPending}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
          {upsert.isPending ? "Saving..." : "Save Log"}
        </button>
      )}

      {/* ── This week ── */}
      <div>
        <SectionLabel>This week</SectionLabel>
        <WeekSummaryPanel
          weekDays={weekDays}
          logs={logs ?? []}
          workoutSessions={workoutSessions}
          selectedDate={date}
          onSelectDate={(iso) => { setDate(iso); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          startDate={startDate}
        />
      </div>
    </div>
  );
}
