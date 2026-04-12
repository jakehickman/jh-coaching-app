import { trpc } from "@/lib/trpc";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Check, ChevronDown, ChevronUp, Pencil, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday } from "@/lib/dates";
import { SectionLabel, Card, DateInput, ScoreInput, DailyLogRow } from "./shared";

// ─── RecentLogsPanel ──────────────────────────────────────────────────────────
function RecentLogsPanel({ logs, startDate }: { logs: DailyLogRow[]; startDate?: string | null }) {
  const { viewAsUserId } = useViewAs();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [, navigate] = useLocation();

  const handleEditDay = (iso: string) => {
    sessionStorage.setItem('editLogDate', iso);
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
    if (startDate && iso < startDate) break;
    allDays.push(iso);
  }
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
        const hasData = !!log;
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
              <div className="w-20 flex-shrink-0">
                <p className="text-sm font-semibold text-foreground">{fmtDay(iso)}</p>
                <p className="text-[10px] text-muted-foreground">{dayLabel(iso)}</p>
              </div>
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
                {!viewAsUserId && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => handleEditDay(iso)}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Pencil size={13} />
                      Edit this day
                    </button>
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
  sleepQuality: number | null;
  hungerLevel: number | null;
  offPlanMeals: number;
  notes: string;
};

const blank: DailyForm = {
  weight: "", sleepHours: "", caffeineServings: "", trainingCompleted: false,
  trainingType: "", stepsCount: "", sleepQuality: null, hungerLevel: null,
  offPlanMeals: 0, notes: "",
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
  const autoTrained = todaysSessions.length > 0;
  const autoTrainingType = todaysSessions.map(s => s.dayLabel).filter(Boolean).join(", ") || undefined;

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
          sleepQuality: existing.sleepQuality ?? null,
          hungerLevel: existing.hungerLevel ?? null,
          offPlanMeals: existing.offPlanMeals ?? 0,
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
        sleepQuality: existing.sleepQuality ?? null,
        hungerLevel: existing.hungerLevel ?? null,
        offPlanMeals: existing.offPlanMeals ?? 0,
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
      trainingCompleted: form.trainingCompleted,
      trainingType: form.trainingType || undefined,
      stepsCount: form.stepsCount ? parseInt(form.stepsCount) : undefined,
      sleepQuality: form.sleepQuality ?? undefined,
      hungerLevel: form.hungerLevel ?? undefined,
      offPlanMeals: form.offPlanMeals ?? 0,
      notes: form.notes || undefined,
    });
  };

  const f = (field: keyof DailyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

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

      {!viewAsUserId && (
        <button onClick={handleSave} disabled={upsert.isPending}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
          {upsert.isPending ? "Saving..." : "Save Log"}
        </button>
      )}

      <div>
        <SectionLabel>Recent Logs</SectionLabel>
        <RecentLogsPanel logs={logs ?? []} startDate={profile?.startDate ? toLocalDateStr(profile.startDate) : undefined} />
      </div>
    </div>
  );
}
