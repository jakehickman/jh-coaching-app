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

function formatTopSet(entry: TopSetEntry): string {
  if (!entry.topSet) return "—";
  const { weight, reps } = entry.topSet;
  if (weight == null && reps == null) return "—";
  const unit = (entry as any).weightUnit ?? 'kg';
  const wStr = weight != null ? `${weight}${unit}` : "BW";
  const rStr = reps != null ? `× ${reps}` : "";
  return `${wStr}${rStr ? " " + rStr : ""}`;
}

function formatSets(entry: TopSetEntry): string {
  if (!entry.topSet || entry.totalSets === 0) return "";
  return `(${entry.totalSets} set${entry.totalSets !== 1 ? "s" : ""})`;
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Review Table ─────────────────────────────────────────────────────────────

function MesocycleReviewTable({ review }: { review: ReviewData }) {
  const cols = Array.from({ length: review.maxMicro }, (_, i) => i + 1);

  if (review.dayReviews.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No sessions logged for this mesocycle yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground w-44 sticky left-0 bg-background z-10">
              Exercise
            </th>
            {cols.map(micro => (
              <th key={micro} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[110px]">
                <div className="text-xs font-semibold">Micro {micro}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {review.dayReviews.map((day, di) => (
            <React.Fragment key={`day-group-${di}`}>
              {/* Day group header */}
              <tr key={`day-${di}`} className="border-t border-border/60">
                <td
                  colSpan={cols.length + 1}
                  className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 sticky left-0"
                >
                  {day.dayLabel}
                  {/* Show dates per microcycle inline */}
                  <span className="ml-3 font-normal normal-case tracking-normal">
                    {cols.map(micro => {
                      const anyEx = day.exercises[0];
                      const entry = anyEx?.microcycles.find(m => m.microNum === micro);
                      return entry?.sessionDate ? (
                        <span key={micro} className="mr-4 text-muted-foreground/60">
                          Micro {micro}: {formatDate(entry.sessionDate)}
                        </span>
                      ) : null;
                    })}
                  </span>
                </td>
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
                    const hasData = entry?.topSet != null;
                    return (
                      <td key={micro} className="py-2.5 px-2 text-center">
                        {entry ? (
                          <div className={`text-xs leading-tight ${hasData ? "text-foreground" : "text-muted-foreground/40"}`}>
                            <div className="font-medium">{formatTopSet(entry)}</div>
                            {hasData && (
                              <div className="text-muted-foreground/60 text-xs mt-0.5">
                                {formatSets(entry)}
                              </div>
                            )}
                            {entry.machinePreset && (
                              <div className="text-muted-foreground/50 text-xs mt-0.5 italic truncate max-w-[100px] mx-auto">
                                {entry.machinePreset}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
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
