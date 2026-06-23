import { trpc } from "@/lib/trpc";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, CheckSquare, Square, Activity } from "lucide-react";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday, dayLabel } from "@/lib/dates";
import { SectionLabel, Card, ScoreInput, DailyLogRow } from "./shared";

// ─── WeekSummaryPanel ────────────────────────────────────────────────────────
// Compact 7-row summary of the currently-viewed week, synced with the week strip.
function WeekSummaryPanel({
  weekDays,
  logs,
  selectedDate,
  onSelectDate,
  startDate,
}: {
  weekDays: string[];
  logs: DailyLogRow[];
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

  const isTrained = (v: unknown) => v === true || v === 1 || v === '1';

  function fmtShort(iso: string) {
    const [, m, d] = iso.split('-');
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
        const trained = log ? isTrained(log.trainingCompleted) : false;
        const sessionLabel = trained && log?.trainingType && log.trainingType !== 'Off'
          ? log.trainingType
          : (trained ? 'Training' : 'Rest');
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

            {/* Content */}
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {hasData ? (
                <>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>{sessionLabel}</span>
                  {((log as any).lissMinutes ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium bg-blue-500/20 text-blue-400">
                      <Activity size={11} />{(log as any).lissMinutes}m
                    </span>
                  )}
                </>
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

// ─── HabitsCard ────────────────────────────────────────────────────────────────────────────────
function HabitsCard({ date }: { date: string }) {
  const { viewAsUserId } = useViewAs();
  const utils = trpc.useUtils();
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
              onClick={() => !viewAsUserId && toggleMutation.mutate({ habitId: h.id, date })}
              disabled={toggleMutation.isPending || !!viewAsUserId}
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

// ─── DailyLogTab ──────────────────────────────────────────────────────────────
type DailyForm = {
  weight: string;
  sleepHours: string;
  caffeineServings: string;
  trainingCompleted: boolean;
  trainingType: string;
  stepsCount: string;
  lissMinutes: string;
  sleepQuality: number | null;
  hungerLevel: number | null;
  stressLevel: number | null;
  notes: string;
};

const blank: DailyForm = {
  weight: "", sleepHours: "", caffeineServings: "", trainingCompleted: false,
  trainingType: "", stepsCount: "", lissMinutes: "", sleepQuality: null, hungerLevel: null, stressLevel: null,
  notes: "",
};

export default function DailyLogTab() {
  const today = localToday();
  const { viewAsUserId } = useViewAs();

  const [date, setDateRaw] = useState(() => {
    // In viewAs mode, never load from sessionStorage (belongs to coach)
    if (viewAsUserId) return today;
    const editDate = sessionStorage.getItem('editLogDate');
    if (editDate) { sessionStorage.removeItem('editLogDate'); return editDate; }
    return today;
  });

  const draftKey = `draft:dailyLog:${date}`;

  const saveDraft = (data: DailyForm, key = draftKey) => {
    // Never persist drafts in viewAs mode
    if (viewAsUserId) return;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
  };
  const removeDraft = () => {
    if (viewAsUserId) return;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  };
  const loadDraft = (key: string): DailyForm | null => {
    // Never load drafts in viewAs mode
    if (viewAsUserId) return null;
    try {
      const s = localStorage.getItem(key);
      if (s) return JSON.parse(s) as DailyForm;
    } catch { /* ignore */ }
    return null;
  };

  // In viewAs mode, always start blank — server data will populate via useEffect
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

  const toDateStr = (v: Date | string | null | undefined): string => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    return v.toISOString().slice(0, 10);
  };
  const todaysSessions = workoutSessions.filter(s => toDateStr(s.sessionDate as Date | string) === date);
  // Never auto-populate training from workout sessions when in clone/viewAs mode — prevents
  // the client's sessions from leaking into the coach's own log when switching views.
  const autoTrained = !viewAsUserId && todaysSessions.length > 0;
  const autoTrainingType = !viewAsUserId ? (todaysSessions.map(s => s.dayLabel).filter(Boolean).join(", ") || undefined) : undefined;

  const setDate = (newDate: string) => {
    setDateRaw(newDate);
    const newKey = `draft:dailyLog:${newDate}`;
    const draft = loadDraft(newKey);
    if (draft) {
      setFormRaw(draft);
    } else if (logs) {
      const existing = logs.find(l => toLocalDateStr(l.logDate) === newDate);
      if (existing) {
        loadServerData({
          weight: existing.weight?.toString() ?? "",
          sleepHours: existing.sleepHours?.toString() ?? "",
          caffeineServings: existing.caffeineServings?.toString() ?? "",
          trainingCompleted: existing.trainingCompleted ?? false,
          trainingType: existing.trainingType ?? "",
          stepsCount: existing.stepsCount?.toString() ?? "",
          lissMinutes: (existing as any).lissMinutes?.toString() ?? "",
          sleepQuality: existing.sleepQuality ?? null,
          hungerLevel: existing.hungerLevel ?? null,
          stressLevel: (existing as any).stressLevel ?? null,
          notes: existing.notes ?? "",
        }, newKey);
      } else {
        loadServerData({ ...blank, trainingCompleted: autoTrained, trainingType: autoTrainingType ?? "" }, newKey);
      }
    } else {
      loadServerData(blank, newKey);
    }
  };

  useEffect(() => {
    if (!logs) return;
    if (hasDraft()) return;
    const existing = logs.find(l => toLocalDateStr(l.logDate) === date);
    if (existing) {
      loadServerData({
        weight: existing.weight?.toString() ?? "",
        sleepHours: existing.sleepHours?.toString() ?? "",
        caffeineServings: existing.caffeineServings?.toString() ?? "",
        trainingCompleted: existing.trainingCompleted ?? false,
        trainingType: existing.trainingType ?? "",
        stepsCount: existing.stepsCount?.toString() ?? "",
        lissMinutes: (existing as any).lissMinutes?.toString() ?? "",
        sleepQuality: existing.sleepQuality ?? null,
        hungerLevel: existing.hungerLevel ?? null,
          stressLevel: (existing as any).stressLevel ?? null,
          notes: existing.notes ?? "",
        });
    } else {
      loadServerData({ ...blank, trainingCompleted: autoTrained, trainingType: autoTrainingType ?? "" });
    }
  }, [date, logs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const iso = (e as CustomEvent<{ date: string }>).detail?.date;
      if (iso) {
        sessionStorage.removeItem('editLogDate');
        setDate(iso);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('editLogDate', handler);
    return () => window.removeEventListener('editLogDate', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    removeDraft();
    upsert.mutate({
      logDate: date,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : undefined,
      caffeineServings: form.caffeineServings ? parseFloat(form.caffeineServings) : undefined,
      // trainingCompleted and trainingType are server-controlled (set by workout session sync)
      // Do not send from the form to avoid overriding the synced value
      stepsCount: form.stepsCount ? parseInt(form.stepsCount) : undefined,
      lissMinutes: form.lissMinutes ? parseInt(form.lissMinutes) : undefined,
      sleepQuality: form.sleepQuality ?? undefined,
      hungerLevel: form.hungerLevel ?? undefined,
      stressLevel: form.stressLevel ?? undefined,
      notes: form.notes || undefined,
    });
  };

  const f = (field: keyof DailyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  // ── Week strip helpers ──
  const [weekBack, setWeekBack] = useState(() => {
    // initialise to the week of the selected date
    const todayD = new Date(today + 'T12:00:00');
    const dow = todayD.getDay();
    const mondayOffset = (dow === 0 ? 6 : dow - 1);
    const mondayMs = todayD.getTime() - mondayOffset * 86400000;
    const dateMs = new Date(date + 'T12:00:00').getTime();
    return Math.max(0, Math.floor((mondayMs - dateMs) / (7 * 86400000)));
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

  return (
    <div className="space-y-6">
      {/* ── Week strip date picker ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setWeekBack(w => w + 1)}
            disabled={!canGoBack}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {weekBack === 0 ? 'This week' : weekBack === 1 ? 'Last week' : `${weekBack} weeks ago`}
          </span>
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
            const label = dayLabel(iso); // Mon, Tue…
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
                {/* dot indicator for logged days */}
                <span className={`w-1 h-1 rounded-full ${
                  isSelected ? 'bg-primary-foreground/70' : hasLog ? 'bg-primary' : 'bg-transparent'
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Body Metrics</SectionLabel>
        <Card className="space-y-3">
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={f("weight")} className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.weight === '' ? 'border-amber-500/50' : 'border-border'}`} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Sleep (hours)</label>
              <input type="number" step="0.5" value={form.sleepHours} onChange={f("sleepHours")} className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.sleepHours === '' ? 'border-amber-500/50' : 'border-border'}`} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Caffeine (servings)</label>
              <input type="number" step="0.5" min="0" value={form.caffeineServings} onChange={f("caffeineServings")} className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.caffeineServings === '' ? 'border-amber-500/50' : 'border-border'}`} />
              <p className="text-[10px] text-muted-foreground mt-0.5">1 serving ≈ 80–100mg</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">Steps</label>
                {(profile as any)?.stepGoal && (
                  <span className="text-xs text-primary font-medium">Goal: {((profile as any).stepGoal as number).toLocaleString()}</span>
                )}
              </div>
              <input type="number" value={form.stepsCount} onChange={f("stepsCount")} className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.stepsCount === '' ? 'border-amber-500/50' : 'border-border'}`} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">LISS Cardio</label>
                {(profile as any)?.lissSessionsPerWeek != null && (profile as any)?.lissMinutesPerSession != null && (
                  <span className="text-xs text-primary font-medium">Target: {(profile as any).lissSessionsPerWeek} × {(profile as any).lissMinutesPerSession} min / week</span>
                )}
              </div>
              <div className="relative">
                <input type="number" value={form.lissMinutes} onChange={f("lissMinutes")} className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-14 border ${form.lissMinutes === '' ? 'border-amber-500/50' : 'border-border'}`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mins</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Biofeedback (1–5)</SectionLabel>
        <Card className="space-y-4">
          <ScoreInput label="Sleep Quality" value={form.sleepQuality} onChange={v => setForm(p => ({ ...p, sleepQuality: v }))} max={5} />
          <ScoreInput label="Hunger Level" value={form.hungerLevel} onChange={v => setForm(p => ({ ...p, hungerLevel: v }))} max={5} />
          <ScoreInput label="Stress Level" value={form.stressLevel} onChange={v => setForm(p => ({ ...p, stressLevel: v }))} max={5} />
        </Card>
      </div>

      <div>
        <SectionLabel>Notes</SectionLabel>
        <textarea value={form.notes} onChange={f("notes")} rows={3} className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>

      <HabitsCard date={date} />

      {!viewAsUserId && (
        <button onClick={handleSave} disabled={upsert.isPending}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
          {upsert.isPending ? "Saving..." : "Save Log"}
        </button>
      )}

      <div>
        <SectionLabel>This week</SectionLabel>
        <WeekSummaryPanel
          weekDays={weekDays}
          logs={logs ?? []}
          selectedDate={date}
          onSelectDate={(iso) => { setDate(iso); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          startDate={startDate}
        />
      </div>
    </div>
  );
}
