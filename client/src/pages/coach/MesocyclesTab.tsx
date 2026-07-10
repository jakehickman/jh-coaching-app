import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, ChevronRight, X, Check, Loader2, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopSetEntry {
  microNum: number;
  sessionDate: string;
  topSet: { weight: number | null; reps: number | null } | null;
  totalSets: number;
  machinePreset?: string | null;
  weightUnit?: string | null;
}

interface ExerciseReview {
  exerciseName: string;
  microcycles: TopSetEntry[];
}

interface DayReview {
  dayLabel: string;
  exercises: ExerciseReview[];
}

interface ReviewData {
  meso: {
    id: number;
    mesoName: string;
    startDate: string;
    closedAt: Date | null;
    notes: string | null;
  };
  maxMicro: number;
  dayReviews: DayReview[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a comparable "volume" score for a top set: weight × reps (or reps/weight alone). */
function topSetScore(entry: TopSetEntry | undefined): number | null {
  if (!entry?.topSet) return null;
  const { weight, reps } = entry.topSet;
  if (weight != null && reps != null) return weight * reps;
  if (weight != null) return weight;
  if (reps != null) return reps;
  return null;
}

/** Background tint colour based on progression vs previous microcycle. */
function cellBg(current: TopSetEntry | undefined, prev: TopSetEntry | undefined): string {
  const cur = topSetScore(current);
  const prv = topSetScore(prev);
  if (cur == null || prv == null) return "transparent";
  if (cur > prv) return "rgba(82,183,136,0.12)";
  if (cur < prv) return "rgba(239,68,68,0.09)";
  return "transparent";
}

/** Net delta label from first logged microcycle to latest logged microcycle. */
function deltaLabel(entries: TopSetEntry[]): string | null {
  const logged = entries.filter(e => e.topSet != null);
  if (logged.length < 2) return null;
  const first = logged[0];
  const last = logged[logged.length - 1];
  const unit = first.weightUnit ?? "kg";
  const fw = first.topSet?.weight;
  const lw = last.topSet?.weight;
  const fr = first.topSet?.reps;
  const lr = last.topSet?.reps;
  const parts: string[] = [];
  if (fw != null && lw != null && lw !== fw) {
    const diff = lw - fw;
    parts.push(`${diff > 0 ? "+" : ""}${diff}${unit}`);
  }
  if (fr != null && lr != null && lr !== fr) {
    const diff = lr - fr;
    parts.push(`${diff > 0 ? "+" : ""}${diff} rep${Math.abs(diff) !== 1 ? "s" : ""}`);
  }
  if (parts.length === 0) return "=";
  return parts.join(" / ");
}


function formatTopSet(entry: TopSetEntry): string {
  if (!entry.topSet) return "—";
  const { weight, reps } = entry.topSet;
  if (weight == null && reps == null) return "—";
  const unit = entry.weightUnit ?? 'kg';
  const wStr = weight != null ? `${weight}${unit}` : "BW";
  const rStr = reps != null ? `× ${reps}` : "";
  return `${wStr}${rStr ? " " + rStr : ""}`;
}

function formatSets(entry: TopSetEntry): string {
  if (!entry.topSet || entry.totalSets === 0) return "";
  return `${entry.totalSets} set${entry.totalSets !== 1 ? "s" : ""}`;
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Review Table ─────────────────────────────────────────────────────────────

const TOTAL_MICROS = 8;

function MesocycleReviewTable({ review }: { review: ReviewData }) {
  // Always show 8 columns regardless of how many have data
  const cols = Array.from({ length: TOTAL_MICROS }, (_, i) => i + 1);

  if (review.dayReviews.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No sessions logged for this mesocycle yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground w-44 sticky left-0 bg-background z-10">
              Exercise
            </th>
            {cols.map(micro => (
              <th key={micro} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[100px]">
                <div className="text-xs font-semibold">Micro {micro}</div>
              </th>
            ))}
            <th className="text-center py-2 px-3 font-medium text-muted-foreground min-w-[80px] sticky right-0 bg-background z-10">
              <div className="text-xs font-semibold">Δ</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {review.dayReviews.map((day, di) => (
            <React.Fragment key={`day-group-${di}`}>
              {/* Day group header */}
              <tr key={`day-${di}`} className="border-t border-border/60">
                <td
                  className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 sticky left-0 z-10"
                >
                  {day.dayLabel}
                </td>
                {/* Session date per microcycle column — aligned with performance data */}
                {cols.map(micro => {
                  const anyEx = day.exercises[0];
                  const entry = anyEx?.microcycles.find(m => m.microNum === micro);
                  return (
                    <td key={micro} className="py-2 px-2 text-center bg-muted/20">
                      {entry?.sessionDate ? (
                        <span className="text-xs text-muted-foreground/60">
                          {formatDate(entry.sessionDate)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/20 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 px-2 bg-muted/20 sticky right-0 z-10" />
              </tr>
              {day.exercises.map((ex, ei) => (
                <tr
                  key={`ex-${di}-${ei}`}
                  className="border-t border-border/30 hover:bg-muted/10 transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium sticky left-0 bg-background z-10 max-w-[176px] truncate">
                    {ex.exerciseName}
                  </td>
                  {cols.map(micro => {
                    const entry = ex.microcycles.find(m => m.microNum === micro);
                    const prevEntry = micro > 1 ? ex.microcycles.find(m => m.microNum === micro - 1) : undefined;
                    const hasData = entry?.topSet != null;
                    const bg = cellBg(entry, prevEntry);
                    return (
                      <td
                        key={micro}
                        className="py-2.5 px-2 text-center relative group/cell transition-colors"
                        title={entry?.machinePreset ?? undefined}
                        style={{ background: bg }}
                      >
                        {entry ? (
                          <div className={`text-xs leading-tight ${hasData ? "text-foreground" : "text-muted-foreground/40"}`}>
                            <div className="font-medium">{formatTopSet(entry)}</div>
                            {hasData && (
                              <div className="text-muted-foreground/60 text-xs mt-0.5">
                                {formatSets(entry)}
                              </div>
                            )}
                            {entry.machinePreset && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover/cell:block pointer-events-none">
                                <div className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs shadow-lg"
                                  style={{ background: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--popover-foreground)' }}>
                                  {entry.machinePreset}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                  {/* Delta column */}
                  {(() => {
                    const delta = deltaLabel(ex.microcycles);
                    const logged = ex.microcycles.filter(e => e.topSet != null);
                    const first = logged[0];
                    const last = logged[logged.length - 1];
                    const isPositive = delta && delta !== "=" && !delta.startsWith("-") && delta !== null;
                    const isNegative = delta && (delta.startsWith("-") || delta.includes("/-"));
                    return (
                      <td className="py-2.5 px-3 text-center sticky right-0 bg-background z-10">
                        {delta ? (
                          <span className={`text-xs font-semibold ${
                            delta === "=" ? "text-muted-foreground/50" :
                            isPositive ? "text-green-400" : "text-red-400"
                          }`}>
                            {delta}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/20 text-xs">—</span>
                        )}
                      </td>
                    );
                  })()}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Single Mesocycle Card ────────────────────────────────────────────────────

function MesocycleCard({
  meso,
  clientId,
  onRefresh,
}: {
  meso: { id: number; mesoName: string; startDate: string; closedAt: Date | null; notes: string | null };
  clientId: number;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reviewQuery = trpc.meso.review.useQuery(
    { mesoId: meso.id, userId: clientId },
    { enabled: expanded }
  );

  const closeMutation = trpc.meso.close.useMutation({
    onSuccess: () => { toast.success("Mesocycle closed"); onRefresh(); setConfirmClose(false); },
    onError: () => toast.error("Failed to close mesocycle"),
  });

  const deleteMutation = trpc.meso.delete.useMutation({
    onSuccess: () => { toast.success("Mesocycle deleted"); onRefresh(); },
    onError: () => toast.error("Failed to delete mesocycle"),
  });

  const isActive = !meso.closedAt;

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 active:opacity-70 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            size={16}
            className={`text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{meso.mesoName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Started {formatDate(meso.startDate)}
              {meso.closedAt && (
                <span className="ml-2 text-muted-foreground/60">
                  · Closed {formatDate(meso.closedAt as unknown as Date)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
          {isActive && !confirmClose && !confirmDelete && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setConfirmClose(true)}
              >
                <Lock size={12} className="mr-1" />
                Close
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={12} />
              </Button>
            </>
          )}
          {!isActive && !confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={12} />
            </Button>
          )}
          {confirmClose && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Close this meso?</span>
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => closeMutation.mutate({ id: meso.id })}
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmClose(false)}
              >
                <X size={12} />
              </Button>
            </div>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Delete?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-xs"
                onClick={() => deleteMutation.mutate({ id: meso.id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                <X size={12} />
              </Button>
            </div>
          )}
          {isActive && (
            <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Review table */}
      {expanded && (
        <div className="border-t border-border/40 px-4 py-4">
          {reviewQuery.isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading review data...
            </div>
          )}
          {reviewQuery.data && (
            <MesocycleReviewTable review={reviewQuery.data as unknown as ReviewData} />
          )}
          {reviewQuery.isError && (
            <div className="text-destructive text-sm py-4">Failed to load review data.</div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Create Form ─────────────────────────────────────────────────────────────

function CreateMesocycleForm({
  clientId,
  onCreated,
  onCancel,
}: {
  clientId: number;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today);

  const createMutation = trpc.meso.create.useMutation({
    onSuccess: () => {
      toast.success("Mesocycle created");
      onCreated();
    },
    onError: () => toast.error("Failed to create mesocycle"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Please enter a name"); return; }
    createMutation.mutate({ userId: clientId, mesoName: name.trim(), startDate });
  };

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-3">New Mesocycle</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Name</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Hypertrophy Block 1"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs">
            Cancel
          </Button>
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            Create
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function MesocyclesTab({ clientId }: { clientId: number }) {
  const [showCreate, setShowCreate] = useState(false);

  const cyclesQuery = trpc.meso.cyclesForClient.useQuery({ userId: clientId });
  const utils = trpc.useUtils();

  const refresh = () => utils.meso.cyclesForClient.invalidate({ userId: clientId });

  const cycles = ((cyclesQuery.data ?? []) as unknown) as Array<{
    id: number;
    mesoName: string;
    startDate: string;
    closedAt: Date | null;
    notes: string | null;
  }>;

  const active = cycles.filter(c => !c.closedAt);
  const closed = cycles.filter(c => c.closedAt);

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-base">Mesocycles</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Track exercise progression across 8-microcycle training blocks
          </div>
        </div>
        {!showCreate && active.length === 0 && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowCreate(true)}>
            <Plus size={13} />
            New Mesocycle
          </Button>
        )}
        {!showCreate && active.length > 0 && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowCreate(true)}>
            <Plus size={13} />
            New Mesocycle
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateMesocycleForm
          clientId={clientId}
          onCreated={() => { setShowCreate(false); refresh(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Loading */}
      {cyclesQuery.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
          <Loader2 size={16} className="animate-spin" />
          Loading mesocycles...
        </div>
      )}

      {/* Active mesocycles */}
      {active.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</div>
          {active.map(meso => (
            <MesocycleCard key={meso.id} meso={meso} clientId={clientId} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Closed mesocycles */}
      {closed.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">Closed</div>
          {closed.map(meso => (
            <MesocycleCard key={meso.id} meso={meso} clientId={clientId} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!cyclesQuery.isLoading && cycles.length === 0 && !showCreate && (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border/50 rounded-xl">
          <div className="font-medium mb-1">No mesocycles yet</div>
          <div className="text-xs">Create one to start tracking exercise progression across training blocks.</div>
        </div>
      )}
    </div>
  );
}
