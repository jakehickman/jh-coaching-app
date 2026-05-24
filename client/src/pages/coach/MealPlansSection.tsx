import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Check } from "lucide-react";
import { Card, SectionLabel, ClientCombobox, useClientSelector } from "./shared";
import MacroTargetsEditor from "./MacroTargetsEditor";

function FoodCombobox({
  value, onChange, foodNames, onSelectAdvance, mealIdx, itemIdx
}: {
  value: string;
  onChange: (v: string) => void;
  foodNames: string[];
  onSelectAdvance?: () => void;
  mealIdx?: number;
  itemIdx?: number;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const filtered = search.length > 0
    ? foodNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : foodNames.slice(0, 10);

  const selectItem = (name: string) => {
    onChange(name);
    setSearch("");
    setOpen(false);
    setHighlightedIdx(-1);
    setTimeout(() => onSelectAdvance?.(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectItem(filtered[highlightedIdx >= 0 ? highlightedIdx : 0]);
      } else if (e.key === "Escape") {
        setOpen(false);
        setHighlightedIdx(-1);
      } else if (e.key === "Tab") {
        setOpen(false);
        setHighlightedIdx(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelectAdvance?.();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        data-meal={mealIdx}
        data-item={itemIdx}
        data-field="food"
        value={open ? search : value}
        onChange={e => { setSearch(e.target.value); setOpen(true); setHighlightedIdx(-1); }}
        onFocus={() => { setSearch(""); setOpen(true); setHighlightedIdx(-1); }}
        onBlur={() => setTimeout(() => { setOpen(false); setHighlightedIdx(-1); }, 150)}
        onKeyDown={handleKeyDown}
        placeholder="Search food…"
        className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={() => selectItem(name)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                idx === highlightedIdx
                  ? "bg-primary/20 text-primary"
                  : "text-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {open && search.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl px-3 py-2">
          <p className="text-xs text-muted-foreground">No foods match "{search}"</p>
        </div>
      )}
    </div>
  );
}

function calcItemMacros(foodDb: any[], foodName: string, amount: number) {
  const food = foodDb.find(f => f.name === foodName);
  if (!food || !amount) return { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
  // If food has a serving unit, amount = number of servings; convert to grams
  const grams = food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor),
    carbs: Math.round(food.carbs * factor),
    fiber: Math.round(food.fiber * factor),
    fat: Math.round(food.fat * factor),
  };
}
// Helper: get the effective grams for a food item (for display)
function getItemGrams(foodDb: any[], foodName: string, amount: number): number | null {
  const food = foodDb.find(f => f.name === foodName);
  if (!food || !amount) return null;
  return food.servingUnit && food.servingGrams ? Math.round(amount * food.servingGrams) : amount;
}

function MacroChip({ label, value, unit = "g", highlight = false }: { label: string; value: number; unit?: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${highlight ? "bg-primary/15 border border-primary/30" : "bg-secondary/60"}` }>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}{unit === "kcal" ? " kcal" : `g`}</span>
    </div>
  );
}

export default function MealPlansSection({ fixedClientId, onLiveTotals }: { fixedClientId?: number; onLiveTotals?: (dayType: "training" | "rest", calories: number) => void } = {}) {
  const { clients, selectedUserId: selectorUserId, setSelectedUserId } = useClientSelector();
  const selectedUserId = fixedClientId ?? selectorUserId;
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const [dayType, setDayType] = useState<"training" | "rest">("training");

  // Compute which client userIds have an unsaved meal plan draft in localStorage
  const [mealDraftUserIds, setMealDraftUserIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("draft:mealPlan:")) {
        const uid = parseInt(k.split(":")[2] ?? "", 10);
        if (!isNaN(uid)) ids.add(uid);
      }
    }
    return ids;
  });
  useEffect(() => {
    function refreshDraftIds() {
      const ids = new Set<number>();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("draft:mealPlan:")) {
          const uid = parseInt(k.split(":")[2] ?? "", 10);
          if (!isNaN(uid)) ids.add(uid);
        }
      }
      setMealDraftUserIds(ids);
    }
    window.addEventListener("storage", refreshDraftIds);
    window.addEventListener("draft-changed", refreshDraftIds);
    return () => {
      window.removeEventListener("storage", refreshDraftIds);
      window.removeEventListener("draft-changed", refreshDraftIds);
    };
  }, []);
  const { data: plan, refetch } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType },
    { enabled: !!selectedUserId }
  );
  const oppositeDay = dayType === "training" ? "rest" : "training";
  const { data: oppositePlan } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType: oppositeDay },
    { enabled: !!selectedUserId }
  );
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();
  const mealDraftKey = selectedUserId ? `draft:mealPlan:${selectedUserId}:${dayType}` : null;

  const [planNotes, setPlanNotes] = useState("");
  const [meals, setMeals] = useState<any[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Treat allowance — per day type, loaded from meal plan
  const [treatAllowance, setTreatAllowance] = useState("");

  // Snapshot of the last server-saved state — used to detect genuine changes
  const mealSavedSnapshot = useRef<{ planNotes: string; meals: any[] } | null>(null);

  const upsert = trpc.mealPlan.upsert.useMutation({
    onSuccess: () => {
      // Update snapshot to current state and clear draft
      mealSavedSnapshot.current = { planNotes, meals };
      if (mealDraftKey) { try { localStorage.removeItem(mealDraftKey); window.dispatchEvent(new Event("draft-changed")); } catch {} }
      setLastSavedAt(new Date());
      toast.success("Meal plan saved"); refetch();
    }
  });

  // Load server data into state and update snapshot when plan or client/dayType changes
  const mealLoadKey = selectedUserId ? `${selectedUserId}:${dayType}` : null;
  const mealServerLoadedRef = useRef<string | null>(null);
  // Track the previous dayType so we can persist draft before switching
  const prevDayTypeRef = useRef<"training" | "rest">(dayType);
  const prevMealsRef = useRef(meals);
  const prevPlanNotesRef = useRef(planNotes);
  // Keep refs in sync with latest state
  useEffect(() => { prevMealsRef.current = meals; }, [meals]);
  useEffect(() => { prevPlanNotesRef.current = planNotes; }, [planNotes]);

  useEffect(() => {
    if (!mealLoadKey) return;
    // If dayType changed, persist the current in-memory draft for the OLD tab before loading the new one
    if (prevDayTypeRef.current !== dayType && selectedUserId) {
      const oldDraftKey = `draft:mealPlan:${selectedUserId}:${prevDayTypeRef.current}`;
      const snap = mealSavedSnapshot.current;
      const isDirty = snap && (
        prevPlanNotesRef.current !== snap.planNotes ||
        JSON.stringify(prevMealsRef.current) !== JSON.stringify(snap.meals)
      );
      if (isDirty) {
        try { localStorage.setItem(oldDraftKey, JSON.stringify({ planNotes: prevPlanNotesRef.current, meals: prevMealsRef.current })); window.dispatchEvent(new Event("draft-changed")); } catch {}
      }
      prevDayTypeRef.current = dayType;
    }

    if (mealServerLoadedRef.current === mealLoadKey) {
      // Already loaded server data for this key — check if there's a saved draft to restore
      const draftRaw = localStorage.getItem(`draft:mealPlan:${mealLoadKey}`);
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          setPlanNotes(draft.planNotes ?? "");
          setMeals(draft.meals ?? []);
        } catch {}
      }
      return;
    }
    if (plan === undefined) return; // still fetching
    const serverNotes = plan?.notes ?? "";
    const serverMeals = (plan?.meals as any[]) ?? [];
    // Check if there's a saved draft for this tab — prefer it over server data
    const draftRaw = localStorage.getItem(`draft:mealPlan:${mealLoadKey}`);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        setPlanNotes(draft.planNotes ?? serverNotes);
        setMeals(draft.meals ?? serverMeals);
      } catch {
        setPlanNotes(serverNotes);
        setMeals(serverMeals);
      }
    } else {
      setPlanNotes(serverNotes);
      setMeals(serverMeals);
    }
    setTreatAllowance((plan as any)?.treatAllowanceKcal?.toString() ?? "");
    mealSavedSnapshot.current = { planNotes: serverNotes, meals: serverMeals };
    mealServerLoadedRef.current = mealLoadKey;
  }, [plan, mealLoadKey, dayType, selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Write draft only when state genuinely differs from the saved snapshot
  useEffect(() => {
    if (!mealDraftKey || !mealSavedSnapshot.current) return;
    const snap = mealSavedSnapshot.current;
    const isDirty =
      planNotes !== snap.planNotes ||
      JSON.stringify(meals) !== JSON.stringify(snap.meals);
    if (isDirty) {
      try { localStorage.setItem(mealDraftKey, JSON.stringify({ planNotes, meals })); window.dispatchEvent(new Event("draft-changed")); } catch {}
    } else {
      try { localStorage.removeItem(mealDraftKey); window.dispatchEvent(new Event("draft-changed")); } catch {}
    }
  }, [mealDraftKey, planNotes, meals]);

  // Auto-calculate macros from food db
  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const m = calcItemMacros(foodDb, item.food, parseFloat(item.grams) || 0);
      return {
        calories: acc.calories + m.calories,
        protein: Math.round(acc.protein + m.protein),
        carbs: Math.round(acc.carbs + m.carbs),
        fiber: Math.round(acc.fiber + m.fiber),
        fat: Math.round(acc.fat + m.fat),
      };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 })
  );

  const dailyTotals = mealMacros.reduce((acc, m) => ({
    calories: acc.calories + m.calories,
    protein: Math.round(acc.protein + m.protein),
    carbs: Math.round(acc.carbs + m.carbs),
    fiber: Math.round(acc.fiber + m.fiber),
    fat: Math.round(acc.fat + m.fat),
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });

  // Notify parent of live calorie total whenever it changes
  useEffect(() => {
    if (onLiveTotals) onLiveTotals(dayType, dailyTotals.calories + (parseInt(treatAllowance) || 0));
  }, [dailyTotals.calories, dayType, treatAllowance]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = () => {
    if (!selectedUserId || upsert.isPending) return;
    upsert.mutate({
      userId: selectedUserId, dayType, meals,
      totalCalories: dailyTotals.calories || undefined,
      totalProtein: dailyTotals.protein ? Math.round(dailyTotals.protein) : undefined,
      totalCarbs: dailyTotals.carbs ? Math.round(dailyTotals.carbs) : undefined,
      totalFat: dailyTotals.fat ? Math.round(dailyTotals.fat) : undefined,
      notes: planNotes || null,
      treatAllowanceKcal: treatAllowance ? parseInt(treatAllowance) : null,
    });
  };

  // Cmd/Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedUserId, upsert.isPending, dayType, meals, planNotes, dailyTotals]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route-leave guard when there are unsaved changes
  useEffect(() => {
    const isDirty = !!mealDraftKey && !!mealSavedSnapshot.current && (
      planNotes !== mealSavedSnapshot.current.planNotes ||
      JSON.stringify(meals) !== JSON.stringify(mealSavedSnapshot.current.meals)
    );
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [mealDraftKey, planNotes, meals]);

  const addMeal = () => setMeals(m => [...m, { name: `Meal ${m.length + 1}`, time: "", items: [] }]);
  const removeMeal = (i: number) => setMeals(m => m.filter((_, idx) => idx !== i));
  const moveMeal = (from: number, to: number) => setMeals(m => {
    const next = [...m];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // Renumber any meal whose name matches the default "Meal N" pattern
    return next.map((meal, idx) =>
      /^Meal \d+$/.test(meal.name) ? { ...meal, name: `Meal ${idx + 1}` } : meal
    );
  });
  const updateMealName = (i: number, name: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, name } : meal));
  const updateMealTime = (i: number, time: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, time } : meal));
  const addItem = (mealIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: [...(meal.items ?? []), { food: "", grams: "" }] }
    : meal));
  const removeItem = (mealIdx: number, itemIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: meal.items.filter((_: any, i: number) => i !== itemIdx) }
    : meal));
  const updateItem = (mealIdx: number, itemIdx: number, field: string, value: string) =>
    setMeals(m => m.map((meal, idx) => idx === mealIdx
      ? { ...meal, items: meal.items.map((item: any, i: number) => i === itemIdx ? { ...item, [field]: value } : item) }
      : meal));

  const foodNames = foodDb.map(f => f.name).sort();

  // Nutrition mode: meal_plan or macros — optimistic so the toggle is instant
  const utils = trpc.useUtils();
  const { data: nutritionMode = "meal_plan" } = trpc.macroTarget.getMode.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const setModeMutation = trpc.macroTarget.setMode.useMutation({
    onMutate: async ({ userId, mode }) => {
      await utils.macroTarget.getMode.cancel({ userId });
      const prev = utils.macroTarget.getMode.getData({ userId });
      utils.macroTarget.getMode.setData({ userId }, mode);
      return { prev };
    },
    onError: (_err, { userId }, ctx) => {
      if (ctx?.prev !== undefined) utils.macroTarget.getMode.setData({ userId }, ctx.prev);
    },
    onSettled: (_data, _err, { userId }) => {
      utils.macroTarget.getMode.invalidate({ userId });
    },
  });

  return (
    <div className="space-y-6">
      {!fixedClientId && (
        <div>
          <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} draftUserIds={mealDraftUserIds} />
        </div>
      )}

      {selectedUserId && (
        <>
        {/* Mode toggle — matches Training Day / Rest Day style */}
        <div className="flex items-center gap-2">
          {(["meal_plan", "macros"] as const).map(m => (
            <button
              key={m}
              onClick={() => setModeMutation.mutate({ userId: selectedUserId, mode: m })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                nutritionMode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "meal_plan" ? "Meal Plan" : "Macros"}
            </button>
          ))}
        </div>
        </>)}

      {selectedUserId && nutritionMode === "macros" && (
        <MacroTargetsEditor clientId={selectedUserId} />
      )}

      {selectedUserId && nutritionMode === "meal_plan" && (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            {(["training", "rest"] as const).map(t => (
              <button key={t} onClick={() => setDayType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                {t === "training" ? "Training Day" : "Rest Day"}
              </button>
            ))}
            {oppositePlan && (oppositePlan.meals as any[])?.length > 0 && (
              <button
                onClick={() => {
                  if (!window.confirm(`Copy meals from ${oppositeDay} day plan? This will replace the current meals.`)) return;
                  setMeals(JSON.parse(JSON.stringify((oppositePlan.meals as any[]) ?? [])));
                  setPlanNotes(oppositePlan.notes ?? "");
                  toast.success(`Copied from ${oppositeDay} day plan`);
                }}
                className="ml-auto px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                Copy from {oppositeDay} day
              </button>
            )}
          </div>

          {/* Daily totals — removed inline strip; sticky right panel handles this */}

          <div className="space-y-4">
            {meals.map((meal, i) => (
              <Card key={i}>
                <div className="flex items-center gap-2 mb-3">
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
                  <input type="text" value={meal.name} onChange={e => updateMealName(i, e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="time" value={meal.time ?? ""} onChange={e => updateMealTime(i, e.target.value)}
                    className="w-32 bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => removeMeal(i)} className="text-destructive hover:opacity-80">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5 mb-1">
                    <p className="flex-1 text-[13px] text-muted-foreground">Food</p>
                    <p className="w-16 text-[13px] text-muted-foreground text-right">Amount</p>
                    <p className="w-28 text-[13px] text-muted-foreground">Unit</p>
                    <p className="w-24 text-[13px] text-muted-foreground">Macros</p>
                    <p className="w-4"></p>
                  </div>
                  {(meal.items ?? []).map((item: any, j: number) => {
                    const selectedFood = foodDb.find(f => f.name === item.food);
                    const isServingBased = !!(selectedFood?.servingUnit && selectedFood?.servingGrams);
                    const amount = parseFloat(item.grams) || 0;
                    const m = calcItemMacros(foodDb, item.food, amount);
                    const hasData = item.food && amount > 0;
                    const effectiveGrams = isServingBased ? getItemGrams(foodDb, item.food, amount) : null;
                    const totalItems = (meal.items ?? []).length;
                    const isLastItem = j === totalItems - 1;
                    const focusNextFoodInput = () => {
                      if (isLastItem) {
                        addItem(i);
                        setTimeout(() => {
                          const next = document.querySelector<HTMLInputElement>(
                            `[data-meal="${i}"][data-item="${j + 1}"][data-field="food"]`
                          );
                          next?.focus();
                        }, 50);
                      } else {
                        const next = document.querySelector<HTMLInputElement>(
                          `[data-meal="${i}"][data-item="${j + 1}"][data-field="food"]`
                        );
                        next?.focus();
                      }
                    };
                    const focusQtyInput = () => {
                      const qty = document.querySelector<HTMLInputElement>(
                        `[data-meal="${i}"][data-item="${j}"][data-field="qty"]`
                      );
                      qty?.focus();
                    };
                    return (
                      <div key={j} className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <FoodCombobox
                            value={item.food}
                            onChange={v => updateItem(i, j, "food", v)}
                            foodNames={foodNames}
                            onSelectAdvance={focusQtyInput}
                            mealIdx={i}
                            itemIdx={j}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" min="0" step={isServingBased ? "0.5" : "1"}
                            data-meal={i}
                            data-item={j}
                            data-field="qty"
                            value={item.grams}
                            onChange={e => updateItem(i, j, "grams", e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusNextFoodInput(); } }}
                            className="w-16 bg-secondary border border-border rounded px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-right"
                          />
                          <div className="text-[13px] text-muted-foreground w-28 leading-tight">
                            <span className="whitespace-nowrap">{isServingBased ? selectedFood.servingUnit : "g"}</span>
                            {isServingBased && effectiveGrams ? <span className="whitespace-nowrap text-muted-foreground/60"> ({effectiveGrams}g)</span> : null}
                          </div>
                        </div>
                        <div className="w-24 shrink-0 text-[10px] leading-tight">
                          {hasData ? (
                            <>
                              <span className="text-foreground font-medium text-[13px]">{m.calories} kcal</span>
                              <div className="text-muted-foreground text-[13px]">P{m.protein} C{m.carbs} F{m.fat}</div>
                            </>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </div>
                        <button onClick={() => removeItem(i, j)} className="shrink-0 text-destructive hover:opacity-80">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <button onClick={() => addItem(i)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                {/* Meal subtotal — smaller/muted to distinguish from Daily Totals */}
                {(meal.items ?? []).some((it: any) => it.food && parseFloat(it.grams) > 0) && (
                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Meal</span>
                    <span className="text-[13px] font-semibold text-primary/80">{mealMacros[i].calories} kcal</span>
                    <span className="text-[13px] text-muted-foreground">P{mealMacros[i].protein}</span>
                    <span className="text-[13px] text-muted-foreground">C{mealMacros[i].carbs}</span>
                    <span className="text-[13px] text-muted-foreground">F{mealMacros[i].fat}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <button onClick={addMeal}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center">
            <Plus size={14} /> Add Meal
          </button>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Notes</label>
            <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} rows={2}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {/* Treat allowance */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Free Calories
              </label>
              <input
                type="number"
                min={0}
                value={treatAllowance}
                onChange={e => setTreatAllowance(e.target.value)}
                placeholder=""
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => {
                if (!selectedUserId) return;
                doSave();
              }}
              disabled={upsert.isPending}
              className="px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              Save
            </button>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={doSave}
              disabled={upsert.isPending}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={15} />
              {upsert.isPending ? "Saving..." : "Save Meal Plan"}
            </button>
            {lastSavedAt && (
              <p className="text-center text-[11px] text-muted-foreground">
                Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>{/* end left column */}

        {/* Right column: macro summary sticky panel */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            {meals.length > 0 ? (
              <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Daily Totals</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Calories</p>
                  <p className="text-xl font-bold text-primary">{dailyTotals.calories + (parseInt(treatAllowance) || 0)} <span className="text-xs font-normal">kcal</span></p>
                </div>
                {[{l:'Protein',v:dailyTotals.protein},{l:'Carbs',v:dailyTotals.carbs},{l:'Fiber',v:dailyTotals.fiber},{l:'Fat',v:dailyTotals.fat}].map(({l,v}) => (
                  <div key={l} className="bg-secondary rounded-lg px-2 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
                    <p className="text-sm font-bold text-foreground">{v}g</p>
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
      )}
    </div>
  );
}


