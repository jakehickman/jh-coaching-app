import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";
import { Trash2, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toUTCDateStr as toLocalDateStr, localToday } from "@/lib/dates";
import { SectionLabel, Card, DateInput } from "./shared";
import { Button } from "@/components/ui/button";

// ─── helpers ─────────────────────────────────────────────────────────────────

function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null && !isNaN(v));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const s = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  if (s.length < 10) return s;
  const dt = new Date(s + "T12:00:00Z");
  const day = dt.getUTCDate();
  const month = dt.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
  const year = dt.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function Delta({
  curr,
  prev,
  unit = "",
  lowerIsBetter = true,
}: {
  curr: number | null;
  prev: number | null;
  unit?: string;
  lowerIsBetter?: boolean;
}) {
  if (curr == null || prev == null) return null;
  const diff = Math.round((curr - prev) * 10) / 10;
  if (diff === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? "+" : "";
  const Icon = diff < 0 ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${improved ? "text-primary" : "text-amber-400"}`}>
      <Icon size={11} />
      {sign}{diff}{unit}
    </span>
  );
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

// ─── MeasurementCard ─────────────────────────────────────────────────────────

function MeasurementCard({
  entry,
  prev,
  onDelete,
  readOnly,
}: {
  entry: any;
  prev: any | null;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const umbAvg = avg([entry.umbilical1, entry.umbilical2, entry.umbilical3, entry.umbilical4, entry.umbilical5]);
  const supAvg = avg([entry.suprailiac1, entry.suprailiac2, entry.suprailiac3, entry.suprailiac4, entry.suprailiac5]);
  const calfAvg = avg([entry.calf1, entry.calf2, entry.calf3, entry.calf4, entry.calf5]);
  const thighAvg = avg([entry.thigh1, entry.thigh2, entry.thigh3, entry.thigh4, entry.thigh5]);
  const totalAvg =
    umbAvg != null && supAvg != null && calfAvg != null && thighAvg != null
      ? Math.round((umbAvg + supAvg + calfAvg + thighAvg) * 10) / 10
      : null;

  const prevUmbAvg = prev ? avg([prev.umbilical1, prev.umbilical2, prev.umbilical3, prev.umbilical4, prev.umbilical5]) : null;
  const prevSupAvg = prev ? avg([prev.suprailiac1, prev.suprailiac2, prev.suprailiac3, prev.suprailiac4, prev.suprailiac5]) : null;
  const prevCalfAvg = prev ? avg([prev.calf1, prev.calf2, prev.calf3, prev.calf4, prev.calf5]) : null;
  const prevThighAvg = prev ? avg([prev.thigh1, prev.thigh2, prev.thigh3, prev.thigh4, prev.thigh5]) : null;
  const prevTotal =
    prevUmbAvg != null && prevSupAvg != null && prevCalfAvg != null && prevThighAvg != null
      ? Math.round((prevUmbAvg + prevSupAvg + prevCalfAvg + prevThighAvg) * 10) / 10
      : null;

  const skinfoldSites = [
    { label: "Umbilical", curr: umbAvg, prev: prevUmbAvg },
    { label: "Suprailiac", curr: supAvg, prev: prevSupAvg },
    { label: "Calf", curr: calfAvg, prev: prevCalfAvg },
    { label: "Thigh", curr: thighAvg, prev: prevThighAvg },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{fmtDate(entry.measureDate)}</p>
        {!readOnly && (
          <button
            onClick={onDelete}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground active:text-red-400 active:bg-red-400/10 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Circumferences */}
      {(entry.waist != null || entry.hips != null) && (
        <div className="grid grid-cols-2 gap-3">
          {entry.waist != null && (
            <div className="bg-secondary/50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Waist</p>
              <p className="text-base font-semibold text-foreground">{entry.waist} <span className="text-xs font-normal text-muted-foreground">cm</span></p>
              <Delta curr={entry.waist} prev={prev?.waist ?? null} unit=" cm" />
            </div>
          )}
          {entry.hips != null && (
            <div className="bg-secondary/50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hip</p>
              <p className="text-base font-semibold text-foreground">{entry.hips} <span className="text-xs font-normal text-muted-foreground">cm</span></p>
              <Delta curr={entry.hips} prev={prev?.hips ?? null} unit=" cm" />
            </div>
          )}
        </div>
      )}

      {/* Skinfolds */}
      {skinfoldSites.some(s => s.curr != null) && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Skinfolds</p>
          <div className="grid grid-cols-2 gap-2">
            {skinfoldSites.map(({ label, curr, prev: p }) =>
              curr != null ? (
                <div key={label} className="bg-secondary/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{curr} <span className="text-xs font-normal text-muted-foreground">mm</span></span>
                    <Delta curr={curr} prev={p} unit=" mm" />
                  </div>
                </div>
              ) : null
            )}
          </div>

          {totalAvg != null && (
            <div className="mt-2 bg-secondary/50 rounded-lg px-3 py-2.5 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total skinfolds</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">{totalAvg} mm</span>
                <Delta curr={totalAvg} prev={prevTotal} unit=" mm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border pt-3">{entry.notes}</p>
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
      void refetch();
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = trpc.measurements.delete.useMutation({
    onSuccess: () => { toast.success("Entry deleted"); void refetch(); },
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

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Measurements</h2>
        {!viewAsUserId && (
          <button
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) setForm(blankForm(today));
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
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
                <label className="text-sm text-muted-foreground block mb-1.5">Hip</label>
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
              <SkinfoldInput label="Umbilical" values={form.umbilical} onChange={(i, v) => setSite("umbilical", i, v)} />
              <SkinfoldInput label="Suprailiac" values={form.suprailiac} onChange={(i, v) => setSite("suprailiac", i, v)} />
              <SkinfoldInput label="Calf" values={form.calf} onChange={(i, v) => setSite("calf", i, v)} />
              <SkinfoldInput label="Thigh" values={form.thigh} onChange={(i, v) => setSite("thigh", i, v)} />
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
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-12 text-base font-semibold"
              onClick={handleSave}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </Card>
      )}

      {/* History */}
      {entries.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No measurements logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any, idx: number) => (
            <MeasurementCard
              key={entry.id}
              entry={entry}
              prev={idx < entries.length - 1 ? entries[idx + 1] : null}
              onDelete={() => deleteMutation.mutate({ id: entry.id })}
              readOnly={!!viewAsUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
