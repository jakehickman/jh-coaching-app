import { trpc } from "@/lib/trpc";
import { useEffect, useState, useMemo } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday, dayLabel } from "@/lib/dates";
import { SectionLabel, Card, ScoreInput, DailyLogRow } from "./shared";
import { Button } from "@/components/ui/button";

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
        // A log is "complete" only if all required fields are present
        const hasData = !!log &&
          log.weight != null &&
          log.sleepHours != null &&
          log.sleepQuality != null &&
          log.stepsCount != null &&
          (log as any).stressLevel != null;
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
                : 'hover:bg-muted/30 active:bg-muted/50 cursor-pointer'
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

            {/* Content — always show training/rest badge for valid days */}
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {!isFuture && !isPast && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>{sessionLabel}</span>
              )}
            </div>

            {/* Weight — show if available, greyed if log incomplete */}
            <div className="flex-shrink-0 text-right">
              {log?.weight != null ? (
                <span className={`text-sm font-semibold ${hasData ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {log.weight} kg
                </span>
              ) : !isFuture && !isPast ? (
                <span className="text-sm text-muted-foreground/40">—</span>
              ) : null}
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
  const allHabits = viewAsUserId ? habitsAdmin : habitsOwn;
  // Only show daily habits in the Daily Log — per-meal habits appear in the Fullness rating sheet
  const habits = allHabits.filter((h: any) => h.scope !== 'per_meal');

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
    onSettled: () => { void refetch(); },
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

// Convert decimal hours (e.g. 7.5) → "7:30" display string
function hoursToHmm(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

// Parse sleep input → decimal hours, or null if invalid.
// Accepts: "7:55" → 7h55m | "755" → 7h55m | "1030" → 10h30m
//          "7.55" → 7h55m | "7.5" → 7h30m (decimal only when mins part > 59)
function hmmToHours(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Explicit colon: "7:55"
  if (trimmed.includes(':')) {
    const [hPart, mPart] = trimmed.split(':');
    const h = parseInt(hPart, 10);
    const m = parseInt(mPart, 10);
    if (isNaN(h) || isNaN(m) || m < 0 || m > 59) return null;
    return h + m / 60;
  }
  // Dot format: "7.55" → treat as 7h55m if mins ≤ 59, else decimal hours
  if (trimmed.includes('.')) {
    const [hPart, mPart] = trimmed.split('.');
    const h = parseInt(hPart, 10);
    const mRaw = parseInt(mPart.padEnd(2, '0').slice(0, 2), 10);
    if (!isNaN(h) && !isNaN(mRaw) && mRaw <= 59) return h + mRaw / 60;
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n;
  }
  // 3–4 digit integer: treat last 2 digits as minutes (755 → 7:55, 1030 → 10:30)
  if (/^\d{3,4}$/.test(trimmed)) {
    const mins = parseInt(trimmed.slice(-2), 10);
    const hrs = parseInt(trimmed.slice(0, -2), 10);
    if (mins >= 0 && mins <= 59) return hrs + mins / 60;
  }
  // 1–2 digit plain number → whole hours
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

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
    onSuccess: () => { toast.success("Log saved"); void refetch(); }
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
        sleepHours: log.sleepHours != null ? hoursToHmm(log.sleepHours) : "",
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
      sleepHours: form.sleepHours !== "" ? (hmmToHours(form.sleepHours) ?? undefined) : undefined,
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

  // A day is "complete" (green) only if all required fields are filled.
  // Required: weight, sleepHours, sleepQuality, stepsCount, stressLevel.
  // Notes is optional and does not affect completeness.
  const loggedDates = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs ?? []) {
      const d = toLocalDateStr(l.logDate);
      if (!d) continue;
      const complete =
        l.weight != null &&
        l.sleepHours != null &&
        l.sleepQuality != null &&
        l.stepsCount != null &&
        (l as any).stressLevel != null;
      if (complete) s.add(d);
    }
    return s;
  }, [logs]);

  const weekLabel = useMemo(() => {
    if (weekBack === 0) return 'This week';
    if (weekBack === 1) return 'Last week';
    return `${weekBack} weeks ago`;
  }, [weekBack]);

  // Show skeleton while initial data loads
  if (!logs) {
    return (
      <div className="space-y-5 pb-8 animate-pulse">
        {/* Week strip skeleton */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="space-y-2">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <div className="w-5 h-5 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-20 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Form skeleton */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-11 w-full bg-muted rounded-xl" />
            </div>
          ))}
          <div className="h-12 w-full bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* ── Week strip ── */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setWeekBack(w => w + 1)}
            disabled={!canGoBack}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-medium text-muted-foreground">{weekLabel}</span>
          <button
            onClick={() => setWeekBack(w => Math.max(0, w - 1))}
            disabled={!canGoForward}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
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
                <span className={`text-xs font-medium uppercase ${
                  isSelected ? 'text-primary-foreground' : isToday ? 'text-primary' : 'text-muted-foreground'
                }`}>{label.slice(0, 2)}</span>
                <span className={`text-sm font-bold leading-none ${
                  isSelected ? 'text-primary-foreground' : isToday ? 'text-primary' : 'text-foreground'
                }`}>{dayNum}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSelected
                    ? 'bg-primary-foreground'
                    : hasLog
                    ? 'bg-primary'
                    : !isFuture && !isPast
                    ? 'bg-amber-400'
                    : 'bg-transparent'
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
            <label className="text-sm text-muted-foreground block mb-1.5">Sleep Duration (h:mm)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder=""
              value={form.sleepHours}
              onChange={e => {
                let val = e.target.value;
                // Auto-insert colon: when user types digits only and length hits 2 without colon, insert it
                const digitsOnly = val.replace(/[^0-9]/g, '');
                if (!val.includes(':') && digitsOnly.length >= 2) {
                  // Insert colon after first digit if result would be h:mm (1 digit hour)
                  // or after second digit if hh:mm (2 digit hour)
                  // Heuristic: if first digit > 2, treat as single-digit hour
                  const firstDigit = parseInt(digitsOnly[0], 10);
                  const splitAt = firstDigit > 2 ? 1 : Math.min(2, digitsOnly.length > 2 ? 2 : 1);
                  if (digitsOnly.length > splitAt) {
                    val = digitsOnly.slice(0, splitAt) + ':' + digitsOnly.slice(splitAt, splitAt + 2);
                  }
                }
                setForm(prev => ({ ...prev, sleepHours: val }));
              }}
              onBlur={e => {
                const parsed = hmmToHours(e.target.value);
                if (parsed !== null) {
                  setForm(prev => ({ ...prev, sleepHours: hoursToHmm(parsed) }));
                }
              }}
              className={`w-full bg-secondary rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary border ${form.sleepHours === '' ? 'border-amber-500/50' : 'border-border'}`}
            />
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
        <Button onClick={handleSave} disabled={upsert.isPending} className="w-full h-12 text-base font-semibold">
          {upsert.isPending ? "Saving..." : "Save Log"}
        </Button>
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
