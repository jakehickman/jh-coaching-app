import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { toast } from "sonner";
import { SectionLabel, Card } from "./shared";

// ─── ManageEquipmentTab ───────────────────────────────────────────────────────
export default function ManageEquipmentTab() {
  const utils = trpc.useUtils();
  const { data: allPresets = [], isLoading } = trpc.equipmentPresets.listAll.useQuery();

  const renameMutation = trpc.equipmentPresets.rename.useMutation({
    onSuccess: () => {
      utils.equipmentPresets.listAll.invalidate();
      setRenamingId(null);
      setRenameValue("");
      toast.success("Preset renamed.");
    },
    onError: () => toast.error("Failed to rename preset."),
  });

  const deleteMutation = trpc.equipmentPresets.delete.useMutation({
    onSuccess: () => {
      utils.equipmentPresets.listAll.invalidate();
      toast.success("Preset deleted.");
    },
    onError: () => toast.error("Failed to delete preset."),
  });

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  // Group presets by exercise name
  const grouped: Record<string, typeof allPresets> = {};
  for (const p of allPresets as any[]) {
    if (!grouped[p.exerciseName]) grouped[p.exerciseName] = [];
    grouped[p.exerciseName].push(p);
  }
  const exerciseNames = Object.keys(grouped).sort();

  function startRename(preset: any) {
    setRenamingId(preset.id);
    setRenameValue(preset.presetName);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || !renamingId) { setRenamingId(null); return; }
    renameMutation.mutate({ id: renamingId, newName: trimmed });
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (exerciseNames.length === 0) {
    return (
      <Card className="text-center py-12">
        <Settings size={32} className="mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground">No machine presets yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Presets are saved automatically when you log a workout with a machine selected.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Machine presets are saved per exercise. Renaming a preset updates all past sessions automatically.
      </p>
      {exerciseNames.map(exName => {
        const presets = grouped[exName];
        const isOpen = expandedExercise === exName;
        return (
          <Card key={exName} className="overflow-hidden p-0">
            {/* Exercise header row */}
            <button
              onClick={() => setExpandedExercise(isOpen ? null : exName)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{exName}</p>
                <span className="flex-shrink-0 text-[10px] font-semibold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                  {presets.length} {presets.length === 1 ? "preset" : "presets"}
                </span>
              </div>
              {isOpen
                ? <ChevronUp size={16} className="text-muted-foreground flex-shrink-0" />
                : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
              }
            </button>

            {/* Preset list */}
            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {(presets as any[]).map((preset: any) => (
                  <div key={preset.id} className="px-4 py-3">
                    {renamingId === preset.id ? (
                      /* ── Rename mode ── */
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                          autoFocus
                          className="flex-1 bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={commitRename}
                          disabled={!renameValue.trim() || renameMutation.isPending}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={cancelRename}
                          className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      /* ── Display mode ── */
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{preset.presetName}</p>
                          {preset.lastSettings && (
                            <p className="text-xs text-muted-foreground mt-0.5">Last settings: {preset.lastSettings}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => startRename(preset)}
                            title="Rename preset"
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/70 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete preset "${preset.presetName}"? This won't affect past session records.`))
                                deleteMutation.mutate({ id: preset.id });
                            }}
                            disabled={deleteMutation.isPending}
                            title="Delete preset"
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
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
          </Card>
        );
      })}
    </div>
  );
}
