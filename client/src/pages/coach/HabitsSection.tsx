import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, CheckSquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

function normDate(val: any): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildLast28Days(today: string): string[] {
  const result: string[] = [];
  const base = new Date(today + "T00:00:00");
  for (let i = 27; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return result;
}

// ─── HabitCard (adherence dot grid) ──────────────────────────────────────────

function HabitCard({ habit, days, completedSet, today }: {
  habit: any;
  days: string[];
  completedSet: Set<string>;
  today: string;
}) {
  const assignedAt = normDate(habit.assignedAt);
  const eligible = days.filter(d => d >= assignedAt && d <= today);
  const done = eligible.filter(d => completedSet.has(`${habit.id}:${d}`));
  const pct = eligible.length > 0 ? Math.round((done.length / eligible.length) * 100) : null;

  const pctColor =
    pct === null ? "text-muted-foreground"
    : pct >= 80 ? "text-green-500"
    : pct >= 50 ? "text-amber-500"
    : "text-red-500";

  const rows: string[][] = [];
  for (let r = 0; r < 4; r++) rows.push(days.slice(r * 7, r * 7 + 7));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 overflow-hidden" style={{ height: "2.5em" }}>{habit.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {habit.frequency === "daily" ? "Daily" : `${habit.targetDays}×/wk`}
            {eligible.length > 0 && ` · ${done.length}/${eligible.length}`}
          </p>
        </div>
        <span className={`text-sm font-bold shrink-0 ${pctColor}`}>
          {pct !== null ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((l, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground/50">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {rows.flat().map((iso, idx) => {
          const before = iso < assignedAt;
          const future = iso > today;
          const hit = completedSet.has(`${habit.id}:${iso}`);
          let bg = "transparent";
          if (!before && !future) bg = hit ? "var(--color-primary, #22c55e)" : "rgba(255,255,255,0.08)";
          return (
            <div key={idx} title={iso} className="aspect-square w-full rounded-[3px]" style={{ backgroundColor: bg }} />
          );
        })}
      </div>
    </div>
  );
}

// ─── MealHabitAdherencePanel ──────────────────────────────────────────────────

function MealHabitAdherencePanel({ clientId, fromDate }: { clientId: number; fromDate: string }) {
  const { data } = trpc.habits.clientMealAdherence.useQuery(
    { clientId, fromDate },
    { enabled: !!clientId }
  );

  if (!data || data.habits.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3">
        <SectionLabel>Per-Meal Habit Adherence — Last 4 Weeks</SectionLabel>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {data.habits.map((h: any) => {
          const pct = data.totalMeals > 0 ? Math.round((h.completedCount / data.totalMeals) * 100) : null;
          const pctColor =
            pct === null ? "text-muted-foreground"
            : pct >= 80 ? "text-green-500"
            : pct >= 50 ? "text-amber-500"
            : "text-red-500";
          return (
            <div key={h.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{h.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Per meal</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${pctColor}`}>
                  {pct !== null ? `${pct}%` : "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{h.completedCount}/{data.totalMeals} meals</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CoachHabitsPanel (adherence only — used in Overview tab) ─────────────────

export function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const days = useMemo(() => buildLast28Days(today), [today]);
  const fromDate = days[0];

  const { data: habits = [] } = trpc.habits.clientHabits.useQuery({ clientId }, { enabled: !!clientId });
  const { data: completions = [] } = trpc.habits.clientCompletions.useQuery({ clientId, fromDate }, { enabled: !!clientId });

  const dailyHabits = (habits as any[]).filter(h => h.scope !== "per_meal");
  const hasMealHabits = (habits as any[]).some(h => h.scope === "per_meal");

  if (!clientId || (dailyHabits.length === 0 && !hasMealHabits)) return null;

  const completedSet = new Set(
    (completions as any[]).map((c) => `${c.habitId}:${normDate(c.completedDate)}`)
  );

  return (
    <div>
      {dailyHabits.length > 0 && (
        <>
          <div className="mb-3">
            <SectionLabel>Daily Habit Adherence — Last 4 Weeks</SectionLabel>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {dailyHabits.map((h) => (
              <HabitCard key={h.id} habit={h} days={days} completedSet={completedSet} today={today} />
            ))}
          </div>
        </>
      )}
      <MealHabitAdherencePanel clientId={clientId} fromDate={fromDate} />
    </div>
  );
}

// ─── ClientHabitsTab (assignment only — adherence shown in Overview) ──────────

export function ClientHabitsTab({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();

  // All habits in the library
  const { data: allHabits = [], isLoading: habitsLoading } = trpc.habits.list.useQuery();
  // Currently assigned habits for this client
  const { data: assignedHabits = [], isLoading: assignedLoading } = trpc.habits.clientHabits.useQuery(
    { clientId }, { enabled: !!clientId }
  );

  // Optimistic local state — null means "use server data"
  const [optimisticIds, setOptimisticIds] = useState<Set<number> | null>(null);

  const serverAssignedIds = useMemo(
    () => new Set((assignedHabits as any[]).map((h: any) => h.id)),
    [assignedHabits]
  );

  // Reset optimistic state when server data changes
  const effectiveIds = optimisticIds ?? serverAssignedIds;

  const assignMut = trpc.habits.assignHabit.useMutation({
    onSuccess: () => {
      utils.habits.clientHabits.invalidate({ clientId });
      setOptimisticIds(null);
    },
  });
  const unassignMut = trpc.habits.unassignHabit.useMutation({
    onSuccess: () => {
      utils.habits.clientHabits.invalidate({ clientId });
      setOptimisticIds(null);
    },
  });

  function toggleAssign(habitId: number) {
    const next = new Set(effectiveIds);
    if (next.has(habitId)) {
      next.delete(habitId);
      setOptimisticIds(next);
      unassignMut.mutate({ habitId, clientId });
    } else {
      next.add(habitId);
      setOptimisticIds(next);
      assignMut.mutate({ habitId, clientId });
    }
  }

  const isLoading = habitsLoading || assignedLoading;
  const dailyHabits = (allHabits as any[]).filter(h => h.scope !== "per_meal");
  const mealHabits = (allHabits as any[]).filter(h => h.scope === "per_meal");

  if (isLoading) {
    return <div className="space-y-2 mt-4 max-w-2xl mx-auto">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}</div>;
  }

  const renderHabitList = (list: any[]) => (
    <div className="space-y-1.5">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">None in library yet.</p>
      ) : list.map((h: any) => {
        const assigned = effectiveIds.has(h.id);
        return (
          <button
            key={h.id}
            onClick={() => toggleAssign(h.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
              assigned
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-card border-border text-foreground hover:border-primary/40"
            }`}
          >
            <div>
              <p className="text-sm font-medium">{h.name}</p>
              <p className="text-xs text-muted-foreground">
                {h.scope === "per_meal" ? "Per meal" : (h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`)}
              </p>
            </div>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              assigned ? "bg-primary border-primary" : "border-border"
            }`}>
              {assigned && <Check size={12} className="text-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderColumn = (title: string, list: any[]) => (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl">
          <p className="text-xs">None in library yet</p>
        </div>
      ) : renderHabitList(list)}
    </div>
  );

  return (
    <div className="mt-4">
      {(allHabits as any[]).length === 0 ? (
        <p className="text-sm text-muted-foreground">No habits in the library yet. Add habits from the Habits page first.</p>
      ) : (
        <div className="grid grid-cols-2 gap-8">
          {renderColumn("Daily Habits", dailyHabits)}
          {renderColumn("Per-Meal Habits", mealHabits)}
        </div>
      )}
    </div>
  );
}

// ─── HabitForm (shared create/edit form) ─────────────────────────────────────

type HabitScope = "daily" | "per_meal";

function HabitForm({
  initial,
  onSave,
  onCancel,
  isPending,
  title,
}: {
  initial?: { name: string; scope: HabitScope };
  onSave: (data: { name: string; scope: HabitScope; frequency: "daily" | "x_per_week"; targetDays: number }) => void;
  onCancel: () => void;
  isPending: boolean;
  title: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const scope: HabitScope = initial?.scope ?? "daily";

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit name"
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      <div className="flex gap-2">
        <Button size="sm" disabled={!name.trim() || isPending}
          onClick={() => onSave({ name: name.trim(), scope, frequency: "daily", targetDays: 7 })}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── HabitLibraryColumn (one column of the two-column layout) ────────────────

function HabitLibraryColumn({
  title,
  habits,
  isLoading,
  scope,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  habits: any[];
  isLoading: boolean;
  scope: HabitScope;
  onAdd: (data: { name: string; scope: HabitScope; frequency: "daily" | "x_per_week"; targetDays: number }) => void;
  onEdit: (id: number, data: { name: string; scope: HabitScope; frequency: "daily" | "x_per_week"; targetDays: number }) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [editPending, setEditPending] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Button size="sm" variant="ghost" onClick={() => { setShowAdd(v => !v); setEditingId(null); }} className="h-7 px-2 text-xs gap-1">
          <Plus size={12} /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4">
          <HabitForm
            title="New Habit"
            initial={{ name: "", scope }}
            isPending={addPending}
            onCancel={() => setShowAdd(false)}
            onSave={(data) => {
              setAddPending(true);
              onAdd(data);
              setShowAdd(false);
              setAddPending(false);
            }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : habits.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl">
          <CheckSquare size={24} className="mb-2 opacity-30" />
          <p className="text-xs">No {title.toLowerCase()} habits yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((h: any) => (
            <div key={h.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {editingId === h.id ? (
                <div className="p-4">
                  <HabitForm
                    title="Edit Habit"
                    initial={{ name: h.name, scope: (h.scope ?? "daily") as HabitScope }}
                    isPending={editPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(data) => {
                      setEditPending(true);
                      onEdit(h.id, data);
                      setEditingId(null);
                      setEditPending(false);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.scope === "per_meal" ? "Per meal" : (h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingId(h.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(h.id, h.name)} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded">
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

// ─── HabitsSection (global library — two-column Daily | Per Meal) ─────────────

export default function HabitsSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const utils = trpc.useUtils();
  const { data: habits = [], isLoading } = trpc.habits.list.useQuery();

  const createMut = trpc.habits.create.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });
  const updateMut = trpc.habits.update.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });
  const deleteMut = trpc.habits.delete.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });

  const dailyHabits = (habits as any[]).filter(h => h.scope !== "per_meal");
  const mealHabits = (habits as any[]).filter(h => h.scope === "per_meal");

  async function handleDelete(id: number, name: string) {
    const ok = await confirm({ title: "Delete habit?", description: `Remove "${name}" from the habit library?`, variant: "destructive" });
    if (ok) deleteMut.mutate({ id });
  }

  return (
    <div>
      {ConfirmDialogNode}
      <div className="grid grid-cols-2 gap-8">
        <HabitLibraryColumn
          title="Daily Habits"
          habits={dailyHabits}
          isLoading={isLoading}
          scope="daily"
          onAdd={(data) => createMut.mutate({ ...data })}
          onEdit={(id, data) => updateMut.mutate({ id, ...data })}
          onDelete={handleDelete}
        />
        <HabitLibraryColumn
          title="Per-Meal Habits"
          habits={mealHabits}
          isLoading={isLoading}
          scope="per_meal"
          onAdd={(data) => createMut.mutate({ ...data })}
          onEdit={(id, data) => updateMut.mutate({ id, ...data })}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
