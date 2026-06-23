import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";
import { Trash2, Plus, TrendingDown, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { Card, DateInput } from "./shared";

// ─── helpers ──────────────────────────────────────────────────────────────────
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
function delta(curr: number | null, prev: number | null, unit: string, lowerIsBetter = true) {
  if (curr == null || prev == null) return null;
  const diff = Math.round((curr - prev) * 10) / 10;
  if (diff === 0) return null;
  const positive = diff > 0;
  const good = lowerIsBetter ? !positive : positive;
  return { diff, positive, good, label: `${positive ? "+" : ""}${diff} ${unit}` };
}

// ─── SkinfoldInput ─────────────────────────────────────────────────────────────
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

// ─── HistoryCard ────────────────────────────────────────────────────────────────
function HistoryCard({
  entry,
  prevEntry,
  onDelete,
  readOnly,
}: {
  entry: any;
  prevEntry: any | null;
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

  const prevUmbAvg = prevEntry ? avg([prevEntry.umbilical1, prevEntry.umbilical2, prevEntry.umbilical3, prevEntry.umbilical4, prevEntry.umbilical5]) : null;
  const prevSupAvg = prevEntry ? avg([prevEntry.suprailiac1, prevEntry.suprailiac2, prevEntry.suprailiac3, prevEntry.suprailiac4, prevEntry.suprailiac5]) : null;
  const prevCalfAvg = prevEntry ? avg([prevEntry.calf1, prevEntry.calf2, prevEntry.calf3, prevEntry.calf4, prevEntry.calf5]) : null;
  const prevThighAvg = prevEntry ? avg([prevEntry.thigh1, prevEntry.thigh2, prevEntry.thigh3, prevEntry.thigh4, prevEntry.thigh5]) : null;
  const prevTotalAvg = prevEntry && prevUmbAvg != null && prevSupAvg != null && prevCalfAvg != null && prevThighAvg != null
    ? Math.round((prevUmbAvg + prevSupAvg + prevCalfAvg + prevThighAvg) * 10) / 10
    : null;

  function DeltaBadge({ curr, prev, unit, lowerIsBetter = true }: { curr: number | null; prev: number | null; unit: string; lowerIsBetter?: boolean }) {
    const d = delta(curr, prev, unit, lowerIsBetter);
    if (!d) return null;
    return (
      <span className={`text-xs font-medium ml-1 ${d.good ? "text-primary" : "text-amber-400"}`}>
        {d.label}
      </span>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header: date + delete */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{fmtDate(entry.measureDate)}</p>
        {!readOnly && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Circumferences */}
      {(entry.waist != null || entry.hips != null) && (
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border">
          {entry.waist != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Waist</p>
              <p className="text-sm font-semibold text-foreground">
                {entry.waist} cm
                <DeltaBadge curr={entry.waist} prev={prevEntry?.waist ?? null} unit="cm" lowerIsBetter />
              </p>
            </div>
          )}
          {entry.hips != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Hips</p>
              <p className="text-sm font-semibold text-foreground">
                {entry.hips} cm
                <DeltaBadge curr={entry.hips} prev={prevEntry?.hips ?? null} unit="cm" lowerIsBetter />
              </p>
            </div>
          )}
        </div>
      )}

      {/* Skinfolds grid */}
      {(umbAvg != null || supAvg != null || calfAvg != null || thighAvg != null) && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Umbilical", a: umbAvg, prevA: prevUmbAvg },
              { label: "Suprailiac", a: supAvg, prevA: prevSupAvg },
              { label: "Calf", a: calfAvg, prevA: prevCalfAvg },
              { label: "Thigh", a: thighAvg, prevA: prevThighAvg },
            ].map(({ label, a, prevA }) => {
              if (a == null) return null;
              return (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {a} mm
                    <DeltaBadge curr={a} prev={prevA} unit="mm" lowerIsBetter />
                  </p>
                </div>
              );
            })}
          </div>
          {totalAvg != null && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Skinfolds</span>
              <span className="text-sm font-bold text-primary">
                {totalAvg} mm
                <DeltaBadge curr={totalAvg} prev={prevTotalAvg} unit="mm" lowerIsBetter />
              </span>
            </div>
          )}
        </div>
      )}

      {entry.notes && (
        <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{entry.notes}</p>
      )}
    </div>
  );
}

// ─── blank form helper ─────────────────────────────────────────────────────────
function blankForm(today: string) {
  return {
    measureDate: today,
    waist: "",
    hips: "",
    umbilical: ["", "", "", "", ""] as string[],
    suprailiac: ["", "", "", "", ""] as string[],
    calf: ["", "", "", "", ""] as string[],
    thigh: ["", "", "", "", ""] as string[],
    notes: "",
  };
}

// ─── BodyCompTab ───────────────────────────────────────────────────────────────
export default function BodyCompTab() {
  const { viewAsUserId } = useViewAs();
  const utils = trpc.useUtils();

  // ── weight data from daily logs ──
  const { data: logsOwn } = trpc.dailyLog.list.useQuery({ limit: 60 }, { enabled: !viewAsUserId });
  const { data: logsAdmin } = trpc.dailyLog.listForClient.useQuery({ userId: viewAsUserId!, limit: 60 }, { enabled: !!viewAsUserId });
  const logs = viewAsUserId ? logsAdmin : logsOwn;

  const weightData = useMemo(() => {
    return (logs ?? [])
      .filter(l => l.weight != null)
      .slice(0, 28)
      .reverse()
      .map(l => {
        const iso = toLocalDateStr(l.logDate);
        return { date: iso.slice(5), weight: l.weight };
      });
  }, [logs]);

  const DAY = 86400000;
  const localDateStr = (offsetDays: number) => {
    const d = new Date(Date.now() - offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const today = localDateStr(0);
  const day6ago = localDateStr(6);
  const day7ago = localDateStr(7);
  const day13ago = localDateStr(13);
  const allLogs = logs ?? [];
  const thisWeekWeights = allLogs
    .filter(l => { const d = toLocalDateStr(l.logDate); return d >= day6ago && d <= today && l.weight != null; })
    .map(l => l.weight as number);
  const prevWeekWeights = allLogs
    .filter(l => { const d = toLocalDateStr(l.logDate); return d >= day13ago && d <= day7ago && l.weight != null; })
    .map(l => l.weight as number);
  const avgWeight = thisWeekWeights.length > 0
    ? (thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length).toFixed(1)
    : null;
  const prevAvgWeight = prevWeekWeights.length > 0
    ? prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length
    : null;
  const weightChangePct = prevAvgWeight && thisWeekWeights.length > 0
    ? (((thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length) - prevAvgWeight) / prevAvgWeight * 100).toFixed(1)
    : null;
  const weightChangeDir = weightChangePct ? (Number(weightChangePct) > 0 ? "up" : "down") : null;

  // ── measurements ──
  const { data: entriesOwn = [] } = trpc.measurements.list.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: entriesAdmin = [] } = trpc.measurements.listForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const entries = viewAsUserId ? entriesAdmin : entriesOwn;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => blankForm(today));

  const setSite = (site: "umbilical" | "suprailiac" | "calf" | "thigh", idx: number, val: string) => {
    setForm(p => ({ ...p, [site]: p[site].map((v, i) => (i === idx ? val : v)) }));
  };

  const addMutation = trpc.measurements.add.useMutation({
    onSuccess: () => {
      utils.measurements.list.invalidate();
      utils.measurements.listForClient.invalidate();
      setShowForm(false);
      setForm(blankForm(today));
      toast.success("Measurement saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = trpc.measurements.delete.useMutation({
    onSuccess: () => {
      utils.measurements.list.invalidate();
      utils.measurements.listForClient.invalidate();
      toast.success("Deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleSave = () => {
    const toNums = (arr: string[]) =>
      arr.map(v => (v.trim() === "" ? null : parseFloat(v)));
    addMutation.mutate({
      measureDate: form.measureDate,
      waist: form.waist.trim() !== "" ? parseFloat(form.waist) : undefined,
      hips: form.hips.trim() !== "" ? parseFloat(form.hips) : undefined,
      umbilical1: toNums(form.umbilical)[0] ?? undefined,
      umbilical2: toNums(form.umbilical)[1] ?? undefined,
      umbilical3: toNums(form.umbilical)[2] ?? undefined,
      umbilical4: toNums(form.umbilical)[3] ?? undefined,
      umbilical5: toNums(form.umbilical)[4] ?? undefined,
      suprailiac1: toNums(form.suprailiac)[0] ?? undefined,
      suprailiac2: toNums(form.suprailiac)[1] ?? undefined,
      suprailiac3: toNums(form.suprailiac)[2] ?? undefined,
      suprailiac4: toNums(form.suprailiac)[3] ?? undefined,
      suprailiac5: toNums(form.suprailiac)[4] ?? undefined,
      calf1: toNums(form.calf)[0] ?? undefined,
      calf2: toNums(form.calf)[1] ?? undefined,
      calf3: toNums(form.calf)[2] ?? undefined,
      calf4: toNums(form.calf)[3] ?? undefined,
      calf5: toNums(form.calf)[4] ?? undefined,
      thigh1: toNums(form.thigh)[0] ?? undefined,
      thigh2: toNums(form.thigh)[1] ?? undefined,
      thigh3: toNums(form.thigh)[2] ?? undefined,
      thigh4: toNums(form.thigh)[3] ?? undefined,
      thigh5: toNums(form.thigh)[4] ?? undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  return (
    <div className="space-y-5 pb-24">

      {/* ── Weight section: compact inline avg + trend chart ── */}
      {(avgWeight || weightData.length > 0) && (
        <Card className="p-0 overflow-hidden">
          {/* Header row with avg */}
          {avgWeight && (
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">7-Day Avg Weight</p>
                <p className="text-2xl font-bold text-foreground">{avgWeight} kg</p>
              </div>
              {weightChangePct && weightChangeDir && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  weightChangeDir === "down" ? "bg-primary/15 text-primary" : "bg-amber-400/15 text-amber-400"
                }`}>
                  {weightChangeDir === "down"
                    ? <TrendingDown size={15} />
                    : <TrendingUp size={15} />
                  }
                  {Number(weightChangePct) > 0 ? "+" : ""}{weightChangePct}% vs prev week
                </div>
              )}
            </div>
          )}
          {/* Chart */}
          {weightData.length > 0 && (
            <div className="px-2 pt-3 pb-2">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weightData} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    interval="preserveStartEnd"
                    tickLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--foreground)" }}
                    itemStyle={{ color: "var(--primary)" }}
                    formatter={(v: any) => [`${v} kg`, "Weight"]}
                  />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {/* ── Measurements section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground uppercase tracking-wide text-muted-foreground">Measurements</p>
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
          <Card className="space-y-5 mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Date</p>
              <DateInput
                value={form.measureDate}
                onChange={(d) => setForm((p) => ({ ...p, measureDate: d }))}
                max={today}
                className="w-full"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Circumferences (cm)</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Skinfolds — 5 readings per site</p>
              <div className="space-y-4">
                <SkinfoldInput label="Umbilical" values={form.umbilical} onChange={(i, v) => setSite("umbilical", i, v)} />
                <SkinfoldInput label="Suprailiac" values={form.suprailiac} onChange={(i, v) => setSite("suprailiac", i, v)} />
                <SkinfoldInput label="Calf" values={form.calf} onChange={(i, v) => setSite("calf", i, v)} />
                <SkinfoldInput label="Thigh" values={form.thigh} onChange={(i, v) => setSite("thigh", i, v)} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
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
        {entries.length === 0 ? (
          <div className="bg-card border border-border rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No measurements logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(entries as any[]).map((entry: any, idx: number) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                prevEntry={(entries as any[])[idx + 1] ?? null}
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
