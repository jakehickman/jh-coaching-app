import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "./shared";
import { Button } from "@/components/ui/button";

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
  label, minVal, maxVal, onMinChange, onMaxChange, unit = "g", highlight = false,
}: {
  label: string; minVal: string; maxVal: string;
  onMinChange: (v: string) => void; onMaxChange: (v: string) => void;
  unit?: string; highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs uppercase tracking-wider font-semibold ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        {label} <span className="font-normal text-muted-foreground/50">({unit})</span>
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number" min={0} value={minVal} onChange={e => onMinChange(e.target.value)} placeholder="min"
          className="w-16 bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <input
          type="number" min={0} value={maxVal} onChange={e => onMaxChange(e.target.value)} placeholder="max"
          className="w-16 bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
    id: s.id, name: s.name, time: s.time || undefined,
    caloriesMin: numOrNull(s.caloriesMin), caloriesMax: numOrNull(s.caloriesMax),
    proteinMin: numOrNull(s.proteinMin), proteinMax: numOrNull(s.proteinMax),
    carbsMin: numOrNull(s.carbsMin), carbsMax: numOrNull(s.carbsMax),
    fatMin: numOrNull(s.fatMin), fatMax: numOrNull(s.fatMax),
  };
}

type MealState = ReturnType<typeof mealToState>;

export default function MacroTargetsEditor({
  clientId,
  dayType,
  onDayTypeChange,
}: {
  clientId: number;
  dayType: "training" | "rest";
  onDayTypeChange?: (v: "training" | "rest") => void;
}) {
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

  useEffect(() => { loadedRef.current = null; }, [clientId, dayType]);

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
    upsert.mutate({ userId: clientId, dayType, meals: meals.map(stateToMeal), notes: notes || null });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); doSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clientId, dayType, meals, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMeal = () => setMeals(m => [...m, mealToState({ name: `Meal ${m.length + 1}`, time: "" })]);
  const removeMeal = (i: number) => setMeals(m => m.filter((_, idx) => idx !== i));
  const moveMeal = (from: number, to: number) => setMeals(m => {
    const next = [...m];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next.map((meal, idx) => /^Meal \d+$/.test(meal.name) ? { ...meal, name: `Meal ${idx + 1}` } : meal);
  });
  const updateMeal = (i: number, field: keyof MealState, value: string) =>
    setMeals(m => m.map((meal, idx) => (idx === i ? { ...meal, [field]: value } : meal)));

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
      {/* Left column */}
      <div className="space-y-4">
        {/* Meal cards */}
        {meals.map((meal, i) => (
          <Card key={meal.id}>
            {/* Card header */}
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-border/50">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => i > 0 && moveMeal(i, i - 1)} disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none p-0.5">
                  <ArrowUp size={12} />
                </button>
                <button onClick={() => i < meals.length - 1 && moveMeal(i, i + 1)} disabled={i === meals.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none p-0.5">
                  <ArrowDown size={12} />
                </button>
              </div>
              <input
                type="text" value={meal.name} onChange={e => updateMeal(i, "name", e.target.value)}
                className="flex-1 bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
              />
              <input
                type="time" value={meal.time} onChange={e => updateMeal(i, "time", e.target.value)}
                className="w-28 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={() => removeMeal(i)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Macro range inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MacroRangeInput label="Calories" unit="kcal" highlight
                minVal={meal.caloriesMin} maxVal={meal.caloriesMax}
                onMinChange={v => updateMeal(i, "caloriesMin", v)} onMaxChange={v => updateMeal(i, "caloriesMax", v)} />
              <MacroRangeInput label="Protein"
                minVal={meal.proteinMin} maxVal={meal.proteinMax}
                onMinChange={v => updateMeal(i, "proteinMin", v)} onMaxChange={v => updateMeal(i, "proteinMax", v)} />
              <MacroRangeInput label="Carbs"
                minVal={meal.carbsMin} maxVal={meal.carbsMax}
                onMinChange={v => updateMeal(i, "carbsMin", v)} onMaxChange={v => updateMeal(i, "carbsMax", v)} />
              <MacroRangeInput label="Fat"
                minVal={meal.fatMin} maxVal={meal.fatMax}
                onMinChange={v => updateMeal(i, "fatMin", v)} onMaxChange={v => updateMeal(i, "fatMax", v)} />
            </div>
          </Card>
        ))}

        {/* Add Meal */}
        <Button variant="ghost" size="sm" onClick={addMeal} className="text-primary hover:text-primary/80 px-0">
          <Plus size={14} /> Add Meal
        </Button>

        {/* Notes card */}
        <Card>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </Card>

        {/* Save button */}
        <div className="space-y-1.5">
          <Button onClick={doSave} disabled={upsert.isPending} className="w-full">
            <Save size={15} />
            {upsert.isPending ? "Saving…" : "Save Macro Targets"}
          </Button>
          {lastSavedAt && (
            <p className="text-center text-xs text-muted-foreground">
              Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Right column: sticky Daily Totals */}
      <div>
        <Card className="sticky top-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Daily Totals</p>
          {hasTotals ? (
            <div className="space-y-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-3 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Calories</p>
                <p className="text-2xl font-bold text-primary leading-none">
                  {totals.calMin > 0 || totals.calMax > 0 ? `${totals.calMin} – ${totals.calMax}` : "—"}
                  <span className="text-xs font-normal ml-1">kcal</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Protein", min: totals.proMin, max: totals.proMax },
                  { l: "Carbs", min: totals.carbMin, max: totals.carbMax },
                  { l: "Fat", min: totals.fatMin, max: totals.fatMax },
                ].map(({ l, min, max }) => (
                  <div key={l} className="bg-secondary rounded-lg px-2 py-2 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{l}</p>
                    <p className="text-sm font-bold text-foreground">
                      {min > 0 || max > 0 ? `${min} – ${max}g` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Add meals to see daily totals</p>
          )}
        </Card>
      </div>
    </div>
  );
}
