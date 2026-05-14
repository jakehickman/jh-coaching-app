import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { Check, Candy } from "lucide-react"; // Candy used for treat allowance card
import { SectionLabel, Card } from "./shared";
import { useViewAs } from "@/contexts/ViewAsContext";

// ─── MacroTargetsView ─────────────────────────────────────────────────────────
function MacroTargetsView() {
  const { viewAsUserId } = useViewAs();
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: targetOwn } = trpc.macroTarget.get.useQuery({ dayType }, { enabled: !viewAsUserId });
  const { data: targetAdmin } = trpc.macroTarget.getForClient.useQuery(
    { userId: viewAsUserId!, dayType },
    { enabled: !!viewAsUserId }
  );
  const target = viewAsUserId ? targetAdmin : targetOwn;
  const meals = (target?.meals as any[]) ?? [];

  // Daily totals
  const totals = meals.reduce(
    (acc: any, m: any) => ({
      calMin: acc.calMin + (m.caloriesMin ?? 0),
      calMax: acc.calMax + (m.caloriesMax ?? 0),
      proMin: acc.proMin + (m.proteinMin ?? 0),
      proMax: acc.proMax + (m.proteinMax ?? 0),
      carbMin: acc.carbMin + (m.carbsMin ?? 0),
      carbMax: acc.carbMax + (m.carbsMax ?? 0),
      fatMin: acc.fatMin + (m.fatMin ?? 0),
      fatMax: acc.fatMax + (m.fatMax ?? 0),
    }),
    { calMin: 0, calMax: 0, proMin: 0, proMax: 0, carbMin: 0, carbMax: 0, fatMin: 0, fatMax: 0 }
  );

  function fmtRange(min: number, max: number, unit: string) {
    if (min === 0 && max === 0) return "—";
    if (min === max) return `${min}${unit}`;
    return `${min} – ${max}${unit}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["training", "rest"] as const).map(t => (
          <button key={t} onClick={() => setDayType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {t === "training" ? "Training Day" : "Rest Day"}
          </button>
        ))}
      </div>

      {target && meals.length > 0 && (
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 bg-primary/15 border border-primary/30 rounded-lg px-3 py-2 text-center">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Calories</span>
              <span className="text-lg font-bold text-primary">{fmtRange(totals.calMin, totals.calMax, " kcal")}</span>
            </div>
            {[
              { label: "Protein", min: totals.proMin, max: totals.proMax },
              { label: "Carbs", min: totals.carbMin, max: totals.carbMax },
              { label: "Fat", min: totals.fatMin, max: totals.fatMax },
            ].map(({ label, min, max }) => (
              <div key={label} className="bg-secondary/60 rounded-lg px-2 py-2 text-center">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">{label}</span>
                <span className="text-sm font-bold text-foreground">{fmtRange(min, max, "g")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {meals.length > 0 ? (
        <div className="space-y-4">
          {meals.map((meal: any, i: number) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">{meal.name ?? `Meal ${i + 1}`}</p>
                {meal.time && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                    {(() => { try { const [h, m] = meal.time.split(":"); const d = new Date(); d.setHours(+h, +m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return meal.time; } })()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "Calories", min: meal.caloriesMin, max: meal.caloriesMax, unit: " kcal", highlight: true },
                  { label: "Protein", min: meal.proteinMin, max: meal.proteinMax, unit: "g" },
                  { label: "Carbs", min: meal.carbsMin, max: meal.carbsMax, unit: "g" },
                  { label: "Fat", min: meal.fatMin, max: meal.fatMax, unit: "g" },
                ] as { label: string; min: number | null; max: number | null; unit: string; highlight?: boolean }[]).map(({ label, min, max, unit, highlight }) => (
                  <div key={label} className={`rounded-lg px-2 py-2 text-center ${ highlight ? "col-span-2 bg-primary/10 border border-primary/20" : "bg-secondary/60" }`}>
                    <span className={`text-[9px] uppercase tracking-wider block ${ highlight ? "text-primary/70" : "text-muted-foreground" }`}>{label}</span>
                    <span className={`text-sm font-bold ${ highlight ? "text-primary" : "text-foreground" }`}>
                      {fmtRange(min ?? 0, max ?? 0, unit)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="text-muted-foreground text-sm">No macro targets set for {dayType} days yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your macro targets here.</p>
        </Card>
      )}

      {target?.notes && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
          <p className="text-sm text-foreground">{target.notes}</p>
        </Card>
      )}
    </div>
  );
}

const SHOPPING_CHECKED_KEY = "jh_shopping_checked";

// ─── MealPlanTab ────────────────────────────────────────────────────────────────────────────────
function MealPlanTab() {
  const { viewAsUserId } = useViewAs();
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  // Check nutrition mode
  const { data: nutritionMode = "meal_plan" } = viewAsUserId
    ? trpc.macroTarget.getMode.useQuery({ userId: viewAsUserId })
    : trpc.macroTarget.getMyMode.useQuery();
  const { data: planOwn } = trpc.mealPlan.get.useQuery({ dayType }, { enabled: !viewAsUserId });
  const { data: planAdmin } = trpc.mealPlan.getForClient.useQuery({ userId: viewAsUserId!, dayType }, { enabled: !!viewAsUserId });
  const plan = viewAsUserId ? planAdmin : planOwn;

  if (nutritionMode === "macros") return <MacroTargetsView />;
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();
  const treatAllowanceKcal = (plan as any)?.treatAllowanceKcal as number | null | undefined;

  const meals = (plan?.meals as any[]) ?? [];

  function itemToGrams(food: any, amount: number): number {
    if (!food) return amount;
    return food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  }

  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const food = foodDb.find((f: any) => f.name === item.food);
      if (!food || !parseFloat(item.grams)) return acc;
      const grams = itemToGrams(food, parseFloat(item.grams));
      const factor = grams / 100;
      return {
        calories: acc.calories + Math.round(food.calories * factor),
        protein: Math.round(acc.protein + food.protein * factor),
        carbs: Math.round(acc.carbs + food.carbs * factor),
        fiber: Math.round(acc.fiber + food.fiber * factor),
        fat: Math.round(acc.fat + food.fat * factor),
      };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 })
  );
  const dailyTotals = mealMacros.reduce((acc: any, m: any) => ({
    calories: acc.calories + m.calories,
    protein: Math.round(acc.protein + m.protein),
    carbs: Math.round(acc.carbs + m.carbs),
    fiber: Math.round(acc.fiber + m.fiber),
    fat: Math.round(acc.fat + m.fat),
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["training", "rest"] as const).map(t => (
          <button key={t} onClick={() => setDayType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {t === "training" ? "Training Day" : "Rest Day"}
          </button>
        ))}
      </div>

      {plan && (
        <div className="space-y-4">
          {meals.length > 0 && dailyTotals.calories > 0 && (
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Calories", value: dailyTotals.calories + (treatAllowanceKcal ?? 0), unit: "kcal", highlight: true },
                  { label: "Protein", value: dailyTotals.protein, unit: "g" },
                  { label: "Carbs", value: dailyTotals.carbs, unit: "g" },
                  { label: "Fiber", value: dailyTotals.fiber, unit: "g" },
                  { label: "Fat", value: dailyTotals.fat, unit: "g" },
                ].map(({ label, value, unit, highlight }) => (
                  <div key={label} className={`flex flex-col items-center px-2 py-2 rounded-lg ${ highlight ? "bg-primary/15 border border-primary/30" : "bg-secondary/60" }`}>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
                    <span className={`text-sm font-bold mt-0.5 ${ highlight ? "text-primary" : "text-foreground" }`}>{value} {unit}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {meals.length > 0 ? (
            <div className="space-y-4">
              {meals.map((meal: any, i: number) => {
                const mm = mealMacros[i];
                const hasMacros = mm.calories > 0;
                return (
                  <Card key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">{meal.name ?? `Meal ${i + 1}`}</p>
                      {meal.time && (
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                          {(() => { try { const [h, m] = meal.time.split(":"); const d = new Date(); d.setHours(+h, +m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return meal.time; } })()}
                        </span>
                      )}
                    </div>
                    {[...(meal.items ?? [])].sort((a: any, b: any) => {
                        const fa = foodDb.find((f: any) => f.name === a.food);
                        const fb = foodDb.find((f: any) => f.name === b.food);
                        const gaRaw = parseFloat(a.grams) || 0;
                        const gbRaw = parseFloat(b.grams) || 0;
                        const gaG = fa ? (fa.servingGrams ? gaRaw * fa.servingGrams : gaRaw) : gaRaw;
                        const gbG = fb ? (fb.servingGrams ? gbRaw * fb.servingGrams : gbRaw) : gbRaw;
                        const pA = fa ? (fa.protein * gaG / 100) : 0;
                        const pB = fb ? (fb.protein * gbG / 100) : 0;
                        if (pB !== pA) return pB - pA;
                        return gbG - gaG;
                      }).map((item: any, j: number) => {
                      const food = foodDb.find((f: any) => f.name === item.food);
                      const rawAmount = parseFloat(item.grams) || 0;
                      const effectiveGrams = food ? itemToGrams(food, rawAmount) : rawAmount;
                      const factor = effectiveGrams / 100;
                      const isServingBased = !!(food?.servingUnit && food?.servingGrams);
                      const displayQty = isServingBased
                        ? `${rawAmount} ${food.servingUnit}${rawAmount !== 1 ? "s" : ""} (${effectiveGrams}g)`
                        : rawAmount > 0 ? `${rawAmount}g` : "";
                      const itemCal = food && rawAmount ? Math.round(food.calories * factor) : null;
                      const itemP = food && rawAmount ? Math.round(food.protein * factor * 10) / 10 : null;
                      const itemC = food && rawAmount ? Math.round(food.carbs * factor * 10) / 10 : null;
                      const itemF = food && rawAmount ? Math.round(food.fat * factor * 10) / 10 : null;
                      return (
                        <div key={j} className="py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-foreground">{item.food || <span className="text-muted-foreground italic">Unknown food</span>}</p>
                            <p className="text-xs text-muted-foreground">{displayQty}</p>
                          </div>
                          {itemCal !== null && (
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-xs font-medium text-foreground">{itemCal} kcal</span>
                              <span className="text-xs text-muted-foreground">P {itemP}g</span>
                              <span className="text-xs text-muted-foreground">C {itemC}g</span>
                              <span className="text-xs text-muted-foreground">F {itemF}g</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {hasMacros && (
                      <div className="mt-3 pt-2 border-t border-border/40">
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground self-center">Total:</span>
                          <span className="text-xs font-semibold text-primary">{mm.calories} kcal</span>
                          <span className="text-xs text-muted-foreground">P {mm.protein}g</span>
                          <span className="text-xs text-muted-foreground">C {mm.carbs}g</span>
                          <span className="text-xs text-muted-foreground">Fiber {mm.fiber}g</span>
                          <span className="text-xs text-muted-foreground">F {mm.fat}g</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-8">
              <p className="text-muted-foreground text-sm">No meal plan set for {dayType} days yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan here.</p>
            </Card>
          )}

          {plan.notes && (
            <Card>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
              <p className="text-sm text-foreground">{plan.notes}</p>
            </Card>
          )}

          {!!treatAllowanceKcal && (
            <Card className="border-pink-500/20 bg-pink-500/5">
              <div className="flex items-center gap-2 mb-1">
                <Candy size={14} className="text-pink-400" />
                <p className="text-[10px] text-pink-400 uppercase tracking-wider font-semibold">
                  {dayType === "training" ? "Training Day" : "Rest Day"} Free Calories
                </p>
              </div>
              <p className="text-sm text-foreground">
                You have <span className="font-bold text-pink-400">{treatAllowanceKcal} kcal</span> to spend on whatever you like.
              </p>
            </Card>
          )}
        </div>
      )}

      {!plan && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No meal plan set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan here.</p>
        </Card>
      )}
    </div>
  );
}

// ─── ShoppingListTab ──────────────────────────────────────────────────────────
function ShoppingListTab() {
  const [trainingDays, setTrainingDays] = useState(4);
  const [restDays, setRestDays] = useState(3);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SHOPPING_CHECKED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SHOPPING_CHECKED_KEY, JSON.stringify(checked));
    } catch {}
  }, [checked]);

  function toggleItem(name: string) {
    setChecked(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function uncheckAll() {
    setChecked({});
  }

  const { viewAsUserId } = useViewAs();
  const { data: trainingPlanOwn } = trpc.mealPlan.get.useQuery({ dayType: "training" }, { enabled: !viewAsUserId });
  const { data: trainingPlanAdmin } = trpc.mealPlan.getForClient.useQuery({ userId: viewAsUserId!, dayType: "training" }, { enabled: !!viewAsUserId });
  const trainingPlan = viewAsUserId ? trainingPlanAdmin : trainingPlanOwn;
  const { data: restPlanOwn } = trpc.mealPlan.get.useQuery({ dayType: "rest" }, { enabled: !viewAsUserId });
  const { data: restPlanAdmin } = trpc.mealPlan.getForClient.useQuery({ userId: viewAsUserId!, dayType: "rest" }, { enabled: !!viewAsUserId });
  const restPlan = viewAsUserId ? restPlanAdmin : restPlanOwn;
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();

  function itemToGrams(food: any, amount: number): number {
    if (!food) return amount;
    return food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  }

  const shoppingMap = useMemo(() => {
    const map: Record<string, { totalGrams: number; food: any }> = {};

    const addItems = (plan: any, multiplier: number) => {
      if (!plan || multiplier === 0) return;
      const meals = (plan.meals as any[]) ?? [];
      meals.forEach(meal => {
        (meal.items ?? []).forEach((item: any) => {
          if (!item.food || !parseFloat(item.grams)) return;
          const food = foodDb.find((f: any) => f.name === item.food);
          const grams = itemToGrams(food, parseFloat(item.grams)) * multiplier;
          if (!map[item.food]) map[item.food] = { totalGrams: 0, food };
          map[item.food].totalGrams += grams;
        });
      });
    };

    addItems(trainingPlan, trainingDays);
    addItems(restPlan, restDays);
    return map;
  }, [trainingPlan, restPlan, foodDb, trainingDays, restDays]);

  const items = Object.entries(shoppingMap).sort(([a], [b]) => a.localeCompare(b));
  const checkedCount = items.filter(([name]) => checked[name]).length;

  function formatQty(name: string, totalGrams: number, food: any): string {
    if (food?.servingUnit && food?.servingGrams) {
      const servings = totalGrams / food.servingGrams;
      const rounded = Math.ceil(servings * 2) / 2;
      return `${rounded} ${food.servingUnit}${rounded !== 1 ? "s" : ""}`;
    }
    const rounded = Math.ceil(totalGrams / 10) * 10;
    return `${rounded}g`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Shopping For</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Training Days</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setTrainingDays(d => Math.max(0, d - 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">−</button>
              <span className="text-lg font-bold text-foreground w-6 text-center">{trainingDays}</span>
              <button onClick={() => setTrainingDays(d => Math.min(14, d + 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">+</button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Rest Days</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setRestDays(d => Math.max(0, d - 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">−</button>
              <span className="text-lg font-bold text-foreground w-6 text-center">{restDays}</span>
              <button onClick={() => setRestDays(d => Math.min(14, d + 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">+</button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{trainingDays + restDays} day total · quantities calculated from your meal plan</p>
      </Card>

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <p className="text-xs text-muted-foreground whitespace-nowrap">{checkedCount}/{items.length} items</p>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : "0%" }} />
            </div>
          </div>
          {checkedCount > 0 && (
            <button
              onClick={uncheckAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap underline underline-offset-2"
            >
              Uncheck all
            </button>
          )}
        </div>
      )}

      {items.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No meal plan set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan and quantities will appear here.</p>
        </Card>
      )}

      {items.length > 0 && (
        <Card className="space-y-1">
          {items.map(([name, entry]) => {
            const { totalGrams, food } = entry as { totalGrams: number; food: any };
            const qty = formatQty(name, totalGrams, food);
            const isChecked = !!checked[name];
            return (
              <button
                key={name}
                onClick={() => toggleItem(name)}
                className="flex items-center gap-3 py-2.5 w-full text-left group"
              >
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                }`}>
                  {isChecked && <Check size={12} className="text-primary-foreground" />}
                </div>
                <span className={`text-sm flex-1 ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {name}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{qty}</span>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ─── CombinedMealPlanTab ──────────────────────────────────────────────────────
export default function CombinedMealPlanTab({ defaultSub = "plan" }: { defaultSub?: "plan" | "shopping" }) {
  const [sub, setSub] = useState<"plan" | "shopping">(defaultSub);
  return (
    <div>
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
        {(["plan", "shopping"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "plan" ? "Meal Plan" : "Shopping List"}
          </button>
        ))}
      </div>
      {sub === "plan" ? <MealPlanTab /> : <ShoppingListTab />}
    </div>
  );
}
