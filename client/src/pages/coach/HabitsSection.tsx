import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, CheckSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── CoachHabitsPanel ────────────────────────────────────────────────────────
// Shows a compact 4-week dot grid per habit assigned to a client.
// Each row = one week (Mon → Sun). Dots are ~10px squares with 3px gaps.
// Green = completed, dark = missed, transparent = before assignment or future.

export function CoachHabitsPanel({ clientId }: { clientId: number }) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Build 28 days ending today, aligned to Mon start
  const { days, startOffset } = useMemo(() => {
    const result: string[] = [];
    const d = new Date(today + "T00:00:00");
    for (let i = 27; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      result.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`);
    }
    // Mon-based offset of the first day so week rows align correctly
    const firstDay = new Date(result[0] + "T00:00:00");
    const offset = (firstDay.getDay() + 6) % 7; // 0=Mon
    return { days: result, startOffset: offset };
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

  if (!clientId || (habits as any[]).length === 0) return null;

  const normDate = (val: any): string => {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(String(val));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const completedSet = new Set(
    (completions as any[]).map((c) => `${c.habitId}:${normDate(c.completedDate)}`)
  );

  // Build a padded 4×7 grid (28 cells + leading blanks to align Mon)
  // We always show exactly 4 rows of 7 regardless of offset
  const gridDays: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...days,
  ];
  // Pad to next multiple of 7
  while (gridDays.length % 7 !== 0) gridDays.push(null);
  // Take last 4 rows (28 cells)
  const grid = gridDays.slice(-28);

  const DOW = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div className="mb-3">
        <SectionLabel>Habit Adherence — Last 4 Weeks</SectionLabel>
      </div>

      <div className="flex flex-wrap gap-3">
        {(habits as any[]).map((h) => {
          const assignedAt = normDate(h.assignedAt);
          const eligible = days.filter((d) => d >= assignedAt && d <= today);
          const done = eligible.filter((d) => completedSet.has(`${h.id}:${d}`));
          const pct = eligible.length > 0 ? Math.round((done.length / eligible.length) * 100) : null;
          const pctColor =
            pct === null ? "text-muted-foreground"
            : pct >= 80 ? "text-green-500"
            : pct >= 50 ? "text-amber-500"
            : "text-red-500";

          return (
            <div key={h.id} className="bg-card border border-border rounded-lg p-3 min-w-[160px]">
              {/* Name + % */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[110px]">{h.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {h.frequency === "daily" ? "Daily" : `${h.targetDays}×/wk`}
                    {eligible.length > 0 && ` · ${done.length}/${eligible.length}`}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${pctColor}`}>
                  {pct !== null ? `${pct}%` : "—"}
                </span>
              </div>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
                {DOW.map((l, i) => (
                  <div key={i} className="text-center text-[8px] text-muted-foreground/60 font-medium">{l}</div>
                ))}
              </div>

              {/* 4 × 7 dot grid */}
              <div className="grid grid-cols-7 gap-[3px]">
                {grid.map((iso, idx) => {
                  if (!iso) return <div key={idx} className="w-[10px] h-[10px]" />;
                  const before = iso < assignedAt;
                  const future = iso > today;
                  const hit = completedSet.has(`${h.id}:${iso}`);
                  const isToday = iso === today;

                  let cls = "bg-transparent";
                  if (!before && !future) cls = hit ? "bg-primary" : "bg-muted/40";

                  return (
                    <div
                      key={idx}
                      title={iso}
                      className={`w-[10px] h-[10px] rounded-[2px] ${cls} ${isToday ? "ring-1 ring-primary/60" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── HabitsSection (coach habit library management) ──────────────────────────

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
    onSuccess: () => { utils.habits.list.invalidate(); setShowAdd(false); setNewName(""); },
  });
  const updateMut = trpc.habits.update.useMutation({
    onSuccess: () => { utils.habits.list.invalidate(); setEditingId(null); },
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
          <div className="flex gap-2">
            <Button size="sm" disabled={!newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name: newName.trim(), frequency: newFrequency, targetDays: newFrequency === "x_per_week" ? newTargetDays : undefined })}>
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
            <div key={h.id} className="bg-card border border-border rounded-xl p-4">
              {editingId === h.id ? (
                <div className="space-y-3">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
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
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!editName.trim() || updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: h.id, name: editName.trim(), frequency: editFrequency, targetDays: editFrequency === "x_per_week" ? editTargetDays : undefined })}>
                      {updateMut.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.frequency === "daily" ? "Daily" : `${h.targetDays}x/week`}
                      {(h.assignedUsers?.length ?? 0) > 0 && ` · ${h.assignedUsers.length} client${h.assignedUsers.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingId(h.id); setEditName(h.name); setEditFrequency((h.frequency ?? "daily") as any); setEditTargetDays(h.targetDays ?? 5); }}
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
