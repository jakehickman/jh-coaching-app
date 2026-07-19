import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Save, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { Card, ClientCombobox, useClientSelector } from "./shared";
import { Button } from "@/components/ui/button";
import MacroTargetsEditor from "./MacroTargetsEditor";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Item type ────────────────────────────────────────────────────────────────
// item.qty  = number of servings (or grams if 100g serving)
// item.servingGrams = grams per one serving (default 100)
// item.servingLabel = display label e.g. "1 cup (240g)"
// item.servingId    = food_servings.id or null for 100g fallback
interface MealItem {
  food: string;
  qty: string;           // quantity of servings
  servingId: number | null;
  servingGrams: number;  // grams per serving
  servingLabel: string;  // display label
  // legacy compat — grams field kept for old saved plans
  grams?: string;
}

// ─── Macro helpers ────────────────────────────────────────────────────────────

function calcItemMacros(foodDb: any[], item: MealItem) {
  const food = foodDb.find((f: any) => f.name === item.food);
  if (!food) return { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
  const qty = parseFloat(item.qty ?? item.grams ?? "0") || 0;
  if (!qty) return { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
  const grams = qty * (item.servingGrams ?? 100);
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor),
    carbs: Math.round(food.carbs * factor),
    fiber: Math.round(food.fiber * factor),
    fat: Math.round(food.fat * factor),
  };
}

function getEffectiveGrams(item: MealItem): number {
  const qty = parseFloat(item.qty ?? item.grams ?? "0") || 0;
  return Math.round(qty * (item.servingGrams ?? 100));
}

// ─── Sortable food row ────────────────────────────────────────────────────────

function SortableFoodRow({
  id, item, mealIdx, itemIdx, selectedFood, macros, hasData,
  onUpdate, onRemove, onSelectAdvance, onQtyEnter
}: {
  id: string;
  item: MealItem;
  mealIdx: number;
  itemIdx: number;
  selectedFood: any;
  macros: { calories: number; protein: number; carbs: number; fat: number };
  hasData: boolean;
  onUpdate: (field: string, value: string | number | null) => void;
  onRemove: () => void;
  onSelectAdvance: () => void;
  onQtyEnter: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms cubic-bezier(0.25, 1, 0.5, 1)",
  };

  // Build serving options: 100g fallback first, then USDA servings
  const servingOptions: { id: number | null; label: string; grams: number }[] = [
    { id: null, label: "100g", grams: 100 },
    ...(selectedFood?.servings ?? []).map((s: any) => {
      const rawLabel: string = s.label ?? "";
      // Only append (Xg) if the label doesn't already contain a gram value
      const hasGrams = /\(\d+g\)/i.test(rawLabel);
      const label = hasGrams ? rawLabel : `${rawLabel} (${Math.round(s.grams)}g)`;
      return { id: s.id as number, label, grams: s.grams as number };
    }),
  ];

  const effectiveGrams = getEffectiveGrams(item);
  const showGramHint = item.servingGrams !== 100 && (parseFloat(item.qty) || 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded transition-opacity ${
        isDragging ? "opacity-30 border border-dashed border-border bg-secondary/30" : ""
      }`}
    >
      <button {...attributes} {...listeners} className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none">
        <GripVertical size={12} />
      </button>

      {/* Food name combobox */}
      <div className="flex-1 min-w-0">
        <FoodCombobox
          value={item.food}
          onChange={v => {
            onUpdate("food", v);
            // Reset serving to 100g when food changes
            onUpdate("servingId", null);
            onUpdate("servingGrams", 100);
            onUpdate("servingLabel", "100g");
          }}
          onSelectAdvance={onSelectAdvance}
          mealIdx={mealIdx}
          itemIdx={itemIdx}
        />
      </div>

      {/* Serving size dropdown — always reserves w-44 space for column alignment */}
      <div className="w-44 shrink-0">
        {selectedFood && (
          <select
            value={item.servingId === null || item.servingId === undefined ? "__100g__" : String(item.servingId)}
            onChange={e => {
              const val = e.target.value;
              if (val === "__100g__") {
                onUpdate("servingId", null);
                onUpdate("servingGrams", 100);
                onUpdate("servingLabel", "100g");
              } else {
                const opt = servingOptions.find(o => o.id !== null && String(o.id) === val);
                if (opt) {
                  onUpdate("servingId", opt.id);
                  onUpdate("servingGrams", opt.grams);
                  onUpdate("servingLabel", opt.label);
                }
              }
            }}
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {servingOptions.map(opt => (
              <option key={opt.id === null ? "__100g__" : opt.id} value={opt.id === null ? "__100g__" : String(opt.id)}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Quantity input */}
      <div className="w-20 shrink-0">
        <input
          type="number" min="0" step="0.5"
          data-meal={mealIdx} data-item={itemIdx} data-field="qty"
          value={item.qty ?? item.grams ?? ""}
          onChange={e => onUpdate("qty", e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onQtyEnter(); } }}
          className="w-full bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-right"
          placeholder="0"
        />
      </div>

      {/* Gram hint — fixed width slot so macros column stays aligned */}
      <div className="w-16 shrink-0">
        {showGramHint && (
          <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
            = {effectiveGrams}g
          </span>
        )}
      </div>

      {/* Macro summary */}
      <div className="w-24 shrink-0 text-xs leading-tight">
        {hasData ? (
          <>
            <span className="text-foreground font-medium text-xs">{macros.calories} kcal</span>
            <div className="text-muted-foreground text-xs">P{macros.protein} C{macros.carbs} F{macros.fat}</div>
          </>
        ) : <span className="text-muted-foreground/30">—</span>}
      </div>

      <button onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── Food combobox ────────────────────────────────────────────────────────────

function FoodCombobox({
  value, onChange, onSelectAdvance, mealIdx, itemIdx
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectAdvance?: () => void;
  mealIdx?: number;
  itemIdx?: number;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  // Debounce search input by 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults = [], isFetching } = trpc.nutritionFoods.search.useQuery(
    { query: debouncedSearch, limit: 25 },
    { enabled: open, staleTime: 30_000 }
  );

  const filtered = searchResults.map((f: any) => f.name);

  const selectItem = (name: string) => {
    onChange(name);
    setSearch("");
    setDebouncedSearch("");
    setOpen(false);
    setHighlightedIdx(-1);
    setTimeout(() => onSelectAdvance?.(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); selectItem(filtered[highlightedIdx >= 0 ? highlightedIdx : 0]); }
      else if (e.key === "Escape") { setOpen(false); setHighlightedIdx(-1); }
      else if (e.key === "Tab") { setOpen(false); setHighlightedIdx(-1); }
    } else if (e.key === "Enter") { e.preventDefault(); onSelectAdvance?.(); }
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
        className="w-full bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {isFetching && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">Searching…</div>
          )}
          {filtered.map((name: string, idx: number) => (
            <button key={name} type="button" onMouseDown={() => selectItem(name)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${idx === highlightedIdx ? "bg-primary/20 text-primary" : "text-foreground hover:bg-primary/10 hover:text-primary"}`}>
              {name}
            </button>
          ))}
        </div>
      )}
      {open && debouncedSearch.length > 0 && !isFetching && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl px-3 py-2">
          <p className="text-xs text-muted-foreground">No foods match "{debouncedSearch}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Shared tab bar component ─────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs, active, onChange, className = ""
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex border-b border-border ${className}`}>
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`px-5 py-2.5 text-sm font-medium transition-colors relative -mb-px ${
            active === value
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Daily Totals sidebar card ────────────────────────────────────────────────

function DailyTotalsCard({
  calories, protein, carbs, fiber, fat, treatAllowance = 0, onTreatAllowanceChange, empty = false
}: {
  calories: number; protein: number; carbs: number; fiber: number; fat: number;
  treatAllowance?: number;
  onTreatAllowanceChange?: (v: string) => void;
  empty?: boolean;
}) {
  const totalCal = calories + treatAllowance;
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Daily Totals</p>
      {empty ? (
        <p className="text-xs text-muted-foreground text-center py-4">Add meals to see daily totals</p>
      ) : (
        <div className="space-y-2">
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-3 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Calories</p>
            <p className="text-2xl font-bold text-primary leading-none">{totalCal}<span className="text-xs font-normal ml-1">kcal</span></p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Protein", value: protein },
              { label: "Carbs", value: carbs },
              { label: "Fat", value: fat },
              { label: "Fiber", value: fiber },
            ].map(({ label, value }) => (
              <div key={label} className="bg-secondary rounded-lg px-2 py-2 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-sm font-bold text-foreground">{value}g</p>
              </div>
            ))}
          </div>
          {onTreatAllowanceChange && (
            <div className="pt-2 border-t border-border/40">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Free Calories</label>
              <input
                type="number" min={0}
                value={treatAllowance || ""}
                onChange={e => onTreatAllowanceChange(e.target.value)}
                placeholder="0"
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Normalize legacy items ───────────────────────────────────────────────────
// Old items used { food, grams } — migrate to new shape on load
function normalizeMealItem(item: any): MealItem {
  if (item.qty !== undefined) return item as MealItem; // already new shape
  return {
    food: item.food ?? "",
    qty: item.grams ?? "",
    servingId: null,
    servingGrams: 100,
    servingLabel: "100g",
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MealPlansSection({ fixedClientId, onLiveTotals }: { fixedClientId?: number; onLiveTotals?: (dayType: "training" | "rest", calories: number) => void } = {}) {
  const { clients, selectedUserId: selectorUserId, setSelectedUserId } = useClientSelector();
  const selectedUserId = fixedClientId ?? selectorUserId;
  const [dayType, setDayType] = useState<"training" | "rest">("training");

  // Track which clients have unsaved drafts
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

  // Nutrition mode: meal_plan | macros
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

  // Meal plan data
  const { data: plan, refetch } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType },
    { enabled: !!selectedUserId && nutritionMode === "meal_plan" }
  );
  const oppositeDay = dayType === "training" ? "rest" : "training";
  const { data: oppositePlan } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType: oppositeDay },
    { enabled: !!selectedUserId && nutritionMode === "meal_plan" }
  );
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();
  const mealDraftKey = selectedUserId ? `draft:mealPlan:${selectedUserId}:${dayType}` : null;

  const [planNotes, setPlanNotes] = useState("");
  const [treatAllowance, setTreatAllowance] = useState("");
  const [meals, setMeals] = useState<any[]>([]);
  const [supplements, setSupplements] = useState<{ name: string; dose: string; timing: string }[]>([]);
  const mealSavedSnapshot = useRef<{ meals: any[]; planNotes: string } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Load from draft or server
  useEffect(() => {
    if (!mealDraftKey) return;
    const draft = localStorage.getItem(mealDraftKey);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        const normalizedMeals = (parsed.meals ?? []).map((meal: any) => ({
          ...meal,
          items: (meal.items ?? []).map(normalizeMealItem),
        }));
        setMeals(normalizedMeals);
        setPlanNotes(parsed.planNotes ?? "");
        setTreatAllowance(parsed.treatAllowance ?? "");
        setSupplements(parsed.supplements ?? []);
        return;
      } catch { /* ignore */ }
    }
    if (plan) {
      const normalizedMeals = ((plan.meals as any[]) ?? []).map((meal: any) => ({
        ...meal,
        items: (meal.items ?? []).map(normalizeMealItem),
      }));
      setMeals(normalizedMeals);
      setPlanNotes(plan.notes ?? "");
      setTreatAllowance(plan.treatAllowanceKcal ? String(plan.treatAllowanceKcal) : "");
      setSupplements((plan as any).supplements ?? []);
      mealSavedSnapshot.current = { meals: normalizedMeals, planNotes: plan.notes ?? "" };
    }
  }, [plan, mealDraftKey]);

  // Persist draft to localStorage
  useEffect(() => {
    if (!mealDraftKey) return;
    localStorage.setItem(mealDraftKey, JSON.stringify({ meals, planNotes, treatAllowance, supplements }));
    window.dispatchEvent(new Event("draft-changed"));
  }, [meals, planNotes, treatAllowance, supplements, mealDraftKey]);

  const upsert = trpc.mealPlan.upsert.useMutation({
    onSuccess: () => {
      toast.success("Meal plan saved");
      setLastSavedAt(new Date());
      if (mealDraftKey) {
        localStorage.removeItem(mealDraftKey);
        setMealDraftUserIds(prev => { const next = new Set(prev); next.delete(selectedUserId!); return next; });
        window.dispatchEvent(new Event("draft-changed"));
      }
      mealSavedSnapshot.current = { meals, planNotes };
      refetch();
    },
    onError: () => toast.error("Failed to save meal plan"),
  });

  // Warn before unload if dirty
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
    return next.map((meal, idx) => /^Meal \d+$/.test(meal.name) ? { ...meal, name: `Meal ${idx + 1}` } : meal);
  });
  const updateMealName = (i: number, name: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, name } : meal));
  const updateMealTime = (i: number, time: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, time } : meal));

  const addItem = (mealIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: [...(meal.items ?? []), { food: "", qty: "", servingId: null, servingGrams: 100, servingLabel: "100g" } as MealItem] }
    : meal
  ));
  const removeItem = (mealIdx: number, itemIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: meal.items.filter((_: any, i: number) => i !== itemIdx) }
    : meal
  ));
  const updateItem = (mealIdx: number, itemIdx: number, field: string, value: string | number | null) =>
    setMeals(m => m.map((meal, idx) => idx === mealIdx
      ? { ...meal, items: meal.items.map((item: any, i: number) => i === itemIdx ? { ...item, [field]: value } : item) }
      : meal
    ));
  const reorderItem = (mealIdx: number, oldIndex: number, newIndex: number) =>
    setMeals(m => m.map((meal, idx) => idx === mealIdx
      ? { ...meal, items: arrayMove(meal.items ?? [], oldIndex, newIndex) }
      : meal
    ));

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleFoodDragStart(_mealIdx: number, event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }
  function handleFoodDragEnd(mealIdx: number, event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = meals[mealIdx]?.items ?? [];
    const oldIndex = items.findIndex((_: any, i: number) => `food-${mealIdx}-${i}` === active.id);
    const newIndex = items.findIndex((_: any, i: number) => `food-${mealIdx}-${i}` === over.id);
    if (oldIndex !== -1 && newIndex !== -1) reorderItem(mealIdx, oldIndex, newIndex);
  }

  // Derive the active item data for DragOverlay
  function getActiveDragItem() {
    if (!activeDragId) return null;
    const parts = activeDragId.split("-"); // food-{mealIdx}-{itemIdx}
    const mealIdx = parseInt(parts[1] ?? "", 10);
    const itemIdx = parseInt(parts[2] ?? "", 10);
    if (isNaN(mealIdx) || isNaN(itemIdx)) return null;
    const meal = meals[mealIdx];
    const item: MealItem | undefined = meal?.items?.[itemIdx];
    if (!item) return null;
    const selectedFood = foodDb.find((f: any) => f.name === item.food);
    const m = calcItemMacros(foodDb, item);
    const hasData = !!(item.food && (parseFloat(item.qty ?? item.grams ?? "0") || 0) > 0);
    return { item, mealIdx, itemIdx, selectedFood, macros: m, hasData };
  }

  // Macro calculations
  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const normalized = normalizeMealItem(item);
      const m = calcItemMacros(foodDb, normalized);
      return { calories: acc.calories + m.calories, protein: Math.round(acc.protein + m.protein), carbs: Math.round(acc.carbs + m.carbs), fiber: Math.round(acc.fiber + m.fiber), fat: Math.round(acc.fat + m.fat) };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 })
  );
  const dailyTotals = mealMacros.reduce((acc, m) => ({
    calories: acc.calories + m.calories,
    protein: Math.round(acc.protein + m.protein),
    carbs: Math.round(acc.carbs + m.carbs),
    fiber: Math.round(acc.fiber + m.fiber),
    fat: Math.round(acc.fat + m.fat),
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });

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
      supplements: supplements.length > 0 ? supplements : null,
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); doSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedUserId, upsert.isPending, dayType, meals, planNotes, dailyTotals]); // eslint-disable-line react-hooks/exhaustive-deps

  const foodNames = (foodDb as any[]).map((f: any) => f.name).sort();

  const modeTabs = [
    { value: "meal_plan" as const, label: "Meal Plan" },
    { value: "macros" as const, label: "Macros" },
  ];
  const dayTabs = [
    { value: "training" as const, label: "Training Day" },
    { value: "rest" as const, label: "Rest Day" },
  ];

  return (
    <div className="space-y-0">
      {/* Client selector */}
      {!fixedClientId && (
        <div className="mb-5">
          <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} draftUserIds={mealDraftUserIds} />
        </div>
      )}

      {selectedUserId && (
        <>
          {/* Primary tab bar: Meal Plan | Macros */}
          <TabBar
            tabs={modeTabs}
            active={nutritionMode as "meal_plan" | "macros"}
            onChange={mode => setModeMutation.mutate({ userId: selectedUserId, mode })}
          />

          {/* Secondary row: Training Day | Rest Day pills */}
          <div className="flex items-center gap-2 flex-wrap mt-4 mb-5">
            {(dayTabs).map(({ value, label }) => (
              <button key={value} onClick={() => setDayType(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dayType === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
            {/* Copy from opposite day — only show when opposite has data */}
            {nutritionMode === "meal_plan" && oppositePlan && (oppositePlan.meals as any[])?.length > 0 && (
              <button
                onClick={() => {
                  if (!window.confirm(`Copy meals from ${oppositeDay} day plan? This will replace the current meals.`)) return;
                  const normalizedMeals = ((oppositePlan.meals as any[]) ?? []).map((meal: any) => ({
                    ...meal,
                    items: (meal.items ?? []).map(normalizeMealItem),
                  }));
                  setMeals(normalizedMeals);
                  setPlanNotes(oppositePlan.notes ?? "");
                  toast.success(`Copied from ${oppositeDay} day plan`);
                }}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border flex items-center gap-1.5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                Copy from {oppositeDay} day
              </button>
            )}
          </div>

          {/* ── Macros mode ─────────────────────────────────────────────── */}
          {nutritionMode === "macros" && (
            <MacroTargetsEditor clientId={selectedUserId} dayType={dayType} onDayTypeChange={setDayType} />
          )}

          {/* ── Meal Plan mode ───────────────────────────────────────────── */}
          {nutritionMode === "meal_plan" && (
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
              {/* Left column */}
              <div className="space-y-4">
                {/* Meal cards */}
                {meals.map((meal, i) => (
                  <Card key={i}>
                    {/* Card header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex flex-col gap-0.5 shrink-0 text-muted-foreground">
                        <button onClick={() => i > 0 && moveMeal(i, i - 1)} disabled={i === 0}
                          className="hover:text-foreground disabled:opacity-20 leading-none p-0.5">
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={() => i < meals.length - 1 && moveMeal(i, i + 1)} disabled={i === meals.length - 1}
                          className="hover:text-foreground disabled:opacity-20 leading-none p-0.5">
                          <ArrowDown size={12} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={meal.name ?? `Meal ${i + 1}`}
                        onChange={e => updateMealName(i, e.target.value)}
                        className="text-[13px] text-foreground font-semibold bg-transparent border-none outline-none focus:ring-0 p-0 w-32"
                      />
                      <div className="flex-1" />
                      <input type="time" value={meal.time ?? ""} onChange={e => updateMealTime(i, e.target.value)}
                        className="w-28 bg-secondary border border-border rounded px-2 py-1 text-[13px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <button onClick={() => removeMeal(i)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Column headers */}
                    <div className="flex items-center gap-2 px-1 mb-2">
                      <div className="w-3 shrink-0" />
                      <p className="flex-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Food</p>
                      <p className="w-44 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Serving</p>
                       <p className="w-20 text-xs uppercase tracking-wider font-semibold text-muted-foreground text-right">Qty</p>
                      <div className="w-16 shrink-0" />
                      <p className="w-24 text-xs uppercase tracking-wider font-semibold text-muted-foreground">Macros</p>
                      <p className="w-4"></p>
                    </div>

                    {/* Food rows — drag to reorder */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={e => handleFoodDragStart(i, e)}
                      onDragEnd={e => handleFoodDragEnd(i, e)}
                      onDragCancel={() => setActiveDragId(null)}
                    >
                      <SortableContext
                        items={(meal.items ?? []).map((_: any, j: number) => `food-${i}-${j}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1.5">
                          {(meal.items ?? []).map((rawItem: any, j: number) => {
                            const item = normalizeMealItem(rawItem);
                            const selectedFood = (foodDb as any[]).find((f: any) => f.name === item.food);
                            const m = calcItemMacros(foodDb, item);
                            const hasData = !!(item.food && (parseFloat(item.qty ?? item.grams ?? "0") || 0) > 0);
                            const totalItems = (meal.items ?? []).length;
                            const isLastItem = j === totalItems - 1;
                            const focusNextFoodInput = () => {
                              if (isLastItem) {
                                addItem(i);
                                setTimeout(() => {
                                  const next = document.querySelector<HTMLInputElement>(`[data-meal="${i}"][data-item="${j + 1}"][data-field="food"]`);
                                  next?.focus();
                                }, 50);
                              } else {
                                const next = document.querySelector<HTMLInputElement>(`[data-meal="${i}"][data-item="${j + 1}"][data-field="food"]`);
                                next?.focus();
                              }
                            };
                            const focusQtyInput = () => {
                              const qty = document.querySelector<HTMLInputElement>(`[data-meal="${i}"][data-item="${j}"][data-field="qty"]`);
                              qty?.focus();
                            };
                            return (
                              <SortableFoodRow
                                key={`food-${i}-${j}`}
                                id={`food-${i}-${j}`}
                                item={item}
                                mealIdx={i}
                                itemIdx={j}
                                selectedFood={selectedFood}
                                macros={m}
                                hasData={hasData}
                                onUpdate={(field, value) => updateItem(i, j, field, value)}
                                onRemove={() => removeItem(i, j)}
                                onSelectAdvance={focusQtyInput}
                                onQtyEnter={focusNextFoodInput}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                      <DragOverlay dropAnimation={null}>
                        {(() => {
                          const active = getActiveDragItem();
                          if (!active) return null;
                          return (
                            <div className="flex items-center gap-2 rounded-lg bg-card border border-primary/30 shadow-xl scale-[1.02] opacity-95 px-1 py-0.5">
                              <button className="shrink-0 text-primary/60 cursor-grabbing touch-none">
                                <GripVertical size={12} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="w-full bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground truncate">
                                  {active.item.food || <span className="text-muted-foreground">Search food…</span>}
                                </div>
                              </div>
                              <div className="w-44 bg-secondary border border-border rounded px-2 py-1 text-[12px] text-foreground truncate shrink-0">
                                {active.item.servingLabel || "100g"}
                              </div>
                               <div className="w-20 bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground text-right shrink-0">
                                {active.item.qty || active.item.grams || ""}
                              </div>
                              <div className="w-24 shrink-0 text-xs leading-tight">
                                {active.hasData ? (
                                  <>
                                    <span className="text-foreground font-medium text-xs">{active.macros.calories} kcal</span>
                                    <div className="text-muted-foreground text-xs">P{active.macros.protein} C{active.macros.carbs} F{active.macros.fat}</div>
                                  </>
                                ) : <span className="text-muted-foreground/30">—</span>}
                              </div>
                              <div className="w-4 shrink-0" />
                            </div>
                          );
                        })()}
                      </DragOverlay>
                    </DndContext>

                    {/* Add item + meal subtotal */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                      <Button variant="ghost" size="sm" onClick={() => addItem(i)} className="text-primary hover:text-primary/80 px-0 h-auto text-[13px]">
                        <Plus size={12} /> Add Item
                      </Button>
                      {(meal.items ?? []).some((it: any) => it.food && (parseFloat(it.qty ?? it.grams ?? "0") || 0) > 0) && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-primary/70">{mealMacros[i].calories} kcal</span>
                          <span className="text-xs text-muted-foreground">P{mealMacros[i].protein} C{mealMacros[i].carbs} F{mealMacros[i].fat}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}

                {/* Add Meal */}
                <Button variant="ghost" size="sm" onClick={addMeal} className="text-primary hover:text-primary/80 px-0 h-auto text-[13px] mt-1">
                  <Plus size={12} /> Add Meal
                </Button>

                {/* Notes card */}
                <Card>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5">Notes</label>
                  <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} rows={2}
                    className="w-full bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </Card>

                {/* Supplements card */}
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Supplements</label>
                    <button
                      onClick={() => setSupplements(s => [...s, { name: "", dose: "", timing: "" }])}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {supplements.length === 0 && (
                    <p className="text-xs text-muted-foreground">No supplements added yet.</p>
                  )}
                  <div className="space-y-2">
                    {supplements.map((supp, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                        <input
                          placeholder="Name"
                          value={supp.name}
                          onChange={e => setSupplements(s => s.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                          className="bg-secondary border border-border rounded px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          placeholder="Dose"
                          value={supp.dose}
                          onChange={e => setSupplements(s => s.map((x, idx) => idx === i ? { ...x, dose: e.target.value } : x))}
                          className="bg-secondary border border-border rounded px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          placeholder="Timing"
                          value={supp.timing}
                          onChange={e => setSupplements(s => s.map((x, idx) => idx === i ? { ...x, timing: e.target.value } : x))}
                          className="bg-secondary border border-border rounded px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => setSupplements(s => s.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Save button */}
                <div className="space-y-1.5">
                  <Button onClick={doSave} disabled={upsert.isPending} className="w-full">
                    <Save size={15} />
                    {upsert.isPending ? "Saving…" : "Save Meal Plan"}
                  </Button>
                  {lastSavedAt && (
                    <p className="text-center text-xs text-muted-foreground">
                      Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Right column: Daily Totals (sticky) */}
              <div className="sticky top-4 self-start">
                <DailyTotalsCard
                  calories={dailyTotals.calories}
                  protein={dailyTotals.protein}
                  carbs={dailyTotals.carbs}
                  fiber={dailyTotals.fiber}
                  fat={dailyTotals.fat}
                  treatAllowance={parseInt(treatAllowance) || 0}
                  onTreatAllowanceChange={setTreatAllowance}
                  empty={meals.length === 0}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
