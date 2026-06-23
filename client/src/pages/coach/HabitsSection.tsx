import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, CheckSquare, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── CoachHabitsPanel (used inside ProgressSection) ─────────────────────────

function HabitMonthCalendar({
  habitId,
  assignedAt,
  completedSet,
  calMonth,
}: {
  habitId: number;
  assignedAt: string; // yyyy-mm-dd
  completedSet: Set<string>; // "habitId:yyyy-mm-dd"
  calMonth: Date;
}) {
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // Mon-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-0.5">
        {dayLetters.map((l, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground py-0.5">
            {l}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`pad-${idx}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const beforeAssigned = iso < assignedAt;
          const isFuture = iso > todayStr;
          const done = completedSet.has(`${habitId}:${iso}`);
          const isToday = iso === todayStr;

          let bg = "bg-muted/30";
          if (!beforeAssigned && !isFuture) {
            bg = done ? "bg-primary" : "bg-muted";
          }

          return (
            <div
              key={iso}
              title={iso}
              className={`flex items-center justify-center rounded-sm mx-0.5 ${isToday ? "ring-1 ring-primary/60" : ""}`}
              style={{ aspectRatio: "1" }}
            >
              <div
                className={`w-full h-full rounded-sm ${
                  beforeAssigned || isFuture ? "opacity-0" : bg
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Fetch from start of displayed month
  const fromDate = useMemo(() => {
    return `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, "0")}-01`;
  }, [calMonth]);

  const { data: habits = [] } = trpc.habits.clientHabits.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const { data: completions = [] } = trpc.habits.clientCompletions.useQuery(
    { clientId, fromDate },
    { enabled: !!clientId }
  );

  if (!clientId || habits.length === 0) return null;

  // Normalise a date value to yyyy-mm-dd using LOCAL timezone
  const normDate = (val: any): string => {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const completedSet = new Set(
    completions.map((c: any) => `${c.habitId}:${normDate(c.completedDate)}`)
  );

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // Per-habit stats for the displayed month
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const habitStats = habits.map((h: any) => {
    const assignedDateStr = normDate(h.assignedAt);
    const eligible: string[] = [];
    const done: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (iso < assignedDateStr || iso > todayStr) continue;
      eligible.push(iso);
      if (completedSet.has(`${h.id}:${iso}`)) done.push(iso);
    }
    const pct = eligible.length > 0 ? Math.round((done.length / eligible.length) * 100) : 0;
    return { ...h, pct, doneDays: done.length, eligibleDays: eligible.length, assignedDateStr };
  });

  const prevMonth = () => setCalMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalMonth(new Date(year, month + 1, 1));
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Habit Adherence</SectionLabel>
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[90px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {habitStats.map((h: any) => (
          <div key={h.id} className="bg-card border border-border rounded-xl p-4">
            {/* Habit name + % */}
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`}
                  {h.eligibleDays > 0 && ` · ${h.doneDays}/${h.eligibleDays} days`}
                </p>
              </div>
              <span
                className={`text-sm font-bold ml-2 flex-shrink-0 ${
                  h.pct >= 80
                    ? "text-green-500"
                    : h.pct >= 50
                    ? "text-amber-500"
                    : h.eligibleDays === 0
                    ? "text-muted-foreground"
                    : "text-red-500"
                }`}
              >
                {h.eligibleDays > 0 ? `${h.pct}%` : "—"}
              </span>
            </div>

            {/* Monthly heatmap */}
            <HabitMonthCalendar
              habitId={h.id}
              assignedAt={h.assignedDateStr}
              completedSet={completedSet}
              calMonth={calMonth}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── HabitsSection ───────────────────────────────────────────────────────────

export default function HabitsSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "x_per_week">("daily");
  const [editTargetDays, setEditTargetDays] = useState(5);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState<"daily" | "x_per_week">("daily");
  const [newTargetDays, setNewTargetDays] = useState(5);

  const utils = trpc.useUtils();
  const { data: habits = [], isLoading } = trpc.habits.list.useQuery();

  const createMut = trpc.habits.create.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setShowAdd(false);
      setNewName("");
    },
  });

  const updateMut = trpc.habits.update.useMutation({
    onSuccess: () => {
      utils.habits.list.invalidate();
      setEditingId(null);
    },
  });

  const deleteMut = trpc.habits.delete.useMutation({
    onSuccess: () => utils.habits.list.invalidate(),
  });

  const filtered = (habits as any[]).filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}

      {/* Header */}
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
          <Plus size={14} />
          Add Habit
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">New Habit</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Habit name"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-3">
            <select
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value as "daily" | "x_per_week")}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value="daily">Daily</option>
            <option value="x_per_week">x per week</option>
            </select>
              {newFrequency === "x_per_week" && (
              <input
                type="number"
                min={1}
                max={7}
                value={newTargetDays}
                onChange={(e) => setNewTargetDays(Number(e.target.value))}
                className="w-20 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newName.trim() || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  name: newName.trim(),
                  frequency: newFrequency,
                  targetDays: newFrequency === "x_per_week" ? newTargetDays : undefined,
                })
              }
            >
              {createMut.isPending ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Habit list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckSquare size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No habits yet</p>
          <p className="text-xs mt-1">Add a habit above to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h: any) => (
            <div key={h.id} className="bg-card border border-border rounded-xl p-4">
              {editingId === h.id ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex gap-3">
                    <select
                      value={editFrequency}
                      onChange={(e) => setEditFrequency(e.target.value as "daily" | "x_per_week")}
                      className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                    >
                      <option value="daily">Daily</option>
                      <option value="x_per_week">x per week</option>
                    </select>
                    {editFrequency === "x_per_week" && (
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={editTargetDays}
                        onChange={(e) => setEditTargetDays(Number(e.target.value))}
                        className="w-20 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!editName.trim() || updateMut.isPending}
                      onClick={() =>
                        updateMut.mutate({
                          id: h.id,
                          name: editName.trim(),
                          frequency: editFrequency,
                          targetDays: editFrequency === "x_per_week" ? editTargetDays : undefined,
                        })
                      }
                    >
                      {updateMut.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`}
                      {(h.assignedUsers?.length ?? 0) > 0 &&
                        ` · ${h.assignedUsers.length} client${h.assignedUsers.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingId(h.id);
                        setEditName(h.name);
                        setEditFrequency((h.frequency ?? "daily") as "daily" | "x_per_week");
                        setEditTargetDays(h.targetDays ?? 5);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Delete habit?",
                          description: `Remove "${h.name}" from the habit library?`,
                          variant: "destructive",
                        });
                        if (ok) deleteMut.mutate({ id: h.id });
                      }}
                      className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded"
                    >
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
