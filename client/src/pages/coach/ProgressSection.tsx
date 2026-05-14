import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { localToday, fmtDate, toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { pctChange as pctChangeNum } from "@/lib/stats";
import {
  LineChart, Line, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Minus, Pencil, Save, Trash2, X, ArrowUp, ArrowDown, Check, Ruler, Utensils, Settings2, Plus, Activity, History } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import {
  Card, SectionLabel, ClientCombobox, useClientSelector,
  MeasurementsCard, MuscleGroupSection, DailyLogRow, ProgressHistoryTable
} from "./shared";
import { CoachHabitsPanel } from "./HabitsSection";
import { WeeklyReviewTab } from "./WeeklyReviewTab";
import TrainingSection from "./TrainingSection";
import MealPlansSection from "./MealPlansSection";
import { ProgressPhotosTab } from "./ProgressPhotosTab";
import { WeeklyBodyCompCards } from "./WeeklyBodyCompCards";
import ProgramChangeLogTab from "./ProgramChangeLogTab";
import CardioChangeLogTab from "./CardioChangeLogTab";

import { CoachCheckInsTab } from "./CoachCheckInsTab";
import { UnifiedChangeLog } from "./UnifiedChangeLog";
import { PhasesTab } from "./PhasesTab";
import { DailyLogTrendsPanel } from "./TrendCharts";

// ─── Collapsible Change History Panel ───────────────────────────────────────
function ChangeHistoryPanel({ children, label = "Change History" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History size={14} />
          {label}
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/40">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Cardio & Activity Card ───────────────────────────────────────────
function CardioActivityCard({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.getById.useQuery(
    { userId: clientId },
    { enabled: clientId > 0 }
  );

  const [editing, setEditing] = useState(false);
  const [stepGoal, setStepGoal] = useState("");
  const [lissSessions, setLissSessions] = useState("");
  const [lissMinsPer, setLissMinsPer] = useState("");

  useEffect(() => {
    if (profile) {
      setStepGoal((profile as any).stepGoal?.toString() ?? "");
      setLissSessions((profile as any).lissSessionsPerWeek?.toString() ?? "");
      setLissMinsPer((profile as any).lissMinutesPerSession?.toString() ?? "");
    }
  }, [profile]);

  const updateConfig = trpc.clientConfig.update.useMutation({
    onSuccess: () => {
      utils.profile.getById.invalidate({ userId: clientId });
      setEditing(false);
      toast.success("Cardio targets updated");
    },
    onError: () => toast.error("Failed to save"),
  });

  function handleSave() {
    updateConfig.mutate({
      userId: clientId,
      stepGoal: stepGoal ? parseInt(stepGoal) : null,
      lissSessionsPerWeek: lissSessions ? parseInt(lissSessions) : null,
      lissMinutesPerSession: lissMinsPer ? parseInt(lissMinsPer) : null,
    });
  }

  const currentStepGoal = (profile as any)?.stepGoal ?? null;
  const currentLissSessions = (profile as any)?.lissSessionsPerWeek ?? null;
  const currentLissMinsPer = (profile as any)?.lissMinutesPerSession ?? null;
  const currentLissSet = currentLissSessions != null && currentLissMinsPer != null;

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      {/* Targets card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weekly Targets</p>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={12} /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditing(false); setStepGoal((profile as any)?.stepGoal?.toString() ?? ""); setLissSessions((profile as any)?.lissSessionsPerWeek?.toString() ?? ""); setLissMinsPer((profile as any)?.lissMinutesPerSession?.toString() ?? ""); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateConfig.isPending}
                className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                <Save size={12} /> {updateConfig.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1.5">Daily Step Goal</label>
              <input
                type="number"
                value={stepGoal}
                onChange={e => setStepGoal(e.target.value)}
                placeholder=""
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">LISS Sessions / Week</label>
              <input
                type="number"
                value={lissSessions}
                onChange={e => setLissSessions(e.target.value)}
                placeholder=""
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Mins / Session</label>
              <input
                type="number"
                value={lissMinsPer}
                onChange={e => setLissMinsPer(e.target.value)}
                placeholder=""
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Step Goal tile */}
            <div className="bg-secondary/40 rounded-xl p-4 border border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Daily Step Goal</p>
              {currentStepGoal ? (
                <>
                  <p className="text-base font-bold tabular-nums text-foreground leading-none">
                    {currentStepGoal.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">steps / day</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">Not set</p>
              )}
            </div>
            {/* LISS Cardio tile */}
            <div className="bg-secondary/40 rounded-xl p-4 border border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">LISS Cardio</p>
              {currentLissSet ? (
                <>
                  <p className="text-base font-bold tabular-nums text-foreground leading-none">
                    {currentLissSessions} × {currentLissMinsPer} min
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">sessions / week</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">Not set</p>
              )}
            </div>
          </div>
        )}
      </div>


    </div>
  );
}

// ─── Nutrition Tab ───────────────────────────────────────────────────────────
function MealPlanNoteEditor({ entryId, initialNote }: { entryId: number; initialNote?: string | null }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();
  const updateNote = trpc.mealPlan.updateHistoryNote.useMutation({
    onSuccess: () => {
      utils.mealPlan.getHistory.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleBlur() {
    const trimmed = note.trim();
    const current = initialNote?.trim() ?? "";
    if (trimmed !== current) {
      updateNote.mutate({ id: entryId, note: trimmed || null });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textareaRef.current?.blur();
    }
    if (e.key === "Escape") {
      setNote(initialNote ?? "");
      textareaRef.current?.blur();
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <textarea
        ref={textareaRef}
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder=""
        rows={2}
        className="w-full resize-none rounded-md bg-muted/30 border border-border/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/50 transition-colors"
      />
      {saved && <p className="text-xs text-emerald-500 mt-1">Note saved</p>}
    </div>
  );
}

function MacroPlanHistoryTab({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: history = [], isLoading } = trpc.mealPlan.getHistory.useQuery(
    { userId: clientId },
    { enabled: !!clientId }
  );
  const deleteEntry = trpc.mealPlan.deleteHistoryEntry.useMutation({
    onSuccess: () => utils.mealPlan.getHistory.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        <div className="h-28 bg-muted rounded-xl animate-pulse" />
        <div className="h-28 bg-muted rounded-xl animate-pulse" />
        <div className="h-28 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-base font-medium">No plan changes recorded</p>
        <p className="text-sm mt-1">Changes to the nutrition plan will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((entry: any, idx: number) => {
        const prev = history[idx + 1] as any | undefined;
        function getDelta(curr: number | null, p: number | null | undefined): number | null {
          if (curr == null || p == null) return null;
          const d = curr - p;
          return d === 0 ? null : d;
        }
        function Cell({ value, unit, delta }: { value: number | null; unit: string; delta?: number | null }) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-semibold tabular-nums text-foreground leading-none">
                {value != null ? value.toLocaleString() : "—"}
                <span className="text-[10px] font-normal text-muted-foreground/50 ml-0.5">{unit}</span>
              </span>
              {delta != null ? (
                <span className={`text-[10px] font-semibold leading-none ${delta > 0 ? "text-emerald-500" : "text-red-400"}`}>
                  {delta > 0 ? "+" : ""}{delta}
                </span>
              ) : (
                <span className="text-[10px] leading-none text-transparent select-none">·</span>
              )}
            </div>
          );
        }
        const cols = [
          { label: "Calories", unit: "kcal", tVal: entry.trainingCalories, rVal: entry.restCalories, tPrev: prev?.trainingCalories, rPrev: prev?.restCalories },
          { label: "Protein",  unit: "g",    tVal: entry.trainingProtein,  rVal: entry.restProtein,  tPrev: prev?.trainingProtein,  rPrev: prev?.restProtein },
          { label: "Carbs",    unit: "g",    tVal: entry.trainingCarbs,    rVal: entry.restCarbs,    tPrev: prev?.trainingCarbs,    rPrev: prev?.restCarbs },
          { label: "Fat",      unit: "g",    tVal: entry.trainingFat,      rVal: entry.restFat,      tPrev: prev?.trainingFat,      rPrev: prev?.restFat },
        ];
        return (
          <div key={entry.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {new Date(entry.changedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <button
                onClick={() => {
                  if (confirm("Delete this nutrition history entry?")) {
                    deleteEntry.mutate({ id: entry.id });
                  }
                }}
                disabled={deleteEntry.isPending}
                className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-5 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 col-span-1" />
              {cols.map(c => (
                <span key={c.label} className="text-[10px] uppercase tracking-wider text-muted-foreground/60 text-right">{c.label}</span>
              ))}
            </div>
            <div className="grid grid-cols-5 items-start py-2 border-t border-border/40">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide self-center">Train</span>
              {cols.map(c => (
                <Cell key={c.label} value={c.tVal} unit={c.unit} delta={getDelta(c.tVal, c.tPrev)} />
              ))}
            </div>
            <div className="grid grid-cols-5 items-start py-2 border-t border-border/40">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide self-center">Rest</span>
              {cols.map(c => (
                <Cell key={c.label} value={c.rVal} unit={c.unit} delta={getDelta(c.rVal, c.rPrev)} />
              ))}
            </div>
            <MealPlanNoteEditor entryId={entry.id} initialNote={entry.note} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Weekly Calorie Summary ─────────────────────────────────────────────────
function WeeklyCalorySummary({
  clientId,
  liveTrainingCal,
  liveRestCal,
}: {
  clientId: number;
  liveTrainingCal?: number | null;
  liveRestCal?: number | null;
}) {
  const { data: trainingPlan } = trpc.mealPlan.getForClient.useQuery(
    { userId: clientId, dayType: "training" },
    { enabled: !!clientId }
  );
  const { data: restPlan } = trpc.mealPlan.getForClient.useQuery(
    { userId: clientId, dayType: "rest" },
    { enabled: !!clientId }
  );
  const { data: trainingProgram } = trpc.training.getForClient.useQuery(
    { userId: clientId },
    { enabled: !!clientId }
  );

  const schedule: string[] = (trainingProgram as any)?.schedule ?? [];
  const cycleLength = schedule.length;
  const trainingDays = schedule.filter((s: string) => s.toUpperCase() !== "OFF").length;
  const restDays = cycleLength - trainingDays;
  // Treat allowances from saved plans (live values already include treat via onLiveTotals)
  const tTreat = trainingPlan?.treatAllowanceKcal ?? 0;
  const rTreat = restPlan?.treatAllowanceKcal ?? 0;
  // Prefer live (draft) values over saved server values; add treat to saved values
  const tCal = (liveTrainingCal != null && liveTrainingCal > 0) ? liveTrainingCal : (trainingPlan?.totalCalories != null ? trainingPlan.totalCalories + tTreat : null);
  const rCal = (liveRestCal != null && liveRestCal > 0) ? liveRestCal : (restPlan?.totalCalories != null ? restPlan.totalCalories + rTreat : null);

  // Is the figure currently showing live/unsaved draft values?
  const savedTCal = trainingPlan?.totalCalories != null ? trainingPlan.totalCalories + tTreat : null;
  const savedRCal = restPlan?.totalCalories != null ? restPlan.totalCalories + rTreat : null;
  const isLive =
    (liveTrainingCal != null && liveTrainingCal > 0 && liveTrainingCal !== savedTCal) ||
    (liveRestCal != null && liveRestCal > 0 && liveRestCal !== savedRCal);

  if (!cycleLength || (tCal == null && rCal == null)) return null;

  const tCalVal = tCal ?? rCal!;
  const rCalVal = rCal ?? tCal!;
  const avgDaily = Math.round((trainingDays * tCalVal + restDays * rCalVal) / cycleLength);
  const weeklyTotal = avgDaily * 7;
  const scheduleLabel = `${trainingDays} training / ${restDays} OFF per ${cycleLength}-day cycle`;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weekly Average</p>
        {isLive && (
          <span className="flex items-center gap-1.5 text-[10px] text-primary/80 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            unsaved
          </span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <div>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {avgDaily.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground ml-1.5">kcal / day</span>
        </div>
        <div className="text-xs text-muted-foreground pb-1">
          {weeklyTotal >= 1000
            ? `${(weeklyTotal / 1000).toFixed(1)}k kcal / week`
            : `${weeklyTotal.toLocaleString()} kcal / week`}
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-2">{scheduleLabel}</p>
    </div>
  );
}

// ─── Nutrition Tab (current plan only) ───────────────────────────────────────
function NutritionTab({ clientId }: { clientId: number }) {
  const { data: trainingPlan, isLoading: loadingTraining } = trpc.mealPlan.getForClient.useQuery(
    { userId: clientId, dayType: "training" },
    { enabled: !!clientId }
  );
  const { data: restPlan, isLoading: loadingRest } = trpc.mealPlan.getForClient.useQuery(
    { userId: clientId, dayType: "rest" },
    { enabled: !!clientId }
  );
  const { data: trainingProgram } = trpc.training.getForClient.useQuery(
    { userId: clientId },
    { enabled: !!clientId }
  );

  // Derive weekly average calories from training schedule rotation
  const weeklyAvgCalories = useMemo(() => {
    const schedule: string[] = (trainingProgram as any)?.schedule ?? [];
    if (!schedule.length) return null;
    const cycleLength = schedule.length;
    const trainingDays = schedule.filter((s: string) => s.toUpperCase() !== "OFF").length;
    const restDays = cycleLength - trainingDays;
    const tCal = trainingPlan?.totalCalories ?? null;
    const rCal = restPlan?.totalCalories ?? null;
    if (tCal == null && rCal == null) return null;
    const tCalVal = tCal ?? rCal!;
    const rCalVal = rCal ?? tCal!;
    return Math.round((trainingDays * tCalVal + restDays * rCalVal) / cycleLength);
  }, [trainingProgram, trainingPlan, restPlan]);

  // Weekly average including treat allowances
  const weeklyAvgCaloriesWithTreat = useMemo(() => {
    const schedule: string[] = (trainingProgram as any)?.schedule ?? [];
    if (!schedule.length) return null;
    const cycleLength = schedule.length;
    const trainingDays = schedule.filter((s: string) => s.toUpperCase() !== "OFF").length;
    const restDays = cycleLength - trainingDays;
    const tCal = (trainingPlan?.totalCalories ?? null);
    const rCal = (restPlan?.totalCalories ?? null);
    const tTreat = trainingPlan?.treatAllowanceKcal ?? 0;
    const rTreat = restPlan?.treatAllowanceKcal ?? 0;
    if (tCal == null && rCal == null) return null;
    const tCalVal = (tCal ?? rCal!) + tTreat;
    const rCalVal = (rCal ?? tCal!) + rTreat;
    const avg = Math.round((trainingDays * tCalVal + restDays * rCalVal) / cycleLength);
    // Only return if there's actually a treat allowance on at least one plan
    return (tTreat > 0 || rTreat > 0) ? avg : null;
  }, [trainingProgram, trainingPlan, restPlan]);

  const scheduleLabel = useMemo(() => {
    const schedule: string[] = (trainingProgram as any)?.schedule ?? [];
    if (!schedule.length) return null;
    const trainingDays = schedule.filter((s: string) => s.toUpperCase() !== "OFF").length;
    const restDays = schedule.length - trainingDays;
    return `${trainingDays} training / ${restDays} OFF per ${schedule.length}-day cycle`;
  }, [trainingProgram]);

  const isLoading = loadingTraining || loadingRest;
  const hasAny = trainingPlan || restPlan;

  function MacroTile({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</span>
        <span className="text-xl font-bold tabular-nums text-foreground">
          {value != null ? value.toLocaleString() : "—"}
        </span>
        <span className="text-[10px] text-muted-foreground/50 leading-none">{unit}</span>
      </div>
    );
  }

  function DayCard({ label, plan }: { label: string; plan: any }) {
    if (!plan) return (
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{label}</p>
        <p className="text-sm text-muted-foreground italic">No plan set</p>
      </div>
    );
    const treat = plan.treatAllowanceKcal ?? 0;
    const mealCals = plan.totalCalories ?? null;
    const displayCals = mealCals != null ? mealCals + treat : null;
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{label}</p>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">Calories</span>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {displayCals != null ? displayCals.toLocaleString() : "—"}
            </span>
              {treat > 0 && mealCals != null && (
              <span className="text-[10px] text-muted-foreground/50 leading-none">{mealCals.toLocaleString()} meals + {treat} free</span>
            )}
            <span className="text-[10px] text-muted-foreground/50 leading-none">kcal</span>
          </div>
          <MacroTile label="Protein" value={plan.totalProtein} unit="g" />
          <MacroTile label="Carbs" value={plan.totalCarbs} unit="g" />
          <MacroTile label="Fat" value={plan.totalFat} unit="g" />
        </div>
        {plan.notes && (
          <p className="text-xs text-muted-foreground/70 mt-2 italic">{plan.notes}</p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Nutrition Plan</SectionLabel>
      </div>
      {!hasAny ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-base font-medium">No nutrition plan set</p>
          <p className="text-sm mt-1">Go to the Nutrition tab to assign a meal plan.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DayCard label="Training Day" plan={trainingPlan} />
            <DayCard label="Rest Day" plan={restPlan} />
          </div>

          {/* Weekly average calorie summary */}
          {weeklyAvgCalories != null && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Weekly Average</p>
              <div className="flex items-end gap-3">
                <div>
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {(weeklyAvgCaloriesWithTreat ?? weeklyAvgCalories).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1.5">kcal / day</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {((weeklyAvgCaloriesWithTreat ?? weeklyAvgCalories) * 7) >= 1000
                      ? `${((weeklyAvgCaloriesWithTreat ?? weeklyAvgCalories) * 7 / 1000).toFixed(1)}k kcal / week`
                      : `${((weeklyAvgCaloriesWithTreat ?? weeklyAvgCalories) * 7).toLocaleString()} kcal / week`}
                  </div>
                  {weeklyAvgCaloriesWithTreat != null && (
                    <div className="text-[10px] text-muted-foreground/50 mt-0.5">{weeklyAvgCalories.toLocaleString()} meals + free cal avg</div>
                  )}
                </div>
              </div>
              {scheduleLabel && (
                <p className="text-xs text-muted-foreground/60 mt-2">{scheduleLabel}</p>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}

// ─── Measurements Tab ────────────────────────────────────────────────────────
function MeasurementsTab({ measurements, logs, chartOnly, historyOnly, clientId }: { measurements: any[]; logs?: any[]; chartOnly?: boolean; historyOnly?: boolean; clientId?: number }) {
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

  // Build weight trend data from daily logs (oldest first)
  const weightData = [...(logs ?? [])]
    .filter((l: any) => l.weight != null)
    .sort((a: any, b: any) => toLocalDateStr(a.logDate).localeCompare(toLocalDateStr(b.logDate)))
    .map((l: any) => {
      const iso = toLocalDateStr(l.logDate);
      const [, mo, d] = iso.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { date: `${parseInt(d)} ${months[parseInt(mo)-1]}`, weight: l.weight };
    });

  // Build waist trend data from measurements (oldest first)
  const waistData = [...sorted].reverse()
    .filter(m => m.waist != null)
    .map(m => {
      const iso = toLocalDateStr(m.measureDate);
      const [, mo, d] = iso.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { date: `${parseInt(d)} ${months[parseInt(mo)-1]}`, waist: m.waist };
    });

  // Merge weight and waist onto a shared date axis
  const combinedTrendData = (() => {
    const map = new Map<string, { date: string; weight?: number; waist?: number }>();
    for (const w of weightData) {
      map.set(w.date, { ...map.get(w.date), date: w.date, weight: w.weight });
    }
    for (const w of waistData) {
      map.set(w.date, { ...map.get(w.date), date: w.date, waist: w.waist as number });
    }
    return Array.from(map.values()).sort((a, b) => {
      // Sort by original order (month/day string — use index from weightData as proxy)
      const ai = weightData.findIndex(x => x.date === a.date);
      const bi = weightData.findIndex(x => x.date === b.date);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
  })();

  if (sorted.length === 0 && weightData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Ruler className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No body composition data recorded yet.</p>
      </div>
    );
  }

  const SITE_COLORS: Record<string, string> = {
    umbilical: '#22c55e',
    suprailiac: '#3b82f6',
    calf: '#f59e0b',
    thigh: '#a855f7',
  };

  // Build skinfold data from measurements (oldest first)
  const skinfoldRaw = [...sorted].reverse()
    .filter(m => totalSkinfold(m) != null)
    .map(m => {
      const iso = toLocalDateStr(m.measureDate);
      const [, mo, d] = iso.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { isoDate: iso, date: `${parseInt(d)} ${months[parseInt(mo)-1]}`, skinfold: totalSkinfold(m) };
    });

  // Build weekly avg weight dots aligned to skinfold measurement dates
  // For each skinfold entry, find the avg weight of daily logs in the same 7-day window
  const skinfoldWeightData = skinfoldRaw.map(s => {
    const measureIso = s.isoDate;
    const measureTs = new Date(measureIso + 'T00:00:00').getTime();
    const weekStart = measureTs - 6 * 86400000;
    const weekLogs = (logs ?? []).filter((l: any) => {
      const t = new Date(toLocalDateStr(l.logDate) + 'T00:00:00').getTime();
      return l.weight != null && t >= weekStart && t <= measureTs;
    });
    const avgWeight = weekLogs.length > 0
      ? Math.round((weekLogs.reduce((sum: number, l: any) => sum + l.weight, 0) / weekLogs.length) * 10) / 10
      : null;
    return { isoDate: measureIso, date: s.date, skinfold: s.skinfold, avgWeight };
  });

  const hasWeightWaist = weightData.length > 1 || waistData.length > 1;
  const hasSkinfold = skinfoldRaw.length > 1;

  return (
    <div className="space-y-5">
      {/* Two-column chart grid */}
      {!historyOnly && (hasWeightWaist || hasSkinfold) && (
        <div className="grid gap-4 grid-cols-1">
          {/* Weight + Waist chart */}
          {hasWeightWaist && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Weight &amp; Waist</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={combinedTrendData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="weight" tick={{ fill: '#3b82f6', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <YAxis yAxisId="waist" orientation="right" tick={{ fill: '#f59e0b', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v: number, name: string) => name === 'weight' ? [`${v} kg`, 'Weight'] : [`${v} cm`, 'Waist']}
                    />
                    <Area yAxisId="weight" type="monotone" dataKey="weight" stroke="#3b82f6" fill="#3b82f622" strokeWidth={2} dot={{ r: 2, fill: '#3b82f6' }} connectNulls />
                    <Line yAxisId="waist" type="monotone" dataKey="waist" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
                    Weight (kg)
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" />
                    Waist (cm)
                  </span>
                </div>
            </div>
          )}
          {/* Skinfold vs Weight dual-axis chart (shared date axis) */}
          {hasSkinfold && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Skinfold vs Weight</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={skinfoldWeightData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="skinfold" tick={{ fill: '#22c55e', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <YAxis yAxisId="weight" orientation="right" tick={{ fill: '#3b82f6', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v: number, name: string) =>
                        name === 'skinfold' ? [`${v} mm`, 'Total Skinfold'] : [`${v} kg`, 'Weight']
                      }
                    />
                    <Line yAxisId="skinfold" type="monotone" dataKey="skinfold" stroke="#22c55e" strokeWidth={2} dot={(props: any) => props.payload.skinfold != null ? <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#22c55e" stroke="#22c55e" /> : <g key={props.key} />} connectNulls />
                    <Line yAxisId="weight" type="monotone" dataKey="avgWeight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', stroke: '#3b82f6' }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />
                    Skinfold (mm)
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
                    Avg Weight (kg)
                  </span>
                </div>
            </div>
          )}
        </div>
      )}
      {/* Session cards */}
      {!chartOnly && (<div>
        <SectionLabel>Measurements</SectionLabel>
        <div className="space-y-2">
          {sorted.map((m, i) => {
            const iso = toLocalDateStr(m.measureDate);
            const prev = sorted[i + 1] ?? null;
            const isExpanded = expandedId === m.id;
            const total = totalSkinfold(m);
            const prevTotal = prev ? totalSkinfold(prev) : null;
            return (
              <div key={m.id} className="rounded-xl border border-border bg-card transition-colors">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">{fmtDate(iso)}</p>
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
      </div>)}
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
    <div className="grid grid-cols-1 gap-2">
      {days.map((iso) => {
        const log = logMap[iso] ?? null;
        const isExpanded = expandedId === iso;
        const hasData = !!log;
        const trained = log ? isTrained(log.trainingCompleted) : false;
        const sessionLabel = log?.trainingType && log.trainingType !== 'Off'
          ? log.trainingType
          : (trained ? 'Training' : 'Rest');

        // Determine left-border accent colour
        const hasOffPlan = hasData && (log.offPlanMeals ?? 0) > 0;
        const borderAccent = !hasData
          ? 'border-l-border'
          : hasOffPlan
          ? 'border-l-amber-500/70'
          : trained
          ? 'border-l-primary/70'
          : 'border-l-border/40';

        return (
          <div key={iso} className={`bg-card border border-border border-l-4 ${borderAccent} rounded-xl overflow-hidden`}>
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
                      {((log as any).lissMinutes ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400" title="LISS Cardio">
                          <Activity size={11} />{(log as any).lissMinutes}m
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
                  {(log as any).stressLevel != null && (
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stress</p><p className="text-sm font-semibold text-foreground">{(log as any).stressLevel}/5</p></div>
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

  // Build a map of yyyy-mm-dd -> log
  const logMap: Record<string, DailyLogRow> = {};
  for (const log of logs) {
    const key = toLocalDateStr(log.logDate);
    if (key) logMap[key] = log;
  }

  // Generate all calendar days from today back to client start date (up to 365 days)
  const allDays: string[] = [];
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (startDate && iso < startDate) break;
    allDays.push(iso);
  }
  const visibleDays = showAll ? allDays : allDays.slice(0, INITIAL_DAYS);
  const hiddenCount = allDays.length - INITIAL_DAYS;

  return (
    <div>
      <SectionLabel>Recent Daily Logs</SectionLabel>
      <RecentLogsPanel logs={logs} visibleDays={visibleDays} />
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:border-border/80 transition-colors"
        >
          View more ({hiddenCount} more {hiddenCount === 1 ? 'day' : 'days'})
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
const CAL_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function SessionDetailPanel({ session, onClose }: { session: any; onClose: () => void }) {
  const exercises = (session.exercises as any[]) ?? [];
  const sessionNotes = session.notes as string | null;
  const dateStr = toLocalDateStr(session.sessionDate);
  const dateObj = new Date(`${dateStr}T00:00:00`);
  const dateLabel = dateObj.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const totalSets = exercises.reduce((acc: number, ex: any) =>
    acc + (ex.sets ?? []).filter((s: any) => s.completed || s.weight != null || s.reps != null).length, 0);
  const hasIncomplete = exercises.some((ex: any) => {
    const sets = ex.sets ?? [];
    return sets.length > 0 && sets.filter((s: any) => s.completed).length < sets.length;
  });

  return (
    <div className="w-72 flex-shrink-0 border border-border rounded-xl bg-card overflow-hidden sticky top-4">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <p className="text-sm font-bold text-foreground">
            Session {session.dayLabel}
            {hasIncomplete && (
              <span className="ml-2 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">Incomplete</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{dateLabel} &middot; {exercises.length} exercises &middot; {totalSets} sets</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Exercise list */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <div className="px-4 py-3 space-y-3">
          {exercises.map((ex: any, i: number) => {
            const allSets: any[] = ex.sets ?? [];
            const totalExSets = allSets.length;
            const completedSets = allSets.filter((s: any) => s.completed || s.weight != null || s.reps != null);
            const isPartial = completedSets.length > 0 && totalExSets > 0 && completedSets.length < totalExSets;
            const isSkipped = completedSets.length === 0 && totalExSets > 0;
            return (
              <div key={i} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-foreground">{ex.name}</p>
                  {ex.substitutedFor && (
                    <span className="text-[9px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">SUB</span>
                  )}
                </div>
                {isSkipped ? (
                  <p className="text-[11px] text-amber-400/80">0/{totalExSets} sets — skipped</p>
                ) : (
                  <div className="space-y-1">
                    {completedSets.map((s: any, si: number) => (
                      <div key={si} className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground w-4">{si + 1}</span>
                        <span className="text-[11px] font-semibold text-foreground">
                          {s.weight != null ? `${s.weight} kg` : '—'} × {s.reps != null ? s.reps : '—'}
                        </span>
                        {isPartial && si === completedSets.length - 1 && (
                          <span className="text-[10px] text-amber-400/80">{completedSets.length}/{totalExSets}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {ex.exerciseNotes && (
                  <p className="text-[11px] text-muted-foreground/60 italic mt-1">&ldquo;{ex.exerciseNotes}&rdquo;</p>
                )}
              </div>
            );
          })}
          {sessionNotes && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Session notes</p>
              <p className="text-xs text-muted-foreground/80 italic">&ldquo;{sessionNotes}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkoutSessionsTab({ workoutSessions }: { workoutSessions: any[] }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Build a map of dateStr -> session for quick lookup
  const sessionByDate = useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of workoutSessions) {
      const d = toLocalDateStr(s.sessionDate);
      // If multiple sessions on same day, keep the latest
      if (!map[d] || s.id > map[d].id) map[d] = s;
    }
    return map;
  }, [workoutSessions]);

  const monthSessionCount = useMemo(() => {
    const prefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-`;
    return workoutSessions.filter(s => toLocalDateStr(s.sessionDate).startsWith(prefix)).length;
  }, [workoutSessions, calYear, calMonth]);

  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Calendar grid helpers
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const monFirst = (firstDayOfMonth + 6) % 7; // 0=Mon
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  function changeMonth(dir: number) {
    setSelectedSession(null);
    setCalMonth(m => {
      let nm = m + dir;
      if (nm > 11) { setCalYear(y => y + 1); return 0; }
      if (nm < 0) { setCalYear(y => y - 1); return 11; }
      return nm;
    });
  }

  // Build cells — overflow days get real ISO dates so they can show sessions too
  const cells: { day: number; iso: string; otherMonth: boolean }[] = [];
  const prevMonthYear = calMonth === 0 ? calYear - 1 : calYear;
  const prevMonthIdx = calMonth === 0 ? 11 : calMonth - 1;
  for (let i = 0; i < monFirst; i++) {
    const d = daysInPrev - monFirst + 1 + i;
    cells.push({ day: d, iso: `${prevMonthYear}-${String(prevMonthIdx+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, otherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({ day: d, iso, otherMonth: false });
  }
  const nextMonthYear = calMonth === 11 ? calYear + 1 : calYear;
  const nextMonthIdx = calMonth === 11 ? 0 : calMonth + 1;
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, iso: `${nextMonthYear}-${String(nextMonthIdx+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`, otherMonth: true });
  }

  if (!workoutSessions.length) {
    return <p className="text-sm text-muted-foreground">No workout sessions logged yet.</p>;
  }

  return (
    <div className="flex gap-4 items-start">
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 rotate-90" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[120px] text-center">
              {CAL_MONTH_NAMES[calMonth]} {calYear}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{monthSessionCount}</span> session{monthSessionCount !== 1 ? 's' : ''} this month
          </span>
        </div>

        {/* Grid */}
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted/30 border-b border-border divide-x divide-border">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{d}</div>
            ))}
          </div>
          {/* Day cells — wrap each row in a div so borders are clean */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {cells.map((cell, idx) => {
              const sess = cell.iso ? sessionByDate[cell.iso] : null;
              const isToday = cell.iso === todayIso;
              const isSelected = selectedSession && cell.iso && toLocalDateStr(selectedSession.sessionDate) === cell.iso;

              let exercises: any[] = [];
              let totalSets = 0;
              let hasIncomplete = false;
              if (sess) {
                exercises = (sess.exercises as any[]) ?? [];
                totalSets = exercises.reduce((acc: number, ex: any) =>
                  acc + (ex.sets ?? []).filter((s: any) => s.completed || s.weight != null || s.reps != null).length, 0);
                hasIncomplete = exercises.some((ex: any) => {
                  const sets = ex.sets ?? [];
                  return sets.length > 0 && sets.filter((s: any) => s.completed).length < sets.length;
                });
              }

              return (
                <div
                  key={idx}
                  className={[
                    'min-h-[90px] p-1.5',
                    cell.otherMonth ? 'opacity-30 bg-card' : 'bg-card',
                    isToday ? 'bg-primary/5' : '',
                    isSelected ? 'ring-1 ring-inset ring-primary/40' : '',
                    sess ? 'cursor-pointer hover:bg-muted/20' : '',
                  ].join(' ')}
                  onClick={() => sess ? setSelectedSession(isSelected ? null : sess) : undefined}
                >
                  <span className={`text-[11px] font-medium block mb-1 ${
                    isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}>{cell.day}</span>

                  {sess && (
                    <div className={[
                      'rounded-md px-1.5 py-1 border text-left',
                      hasIncomplete
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-primary/10 border-primary/20',
                    ].join(' ')}>
                      <div className="flex items-center gap-1">
                        <span className={`text-[11px] font-black ${
                          hasIncomplete ? 'text-amber-400' : 'text-primary'
                        }`}>{sess.dayLabel}</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {exercises.length} ex &middot; {totalSets} sets
                        </span>
                      </div>
                      {hasIncomplete && (
                        <span className="text-[9px] font-semibold text-amber-400/80">incomplete</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedSession ? (
        <SessionDetailPanel session={selectedSession} onClose={() => setSelectedSession(null)} />
      ) : (
        <div className="w-72 flex-shrink-0 border border-border rounded-xl bg-card flex items-center justify-center" style={{ minHeight: 200 }}>
          <p className="text-xs text-muted-foreground">Click a session to view details</p>
        </div>
      )}
    </div>
  );
}

// ─── Coach Preset Editor ────────────────────────────────────────────────────
function CoachPresetEditor({ clientId, exerciseName, onClose }: { clientId: number; exerciseName: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: presets = [], isLoading } = trpc.equipmentPresets.listForClient.useQuery({ userId: clientId, exerciseName });
  const upsert = trpc.equipmentPresets.upsertForClient.useMutation({
    onSuccess: () => { utils.equipmentPresets.listForClient.invalidate({ userId: clientId, exerciseName }); setNewName(''); toast.success('Preset saved'); },
  });
  const del = trpc.equipmentPresets.deleteForClient.useMutation({
    onSuccess: () => { utils.equipmentPresets.listForClient.invalidate({ userId: clientId, exerciseName }); toast.success('Preset deleted'); },
  });
  const rename = trpc.equipmentPresets.renameForClient.useMutation({
    onSuccess: () => {
      utils.equipmentPresets.listForClient.invalidate({ userId: clientId, exerciseName });
      utils.workoutSessions.listForClient.invalidate({ userId: clientId });
      setRenamingId(null);
      toast.success('Preset renamed');
    },
  });

  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Machine Presets</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : presets.length === 0 ? (
        <p className="text-xs text-muted-foreground">No presets saved yet.</p>
      ) : (
        <div className="space-y-1">
          {presets.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2">
              {renamingId === p.id ? (
                <>
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') rename.mutate({ userId: clientId, id: p.id, newName: renameVal }); if (e.key === 'Escape') setRenamingId(null); }}
                    className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={() => rename.mutate({ userId: clientId, id: p.id, newName: renameVal })} className="text-primary hover:opacity-80"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setRenamingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs text-foreground truncate">{p.presetName}</span>
                  {p.lastSettings && <span className="text-[10px] text-muted-foreground/60 truncate max-w-[80px]">{p.lastSettings}</span>}
                  <button onClick={() => { setRenamingId(p.id); setRenameVal(p.presetName); }} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => del.mutate({ userId: clientId, id: p.id })} className="text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Add new preset */}
      <div className="flex gap-2 pt-1">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) upsert.mutate({ userId: clientId, exerciseName, presetName: newName.trim() }); }}
          placeholder=""
          className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => { if (newName.trim()) upsert.mutate({ userId: clientId, exerciseName, presetName: newName.trim() }); }}
          disabled={!newName.trim() || upsert.isPending}
          className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}

function ExerciseProgressTab({
  workoutSessions, exerciseLib, clientId
}: {
  workoutSessions: any[];
  exerciseLib: any[];
  clientId: number;
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
  const exerciseHistory: Record<string, Array<{ sessionId: number; date: string; topSet: { weight: number | null; reps: number | null } | null; allSets: Array<{ weight: number | null; reps: number | null }>; substitutedFor?: string; equipmentDetails?: string | null; machinePreset?: string | null; machineSettings?: string | null }>> = {};
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
      exerciseHistory[ex.name].push({ sessionId: session.id, date: dateStr, topSet, allSets: sets, substitutedFor: ex.substitutedFor ?? undefined, equipmentDetails: ex.equipmentDetails ?? null, machinePreset: ex.machinePreset ?? null, machineSettings: ex.machineSettings ?? null });
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
              // Collect unique machine presets for this exercise (case-insensitive dedup)
              const presetsRaw = history.map(e => e.machinePreset ?? e.equipmentDetails ?? null).filter(Boolean) as string[];
              const presetsSeen = new Map<string, string>();
              for (const p of presetsRaw) { const key = p.toLowerCase(); if (!presetsSeen.has(key)) presetsSeen.set(key, p); }
              const presets = Array.from(presetsSeen.values());
              const activeMachineFilter = presetFilter[name] ?? (presets.length > 1 ? presets[0] : 'All');
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {trend === 'up' && <ArrowUp className="w-4 h-4 text-green-400" />}
                      {trend === 'down' && <ArrowDown className="w-4 h-4 text-red-400" />}
                      {trend === 'flat' && <Minus className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Machine preset filter — only shown when multiple presets exist */}
                  {presets.length > 1 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {presets.map(p => (
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
                      const rUp = !wUp && !wDown && w != null && pw != null && w === pw && r != null && pr != null && r > pr;
                      const rDown = !wUp && !wDown && w != null && pw != null && w === pw && r != null && pr != null && r < pr;
                      const weightStr = w != null ? `${w} kg` : '—';
                      const repsStr = r != null ? ` × ${r}` : '';
                      const presetStr = presets.length <= 1
                        ? (entry.machinePreset || entry.equipmentDetails || null)
                        : null;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 py-1 ${
                            i > 0 ? 'border-t border-border/40' : ''
                          } ${isLatest ? 'opacity-100' : 'opacity-60'}`}
                        >
                          {/* Date */}
                          <span className="text-xs text-muted-foreground w-[72px] flex-shrink-0">{dateLabel}</span>
                          {/* Weight × reps */}
                          <span className={`text-xs font-semibold flex-shrink-0 ${
                            isLatest ? 'text-foreground' : 'text-muted-foreground'
                          }`}>{weightStr}{repsStr}</span>
                          {/* Machine preset label (read-only) */}
                          {presetStr && (
                            <span className="text-[10px] text-muted-foreground/60 truncate flex-1">{presetStr}</span>
                          )}
                          {!presetStr && <span className="flex-1" />}
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

export default function ProgressSection({ fixedClientId }: { fixedClientId?: number } = {}) {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const urlClientId = searchParams.get("clientId") ? parseInt(searchParams.get("clientId")!, 10) : null;
  const urlTab = searchParams.get("tab") ?? "overview";
  const urlSubTab = searchParams.get("sub") ?? "";
  const [, navigate] = useLocation();

  const { clients, selectedUserId: selectorUserId, setSelectedUserId } = useClientSelector();
  // In hub mode, use the fixed clientId directly without a selector
  const selectedUserId = fixedClientId ?? selectorUserId;
  const [activeTab, setActiveTab] = useState(urlTab);
  // Per-tab sub-tab state so switching top-level tabs doesn't bleed sub-tab selection
  const [subTabs, setSubTabs] = useState<Record<string, string>>(
    urlSubTab ? { [urlTab]: urlSubTab } : {}
  );

  const getSubTab = (tab: string) => subTabs[tab] ?? "";

  // Helper to update URL when tab or sub-tab changes
  const updateTabUrl = (tab: string, sub?: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    if (sub) params.set("sub", sub); else params.delete("sub");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    updateTabUrl(tab, subTabs[tab]);
  };

  const handleSubTabChange = (sub: string) => {
    setSubTabs(prev => ({ ...prev, [activeTab]: sub }));
    updateTabUrl(activeTab, sub);
  };

  // Sync tab from URL when navigating via deep-link (e.g. from Check-ins kanban)
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
    if (urlSubTab) {
      setSubTabs(prev => ({ ...prev, [urlTab]: urlSubTab }));
    }
  }, [urlTab, urlSubTab]);

  // Sync URL clientId into selector once clients load (only in standalone mode)
  const [urlSynced, setUrlSynced] = useState(false);
  useEffect(() => {
    if (fixedClientId) return; // hub mode — no selector sync needed
    if (!urlSynced && urlClientId && clients.length > 0) {
      const match = clients.find((c: any) => c.id === urlClientId);
      if (match) {
        setSelectedUserId(urlClientId);
        setUrlSynced(true);
      }
    }
  }, [urlClientId, clients, urlSynced, fixedClientId]);
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

  // Live calorie overrides from MealPlansSection draft — reset when client changes
  const [liveTrainingCal, setLiveTrainingCal] = useState<number | null>(null);
  const [liveRestCal, setLiveRestCal] = useState<number | null>(null);
  const prevLiveClientId = React.useRef<number | null>(null);
  useEffect(() => {
    if (selectedUserId !== prevLiveClientId.current) {
      setLiveTrainingCal(null);
      setLiveRestCal(null);
      prevLiveClientId.current = selectedUserId ?? null;
    }
  }, [selectedUserId]);
  const handleLiveTotals = React.useCallback((dayType: "training" | "rest", calories: number) => {
    if (dayType === "training") setLiveTrainingCal(calories);
    else setLiveRestCal(calories);
  }, []);

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

  const curAvgStress = avgOf(cur7.map(l => (l as any).stressLevel as number | null));
  const prevAvgStress = avgOf(prev7.map(l => (l as any).stressLevel as number | null));

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
      {!fixedClientId && (
        <div>
          <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} />
        </div>
      )}


      {selectedUserId && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="sticky top-[48px] z-20 bg-background -mx-4 px-4 lg:-mx-6 lg:px-6 pt-2 pb-2 border-b border-border/40">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="check-ins">Check-ins</TabsTrigger>
              <TabsTrigger value="body-comp">Body Composition</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Overview: weekly review, habits, recent logs ── */}
          <TabsContent value="overview">
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div>
                  <SectionLabel>Weekly Review</SectionLabel>
                  <WeeklyReviewTab clientId={selectedUserId!} />
                </div>
                <div>
                  <CoachHabitsPanel clientId={selectedUserId!} />
                </div>
              </div>
              {(logs ?? []).length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RecentLogsWithViewMore logs={logs ?? []} startDate={clientStartDate} />
                  <DailyLogTrendsPanel logs={logs ?? []} clientStartDate={clientStartDate} gridCols="grid-cols-2" />
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Check-ins: Q&A + Timeline sub-tabs ── */}
          <TabsContent value="check-ins">
            <Tabs value={getSubTab("check-ins") || "check-ins-list"} onValueChange={handleSubTabChange} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="check-ins-list">Check-ins</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="check-ins-list">
                <CoachCheckInsTab clientId={selectedUserId!} />
              </TabsContent>
              <TabsContent value="timeline">
                <PhasesTab clientId={selectedUserId!} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Body Composition: Data / Photos sub-tabs ── */}
          <TabsContent value="body-comp">
            <Tabs value={getSubTab("body-comp") || "data"} onValueChange={handleSubTabChange} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
              </TabsList>
              <TabsContent value="data">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <div>
                    <WeeklyBodyCompCards clientId={selectedUserId!} />
                  </div>
                  <div className="flex flex-col gap-6">
                    <MeasurementsTab measurements={measurements ?? []} logs={logs ?? []} chartOnly clientId={selectedUserId!} />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="photos">
                <ProgressPhotosTab
                  clientId={selectedUserId!}
                  photoType={(clientProfile?.photoType as "standard" | "athlete") ?? "standard"}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Training: Session Log, Exercise Progress, Program, Cardio sub-tabs ── */}
          <TabsContent value="training">
            <Tabs value={getSubTab("training") || "session-log"} onValueChange={handleSubTabChange} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="session-log">Session Log</TabsTrigger>
                <TabsTrigger value="exercise-progress">Exercise Progress</TabsTrigger>
                <TabsTrigger value="program">Program</TabsTrigger>
                <TabsTrigger value="cardio">Cardio &amp; Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="session-log">
                <WorkoutSessionsTab workoutSessions={workoutSessions} />
              </TabsContent>
              <TabsContent value="exercise-progress">
                <ExerciseProgressTab workoutSessions={workoutSessions} exerciseLib={exerciseLib} clientId={selectedUserId!} />
              </TabsContent>
              <TabsContent value="program">
                <div className="space-y-6">
                  <TrainingSection fixedClientId={selectedUserId!} />
                  <ChangeHistoryPanel label="Program Change History">
                    <ProgramChangeLogTab clientId={selectedUserId!} />
                  </ChangeHistoryPanel>
                </div>
              </TabsContent>
              <TabsContent value="cardio">
                <div className="max-w-xl space-y-6">
                  <CardioActivityCard clientId={selectedUserId!} />
                  <ChangeHistoryPanel label="Cardio & Activity Change History">
                    <CardioChangeLogTab clientId={selectedUserId!} />
                  </ChangeHistoryPanel>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Nutrition: Meal Plan (editor) ── */}
          <TabsContent value="nutrition">
            <div className="space-y-4">
              <WeeklyCalorySummary clientId={selectedUserId!} liveTrainingCal={liveTrainingCal} liveRestCal={liveRestCal} />
              <MealPlansSection fixedClientId={selectedUserId!} onLiveTotals={handleLiveTotals} />
              <ChangeHistoryPanel label="Nutrition Change History">
                <MacroPlanHistoryTab clientId={selectedUserId!} />
              </ChangeHistoryPanel>
            </div>
          </TabsContent>


        </Tabs>
      )}
    </div>
  );
}
