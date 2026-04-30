import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

const PHASE_LABELS = ["Gaining", "Mini Cut", "General Fat Loss", "Contest Prep"] as const;
type PhaseLabel = typeof PHASE_LABELS[number];

const PHASE_COLORS: Record<PhaseLabel, { bg: string; text: string; border: string }> = {
  "Gaining":          { bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30" },
  "Mini Cut":         { bg: "bg-orange-500/15",  text: "text-orange-400", border: "border-orange-500/30" },
  "General Fat Loss": { bg: "bg-emerald-500/15", text: "text-emerald-400",border: "border-emerald-500/30" },
  "Contest Prep":     { bg: "bg-purple-500/15",  text: "text-purple-400", border: "border-purple-500/30" },
};

type Phase = {
  id: number;
  clientId: number;
  label: PhaseLabel;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  startWeight: number | null;
  targetWeight: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type WeekData = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  avgWeight: number | null;
  avgWaist: number | null;
  avgSkinfold: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function toIsoDate(val: string | Date | null | undefined): string | null {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  // Already a YYYY-MM-DD string
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return String(val);
  // Fallback: parse and re-format
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string | null | undefined): string {
  const safe = toIsoDate(iso);
  if (!safe) return "—";
  const d = new Date(safe + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function getPhaseStatus(phase: Phase, today: string): "active" | "upcoming" | "completed" {
  const start = toIsoDate(phase.startDate) ?? "";
  const end = toIsoDate(phase.endDate);
  if (start > today) return "upcoming";
  if (!end || end >= today) return "active";
  return "completed";
}

function DeltaVal({ val, prev, unit = "", invert = false }: { val: number | null; prev: number | null; unit?: string; invert?: boolean }) {
  if (val == null || prev == null) return <span className="text-muted-foreground text-xs">—</span>;
  const delta = val - prev;
  if (Math.abs(delta) < 0.05) return <span className="text-muted-foreground text-xs">±0{unit}</span>;
  const isPositive = delta > 0;
  const isGood = invert ? !isPositive : isPositive;
  const colour = isGood ? "text-emerald-400" : "text-rose-400";
  const Icon = isPositive ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colour}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(delta).toFixed(1)}{unit}
    </span>
  );
}

/** Calculate rate of change as % body weight per week */
function calcRateOfChange(startWeight: number | null, targetWeight: number | null, durationWeeks: number): string | null {
  if (startWeight == null || targetWeight == null || startWeight <= 0 || durationWeeks <= 0) return null;
  const rate = ((targetWeight - startWeight) / startWeight / durationWeeks) * 100;
  if (Math.abs(rate) < 0.001) return "0% / wk";
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)}% / wk`;
}

// ── Phase Form ────────────────────────────────────────────────────────────────

type PhaseFormState = {
  label: PhaseLabel;
  startDate: string;
  durationWeeks: string; // "" = ongoing / no fixed end
  notes: string;
  startWeight: string;
  targetWeight: string;
};

function PhaseFormDialog({
  open,
  onClose,
  onSave,
  initial,
  title,
  defaultStartWeight,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: PhaseFormState) => void;
  initial?: Partial<PhaseFormState>;
  title: string;
  defaultStartWeight?: number | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<PhaseFormState>({
    label: initial?.label ?? "Gaining",
    startDate: initial?.startDate ?? today,
    durationWeeks: initial?.durationWeeks ?? "",
    notes: initial?.notes ?? "",
    startWeight: initial?.startWeight ?? (defaultStartWeight != null ? String(defaultStartWeight) : ""),
    targetWeight: initial?.targetWeight ?? "",
  });

  // Derived end date preview
  const endDatePreview = useMemo(() => {
    const weeks = parseInt(form.durationWeeks, 10);
    if (!form.startDate || isNaN(weeks) || weeks <= 0) return null;
    return addWeeks(form.startDate, weeks);
  }, [form.startDate, form.durationWeeks]);

  function handleSave() {
    if (!form.startDate) {
      toast.error("Start date is required");
      return;
    }
    onSave(form);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Phase type */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Phase Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PHASE_LABELS.map((l) => {
                const c = PHASE_COLORS[l];
                const selected = form.label === l;
                return (
                  <button
                    key={l}
                    onClick={() => setForm(f => ({ ...f, label: l }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-left ${
                      selected
                        ? `${c.bg} ${c.text} ${c.border}`
                        : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start date + Duration side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Duration (weeks)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.durationWeeks}
                onChange={(e) => setForm(f => ({ ...f, durationWeeks: e.target.value }))}
                placeholder="e.g. 12"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* End date preview */}
          {endDatePreview ? (
            <p className="text-xs text-muted-foreground -mt-1">
              End date: <span className="text-foreground font-medium">{fmtDate(endDatePreview)}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground -mt-1">Leave duration blank for an ongoing phase with no fixed end.</p>
          )}

          {/* Weight targets */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Start Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.startWeight}
                onChange={(e) => setForm(f => ({ ...f, startWeight: e.target.value }))}
                placeholder={defaultStartWeight != null ? String(defaultStartWeight) : "e.g. 82.5"}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Target Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.targetWeight}
                onChange={(e) => setForm(f => ({ ...f, targetWeight: e.target.value }))}
                placeholder="e.g. 78.0"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="e.g. Aggressive deficit, target -0.5kg/week"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Phase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Phase Summary Card ────────────────────────────────────────────────────────

function PhaseSummaryCard({
  phase,
  weeks,
  photoWeeks,
  clientId,
  onEdit,
  onDelete,
}: {
  phase: Phase;
  weeks: WeekData[];
  photoWeeks: number[];
  clientId: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const status = getPhaseStatus(phase, today);
  const c = PHASE_COLORS[phase.label];

  // Normalise dates (guard against Date objects coming through)
  const startDate = toIsoDate(phase.startDate) ?? "";
  const endDate = toIsoDate(phase.endDate);

  // Filter weeks that fall within this phase's date range
  const phaseWeeks = useMemo(() => {
    return weeks.filter((w) => {
      const afterStart = w.weekEnd >= startDate;
      const beforeEnd = !endDate || w.weekStart <= endDate;
      return afterStart && beforeEnd;
    }).sort((a, b) => a.weekNumber - b.weekNumber);
  }, [weeks, startDate, endDate]);

  // First and last week with body comp data
  const weeksWithWeight = phaseWeeks.filter(w => w.avgWeight != null);
  const firstWeek = weeksWithWeight[0] ?? null;
  const lastWeek = weeksWithWeight[weeksWithWeight.length - 1] ?? null;

  const weeksWithWaist = phaseWeeks.filter(w => w.avgWaist != null);
  const firstWaistWeek = weeksWithWaist[0] ?? null;
  const lastWaistWeek = weeksWithWaist[weeksWithWaist.length - 1] ?? null;

  const weeksWithSkinfold = phaseWeeks.filter(w => w.avgSkinfold != null);
  const firstSkinfoldWeek = weeksWithSkinfold[0] ?? null;
  const lastSkinfoldWeek = weeksWithSkinfold[weeksWithSkinfold.length - 1] ?? null;

  // Duration: use endDate if set, otherwise today for active phases
  const endForDuration = endDate ?? today;
  const durationWeeks = startDate ? weeksBetween(startDate, endForDuration) : 0;
  // Planned duration (from endDate only, not today)
  const plannedDurationWeeks = endDate && startDate ? weeksBetween(startDate, endDate) : null;

  // Rate of change from planned weights
  const rateOfChange = calcRateOfChange(
    phase.startWeight,
    phase.targetWeight,
    plannedDurationWeeks ?? durationWeeks
  );

  // Photo weeks within this phase
  const phasePhotoWeekNumbers = phaseWeeks.map(w => w.weekNumber);
  const availablePhotoWeeks = photoWeeks.filter(wn => phasePhotoWeekNumbers.includes(wn));
  const firstPhotoWeek = availablePhotoWeeks[0] ?? null;
  const lastPhotoWeek = availablePhotoWeeks[availablePhotoWeeks.length - 1] ?? null;
  const hasPhotos = firstPhotoWeek != null && lastPhotoWeek != null && firstPhotoWeek !== lastPhotoWeek;

  // Fetch comparison photos only when expanded and photos exist
  const { data: comparePhotos } = trpc.progressPhotos.getForCompare.useQuery(
    { clientId, weekA: firstPhotoWeek!, weekB: lastPhotoWeek! },
    { enabled: expanded && hasPhotos && firstPhotoWeek != null && lastPhotoWeek != null }
  );

  const statusLabel = status === "active" ? "Active" : status === "upcoming" ? "Upcoming" : "Completed";
  const statusClass = status === "active"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : status === "upcoming"
    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    : "bg-secondary text-muted-foreground border-border";

  return (
    <div className={`border rounded-xl overflow-hidden ${c.border} bg-card`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Phase label pill */}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border} flex-shrink-0`}>
          {phase.label}
        </span>

        {/* Dates & duration */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {fmtDate(startDate)}
              {endDate ? ` → ${fmtDate(endDate)}` : status === "active" ? " → Present" : ""}
            </span>
            {plannedDurationWeeks != null && plannedDurationWeeks > 0 ? (
              <span className="text-xs text-muted-foreground">
                ({plannedDurationWeeks} {plannedDurationWeeks === 1 ? "week" : "weeks"})
              </span>
            ) : durationWeeks > 0 && status === "active" ? (
              <span className="text-xs text-muted-foreground">
                ({durationWeeks} {durationWeeks === 1 ? "week" : "weeks"} so far)
              </span>
            ) : null}
          </div>
          {phase.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{phase.notes}</p>
          )}
        </div>

        {/* Status badge */}
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${statusClass}`}>
          {statusLabel}
        </span>

        {/* Rate of change badge */}
        {rateOfChange && (
          <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-secondary text-muted-foreground border-border flex-shrink-0">
            {rateOfChange}
          </span>
        )}

        {/* Quick body comp summary (collapsed) */}
        {status !== "upcoming" && firstWeek && lastWeek && firstWeek !== lastWeek && (
          <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Weight</p>
              <DeltaVal val={lastWeek.avgWeight} prev={firstWeek.avgWeight} unit=" kg" invert />
            </div>
            {firstWaistWeek && lastWaistWeek && firstWaistWeek !== lastWaistWeek && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waist</p>
                <DeltaVal val={lastWaistWeek.avgWaist} prev={firstWaistWeek.avgWaist} unit=" cm" invert />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={15} className="text-muted-foreground ml-1" /> : <ChevronDown size={15} className="text-muted-foreground ml-1" />}
        </div>
      </div>

      {/* Expanded summary */}
      {expanded && (
        <div className="border-t border-border/40 px-5 py-5 space-y-5">
          {status === "upcoming" ? (
            <div className="space-y-4">
              {/* Weight plan for upcoming phases */}
              {(phase.startWeight != null || phase.targetWeight != null) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weight Plan</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Start Weight</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(phase.startWeight)} kg</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Target Weight</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(phase.targetWeight)} kg</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rate</p>
                      <p className="text-sm font-semibold text-foreground">{rateOfChange ?? "—"}</p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">This phase hasn't started yet. Body composition data will appear here once the phase begins.</p>
            </div>
          ) : (
            <>
              {/* Weight plan row (if set) */}
              {(phase.startWeight != null || phase.targetWeight != null) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weight Plan</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Start Weight</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(phase.startWeight)} kg</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Target Weight</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(phase.targetWeight)} kg</p>
                    </div>
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rate</p>
                      <p className="text-sm font-semibold text-foreground">{rateOfChange ?? "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Body comp changes */}
              {(firstWeek || firstWaistWeek || firstSkinfoldWeek) ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Body Composition Changes</p>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Weight */}
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Weight</p>
                      {firstWeek && lastWeek ? (
                        <>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-sm text-muted-foreground">{fmt(firstWeek.avgWeight)} kg</span>
                            <span className="text-muted-foreground/40">→</span>
                            <span className="text-sm font-semibold text-foreground">{fmt(lastWeek.avgWeight)} kg</span>
                          </div>
                          <DeltaVal val={lastWeek.avgWeight} prev={firstWeek.avgWeight} unit=" kg" invert />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No data</p>
                      )}
                    </div>

                    {/* Waist */}
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Waist</p>
                      {firstWaistWeek && lastWaistWeek ? (
                        <>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-sm text-muted-foreground">{fmt(firstWaistWeek.avgWaist)} cm</span>
                            <span className="text-muted-foreground/40">→</span>
                            <span className="text-sm font-semibold text-foreground">{fmt(lastWaistWeek.avgWaist)} cm</span>
                          </div>
                          <DeltaVal val={lastWaistWeek.avgWaist} prev={firstWaistWeek.avgWaist} unit=" cm" invert />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No data</p>
                      )}
                    </div>

                    {/* Skinfold */}
                    <div className="bg-secondary/40 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skinfold</p>
                      {firstSkinfoldWeek && lastSkinfoldWeek ? (
                        <>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-sm text-muted-foreground">{fmt(firstSkinfoldWeek.avgSkinfold)} mm</span>
                            <span className="text-muted-foreground/40">→</span>
                            <span className="text-sm font-semibold text-foreground">{fmt(lastSkinfoldWeek.avgSkinfold)} mm</span>
                          </div>
                          <DeltaVal val={lastSkinfoldWeek.avgSkinfold} prev={firstSkinfoldWeek.avgSkinfold} unit=" mm" invert />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No data</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No body composition data logged during this phase yet.</p>
              )}

              {/* Phase photos: start vs end */}
              {hasPhotos && comparePhotos && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Photos: Week {firstPhotoWeek} vs Week {lastPhotoWeek}
                  </p>
                  {(() => {
                    const poses = Object.keys((comparePhotos as any).weekA ?? {});
                    if (poses.length === 0) return <p className="text-xs text-muted-foreground">No photos available for this phase.</p>;
                    return (
                      <div className="space-y-4">
                        {poses.map((pose) => {
                          const photoA = ((comparePhotos as any).weekA as any)?.[pose];
                          const photoB = ((comparePhotos as any).weekB as any)?.[pose];
                          if (!photoA && !photoB) return null;
                          return (
                            <div key={pose}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                {pose.replace(/_/g, " ")}
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-center text-muted-foreground mb-1">Week {firstPhotoWeek}</p>
                                  {photoA ? (
                                    <img src={photoA.url} alt={`Week ${firstPhotoWeek} ${pose}`} className="w-full aspect-[9/16] object-cover rounded-xl" />
                                  ) : (
                                    <div className="w-full aspect-[9/16] bg-secondary rounded-xl flex items-center justify-center">
                                      <span className="text-xs text-muted-foreground">No photo</span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-center text-muted-foreground mb-1">Week {lastPhotoWeek}</p>
                                  {photoB ? (
                                    <img src={photoB.url} alt={`Week ${lastPhotoWeek} ${pose}`} className="w-full aspect-[9/16] object-cover rounded-xl" />
                                  ) : (
                                    <div className="w-full aspect-[9/16] bg-secondary rounded-xl flex items-center justify-center">
                                      <span className="text-xs text-muted-foreground">No photo</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Notes */}
              {phase.notes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</p>
                  <p className="text-sm text-foreground/80">{phase.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main PhasesTab ────────────────────────────────────────────────────────────

export function PhasesTab({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const tzOffsetMinutes = -new Date().getTimezoneOffset();

  const { data: phases = [], isLoading: phasesLoading } = trpc.phases.list.useQuery(
    { clientId },
    { enabled: clientId > 0 }
  );

  const { data: weeklyData } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: clientId > 0, staleTime: 60_000 }
  );

  const { data: photoWeeks = [] } = trpc.progressPhotos.getWeeks.useQuery(
    { clientId },
    { enabled: clientId > 0 }
  );

  const weeks: WeekData[] = (weeklyData?.weeks ?? []) as WeekData[];

  // Derive the most recent logged weight for auto-fill
  const latestWeight = useMemo(() => {
    const weeksWithWeight = [...weeks].filter(w => w.avgWeight != null).sort((a, b) => b.weekNumber - a.weekNumber);
    return weeksWithWeight[0]?.avgWeight ?? null;
  }, [weeks]);

  // ── Mutations ──
  const createPhase = trpc.phases.create.useMutation({
    onSuccess: () => {
      utils.phases.list.invalidate({ clientId });
      toast.success("Phase created");
      setAddOpen(false);
    },
    onError: () => toast.error("Failed to create phase"),
  });

  const updatePhase = trpc.phases.update.useMutation({
    onSuccess: () => {
      utils.phases.list.invalidate({ clientId });
      toast.success("Phase updated");
      setEditPhase(null);
    },
    onError: () => toast.error("Failed to update phase"),
  });

  const deletePhase = trpc.phases.delete.useMutation({
    onSuccess: () => {
      utils.phases.list.invalidate({ clientId });
      toast.success("Phase deleted");
      setDeletePhaseId(null);
    },
    onError: () => toast.error("Failed to delete phase"),
  });

  // ── Local state ──
  const [addOpen, setAddOpen] = useState(false);
  const [editPhase, setEditPhase] = useState<Phase | null>(null);
  const [deletePhaseId, setDeletePhaseId] = useState<number | null>(null);

  // Sort phases: active first, then upcoming, then completed (newest first within each group)
  const today = new Date().toISOString().slice(0, 10);
  const sortedPhases = [...(phases as unknown as Phase[])].sort((a, b) => {
    const statusOrder = { active: 0, upcoming: 1, completed: 2 };
    const sa = statusOrder[getPhaseStatus(a, today)];
    const sb = statusOrder[getPhaseStatus(b, today)];
    if (sa !== sb) return sa - sb;
    const aStart = toIsoDate(a.startDate) ?? "";
    const bStart = toIsoDate(b.startDate) ?? "";
    return bStart.localeCompare(aStart);
  });

  /** Convert form data to the endDate string to store */
  function formToEndDate(data: PhaseFormState): string | null {
    const weeks = parseInt(data.durationWeeks, 10);
    if (!data.startDate || isNaN(weeks) || weeks <= 0) return null;
    return addWeeks(data.startDate, weeks);
  }

  /** Convert a stored phase back to form state for editing */
  function phaseToFormInitial(phase: Phase): Partial<PhaseFormState> {
    const start = toIsoDate(phase.startDate) ?? "";
    const end = toIsoDate(phase.endDate);
    const durationWeeks = start && end ? String(weeksBetween(start, end)) : "";
    return {
      label: phase.label,
      startDate: start,
      durationWeeks,
      notes: phase.notes ?? "",
      startWeight: phase.startWeight != null ? String(phase.startWeight) : "",
      targetWeight: phase.targetWeight != null ? String(phase.targetWeight) : "",
    };
  }

  if (phasesLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Phases</p>
          <p className="text-xs text-muted-foreground mt-0.5">Plan and review training phases. Expand a phase to see body composition changes and photos.</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus size={14} />
          Add Phase
        </Button>
      </div>

      {/* Phase list */}
      {sortedPhases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          <CalendarDays size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No phases yet</p>
          <p className="text-xs mt-1">Add a phase to start tracking this client's training journey.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Add First Phase
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPhases.map((phase) => (
            <PhaseSummaryCard
              key={phase.id}
              phase={phase}
              weeks={weeks}
              photoWeeks={photoWeeks}
              clientId={clientId}
              onEdit={() => setEditPhase(phase)}
              onDelete={() => setDeletePhaseId(phase.id)}
            />
          ))}
        </div>
      )}

      {/* Add phase dialog */}
      {addOpen && (
        <PhaseFormDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="Add Phase"
          defaultStartWeight={latestWeight}
          onSave={(data) => {
            createPhase.mutate({
              clientId,
              label: data.label,
              startDate: data.startDate,
              endDate: formToEndDate(data),
              notes: data.notes || null,
              startWeight: data.startWeight ? parseFloat(data.startWeight) : null,
              targetWeight: data.targetWeight ? parseFloat(data.targetWeight) : null,
            });
          }}
        />
      )}

      {/* Edit phase dialog */}
      {editPhase && (
        <PhaseFormDialog
          open={!!editPhase}
          onClose={() => setEditPhase(null)}
          title="Edit Phase"
          initial={phaseToFormInitial(editPhase)}
          onSave={(data) => {
            updatePhase.mutate({
              id: editPhase.id,
              label: data.label,
              startDate: data.startDate,
              endDate: formToEndDate(data),
              notes: data.notes || null,
              startWeight: data.startWeight ? parseFloat(data.startWeight) : null,
              targetWeight: data.targetWeight ? parseFloat(data.targetWeight) : null,
            });
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deletePhaseId != null} onOpenChange={(o) => !o && setDeletePhaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phase</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this phase. Body composition data is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePhaseId != null && deletePhase.mutate({ id: deletePhaseId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
