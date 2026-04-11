import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";

// ─── CoachHabitsPanel (used inside ProgressSection) ─────────────────────────

export function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const { data: habits = [] } = trpc.habits.clientHabits.useQuery(
    { clientId },
    { enabled: !!clientId }
  );
  const from28 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 27);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const { data: completions = [] } = trpc.habits.clientCompletions.useQuery(
    { clientId, fromDate: from28 },
    { enabled: !!clientId }
  );

  if (!clientId || habits.length === 0) return null;

  // Build last 28 days
  const last28: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last28.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  const last7 = last28.slice(-7);

  // Normalise a date value to yyyy-mm-dd using LOCAL timezone
  const normCompDate = (val: any): string => {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const completedSet = new Set(
    completions.map((c: any) => `${c.habitId}:${normCompDate(c.completedDate)}`)
  );

  const todayStr = last28[last28.length - 1];

  const habitStats = habits.map((h: any) => {
    const assignedDateStr = normCompDate(h.assignedAt);
    const eligible28 = last28.filter(
      (d) => d >= assignedDateStr && d <= todayStr
    );
    const eligible7 = last7.filter(
      (d) => d >= assignedDateStr && d <= todayStr
    );
    const done28 = eligible28.filter((d) =>
      completedSet.has(`${h.id}:${d}`)
    ).length;
    const done7 = eligible7.filter((d) =>
      completedSet.has(`${h.id}:${d}`)
    ).length;
    const pct28 =
      eligible28.length > 0
        ? Math.round((done28 / eligible28.length) * 100)
        : 0;
    const pct7 =
      eligible7.length > 0
        ? Math.round((done7 / eligible7.length) * 100)
        : 0;
    // Streak: walk backwards from today
    let streak = 0;
    let startedCounting = false;
    for (let i = 0; i < 28; i++) {
      const d = last28[last28.length - 1 - i];
      if (!d || d < assignedDateStr) break;
      const done = completedSet.has(`${h.id}:${d}`);
      if (!startedCounting) {
        if (!done && i === 0) continue;
        startedCounting = true;
      }
      if (done) streak++;
      else break;
    }
    return { ...h, pct28, pct7, streak, done28, done7 };
  });

  // Group last28 into 4 weeks
  const weeks = [
    last28.slice(0, 7),
    last28.slice(7, 14),
    last28.slice(14, 21),
    last28.slice(21, 28),
  ];
  const weekLabels = weeks.map((w, i) => {
    const start = w[0].slice(5).replace("-", "/");
    return i === 3 ? "This week" : start;
  });

  return (
    <div>
      <SectionLabel>Habit Adherence (4 Weeks)</SectionLabel>
      <div className="space-y-3">
        {habitStats.map((h: any) => (
          <div key={h.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`}
                  {" · "}
                  {h.pct28}% last 28 days
                  {h.streak > 0 ? ` · ${h.streak}-day streak` : ""}
                </p>
              </div>
              <span
                className={`text-sm font-bold ${
                  h.pct28 >= 80
                    ? "text-green-500"
                    : h.pct28 >= 50
                    ? "text-amber-500"
                    : "text-red-500"
                }`}
              >
                {h.pct28}%
              </span>
            </div>
            {/* 4-week heatmap */}
            <div className="space-y-1.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                    {weekLabels[wi]}
                  </span>
                  <div className="flex gap-1">
                    {week.map((d) => {
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
                  <span className="text-[10px] text-muted-foreground">
                    {week.filter((d) => completedSet.has(`${h.id}:${d}`)).length}
                    /7
                  </span>
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
  const utils = trpc.useUtils();
  const { data: habits = [], isLoading } = trpc.habits.list.useQuery();
  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const clients = allUsers;

  const [showForm, setShowForm] = useState(false);
  const [editHabit, setEditHabit] = useState<any | null>(null);
  const [assignHabit, setAssignHabit] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    frequency: "daily" as "daily" | "x_per_week",
    targetDays: 3,
  });
  const [assignedClientIds, setAssignedClientIds] = useState<number[]>([]);

  const createMutation = trpc.habits.create.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setShowForm(false);
      resetForm();
    },
  });
  const updateMutation = trpc.habits.update.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setEditHabit(null);
      resetForm();
    },
  });
  const deleteMutation = trpc.habits.delete.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });
  const setAssignmentsMutation = trpc.habits.setAssignments.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setAssignHabit(null);
    },
  });

  function resetForm() {
    setForm({ name: "", description: "", frequency: "daily", targetDays: 3 });
  }

  function openEdit(h: any) {
    setEditHabit(h);
    setForm({
      name: h.name,
      description: h.description ?? "",
      frequency: h.frequency,
      targetDays: h.targetDays ?? 3,
    });
  }

  async function openAssign(h: any) {
    setAssignHabit(h);
    const assignments = await utils.habits.getAssignments.fetch({
      habitId: h.id,
    });
    setAssignedClientIds(
      assignments.filter((a: any) => a.active).map((a: any) => a.clientId)
    );
  }

  function handleSubmit() {
    const payload = {
      ...form,
      targetDays: form.frequency === "x_per_week" ? form.targetDays : 7,
    };
    if (editHabit) {
      updateMutation.mutate({ id: editHabit.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleClientAssign(clientId: number) {
    setAssignedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  }

  function freqLabel(h: any) {
    if (h.frequency === "daily") return "Daily";
    return `${h.targetDays}x per week`;
  }

  return (
    <div className="xl:grid xl:grid-cols-[1fr_360px] xl:gap-6 xl:items-start">
      {/* Left: habits list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {habits.length} habit{habits.length !== 1 ? "s" : ""} created
          </p>
          <Button
            size="sm"
            onClick={() => {
              setShowForm(true);
              setEditHabit(null);
              resetForm();
            }}
          >
            <Plus size={14} className="mr-1" /> New Habit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Click <strong>New Habit</strong> to create a habit, or{" "}
          <strong>Assign</strong> on any habit to manage client assignments.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading habits...</p>
        ) : habits.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No habits yet. Create your first habit to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((h: any) => (
              <div
                key={h.id}
                className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {h.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {freqLabel(h)}
                    </span>
                    {h.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {h.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => openAssign(h)}
                  >
                    Assign
                  </Button>
                  <button
                    onClick={() => openEdit(h)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${h.name}"?`))
                        deleteMutation.mutate({ id: h.id });
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: create/edit form or assign panel */}
      <div className="space-y-4">
        {/* Create / Edit Form */}
        {(showForm || editHabit) && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 sticky top-20">
            <p className="text-sm font-semibold text-foreground">
              {editHabit ? "Edit Habit" : "New Habit"}
            </p>
            <div>
              <label className="text-xs text-muted-foreground">
                Habit Name *
              </label>
              <input
                className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Frequency</label>
              <select
                className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                value={form.frequency}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    frequency: e.target.value as any,
                  }))
                }
              >
                <option value="daily">Daily</option>
                <option value="x_per_week">X times per week</option>
              </select>
            </div>
            {form.frequency === "x_per_week" && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Target days per week
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  value={form.targetDays}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      targetDays: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">
                Description (optional)
              </label>
              <textarea
                className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditHabit(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  !form.name.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editHabit ? "Save Changes" : "Create Habit"}
              </Button>
            </div>
          </div>
        )}

        {/* Assign panel */}
        {assignHabit && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 sticky top-20">
            <p className="text-sm font-semibold text-foreground">
              Assign "{assignHabit.name}"
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {clients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No clients found.
                </p>
              )}
              {clients.map((c: any) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary"
                    checked={assignedClientIds.includes(c.id)}
                    onChange={() => toggleClientAssign(c.id)}
                  />
                  <span className="text-sm text-foreground">
                    {c.name ?? c.email ?? `User ${c.id}`}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignHabit(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setAssignmentsMutation.mutate({
                    habitId: assignHabit.id,
                    clientIds: assignedClientIds,
                  })
                }
                disabled={setAssignmentsMutation.isPending}
              >
                Save Assignments
              </Button>
            </div>
          </div>
        )}

        {!showForm && !editHabit && !assignHabit && (
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Select a habit to edit or assign it to clients.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
