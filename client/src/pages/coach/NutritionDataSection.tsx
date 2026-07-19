import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, Plus, Save, X, Pencil, Trash2 } from "lucide-react";
import { Card } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Types & constants ───────────────────────────────────────────────────────

type FoodRow = {
  id?: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
};

const EMPTY_FOOD: FoodRow = {
  name: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fiber: 0,
  fat: 0,
};

// ─── ServingsEditor ──────────────────────────────────────────────────────────

function ServingsEditor({ foodId }: { foodId: number }) {
  const { data: servings = [], refetch } = trpc.nutritionFoods.getServings.useQuery({ foodId });
  const upsertServing = trpc.nutritionFoods.upsertServing.useMutation({ onSuccess: () => refetch() });
  const deleteServing = trpc.nutritionFoods.deleteServing.useMutation({ onSuccess: () => refetch() });
  const [confirmServing, ConfirmServingNode] = useConfirm();
  const [newLabel, setNewLabel] = useState("");
  const [newGrams, setNewGrams] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editGrams, setEditGrams] = useState("");

  function addServing() {
    const g = parseFloat(newGrams);
    if (!newLabel.trim() || isNaN(g) || g <= 0) { toast.error("Enter a valid label and gram weight"); return; }
    upsertServing.mutate({ foodId, label: newLabel.trim(), grams: g });
    setNewLabel(""); setNewGrams("");
  }
  function startEditServing(s: { id: number; label: string; grams: number }) {
    setEditingId(s.id); setEditLabel(s.label); setEditGrams(String(s.grams));
  }
  function saveEditServing() {
    const g = parseFloat(editGrams);
    if (!editLabel.trim() || isNaN(g) || g <= 0) { toast.error("Enter a valid label and gram weight"); return; }
    upsertServing.mutate({ id: editingId!, foodId, label: editLabel.trim(), grams: g });
    setEditingId(null);
  }

  return (
    <div className="space-y-2">
      {ConfirmServingNode}
      {servings.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No serving sizes defined. The "100g" option is always available by default.</p>
      )}
      {servings.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          {editingId === s.id ? (
            <>
              <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="e.g. 1 cup" className="flex-1 px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input value={editGrams} onChange={(e) => setEditGrams(e.target.value)} placeholder="grams" type="number" min="0.1" step="0.1" className="w-24 px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <span className="text-xs text-muted-foreground">g</span>
              <button onClick={saveEditServing} className="text-primary hover:opacity-80" title="Save"><Save size={13} /></button>
              <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground" title="Cancel"><X size={13} /></button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-foreground">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.grams}g</span>
              <button onClick={() => startEditServing(s as any)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit"><Pencil size={12} /></button>
              <button onClick={async () => { const ok = await confirmServing({ title: `Delete "${s.label}"?`, description: "This serving size will be removed.", confirmLabel: "Delete", variant: "destructive" }); if (ok) deleteServing.mutate({ id: s.id! }); }} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 size={12} /></button>
            </>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. 1 cup, 1 breast)" className="flex-1 px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" onKeyDown={(e) => e.key === "Enter" && addServing()} />
        <input value={newGrams} onChange={(e) => setNewGrams(e.target.value)} placeholder="grams" type="number" min="0.1" step="0.1" className="w-24 px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" onKeyDown={(e) => e.key === "Enter" && addServing()} />
        <span className="text-xs text-muted-foreground">g</span>
        <button onClick={addServing} disabled={upsertServing.isPending} className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"><Plus size={11} /> Add</button>
      </div>
    </div>
  );
}

const MACRO_FIELDS = [
  { key: "calories" as const, label: "Calories", unit: "kcal", step: 1 },
  { key: "protein" as const, label: "Protein", unit: "g", step: 0.1 },
  { key: "carbs" as const, label: "Carbs", unit: "g", step: 0.1 },
  { key: "fiber" as const, label: "Fiber", unit: "g", step: 0.1 },
  { key: "fat" as const, label: "Fat", unit: "g", step: 0.1 },
];

// ─── NutritionDataSection ────────────────────────────────────────────────────

export default function NutritionDataSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const { data: foods = [], refetch } = trpc.nutritionFoods.list.useQuery();
  const upsert = trpc.nutritionFoods.upsert.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
      toast.success("Saved");
    },
  });
  const del = trpc.nutritionFoods.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Deleted");
    },
  });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = foods.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  function startNew() {
    setEditing({ ...EMPTY_FOOD });
    setIsNew(true);
  }
  function startEdit(f: FoodRow) {
    setEditing({ ...f });
    setIsNew(false);
  }
  function saveEditing() {
    if (!editing || !editing.name.trim()) {
      toast.error("Food name is required");
      return;
    }
    upsert.mutate(editing as any);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search foods…"
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> Add Food
        </button>
      </div>

      {editing && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {isNew ? "Add New Food" : `Edit: ${editing.name}`}
            </p>
            <button
              onClick={() => setEditing(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>
          <input
            value={editing.name}
            onChange={(e) =>
              setEditing((prev) =>
                prev ? { ...prev, name: e.target.value } : prev
              )
            }
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MACRO_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                  {f.label} ({f.unit})
                </label>
                <input
                  type="number"
                  step={f.step}
                  min="0"
                  value={(editing as any)[f.key] ?? 0}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            [f.key]: parseFloat(e.target.value) || 0,
                          }
                        : prev
                    )
                  }
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          {/* Serving sizes — only for existing foods */}
          {!isNew && editing.id ? (
            <div>
              <label className="block text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                Serving Sizes
              </label>
              <ServingsEditor foodId={editing.id} />
            </div>
          ) : isNew ? (
            <p className="text-xs text-muted-foreground italic">
              Save the food first, then reopen it to add serving sizes.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            All macro values are per 100g. The "100g" serving is always available by default.
          </p>
          <div className="flex gap-2 justify-end">
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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[200px]">
                Food
              </th>
              {MACRO_FIELDS.map((f) => (
                <th
                  key={f.key}
                  className="px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold text-right min-w-[80px]"
                >
                  {f.label}
                  <br />
                  <span className="text-xs normal-case font-normal">
                    (per 100g)
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold text-left min-w-[100px]">
                Serving
              </th>
              <th className="px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  No foods found
                </td>
              </tr>
            )}
            {filtered.map((food, i) => (
              <tr
                key={food.id}
                className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
                  i % 2 === 0 ? "" : "bg-secondary/10"
                }`}
              >
                <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card">
                  {food.name}
                </td>
                <td className="px-3 py-2.5 text-right text-foreground">
                  {food.calories}
                </td>
                <td className="px-3 py-2.5 text-right text-foreground">
                  {food.protein}
                </td>
                <td className="px-3 py-2.5 text-right text-foreground">
                  {food.carbs}
                </td>
                <td className="px-3 py-2.5 text-right text-foreground">
                  {food.fiber}
                </td>
                <td className="px-3 py-2.5 text-right text-foreground">
                  {food.fat}
                </td>
                <td className="px-3 py-2.5 text-left text-foreground text-xs">
                  {(food as any).servings?.length > 0 ? (
                    <span className="text-muted-foreground">
                      {(food as any).servings.length} defined
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">100g only</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => startEdit(food as FoodRow)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete "${food.name}"?`,
                          description: "This will remove the food from the nutrition database.",
                          confirmLabel: "Delete",
                          variant: "destructive",
                        });
                        if (ok) del.mutate({ id: food.id! });
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} food{filtered.length !== 1 ? "s" : ""} · All
        nutritional values sourced from USDA SR Legacy (per 100g)
      </p>
      {ConfirmDialogNode}
    </div>
  );
}
