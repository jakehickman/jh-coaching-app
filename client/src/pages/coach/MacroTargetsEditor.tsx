import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "./shared";

interface MacroMeal {
  id?: string;
  name: string;
  time?: string;
  caloriesMin?: number | null;
  caloriesMax?: number | null;
  proteinMin?: number | null;
  proteinMax?: number | null;
  carbsMin?: number | null;
  carbsMax?: number | null;
  fatMin?: number | null;
  fatMax?: number | null;
}

function numOrNull(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function MacroRangeInput({
  label,
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  unit = "g",
  highlight = false,
}: {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-[10px] uppercase tracking-wider font-semibold ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        {label} <span className="font-normal text-muted-foreground/60">({unit})</span>
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={minVal}
          onChange={e => onMinChange(e.target.value)}
          placeholder="min"
          className="w-16 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <input
          type="number"
          min={0}
          value={maxVal}
          onChange={e => onMaxChange(e.target.value)}
          placeholder="max"
          className="w-16 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

function mealToState(meal: MacroMeal) {
  return {
    id: meal.id ?? crypto.randomUUID(),
    name: meal.name,
    time: meal.time ?? "",
    caloriesMin: meal.caloriesMin?.toString() ?? "",
    caloriesMax: meal.caloriesMax?.toString() ?? "",
    proteinMin: meal.proteinMin?.toString() ?? "",
    proteinMax: meal.proteinMax?.toString() ?? "",
    carbsMin: meal.carbsMin?.toString() ?? "",
    carbsMax: meal.carbsMax?.toString() ?? "",
    fatMin: meal.fatMin?.toString() ?? "",
    fatMax: meal.fatMax?.toString() ?? "",
  };
}

function stateToMeal(s: ReturnType<typeof mealToState>): MacroMeal {
  return {
    id: s.id,
    name: s.name,
    time: s.time || undefined,
    caloriesMin: numOrNull(s.caloriesMin),
    caloriesMax: numOrNull(s.caloriesMax),
    proteinMin: numOrNull(s.proteinMin),
    proteinMax: numOrNull(s.proteinMax),
    carbsMin: numOrNull(s.carbsMin),
    carbsMax: numOrNull(s.carbsMax),
    fatMin: numOrNull(s.fatMin),
    fatMax: numOrNull(s.fatMax),
  };
}

type MealState = ReturnType<typeof mealToState>;

export default function MacroTargetsEditor({ clientId }: { clientId: number }) {
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: targetData, refetch } = trpc.macroTarget.getForClient.useQuery(
    { userId: clientId, dayType },
    { enabled: !!clientId }
  );
  const oppositeDay = dayType === "training" ? "rest" : "training";
  const { data: oppositeTargetData } = trpc.macroTarget.getForClient.useQuery(
    { userId: clientId, dayType: oppositeDay },
    { enabled: !!clientId }
  );

  const [meals, setMeals] = useState<MealState[]>([]);
  const [notes, setNotes] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const loadedRef = useRef<string | null>(null);

  const loadKey = `${clientId}:${dayType}`;

  useEffect(() => {
    if (loadedRef.current === loadKey) return;
    if (targetData === undefined) return;
    const serverMeals = (targetData?.meals as MacroMeal[] | null) ?? [];
    setMeals(serverMeals.map(mealToState));
    setNotes(targetData?.notes ?? "");
    loadedRef.current = loadKey;
  }, [targetData, loadKey]);

  // Reset when client or dayType changes
  useEffect(() => {
    loadedRef.current = null;
  }, [clientId, dayType]);

  const upsert = trpc.macroTarget.upsert.useMutation({
    onSuccess: () => {
      setLastSavedAt(new Date());
      toast.success("Macro targets saved");
      refetch();
    },
    onError: () => toast.error("Failed to save macro targets"),
  });

  const doSave = () => {
    if (upsert.isPending) return;
    upsert.mutate({
      userId: clientId,
      dayType,
      meals: meals.map(stateToMeal),
      notes: notes || null,
    });
  };

  // Cmd/Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clientId, dayType, meals, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMeal = () =>
    setMeals(m => [
      ...m,
      mealToState({ name: `Meal ${m.length + 1}`, time: "" }),
    ]);

  const removeMeal = (i: number) => setMeals(m => m.filter((_, idx) => idx !== i));

  const moveMeal = (from: number, to: number) =>
    setMeals(m => {
      const next = [...m];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Renumber any meal whose name matches the default "Meal N" pattern
      return next.map((meal, idx) =>
        /^Meal \d+$/.test(meal.name) ? { ...meal, name: `Meal ${idx + 1}` } : meal
      );
    });

  const updateMeal = (i: number, field: keyof MealState, value: string) =>
    setMeals(m => m.map((meal, idx) => (idx === i ? { ...meal, [field]: value } : meal)));

  // Daily totals (min/max sums)
  const totals = meals.reduce(
    (acc, m) => ({
      calMin: acc.calMin + (parseFloat(m.caloriesMin) || 0),
      calMax: acc.calMax + (parseFloat(m.caloriesMax) || 0),
      proMin: acc.proMin + (parseFloat(m.proteinMin) || 0),
      proMax: acc.proMax + (parseFloat(m.proteinMax) || 0),
      carbMin: acc.carbMin + (parseFloat(m.carbsMin) || 0),
      carbMax: acc.carbMax + (parseFloat(m.carbsMax) || 0),
      fatMin: acc.fatMin + (parseFloat(m.fatMin) || 0),
      fatMax: acc.fatMax + (parseFloat(m.fatMax) || 0),
    }),
    { calMin: 0, calMax: 0, proMin: 0, proMax: 0, carbMin: 0, carbMax: 0, fatMin: 0, fatMax: 0 }
  );

  const hasTotals = meals.length > 0;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
      <div className="space-y-6">
        {/* Day type toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["training", "rest"] as const).map(t => (
            <button
              key={t}
              onClick={() => setDayType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                dayType === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "training" ? "Training Day" : "Rest Day"}
            </button>
          ))}
          {oppositeTargetData && (oppositeTargetData.meals as MacroMeal[] | null)?.length ? (
            <button
              onClick={() => {
                if (!window.confirm(`Copy meals from ${oppositeDay} day? This will replace the current meals.`)) return;
                setMeals(((oppositeTargetData.meals as MacroMeal[]) ?? []).map(mealToState));
                setNotes(oppositeTargetData.notes ?? "");
                toast.success(`Copied from ${oppositeDay} day`);
              }}
              className="ml-auto px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              Copy from {oppositeDay} day
            </button>
          ) : null}
        </div>

        {/* Daily totals summary */}
        {hasTotals && (
          <Card>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals (min – max)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Calories", min: totals.calMin, max: totals.calMax, unit: "kcal", highlight: true },
                { label: "Protein", min: totals.proMin, max: totals.proMax, unit: "g" },
                { label: "Carbs", min: totals.carbMin, max: totals.carbMax, unit: "g" },
                { label: "Fat", min: totals.fatMin, max: totals.fatMax, unit: "g" },
              ].map(({ label, min, max, unit, highlight }) => (
                <div
                  key={label}
                  className={`rounded-lg px-3 py-2 text-center ${
                    highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary"
                  }`}
                >
                  <p className={`text-[10px] uppercase tracking-wider ${highlight ? "text-primary/70" : "text-muted-foreground"}`}>{label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${highlight ? "text-primary" : "text-foreground"}`}>
                    {min > 0 || max > 0 ? `${min} – ${max}` : "—"} <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Meal cards */}
        <div className="space-y-4">
          {meals.map((meal, i) => (
            <Card key={meal.id}>
              {/* Meal header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => i > 0 && moveMeal(i, i - 1)} disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none">
                    <ArrowUp size={12} />
                  </button>
                  <button onClick={() => i < meals.length - 1 && moveMeal(i, i + 1)} disabled={i === meals.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none">
                    <ArrowDown size={12} />
                  </button>
                </div>
                <input
                  type="text"
                  value={meal.name}
                  onChange={e => updateMeal(i, "name", e.target.value)}
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="time"
                  value={meal.time}
                  onChange={e => updateMeal(i, "time", e.target.value)}
                  className="w-28 bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={() => removeMeal(i)} className="text-destructive hover:opacity-80">
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Macro range inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MacroRangeInput
                  label="Calories"
                  unit="kcal"
                  highlight
                  minVal={meal.caloriesMin}
                  maxVal={meal.caloriesMax}
                  onMinChange={v => updateMeal(i, "caloriesMin", v)}
                  onMaxChange={v => updateMeal(i, "caloriesMax", v)}
                />
                <MacroRangeInput
                  label="Protein"
                  minVal={meal.proteinMin}
                  maxVal={meal.proteinMax}
                  onMinChange={v => updateMeal(i, "proteinMin", v)}
                  onMaxChange={v => updateMeal(i, "proteinMax", v)}
                />
                <MacroRangeInput
                  label="Carbs"
                  minVal={meal.carbsMin}
                  maxVal={meal.carbsMax}
                  onMinChange={v => updateMeal(i, "carbsMin", v)}
                  onMaxChange={v => updateMeal(i, "carbsMax", v)}
                />
                <MacroRangeInput
                  label="Fat"
                  minVal={meal.fatMin}
                  maxVal={meal.fatMax}
                  onMinChange={v => updateMeal(i, "fatMin", v)}
                  onMaxChange={v => updateMeal(i, "fatMax", v)}
                />
              </div>
            </Card>
          ))}
        </div>

        <button
          onClick={addMeal}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center"
        >
          <Plus size={14} /> Add Meal
        </button>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <button
            onClick={doSave}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {upsert.isPending ? "Saving..." : "Save Macro Targets"}
          </button>
          {lastSavedAt && (
            <p className="text-center text-[11px] text-muted-foreground">
              Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Right column: sticky summary */}
      <div className="space-y-4 mt-6 lg:mt-0">
        <Card className="sticky top-20">
          {hasTotals ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Daily Totals</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Calories</p>
                  <p className="text-xl font-bold text-primary">
                    {totals.calMin > 0 || totals.calMax > 0 ? `${totals.calMin} – ${totals.calMax}` : "—"}
                    <span className="text-xs font-normal ml-1">kcal</span>
                  </p>
                </div>
                {[
                  { l: "Protein", min: totals.proMin, max: totals.proMax },
                  { l: "Carbs", min: totals.carbMin, max: totals.carbMax },
                  { l: "Fat", min: totals.fatMin, max: totals.fatMax },
                ].map(({ l, min, max }) => (
                  <div key={l} className="bg-secondary rounded-lg px-2 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
                    <p className="text-sm font-bold text-foreground">
                      {min > 0 || max > 0 ? `${min} – ${max}g` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Add meals to see daily totals</p>
          )}
        </Card>
      </div>
    </div>
  );
}
