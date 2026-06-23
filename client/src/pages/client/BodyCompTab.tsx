import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";
import { Trash2, Plus, TrendingDown, TrendingUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/pages/client/shared";

// ─── helpers ──────────────────────────────────────────────────────────────────
function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null && !isNaN(v));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function totalSkinfold(entry: any): number | null {
  const u = avg([entry.umbilical1, entry.umbilical2, entry.umbilical3, entry.umbilical4, entry.umbilical5]);
  const s = avg([entry.suprailiac1, entry.suprailiac2, entry.suprailiac3, entry.suprailiac4, entry.suprailiac5]);
  const c = avg([entry.calf1, entry.calf2, entry.calf3, entry.calf4, entry.calf5]);
  const t = avg([entry.thigh1, entry.thigh2, entry.thigh3, entry.thigh4, entry.thigh5]);
  if (u == null || s == null || c == null || t == null) return null;
  return Math.round((u + s + c + t) * 10) / 10;
}

function delta(curr: number | null, prev: number | null, unit: string, lowerIsBetter = true) {
  if (curr == null || prev == null) return null;
  const diff = parseFloat((curr - prev).toFixed(1));
  if (diff === 0) return null;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return { label: `${diff > 0 ? "+" : ""}${diff} ${unit}`, good };
}

function fmtDate(iso: string | Date) {
  if (iso instanceof Date) iso = iso.toISOString().slice(0, 10);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const [y, m, d] = iso.split("-");
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function isoToDate(d: string | Date): string {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

// ─── SkinfoldInput ─────────────────────────────────────────────────────────────
function SkinfoldInput({ label, values, onChange }: { label: string; values: string[]; onChange: (i: number, v: string) => void }) {
  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-1.5">{label}</label>
      <div className="flex gap-2">
        {values.map((v, i) => (
          <input
            key={i}
            type="number"
            step="0.1"
            min="0"
            value={v}
            onChange={(e) => onChange(i, e.target.value)}
            className="flex-1 min-w-0 bg-secondary border border-border rounded-lg px-2 py-2.5 text-sm text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={`${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── HistoryCard ──────────────────────────────────────────────────────────────
function HistoryCard({
  entry,
  prevEntry,
  weightOnDay,
  onDelete,
  readOnly,
}: {
  entry: any;
  prevEntry: any | null;
  weightOnDay?: number | null;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const umbAvg = avg([entry.umbilical1, entry.umbilical2, entry.umbilical3, entry.umbilical4, entry.umbilical5]);
  const supAvg = avg([entry.suprailiac1, entry.suprailiac2, entry.suprailiac3, entry.suprailiac4, entry.suprailiac5]);
  const calfAvg = avg([entry.calf1, entry.calf2, entry.calf3, entry.calf4, entry.calf5]);
  const thighAvg = avg([entry.thigh1, entry.thigh2, entry.thigh3, entry.thigh4, entry.thigh5]);
  const total = totalSkinfold(entry);

  const prevUmbAvg = prevEntry ? avg([prevEntry.umbilical1, prevEntry.umbilical2, prevEntry.umbilical3, prevEntry.umbilical4, prevEntry.umbilical5]) : null;
  const prevSupAvg = prevEntry ? avg([prevEntry.suprailiac1, prevEntry.suprailiac2, prevEntry.suprailiac3, prevEntry.suprailiac4, prevEntry.suprailiac5]) : null;
  const prevCalfAvg = prevEntry ? avg([prevEntry.calf1, prevEntry.calf2, prevEntry.calf3, prevEntry.calf4, prevEntry.calf5]) : null;
  const prevThighAvg = prevEntry ? avg([prevEntry.thigh1, prevEntry.thigh2, prevEntry.thigh3, prevEntry.thigh4, prevEntry.thigh5]) : null;
  const prevTotal = prevEntry ? totalSkinfold(prevEntry) : null;

  function DeltaBadge({ curr, prev, unit, lowerIsBetter = true }: { curr: number | null; prev: number | null; unit: string; lowerIsBetter?: boolean }) {
    const d = delta(curr, prev, unit, lowerIsBetter);
    if (!d) return null;
    return (
      <span className={`text-xs font-medium ml-1.5 ${d.good ? "text-primary" : "text-amber-400"}`}>
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

      {/* Weight from daily log (if available) */}
      {weightOnDay != null && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Weight</p>
          <p className="text-sm font-semibold text-foreground">{weightOnDay} kg</p>
        </div>
      )}

      {/* Circumferences */}
      {(entry.waist != null || entry.hips != null) && (
        <div className="grid grid-cols-2 gap-3">
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Hip</p>
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
          {total != null && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Skinfolds</span>
              <span className="text-sm font-bold text-primary">
                {total} mm
                <DeltaBadge curr={total} prev={prevTotal} unit="mm" lowerIsBetter />
              </span>
            </div>
          )}
        </div>
      )}

      {entry.notes && (
        <p className="text-xs text-muted-foreground italic">{entry.notes}</p>
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

// ─── MeasurementCalendar ───────────────────────────────────────────────────────
function MeasurementCalendar({
  entries,
  weightByDate,
  selectedDate,
  onSelectDate,
}: {
  entries: any[];
  weightByDate: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (iso: string | null) => void;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Build a set of measurement dates for O(1) lookup
  const measurementDates = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => s.add(isoToDate(e.measureDate)));
    return s;
  }, [entries]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayLetters = ["M","T","W","T","F","S","S"];

  // First day of month (0=Sun...6=Sat), convert to Mon-based (0=Mon...6=Sun)
  const firstDow = calMonth.getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // Mon-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Today string for comparison
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const prevMonth = () => setCalMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalMonth(new Date(year, month + 1, 1));

  // Build grid cells: nulls for padding + day numbers
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {monthNames[month]} {year}
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {dayLetters.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {l}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} />;
          }
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasMeasurement = measurementDates.has(iso);
          const hasWeight = !hasMeasurement && iso in weightByDate;
          const isToday = iso === todayStr;
          const isSelected = iso === selectedDate;

          return (
            <button
              key={iso}
              onClick={() => onSelectDate(isSelected ? null : iso)}
              className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 transition-colors
                ${isSelected
                  ? "bg-primary/20 ring-1 ring-primary"
                  : isToday
                  ? "bg-muted/60"
                  : "hover:bg-muted/30"
                }`}
            >
              <span className={`text-xs leading-none mb-1 ${
                isToday ? "font-bold text-foreground" : "text-foreground/80"
              }`}>
                {day}
              </span>
              {hasMeasurement && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary block" />
              )}
              {hasWeight && (
                <span className="w-1 h-1 rounded-full bg-blue-400/50 block" />
              )}
              {!hasMeasurement && !hasWeight && (
                <span className="w-1.5 h-1.5 block" /> /* spacer to keep height consistent */
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
          Measurement
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-1 h-1 rounded-full bg-blue-400/50 inline-block" />
          Weight only
        </span>
      </div>
    </div>
  );
}

// ─── BodyCompTab ───────────────────────────────────────────────────────────────
export default function BodyCompTab() {
  const { viewAsUserId } = useViewAs();
  const utils = trpc.useUtils();

  // ── weight data from daily logs ──
  const { data: logsOwn } = trpc.dailyLog.list.useQuery({ limit: 60 }, { enabled: !viewAsUserId });
  const { data: logsAdmin } = trpc.dailyLog.listForClient.useQuery({ userId: viewAsUserId!, limit: 60 }, { enabled: !!viewAsUserId });
  const logs = viewAsUserId ? logsAdmin : logsOwn;

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
  const [showAll, setShowAll] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // ── chart data ──
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Weight by date map (for calendar dots and detail card)
  const weightByDate = useMemo(() => {
    const map: Record<string, number> = {};
    (logs ?? []).forEach(l => {
      if (l.weight != null) {
        map[toLocalDateStr(l.logDate)] = l.weight as number;
      }
    });
    return map;
  }, [logs]);

  // Measurement by date map (for calendar tapped-day lookup)
  const measurementByDate = useMemo(() => {
    const map: Record<string, any> = {};
    (entries as any[]).forEach(e => {
      map[isoToDate(e.measureDate)] = e;
    });
    return map;
  }, [entries]);

  // Sorted entries (newest first) for delta calculation
  const sortedEntries = useMemo(() => {
    return [...(entries as any[])].sort((a, b) =>
      isoToDate(b.measureDate).localeCompare(isoToDate(a.measureDate))
    );
  }, [entries]);

  // For a given entry, find the previous one (older)
  const getPrevEntry = (entry: any) => {
    const iso = isoToDate(entry.measureDate);
    const idx = sortedEntries.findIndex(e => isoToDate(e.measureDate) === iso);
    return idx >= 0 && idx + 1 < sortedEntries.length ? sortedEntries[idx + 1] : null;
  };

  // Weight + Waist chart: daily weight from logs + waist from measurements
  const combinedTrendData = useMemo(() => {
    const toStr2 = (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
    const waistByDate: Record<string, number> = {};
    (entries as any[]).forEach((m: any) => {
      if (m.waist != null) waistByDate[toStr2(m.measureDate)] = m.waist;
    });
    const weightPoints = (logs ?? [])
      .filter(l => l.weight != null)
      .slice(0, 60)
      .reverse()
      .map(l => {
        const iso = toLocalDateStr(l.logDate);
        const [, mo, d] = iso.split("-");
        return {
          isoDate: iso,
          date: `${parseInt(d)} ${months[parseInt(mo) - 1]}`,
          weight: l.weight as number,
          waist: waistByDate[iso] ?? null,
        };
      });
    return weightPoints;
  }, [logs, entries]);

  const hasWeightWaist = combinedTrendData.filter(d => d.weight != null).length > 1;

  // Skinfold vs Weight chart
  const skinfoldWeightData = useMemo(() => {
    const toStr = (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
    const sorted = [...(entries as any[])].sort((a, b) => toStr(a.measureDate).localeCompare(toStr(b.measureDate)));
    return sorted
      .map(m => {
        const total = totalSkinfold(m);
        if (total == null) return null;
        const iso = m.measureDate instanceof Date ? m.measureDate.toISOString().slice(0, 10) : String(m.measureDate);
        const [, mo, d] = iso.split("-");
        const dateLabel = `${parseInt(d)} ${months[parseInt(mo) - 1]}`;
        const msDate = new Date(iso).getTime();
        const weekLogs = (logs ?? []).filter(l => {
          const lMs = new Date(toLocalDateStr(l.logDate)).getTime();
          return Math.abs(lMs - msDate) <= 3 * DAY && l.weight != null;
        });
        const wAvg = weekLogs.length > 0
          ? Math.round((weekLogs.reduce((s: number, l: any) => s + l.weight, 0) / weekLogs.length) * 10) / 10
          : null;
        return { isoDate: iso, date: dateLabel, skinfold: total, avgWeight: wAvg };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [entries, logs]);

  const hasSkinfold = skinfoldWeightData.length > 1;

  // Visible entries for history list
  const visibleEntries = showAll ? sortedEntries : sortedEntries.slice(0, 3);

  // Selected day detail
  const selectedEntry = selectedDate ? measurementByDate[selectedDate] ?? null : null;
  const selectedPrevEntry = selectedEntry ? getPrevEntry(selectedEntry) : null;
  const selectedWeight = selectedDate ? weightByDate[selectedDate] ?? null : null;

  return (
    <div className="space-y-5 pb-24">

      {/* ── 7-Day Avg Weight card ── */}
      {avgWeight && (
        <Card className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">7-Day Avg Weight</p>
            <p className="text-2xl font-bold text-foreground">{avgWeight} kg</p>
          </div>
          {weightChangePct && weightChangeDir && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
              weightChangeDir === "down" ? "bg-primary/15 text-primary" : "bg-amber-400/15 text-amber-400"
            }`}>
              {weightChangeDir === "down" ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
              {Number(weightChangePct) > 0 ? "+" : ""}{weightChangePct}% vs prev week
            </div>
          )}
        </Card>
      )}

      {/* ── Weight & Waist chart ── */}
      {hasWeightWaist && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Weight &amp; Waist</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={combinedTrendData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
              <YAxis yAxisId="weight" tick={{ fill: "#3b82f6", fontSize: 10 }} width={36} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
              <YAxis yAxisId="waist" orientation="right" tick={{ fill: "#f59e0b", fontSize: 10 }} width={36} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(v: number, name: string) => name === "weight" ? [`${v} kg`, "Weight"] : [`${v} cm`, "Waist"]}
              />
              <Area yAxisId="weight" type="monotone" dataKey="weight" stroke="#3b82f6" fill="#3b82f622" strokeWidth={2} dot={{ r: 2, fill: "#3b82f6" }} connectNulls />
              <Line yAxisId="waist" type="monotone" dataKey="waist" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
              Weight (kg)
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" />
              Waist (cm)
            </span>
          </div>
        </div>
      )}

      {/* ── Skinfold vs Weight chart ── */}
      {hasSkinfold && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Skinfold vs Weight</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={skinfoldWeightData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
              <YAxis yAxisId="skinfold" tick={{ fill: "#22c55e", fontSize: 10 }} width={36} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
              <YAxis yAxisId="weight" orientation="right" tick={{ fill: "#3b82f6", fontSize: 10 }} width={36} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(v: number, name: string) =>
                  name === "skinfold" ? [`${v} mm`, "Total Skinfold"] : [`${v} kg`, "Weight"]
                }
              />
              <Line yAxisId="skinfold" type="monotone" dataKey="skinfold" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: "#22c55e", stroke: "#22c55e" }} connectNulls />
              <Line yAxisId="weight" type="monotone" dataKey="avgWeight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6", stroke: "#3b82f6" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />
              Skinfold (mm)
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
              Weight (kg)
            </span>
          </div>
        </div>
      )}

      {/* ── Measurements section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Measurements</p>
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

        {/* Calendar */}
        <div className="mb-4">
          <MeasurementCalendar
            entries={entries as any[]}
            weightByDate={weightByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Selected day detail card */}
        {selectedDate && selectedEntry && (
          <div className="mb-4">
            <HistoryCard
              entry={selectedEntry}
              prevEntry={selectedPrevEntry}
              weightOnDay={selectedWeight}
              onDelete={() => handleDelete(selectedEntry.id)}
              readOnly={!!viewAsUserId}
            />
          </div>
        )}

        {/* Weight-only day info (no measurement) */}
        {selectedDate && !selectedEntry && selectedWeight != null && (
          <div className="mb-4 bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-foreground mb-1">{fmtDate(selectedDate)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Weight</p>
            <p className="text-sm font-semibold text-foreground">{selectedWeight} kg</p>
            <p className="text-xs text-muted-foreground mt-2">No measurement logged for this day.</p>
          </div>
        )}

        {/* History list */}
        {entries.length === 0 ? (
          <div className="bg-card border border-border rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No measurements logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">History</p>
            {visibleEntries.map((entry: any, idx: number) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                prevEntry={sortedEntries[idx + 1] ?? null}
                weightOnDay={weightByDate[isoToDate(entry.measureDate)] ?? null}
                onDelete={() => handleDelete(entry.id)}
                readOnly={!!viewAsUserId}
              />
            ))}
            {!showAll && sortedEntries.length > 3 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                <ChevronDown size={14} />
                Show all {sortedEntries.length} entries
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
