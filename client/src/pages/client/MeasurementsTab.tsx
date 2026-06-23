import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Trash2, Plus } from "lucide-react";
import { toUTCDateStr as toLocalDateStr, localToday } from "@/lib/dates";
import { SectionLabel, Card, DateInput } from "./shared";

// ─── helpers ─────────────────────────────────────────────────────────────────

function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null && !isNaN(v));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function fmt(v: number | null | undefined, unit = "") {
  if (v == null) return "—";
  return `${v}${unit}`;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const s = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y}`;
}

// ─── SkinfoldInput ────────────────────────────────────────────────────────────

function SkinfoldInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: (string | "")[];
  onChange: (idx: number, val: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-2">{label} (mm)</label>
      <div className="flex gap-2">
        {values.map((v, i) => (
          <input
            key={i}
            type="number"
            step="0.1"
            min="0"
            value={v}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={`${i + 1}`}
            className="flex-1 min-w-0 bg-secondary border border-border rounded-lg px-2 py-3 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ))}
      </div>
    </div>
  );
}

// ─── HistoryRow ───────────────────────────────────────────────────────────────

function HistoryRow({
  entry,
  onDelete,
  readOnly,
}: {
  entry: any;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const umbAvg = avg([entry.umbilical1, entry.umbilical2, entry.umbilical3, entry.umbilical4, entry.umbilical5]);
  const supAvg = avg([entry.suprailiac1, entry.suprailiac2, entry.suprailiac3, entry.suprailiac4, entry.suprailiac5]);
  const calfAvg = avg([entry.calf1, entry.calf2, entry.calf3, entry.calf4, entry.calf5]);
  const thighAvg = avg([entry.thigh1, entry.thigh2, entry.thigh3, entry.thigh4, entry.thigh5]);
  const totalAvg =
    umbAvg != null && supAvg != null && calfAvg != null && thighAvg != null
      ? Math.round((umbAvg + supAvg + calfAvg + thighAvg) * 10) / 10
      : null;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">{fmtDate(entry.measureDate)}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {entry.waist != null && (
              <span className="text-[11px] text-muted-foreground">Waist {entry.waist} cm</span>
            )}
            {entry.hips != null && (
              <span className="text-[11px] text-muted-foreground">Hips {entry.hips} cm</span>
            )}
            {totalAvg != null && (
              <span className="text-[11px] text-primary font-medium">Total {totalAvg} mm</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-muted/20 border-t border-border">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
            {entry.waist != null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Waist</p>
                <p className="text-sm font-semibold text-foreground">{entry.waist} cm</p>
              </div>
            )}
            {entry.hips != null && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hips</p>
                <p className="text-sm font-semibold text-foreground">{entry.hips} cm</p>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {[
              { label: "Umbilical", vals: [entry.umbilical1, entry.umbilical2, entry.umbilical3, entry.umbilical4, entry.umbilical5], avg: umbAvg },
              { label: "Suprailiac", vals: [entry.suprailiac1, entry.suprailiac2, entry.suprailiac3, entry.suprailiac4, entry.suprailiac5], avg: supAvg },
              { label: "Calf", vals: [entry.calf1, entry.calf2, entry.calf3, entry.calf4, entry.calf5], avg: calfAvg },
              { label: "Thigh", vals: [entry.thigh1, entry.thigh2, entry.thigh3, entry.thigh4, entry.thigh5], avg: thighAvg },
            ].map(({ label, vals, avg: a }) => {
              const readings = vals.filter((v) => v != null);
              if (readings.length === 0) return null;
              return (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground w-24">{label}</p>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {readings.map((v, i) => (
                      <span key={i} className="text-xs text-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {v}
                      </span>
                    ))}
                    {a != null && readings.length > 1 && (
                      <span className="text-xs text-primary font-medium ml-1">avg {a}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalAvg != null && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total skinfolds</p>
              <p className="text-sm font-semibold text-primary">{totalAvg} mm</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── blank form state ─────────────────────────────────────────────────────────

type SkinfoldSite = [string, string, string, string, string];

type MeasureForm = {
  measureDate: string;
  waist: string;
  hips: string;
  umbilical: SkinfoldSite;
  suprailiac: SkinfoldSite;
  calf: SkinfoldSite;
  thigh: SkinfoldSite;
  notes: string;
};

const blankSite = (): SkinfoldSite => ["", "", "", "", ""];

function blankForm(today: string): MeasureForm {
  return {
    measureDate: today,
    waist: "",
    hips: "",
    umbilical: blankSite(),
    suprailiac: blankSite(),
    calf: blankSite(),
    thigh: blankSite(),
    notes: "",
  };
}

function parseOptional(s: string): number | undefined {
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

function siteToFields(site: SkinfoldSite, prefix: string) {
  return {
    [`${prefix}1`]: parseOptional(site[0]),
    [`${prefix}2`]: parseOptional(site[1]),
    [`${prefix}3`]: parseOptional(site[2]),
    [`${prefix}4`]: parseOptional(site[3]),
    [`${prefix}5`]: parseOptional(site[4]),
  };
}

// ─── MeasurementsTab ─────────────────────────────────────────────────────────

export default function MeasurementsTab() {
  const today = localToday();
  const { viewAsUserId } = useViewAs();
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MeasureForm>(() => blankForm(today));

  const { data: entriesOwn = [], refetch: refetchOwn } = trpc.measurements.list.useQuery(undefined, {
    enabled: !viewAsUserId,
  });
  const { data: entriesAdmin = [], refetch: refetchAdmin } = trpc.measurements.listForClient.useQuery(
    { userId: viewAsUserId! },
    { enabled: !!viewAsUserId }
  );
  const entries = viewAsUserId ? entriesAdmin : entriesOwn;
  const refetch = viewAsUserId ? refetchAdmin : refetchOwn;

  const addMutation = trpc.measurements.add.useMutation({
    onSuccess: () => {
      toast.success("Measurements saved");
      setShowForm(false);
      setForm(blankForm(today));
      refetch();
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = trpc.measurements.delete.useMutation({
    onSuccess: () => { toast.success("Entry deleted"); refetch(); },
    onError: () => toast.error("Failed to delete"),
  });

  const setSite = (site: keyof Pick<MeasureForm, "umbilical" | "suprailiac" | "calf" | "thigh">, idx: number, val: string) => {
    setForm((prev) => {
      const next = [...prev[site]] as SkinfoldSite;
      next[idx] = val;
      return { ...prev, [site]: next };
    });
  };

  const handleSave = () => {
    addMutation.mutate({
      measureDate: form.measureDate,
      waist: parseOptional(form.waist),
      hips: parseOptional(form.hips),
      ...siteToFields(form.umbilical, "umbilical"),
      ...siteToFields(form.suprailiac, "suprailiac"),
      ...siteToFields(form.calf, "calf"),
      ...siteToFields(form.thigh, "thigh"),
      notes: form.notes || undefined,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Measurements</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Waist, hips and skinfold readings</p>
        </div>
        {!viewAsUserId && (
          <button
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) setForm(blankForm(today));
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Add
          </button>
        )}
      </div>

      {/* Entry form */}
      {showForm && !viewAsUserId && (
        <Card className="space-y-5">
          <div>
            <SectionLabel>Date</SectionLabel>
            <DateInput
              value={form.measureDate}
              onChange={(d) => setForm((p) => ({ ...p, measureDate: d }))}
              max={today}
              className="w-full"
            />
          </div>

          <div>
            <SectionLabel>Circumferences (cm)</SectionLabel>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Waist</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.waist}
                  onChange={(e) => setForm((p) => ({ ...p, waist: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Hips</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.hips}
                  onChange={(e) => setForm((p) => ({ ...p, hips: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Skinfolds — 5 readings per site</SectionLabel>
            <div className="space-y-4">
              <SkinfoldInput
                label="Umbilical"
                values={form.umbilical}
                onChange={(i, v) => setSite("umbilical", i, v)}
              />
              <SkinfoldInput
                label="Suprailiac"
                values={form.suprailiac}
                onChange={(i, v) => setSite("suprailiac", i, v)}
              />
              <SkinfoldInput
                label="Calf"
                values={form.calf}
                onChange={(i, v) => setSite("calf", i, v)}
              />
              <SkinfoldInput
                label="Thigh"
                values={form.thigh}
                onChange={(i, v) => setSite("thigh", i, v)}
              />
            </div>
          </div>

          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={addMutation.isPending}
              className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {addMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </Card>
      )}

      {/* History */}
      <div>
        <SectionLabel>History</SectionLabel>
        {entries.length === 0 ? (
          <div className="bg-card border border-border rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No measurements logged yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {entries.map((entry: any) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onDelete={() => handleDelete(entry.id)}
                readOnly={!!viewAsUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
