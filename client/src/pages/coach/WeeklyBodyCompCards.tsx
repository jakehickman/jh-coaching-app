import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtDate(d: string): string {
  if (!d || d.length < 10) return d;
  const dt = new Date(d.slice(0, 10) + "T12:00:00Z");
  const day = dt.getUTCDate();
  const month = dt.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  const year = dt.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function skinfoldTotal(m: any): number | null {
  const sites = [
    avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
    avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
    avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]),
    avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]),
  ];
  const valid = sites.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return parseFloat(valid.reduce((a, b) => a + b, 0).toFixed(1));
}

function toDateStr(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function DeltaCell({ delta, unit = "", invert = false, decimals = 1 }: {
  delta: number | null;
  unit?: string;
  invert?: boolean;
  decimals?: number;
}) {
  if (delta == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (Math.abs(delta) < 0.05) {
    return <span className="text-muted-foreground text-xs"><Minus size={10} className="inline" /></span>;
  }
  const isGood = invert ? delta < 0 : delta > 0;
  const color = isGood ? "text-green-400" : "text-red-400";
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon size={10} />
      {Math.abs(delta).toFixed(decimals)}{unit}
    </span>
  );
}

// ─── Edit form types ─────────────────────────────────────────────────────────

type EditForm = {
  measureDate: string;
  waist: string;
  hips: string;
  umbilical1: string; umbilical2: string; umbilical3: string;
  suprailiac1: string; suprailiac2: string; suprailiac3: string;
  calf1: string; calf2: string; calf3: string;
  thigh1: string; thigh2: string; thigh3: string;
  notes: string;
};

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function measurementToForm(m: any): EditForm {
  return {
    measureDate: toDateStr(m.measureDate),
    waist: m.waist != null ? String(m.waist) : "",
    hips: m.hips != null ? String(m.hips) : "",
    umbilical1: m.umbilical1 != null ? String(m.umbilical1) : "",
    umbilical2: m.umbilical2 != null ? String(m.umbilical2) : "",
    umbilical3: m.umbilical3 != null ? String(m.umbilical3) : "",
    suprailiac1: m.suprailiac1 != null ? String(m.suprailiac1) : "",
    suprailiac2: m.suprailiac2 != null ? String(m.suprailiac2) : "",
    suprailiac3: m.suprailiac3 != null ? String(m.suprailiac3) : "",
    calf1: m.calf1 != null ? String(m.calf1) : "",
    calf2: m.calf2 != null ? String(m.calf2) : "",
    calf3: m.calf3 != null ? String(m.calf3) : "",
    thigh1: m.thigh1 != null ? String(m.thigh1) : "",
    thigh2: m.thigh2 != null ? String(m.thigh2) : "",
    thigh3: m.thigh3 != null ? String(m.thigh3) : "",
    notes: m.notes ?? "",
  };
}

// ─── Row component ───────────────────────────────────────────────────────────

function MeasurementRow({
  m,
  prev,
  clientId,
  onUpdated,
  onDeleted,
}: {
  m: any;
  prev: any | null;
  clientId: number;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<EditForm>(measurementToForm(m));

  const utils = trpc.useUtils();

  const updateMut = trpc.measurements.updateForClient.useMutation({
    onSuccess: () => {
      utils.measurements.listForClient.invalidate({ userId: clientId });
      setEditing(false);
      onUpdated();
      toast.success("Measurement updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.measurements.deleteForClient.useMutation({
    onSuccess: () => {
      utils.measurements.listForClient.invalidate({ userId: clientId });
      onDeleted();
      toast.success("Measurement deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const dateStr = toDateStr(m.measureDate);
  const sf = skinfoldTotal(m);
  const prevSf = prev ? skinfoldTotal(prev) : null;
  const sfDelta = sf != null && prevSf != null ? parseFloat((sf - prevSf).toFixed(1)) : null;
  const waistDelta = m.waist != null && prev?.waist != null
    ? parseFloat((m.waist - prev.waist).toFixed(1)) : null;

  const umbAvg = avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]);
  const supAvg = avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]);
  const calfAvg = avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]);
  const thighAvg = avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]);
  const hasSkinfolds = umbAvg != null || supAvg != null || calfAvg != null || thighAvg != null;

  function saveEdit() {
    if (!form.measureDate) { toast.error("Date required"); return; }
    updateMut.mutate({
      id: m.id,
      userId: clientId,
      measureDate: form.measureDate,
      waist: parseNum(form.waist),
      hips: parseNum(form.hips),
      umbilical1: parseNum(form.umbilical1),
      umbilical2: parseNum(form.umbilical2),
      umbilical3: parseNum(form.umbilical3),
      suprailiac1: parseNum(form.suprailiac1),
      suprailiac2: parseNum(form.suprailiac2),
      suprailiac3: parseNum(form.suprailiac3),
      calf1: parseNum(form.calf1),
      calf2: parseNum(form.calf2),
      calf3: parseNum(form.calf3),
      thigh1: parseNum(form.thigh1),
      thigh2: parseNum(form.thigh2),
      thigh3: parseNum(form.thigh3),
      notes: form.notes || null,
    });
  }

  if (editing) {
    return (
      <>
        {ConfirmDialogNode}
        <tr className="bg-primary/5 border-b border-border/40">
          <td colSpan={8} className="px-4 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">Edit Measurement</p>
                <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={form.measureDate}
                    onChange={e => setForm(p => ({ ...p, measureDate: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.waist}
                    onChange={e => setForm(p => ({ ...p, waist: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Hips (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.hips}
                    onChange={e => setForm(p => ({ ...p, hips: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Skinfold readings */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Skinfold Readings (mm) — up to 3 per site</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["umbilical", "suprailiac", "calf", "thigh"] as const).map(site => (
                    <div key={site}>
                      <label className="text-[10px] text-muted-foreground capitalize block mb-1">{site}</label>
                      <div className="flex gap-1">
                        {([1, 2, 3] as const).map(n => (
                          <input
                            key={n}
                            type="number"
                            step="0.1"
                            value={(form as any)[`${site}${n}`]}
                            onChange={e => setForm(p => ({ ...p, [`${site}${n}`]: e.target.value }))}
                            className="w-full bg-secondary border border-border rounded-lg px-1.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending} className="flex items-center gap-1.5">
                  <Check size={13} />{updateMut.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      {ConfirmDialogNode}
      {/* Main summary row */}
      <tr
        className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronUp size={12} className="text-muted-foreground flex-shrink-0" />
              : <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-foreground">{fmtDate(dateStr)}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">{m.waist != null ? `${fmt(m.waist)} cm` : "—"}</span>
        </td>
        <td className="px-3 py-2.5 text-right">
          <DeltaCell delta={waistDelta} unit=" cm" invert />
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">{sf != null ? `${fmt(sf)} mm` : "—"}</span>
        </td>
        <td className="px-3 py-2.5 text-right">
          <DeltaCell delta={sfDelta} unit=" mm" invert />
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="text-xs tabular-nums text-foreground">{m.hips != null ? `${fmt(m.hips)} cm` : "—"}</span>
        </td>
        <td className="px-3 py-2.5 max-w-[140px]">
          {m.notes && (
            <p className="text-xs text-muted-foreground truncate">{m.notes}</p>
          )}
        </td>
        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => { setForm(measurementToForm(m)); setEditing(true); setExpanded(false); }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete measurement?",
                  description: `Remove the entry for ${fmtDate(dateStr)}?`,
                  variant: "destructive",
                });
                if (ok) deleteMut.mutate({ id: m.id, userId: clientId });
              }}
              disabled={deleteMut.isPending}
              className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded skinfold detail */}
      {expanded && (
        <tr className="border-b border-border/40 bg-muted/10">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {hasSkinfolds && (
                <>
                  {umbAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Umbilical</p>
                      <p className="text-sm font-semibold">{fmt(umbAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]
                          .filter(v => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {supAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suprailiac</p>
                      <p className="text-sm font-semibold">{fmt(supAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]
                          .filter(v => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {calfAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Calf</p>
                      <p className="text-sm font-semibold">{fmt(calfAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]
                          .filter(v => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {thighAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Thigh</p>
                      <p className="text-sm font-semibold">{fmt(thighAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]
                          .filter(v => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                </>
              )}
              {!hasSkinfolds && (
                <p className="text-xs text-muted-foreground col-span-4">No skinfold readings recorded.</p>
              )}
              {m.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{m.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 8;

export function WeeklyBodyCompCards({ clientId }: { clientId: number }) {
  const [showAll, setShowAll] = useState(false);

  const { data: measurements = [], isLoading } = trpc.measurements.listForClient.useQuery(
    { userId: clientId },
    { enabled: !!clientId, staleTime: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  // Sort newest first
  const sorted = [...measurements].sort((a, b) =>
    toDateStr(b.measureDate).localeCompare(toDateStr(a.measureDate))
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No measurements recorded yet</p>
        <p className="text-xs mt-1">Measurements entered by the client will appear here.</p>
      </div>
    );
  }

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[110px]">Date</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Waist</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Waist</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Skinfold</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Skinfold</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hips</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
                <th className="px-3 py-2.5" />
              </tr>
              <tr className="border-b border-border/40 bg-muted/10">
                <th className="px-3 py-1" />
                <th className="text-right px-3 py-1 text-[9px] text-muted-foreground font-normal">value</th>
                <th className="text-right px-3 py-1 text-[9px] text-muted-foreground font-normal">delta</th>
                <th className="text-right px-3 py-1 text-[9px] text-muted-foreground font-normal">total</th>
                <th className="text-right px-3 py-1 text-[9px] text-muted-foreground font-normal">delta</th>
                <th className="text-right px-3 py-1 text-[9px] text-muted-foreground font-normal">value</th>
                <th className="px-3 py-1" />
                <th className="px-3 py-1" />
              </tr>
            </thead>
            <tbody>
              {visible.map((m, idx) => {
                // "prev" is the next entry in the sorted (newest-first) array
                const prev = sorted[idx + 1] ?? null;
                return (
                  <MeasurementRow
                    key={m.id}
                    m={m}
                    prev={prev}
                    clientId={clientId}
                    onUpdated={() => {}}
                    onDeleted={() => {}}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sorted.length > DEFAULT_VISIBLE && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(v => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show less" : `Show all ${sorted.length} entries`}
          </Button>
        </div>
      )}
    </div>
  );
}
