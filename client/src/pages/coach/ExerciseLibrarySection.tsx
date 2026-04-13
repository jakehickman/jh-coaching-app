import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, Plus, Save, X, Pencil, Trash2, Play } from "lucide-react";
import { Card } from "./shared";
import type { MuscleKey } from "@shared/types";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Constants & types ───────────────────────────────────────────────────────

export const MUSCLE_GROUPS: { key: MuscleKey; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "frontDelts", label: "Front Delts" },
  { key: "sideDelts", label: "Side Delts" },
  { key: "triceps", label: "Triceps" },
  { key: "lats", label: "Lats" },
  { key: "upperBack", label: "Upper Back" },
  { key: "rearDelts", label: "Rear Delts" },
  { key: "biceps", label: "Biceps" },
  { key: "quads", label: "Quads" },
  { key: "hams", label: "Hams" },
  { key: "glutes", label: "Glute Max" },
  { key: "gluteMed", label: "Glute Med" },
  { key: "calves", label: "Calves" },
  { key: "abs", label: "Abs" },
];

type ExerciseRow = {
  id?: number;
  name: string;
  chest: number;
  frontDelts: number;
  sideDelts: number;
  triceps: number;
  lats: number;
  upperBack: number;
  rearDelts: number;
  biceps: number;
  quads: number;
  hams: number;
  glutes: number;
  gluteMed: number;
  calves: number;
  abs: number;
  videoUrl?: string;
};

const EMPTY_EXERCISE: ExerciseRow = {
  name: "",
  chest: 0,
  frontDelts: 0,
  sideDelts: 0,
  triceps: 0,
  lats: 0,
  upperBack: 0,
  rearDelts: 0,
  biceps: 0,
  quads: 0,
  hams: 0,
  glutes: 0,
  gluteMed: 0,
  calves: 0,
  abs: 0,
  videoUrl: "",
};

// ─── ExerciseLibrarySection ──────────────────────────────────────────────────

export default function ExerciseLibrarySection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const { data: exercises = [], refetch } =
    trpc.exerciseLibrary.list.useQuery();
  const upsert = trpc.exerciseLibrary.upsert.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
      toast.success("Saved");
    },
    onError: (err) => {
      // MySQL unique constraint violation code
      const isDuplicate = err.message?.includes("Duplicate entry") || err.message?.includes("unique");
      toast.error(isDuplicate ? "An exercise with that name already exists" : (err.message || "Save failed"));
    },
  });
  const del = trpc.exerciseLibrary.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Deleted");
    },
  });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  // String versions of muscle group values so dot-decimal and backspace work correctly
  const [muscleStrings, setMuscleStrings] = useState<Record<string, string>>({});
  const [isNew, setIsNew] = useState(false);

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  function startNew() {
    setEditing({ ...EMPTY_EXERCISE });
    const strings: Record<string, string> = {};
    MUSCLE_GROUPS.forEach(mg => { strings[mg.key] = "0"; });
    setMuscleStrings(strings);
    setIsNew(true);
  }

  function startEdit(ex: ExerciseRow) {
    setEditing({ ...ex });
    const strings: Record<string, string> = {};
    MUSCLE_GROUPS.forEach(mg => { strings[mg.key] = String((ex as any)[mg.key] ?? 0); });
    setMuscleStrings(strings);
    setIsNew(false);
  }

  function saveEditing() {
    if (!editing || !editing.name.trim()) {
      toast.error("Exercise name is required");
      return;
    }
    // Client-side duplicate check (case-insensitive, excluding the exercise being edited)
    const trimmedName = editing.name.trim().toLowerCase();
    const duplicate = exercises.find(
      (e) => e.name.trim().toLowerCase() === trimmedName && e.id !== editing.id
    );
    if (duplicate) {
      toast.error(`An exercise named "${duplicate.name}" already exists`);
      return;
    }
    const payload = { ...editing, name: editing.name.trim(), videoUrl: editing.videoUrl || undefined };
    upsert.mutate(payload as any);
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> Add Exercise
        </button>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} exercise{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Desktop: side-by-side form + table when editing */}
      <div
        className={
          editing
            ? "grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start"
            : ""
        }
      >
        {/* Edit / Add form */}
        {editing && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {isNew ? "Add New Exercise" : `Edit: ${editing.name}`}
              </p>
              <button
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={15} />
              </button>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                Exercise Name
              </label>
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev
                  )
                }
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                Demo Video URL (YouTube)
              </label>
              <input
                value={editing.videoUrl ?? ""}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, videoUrl: e.target.value } : prev
                  )
                }
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MUSCLE_GROUPS.map((mg) => (
                <div key={mg.key}>
                  <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                    {mg.label}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={muscleStrings[mg.key] ?? String((editing as any)[mg.key] ?? 0)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Allow empty, digits, and a single dot
                      if (!/^\d*\.?\d*$/.test(raw)) return;
                      setMuscleStrings(prev => ({ ...prev, [mg.key]: raw }));
                      const num = parseFloat(raw);
                      if (!isNaN(num)) {
                        setEditing(prev => prev ? { ...prev, [mg.key]: Math.min(1, Math.max(0, num)) } : prev);
                      } else if (raw === "" || raw === ".") {
                        setEditing(prev => prev ? { ...prev, [mg.key]: 0 } : prev);
                      }
                    }}
                    onBlur={() => {
                      // Normalise on blur: empty → "0"
                      const num = parseFloat(muscleStrings[mg.key] ?? "");
                      const clamped = isNaN(num) ? 0 : Math.min(1, Math.max(0, num));
                      setMuscleStrings(prev => ({ ...prev, [mg.key]: String(clamped) }));
                      setEditing(prev => prev ? { ...prev, [mg.key]: clamped } : prev);
                    }}
                    className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveEditing}
                disabled={upsert.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Save size={13} /> {upsert.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </Card>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[300px]">
                  Exercise
                </th>
                {MUSCLE_GROUPS.map((mg) => (
                  <th
                    key={mg.key}
                    className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[70px]"
                  >
                    {mg.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={MUSCLE_GROUPS.length + 2}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    No exercises found
                  </td>
                </tr>
              )}
              {filtered.map((ex, i) => (
                <tr
                  key={ex.id}
                  className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-secondary/10"
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{ex.name}</span>
                      {(ex as any).videoUrl && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400">
                          <Play size={8} />
                          Video
                        </span>
                      )}
                    </div>
                  </td>
                  {MUSCLE_GROUPS.map((mg) => {
                    const val = ((ex as any)[mg.key] as number) ?? 0;
                    return (
                      <td key={mg.key} className="px-3 py-2.5 text-center">
                        {val > 0 ? (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                              val >= 1
                                ? "bg-primary/20 text-primary"
                                : "bg-primary/10 text-primary/70"
                            }`}
                          >
                            {val}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(ex as unknown as ExerciseRow)}
                        className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete "${ex.name}"?`,
                            description: "This will remove the exercise from the library. Existing programs that reference it will keep the name as text.",
                            confirmLabel: "Delete",
                            variant: "destructive",
                          });
                          if (ok) del.mutate({ id: ex.id! });
                        }}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Values represent sets contributed per set performed (e.g. 0.5 = half a
        set)
      </p>
      {ConfirmDialogNode}
    </div>
  );
}
