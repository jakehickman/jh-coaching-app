import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, CheckSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── CoachHabitsPanel (used inside ProgressSection) ─────────────────────────

export function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const { data: habits = [] } = trpc.habits.clientHabits.useQuery(
    { clientId },
    { enabled: !!clientId }
  );
  const from14 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const { data: completions = [] } = trpc.habits.clientCompletions.useQuery(
    { clientId, fromDate: from14 },
    { enabled: !!clientId }
  );

  if (!clientId || habits.length === 0) return null;

  // Build last 14 days (oldest first)
  const last14: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last14.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  // Normalise a date value to yyyy-mm-dd using LOCAL timezone
  const normCompDate = (val: any): string => {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const completedSet = new Set(
    completions.map((c: any) => `${c.habitId}:${normCompDate(c.completedDate)}`)
  );

  const todayStr = last14[last14.length - 1];

  const habitStats = habits.map((h: any) => {
    const assignedDateStr = normCompDate(h.assignedAt);
    const eligible14 = last14.filter(
      (d) => d >= assignedDateStr && d <= todayStr
    );
    const done14 = eligible14.filter((d) =>
      completedSet.has(`${h.id}:${d}`)
    ).length;
    const pct14 =
      eligible14.length > 0
        ? Math.round((done14 / eligible14.length) * 100)
        : 0;
    // Streak: walk backwards from today
    let streak = 0;
    let startedCounting = false;
    for (let i = 0; i < 14; i++) {
      const d = last14[last14.length - 1 - i];
      if (!d || d < assignedDateStr) break;
      const done = completedSet.has(`${h.id}:${d}`);
      if (!startedCounting) {
        if (!done && i === 0) continue;
        startedCounting = true;
      }
      if (done) streak++;
      else break;
    }
    return { ...h, pct14, streak, done14, eligible14: eligible14.length };
  });

  // Group last14 into 2 weeks
  const weeks = [
    last14.slice(0, 7),
    last14.slice(7, 14),
  ];
  const weekLabels = ["Prev week", "This week"];

  return (
    <div>
      <SectionLabel>Habit Adherence (14 Days)</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {habitStats.map((h: any) => (
          <div key={h.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`}
                  {h.streak > 0 ? ` · ${h.streak}-day streak` : ""}
                </p>
              </div>
              <span
                className={`text-sm font-bold ${
                  h.pct14 >= 80
                    ? "text-green-500"
                    : h.pct14 >= 50
                    ? "text-amber-500"
                    : "text-red-500"
                }`}
              >
                {h.pct14}%
              </span>
            </div>
            {/* 2-week dot grid */}
            <div className="space-y-1.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                    {weekLabels[wi]}
                  </span>
                  <div className="flex gap-1">
                    {week.map((d) => {
                      // Blank spacer for dates before this habit was assigned
                      if (d < normCompDate(h.assignedAt)) {
                        return <div key={d} className="w-5 h-5 rounded-sm bg-transparent" />;
                      }
                      const done = completedSet.has(`${h.id}:${d}`);
                      return (
                        <div
                          key={d}
                          title={d}
                          className={`w-5 h-5 rounded-sm ${
                            done ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      );
                    })}
                  </div>
                  {(() => {
                    const habitStart = normCompDate(h.assignedAt);
                    const eligibleDays = week.filter(d => d >= habitStart);
                    const doneDays = eligibleDays.filter(d => completedSet.has(`${h.id}:${d}`)).length;
                    return (
                      <span className="text-[10px] text-muted-foreground">
                        {doneDays}/{eligibleDays.length}
                      </span>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── HabitsSection ───────────────────────────────────────────────────────────

export default function HabitsSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const utils = trpc.useUtils();
  const { data: habits = [], isLoading } = trpc.habits.list.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    frequency: "daily" as "daily" | "x_per_week",
    targetDays: 3,
  });

  // Track per-habit assignment state (set of clientIds)
  const [assigningHabitId, setAssigningHabitId] = useState<number | null>(null);
  const { data: habitAssignments = [] } = trpc.habits.getAssignments.useQuery(
    { habitId: assigningHabitId! },
    { enabled: assigningHabitId != null }
  );

  const create = trpc.habits.create.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setShowForm(false);
      resetForm();
    },
  });

  const update = trpc.habits.update.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setEditingId(null);
      resetForm();
    },
  });

  const del = trpc.habits.delete.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });

  const setAssignments = trpc.habits.setAssignments.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });

  function resetForm() {
    setForm({ name: "", description: "", frequency: "daily", targetDays: 3 });
  }

  function startEdit(h: any) {
    setEditingId(h.id);
    setForm({
      name: h.name,
      description: h.description ?? "",
      frequency: h.frequency,
      targetDays: h.targetDays ?? 3,
    });
    setShowForm(true);
  }

  const filtered = habits.filter((h: any) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const clients = (allUsers as any[]).filter((u: any) => u.role === "user");

  // Build a map of habitId -> Set<clientId> from the habits data (using assignedUsers if present)
  function getAssignedClientIds(h: any): Set<number> {
    if (Array.isArray(h.assignedUsers)) {
      return new Set(h.assignedUsers.map((a: any) => a.clientId ?? a.userId));
    }
    return new Set();
  }

  return (
    <div className="space-y-6">
      {ConfirmDialogNode}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search habits..."
            className="pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
          />
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingId(null); resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New Habit
        </Button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">{editingId ? "Edit Habit" : "New Habit"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={e => setForm(p => ({ ...p, frequency: e.target.value as "daily" | "x_per_week" }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="daily">Daily</option>
                <option value="x_per_week">X per week</option>
              </select>
            </div>
            {form.frequency === "x_per_week" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Target Days / Week</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={form.targetDays}
                  onChange={e => setForm(p => ({ ...p, targetDays: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!form.name.trim()) return;
                if (editingId) {
                  update.mutate({ id: editingId, name: form.name, description: form.description || undefined, frequency: form.frequency, targetDays: form.targetDays });
                } else {
                  create.mutate({ name: form.name, description: form.description || undefined, frequency: form.frequency, targetDays: form.targetDays });
                }
              }}
              disabled={!form.name.trim() || create.isPending || update.isPending}
            >
              {editingId ? "Save Changes" : "Create Habit"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Habits table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CheckSquare className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-base font-medium">No habits yet</p>
          <p className="text-sm mt-1">Create a habit and assign it to clients.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Habit</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Frequency</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((h: any) => {
                const assignedIds = getAssignedClientIds(h);
                return (
                  <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{h.name}</p>
                      {h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {h.frequency === "daily" ? "Daily" : `${h.targetDays}x / week`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {clients.map((u: any) => {
                          const isAssigned = assignedIds.has(u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => {
                                const newIds = new Set(assignedIds);
                                if (isAssigned) newIds.delete(u.id);
                                else newIds.add(u.id);
                                setAssignments.mutate({ habitId: h.id, clientIds: Array.from(newIds) });
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                isAssigned
                                  ? "bg-primary/20 border-primary/40 text-primary"
                                  : "bg-transparent border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              {u.displayName ?? u.email}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => startEdit(h)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Delete habit?",
                              description: `"${h.name}" will be removed from all clients.`,
                            });
                            if (ok) del.mutate({ id: h.id });
                          }}
                          disabled={del.isPending}
                          className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
