import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, CheckSquare, Search, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── CoachHabitsPanel ────────────────────────────────────────────────────────

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

function HabitCard({ habit, days, completedSet, today }: {
  habit: any;
  days: string[];      // exactly 28 ISO date strings, oldest first
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

  // Split 28 days into 4 rows of 7
  const rows: string[][] = [];
  for (let r = 0; r < 4; r++) {
    rows.push(days.slice(r * 7, r * 7 + 7));
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Header */}
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

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((l, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground/50">{l}</div>
        ))}
      </div>

      {/* 4 rows × 7 dots — fills full card width */}
      <div className="grid grid-cols-7 gap-1">
        {rows.flat().map((iso, idx) => {
          const before = iso < assignedAt;
          const future = iso > today;
          const hit = completedSet.has(`${habit.id}:${iso}`);

          let bg = "transparent";
          if (!before && !future) bg = hit ? "var(--color-primary, #22c55e)" : "rgba(255,255,255,0.08)";

          return (
            <div
              key={idx}
              title={iso}
              className="aspect-square w-full rounded-[3px]"
              style={{ backgroundColor: bg }}
            />
          );
        })}
      </div>
    </div>
  );
}

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

function normDate(val: any): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Build exactly 28 days ending today (oldest → newest)
  const days = useMemo(() => {
    const result: string[] = [];
    const base = new Date(today + "T00:00:00");
    for (let i = 27; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return result;
  }, [today]);

  const fromDate = days[0];

  const { data: habits = [] } = trpc.habits.clientHabits.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const { data: completions = [] } = trpc.habits.clientCompletions.useQuery(
    { clientId, fromDate },
    { enabled: !!clientId }
  );

  const dailyHabits = (habits as any[]).filter(h => h.scope !== "per_meal");

  if (!clientId || dailyHabits.length === 0 && (habits as any[]).filter(h => h.scope === "per_meal").length === 0) return null;

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
              <HabitCard
                key={h.id}
                habit={h}
                days={days}
                completedSet={completedSet}
                today={today}
              />
            ))}
          </div>
        </>
      )}
      <MealHabitAdherencePanel clientId={clientId} fromDate={fromDate} />
    </div>
  );
}

// ─── HabitsSection (coach habit library management) ──────────────────────────

type HabitScope = "daily" | "per_meal";

export default function HabitsSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editScope, setEditScope] = useState<HabitScope>("daily");
  const [editFrequency, setEditFrequency] = useState<"daily" | "x_per_week">("daily");
  const [editTargetDays, setEditTargetDays] = useState(5);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState<HabitScope>("daily");
  const [newFrequency, setNewFrequency] = useState<"daily" | "x_per_week">("daily");
  const [newTargetDays, setNewTargetDays] = useState(5);
  // Assignment panel state: habitId -> open/closed
  const [assignOpen, setAssignOpen] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: habits = [], isLoading } = trpc.habits.list.useQuery();
  const { data: allClients = [] } = trpc.users.clients.useQuery();

  const createMut = trpc.habits.create.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); setShowAdd(false); setNewName(""); setNewScope("daily"); },
  });
  const updateMut = trpc.habits.update.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); setEditingId(null); },
  });
  const deleteMut = trpc.habits.delete.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });
  const setAssignmentsMut = trpc.habits.setAssignments.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); },
  });

  const filtered = (habits as any[]).filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search size={15} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search habits..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <Button size="sm" onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5">
          <Plus size={14} /> Add Habit
        </Button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">New Habit</p>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Habit name"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          {/* Scope toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewScope("daily")}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${newScope === "daily" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setNewScope("per_meal")}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${newScope === "per_meal" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
            >
              Per Meal
            </button>
          </div>
          {newScope === "daily" && (
            <div className="flex gap-3">
              <select value={newFrequency} onChange={(e) => setNewFrequency(e.target.value as any)}
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="daily">Daily</option>
                <option value="x_per_week">x per week</option>
              </select>
              {newFrequency === "x_per_week" && (
                <input type="number" min={1} max={7} value={newTargetDays} onChange={(e) => setNewTargetDays(Number(e.target.value))}
                  className="w-20 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={!newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate({
                name: newName.trim(),
                scope: newScope,
                frequency: newScope === "per_meal" ? "daily" : newFrequency,
                targetDays: newScope === "daily" && newFrequency === "x_per_week" ? newTargetDays : undefined,
              })}>
              {createMut.isPending ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckSquare size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No habits yet</p>
          <p className="text-xs mt-1">Add a habit above to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h: any) => (
            <div key={h.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {editingId === h.id ? (
                <div className="p-4 space-y-3">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  {/* Scope toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditScope("daily")}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${editScope === "daily" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditScope("per_meal")}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${editScope === "per_meal" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      Per Meal
                    </button>
                  </div>
                  {editScope === "daily" && (
                    <div className="flex gap-3">
                      <select value={editFrequency} onChange={(e) => setEditFrequency(e.target.value as any)}
                        className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="daily">Daily</option>
                        <option value="x_per_week">x per week</option>
                      </select>
                      {editFrequency === "x_per_week" && (
                        <input type="number" min={1} max={7} value={editTargetDays} onChange={(e) => setEditTargetDays(Number(e.target.value))}
                          className="w-20 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" />
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!editName.trim() || updateMut.isPending}
                      onClick={() => updateMut.mutate({
                        id: h.id,
                        name: editName.trim(),
                        scope: editScope,
                        frequency: editScope === "per_meal" ? "daily" : editFrequency,
                        targetDays: editScope === "daily" && editFrequency === "x_per_week" ? editTargetDays : undefined,
                      })}>
                      {updateMut.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-semibold">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.scope === "per_meal" ? "Per meal" : (h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Assign clients button */}
                      <button
                        onClick={() => setAssignOpen(assignOpen === h.id ? null : h.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded flex items-center gap-1"
                        title="Assign to clients"
                      >
                        <Users size={14} />
                        {assignOpen === h.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <button onClick={() => {
                        setEditingId(h.id);
                        setEditName(h.name);
                        setEditScope((h.scope ?? "daily") as HabitScope);
                        setEditFrequency((h.frequency ?? "daily") as any);
                        setEditTargetDays(h.targetDays ?? 5);
                      }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={async () => {
                        const ok = await confirm({ title: "Delete habit?", description: `Remove "${h.name}" from the habit library?`, variant: "destructive" });
                        if (ok) deleteMut.mutate({ id: h.id });
                      }} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Assignment panel */}
                  {assignOpen === h.id && (
                    <AssignPanel
                      habitId={h.id}
                      allClients={allClients as any[]}
                      onSave={(clientIds) => {
                        setAssignmentsMut.mutate({ habitId: h.id, clientIds });
                        setAssignOpen(null);
                      }}
                      isPending={setAssignmentsMut.isPending}
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AssignPanel ─────────────────────────────────────────────────────────────

function AssignPanel({ habitId, allClients, onSave, isPending }: {
  habitId: number;
  allClients: any[];
  onSave: (clientIds: number[]) => void;
  isPending: boolean;
}) {
  const { data: assignments = [], isLoading } = trpc.habits.getAssignments.useQuery({ habitId });
  const [selected, setSelected] = useState<Set<number> | null>(null);

  // Initialise selection from server data once loaded
  const activeIds = useMemo(
    () => new Set((assignments as any[]).filter(a => a.active).map((a: any) => a.clientId)),
    [assignments]
  );
  const effectiveSelected = selected ?? activeIds;

  const toggle = (id: number) => {
    const next = new Set(effectiveSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  if (isLoading) return <div className="px-4 pb-4 text-xs text-muted-foreground">Loading...</div>;

  return (
    <div className="border-t border-border px-4 pb-4 pt-3 bg-secondary/30">
      <p className="text-xs font-medium text-muted-foreground mb-2">Assign to clients</p>
      {allClients.length === 0 ? (
        <p className="text-xs text-muted-foreground">No clients yet.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {allClients.map((c: any) => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={effectiveSelected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-primary"
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {c.name || c.email}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={() => onSave(Array.from(effectiveSelected))}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
