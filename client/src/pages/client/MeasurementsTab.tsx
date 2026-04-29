import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday, fmtDate } from "@/lib/dates";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { SectionLabel, Card, DateInput } from "./shared";

const SKINFOLD_SITES = [
  { key: "umbilical", label: "Umbilical" },
  { key: "suprailiac", label: "Suprailiac" },
  { key: "calf", label: "Calf" },
  { key: "thigh", label: "Thigh" },
] as const;

function avgReadings(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null && v !== undefined);
  return nums.length > 0 ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
}

export default function MeasurementsTab() {
  const { viewAsUserId } = useViewAs();
  const { data: measurementsOwn, refetch: refetchOwn } = trpc.measurements.list.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: measurementsAdmin, refetch: refetchAdmin } = trpc.measurements.listForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const measurements = viewAsUserId ? measurementsAdmin : measurementsOwn;
  const refetch = viewAsUserId ? refetchAdmin : refetchOwn;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const emptySkinfold = { r1: "", r2: "", r3: "", r4: "", r5: "" };
  const blankForm = () => ({
    measureDate: localToday(),
    waist: "",
    umbilical: { ...emptySkinfold },
    suprailiac: { ...emptySkinfold },
    calf: { ...emptySkinfold },
    thigh: { ...emptySkinfold },
    notes: "",
  });
  const [form, setForm] = useState(blankForm);
  const [editForm, setEditForm] = useState(blankForm);

  const add = trpc.measurements.add.useMutation({
    onSuccess: () => { toast.success("Measurements saved"); setShowForm(false); setForm(blankForm()); refetch(); }
  });
  const update = trpc.measurements.update.useMutation({
    onSuccess: () => { toast.success("Entry updated"); setEditingId(null); refetch(); }
  });
  const del = trpc.measurements.delete.useMutation({
    onSuccess: () => { toast.success("Entry deleted"); refetch(); }
  });

  const setReading = (site: string, r: string, val: string) =>
    setForm(p => ({ ...p, [site]: { ...(p as any)[site], [r]: val } }));
  const setEditReading = (site: string, r: string, val: string) =>
    setEditForm(p => ({ ...p, [site]: { ...(p as any)[site], [r]: val } }));

  const parseR = (v: string) => v ? parseFloat(v) : undefined;
  const parseRNull = (v: string) => v ? parseFloat(v) : null;

  const startEdit = (m: any) => {
    const toStr = (v: number | null | undefined) => v != null ? String(v) : "";
    setEditForm({
      measureDate: toLocalDateStr(m.measureDate),
      waist: toStr(m.waist),
      umbilical: { r1: toStr(m.umbilical1), r2: toStr(m.umbilical2), r3: toStr(m.umbilical3), r4: toStr(m.umbilical4), r5: toStr(m.umbilical5) },
      suprailiac: { r1: toStr(m.suprailiac1), r2: toStr(m.suprailiac2), r3: toStr(m.suprailiac3), r4: toStr(m.suprailiac4), r5: toStr(m.suprailiac5) },
      calf: { r1: toStr(m.calf1), r2: toStr(m.calf2), r3: toStr(m.calf3), r4: toStr(m.calf4), r5: toStr(m.calf5) },
      thigh: { r1: toStr(m.thigh1), r2: toStr(m.thigh2), r3: toStr(m.thigh3), r4: toStr(m.thigh4), r5: toStr(m.thigh5) },
      notes: m.notes ?? "",
    });
    setEditingId(m.id);
  };

  const waistData = (measurements ?? []).slice(0, 8).reverse().map(m => ({
    date: (() => { const d = new Date(String(m.measureDate).slice(0, 10) + 'T12:00:00Z'); return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); })(),
    waist: m.waist,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Measurements</SectionLabel>
        {!viewAsUserId && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
            <Plus size={14} /> Add Measurement
          </button>
        )}
      </div>

      {!viewAsUserId && showForm && (
        <Card className="space-y-5">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Date</label>
            <DateInput value={form.measureDate} onChange={v => setForm(p => ({ ...p, measureDate: v }))} />
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Waist Circumference (cm)</p>
            <input type="number" step="0.1" value={form.waist} onChange={e => setForm(p => ({ ...p, waist: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold text-foreground">Skinfold Thickness — enter 5 readings per site (mm)</p>
            {SKINFOLD_SITES.map(({ key, label }) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground mb-2">{label}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["r1","r2","r3","r4","r5"] as const).map((r, i) => (
                    <div key={r}>
                      <label className="text-[10px] text-muted-foreground block mb-1 text-center">{i+1}</label>
                      <input type="number" step="0.1" value={(form as any)[key][r]}
                        onChange={e => setReading(key, r, e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-1.5 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <button onClick={() => add.mutate({
            measureDate: form.measureDate,
            waist: parseR(form.waist),
            umbilical1: parseR(form.umbilical.r1), umbilical2: parseR(form.umbilical.r2), umbilical3: parseR(form.umbilical.r3), umbilical4: parseR(form.umbilical.r4), umbilical5: parseR(form.umbilical.r5),
            suprailiac1: parseR(form.suprailiac.r1), suprailiac2: parseR(form.suprailiac.r2), suprailiac3: parseR(form.suprailiac.r3), suprailiac4: parseR(form.suprailiac.r4), suprailiac5: parseR(form.suprailiac.r5),
            calf1: parseR(form.calf.r1), calf2: parseR(form.calf.r2), calf3: parseR(form.calf.r3), calf4: parseR(form.calf.r4), calf5: parseR(form.calf.r5),
            thigh1: parseR(form.thigh.r1), thigh2: parseR(form.thigh.r2), thigh3: parseR(form.thigh.r3), thigh4: parseR(form.thigh.r4), thigh5: parseR(form.thigh.r5),
            notes: form.notes || undefined,
          })} disabled={add.isPending}
            className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 disabled:opacity-50">
            {add.isPending ? "Saving..." : "Save Measurements"}
          </button>
        </Card>
      )}

      {waistData.length > 1 && (
        <div>
          <SectionLabel>Waist Trend</SectionLabel>
          <Card>
            <div style={{ width: "100%", height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waistData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 11 }} width={40} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#22c55e" }} />
                  <Line type="monotone" dataKey="waist" stroke="#22c55e" strokeWidth={2} dot={false} name="Waist (cm)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {(measurements ?? []).length > 0 && (
        <div>
          <SectionLabel>History</SectionLabel>
          <div className="space-y-3">
            {measurements!.map(m => {
              const umbAvg = avgReadings([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]);
              const supAvg = avgReadings([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]);
              const calfAvg = avgReadings([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]);
              const thighAvg = avgReadings([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]);
              const siteAvgs = [umbAvg, supAvg, calfAvg, thighAvg];
              const presentAvgs = siteAvgs.filter(v => v !== null);
              const total = presentAvgs.length > 0 ? parseFloat(presentAvgs.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
              const isEditing = editingId === m.id;
              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-base font-semibold text-foreground">{fmtDate(toLocalDateStr(m.measureDate))}</p>
                    {!viewAsUserId && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => isEditing ? setEditingId(null) : startEdit(m)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1 rounded" title={isEditing ? "Cancel edit" : "Edit entry"}>
                          {isEditing ? <X size={14} /> : <Pencil size={14} />}
                        </button>
                        <button onClick={() => { if (confirm("Delete this measurement entry?")) del.mutate({ id: m.id }); }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" title="Delete entry">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1.5">Date</label>
                        <DateInput value={editForm.measureDate} onChange={v => setEditForm(p => ({ ...p, measureDate: v }))} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2">Waist Circumference (cm)</p>
                        <input type="number" step="0.1" value={editForm.waist}
                          onChange={e => setEditForm(p => ({ ...p, waist: e.target.value }))}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-foreground">Skinfold Thickness — 5 readings per site (mm)</p>
                        {SKINFOLD_SITES.map(({ key, label }) => (
                          <div key={key}>
                            <p className="text-xs text-muted-foreground mb-2">{label}</p>
                            <div className="grid grid-cols-5 gap-1.5">
                              {(["r1","r2","r3","r4","r5"] as const).map((r, i) => (
                                <div key={r}>
                                  <label className="text-[10px] text-muted-foreground block mb-1 text-center">{i+1}</label>
                                  <input type="number" step="0.1" value={(editForm as any)[key][r]}
                                    onChange={e => setEditReading(key, r, e.target.value)}
                                    className="w-full bg-secondary border border-border rounded-lg px-1.5 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1.5">Notes (optional)</label>
                        <input type="text" value={editForm.notes}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <button onClick={() => update.mutate({
                        id: m.id,
                        measureDate: editForm.measureDate,
                        waist: parseRNull(editForm.waist),
                        umbilical1: parseRNull(editForm.umbilical.r1), umbilical2: parseRNull(editForm.umbilical.r2), umbilical3: parseRNull(editForm.umbilical.r3), umbilical4: parseRNull(editForm.umbilical.r4), umbilical5: parseRNull(editForm.umbilical.r5),
                        suprailiac1: parseRNull(editForm.suprailiac.r1), suprailiac2: parseRNull(editForm.suprailiac.r2), suprailiac3: parseRNull(editForm.suprailiac.r3), suprailiac4: parseRNull(editForm.suprailiac.r4), suprailiac5: parseRNull(editForm.suprailiac.r5),
                        calf1: parseRNull(editForm.calf.r1), calf2: parseRNull(editForm.calf.r2), calf3: parseRNull(editForm.calf.r3), calf4: parseRNull(editForm.calf.r4), calf5: parseRNull(editForm.calf.r5),
                        thigh1: parseRNull(editForm.thigh.r1), thigh2: parseRNull(editForm.thigh.r2), thigh3: parseRNull(editForm.thigh.r3), thigh4: parseRNull(editForm.thigh.r4), thigh5: parseRNull(editForm.thigh.r5),
                        notes: editForm.notes || null,
                      })} disabled={update.isPending}
                        className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50">
                        {update.isPending ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {m.waist && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Waist</p>
                          <p className="text-lg font-bold text-foreground">{m.waist} <span className="text-sm font-normal text-muted-foreground">cm</span></p>
                        </div>
                      )}
                      {siteAvgs.some(v => v !== null) && (
                        <>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Skinfold (avg mm)</p>
                          <div className="grid grid-cols-4 gap-2 mb-2">
                            {[
                              { label: "Umbilical", avg: umbAvg },
                              { label: "Suprailiac", avg: supAvg },
                              { label: "Calf", avg: calfAvg },
                              { label: "Thigh", avg: thighAvg },
                            ].map(({ label, avg }) => (
                              <div key={label} className="text-center">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="text-base font-semibold text-foreground">{avg ?? "—"}</p>
                              </div>
                            ))}
                          </div>
                          {total !== null && (
                            <div className="border-t border-border pt-2 flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="text-sm font-bold text-primary">{total} mm</p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
