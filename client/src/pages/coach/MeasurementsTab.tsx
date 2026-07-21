import { useState } from "react";
import {
  Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Ruler } from "lucide-react";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionLabel } from "./shared";

export function MeasurementsTab({ measurements, logs, chartOnly, historyOnly, clientId }: { measurements: any[]; logs?: any[]; chartOnly?: boolean; historyOnly?: boolean; clientId?: number }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sorted = [...measurements].sort((a, b) =>
    toLocalDateStr(b.measureDate).localeCompare(toLocalDateStr(a.measureDate))
  );

  function avg(vals: (number | null | undefined)[]): number | null {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
  }

  const SITES = [
    { key: 'umbilical', label: 'Umbilical' },
    { key: 'suprailiac', label: 'Suprailiac' },
    { key: 'calf',       label: 'Calf' },
    { key: 'thigh',      label: 'Thigh' },
  ] as const;

  function siteAvg(m: any, site: string): number | null {
    return avg([m[`${site}1`], m[`${site}2`], m[`${site}3`], m[`${site}4`], m[`${site}5`]]);
  }

  function totalSkinfold(m: any): number | null {
    const vals = SITES.map(s => siteAvg(m, s.key)).filter((v): v is number => v != null);
    return vals.length > 0 ? parseFloat(vals.reduce((a, b) => a + b, 0).toFixed(1)) : null;
  }

  function fmtDate(iso: string) {
    if (!iso || iso.length < 10) return iso;
    const dt = new Date(iso.slice(0, 10) + "T12:00:00Z");
    const weekday = dt.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
    const day = dt.getUTCDate();
    const month = dt.toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
    const year = dt.getUTCFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  }

  function diffBadge(curr: number | null, prev: number | null, invertGood = false) {
    if (curr == null || prev == null) return null;
    const d = parseFloat((curr - prev).toFixed(1));
    if (d === 0) return null;
    const isGood = invertGood ? d > 0 : d < 0;
    return (
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
        isGood ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}>
        {d > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
        {d > 0 ? '+' : ''}{d} mm
      </span>
    );
  }

  function waistDiffBadge(curr: number | null, prev: number | null) {
    if (curr == null || prev == null) return null;
    const d = parseFloat((curr - prev).toFixed(1));
    if (d === 0) return null;
    const isGood = d < 0;
    return (
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
        isGood ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
      }`}>
        {d > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
        {d > 0 ? '+' : ''}{d} cm
      </span>
    );
  }

  // Build trend data (oldest first) for the chart
  const trendData = [...sorted].reverse().map(m => {
    const iso = toLocalDateStr(m.measureDate);
    const [, mo, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return {
      date: `${parseInt(d)} ${months[parseInt(mo)-1]}`,
      total: totalSkinfold(m),
      waist: m.waist ?? null,
      umbilical: siteAvg(m, 'umbilical'),
      suprailiac: siteAvg(m, 'suprailiac'),
      calf: siteAvg(m, 'calf'),
      thigh: siteAvg(m, 'thigh'),
    };
  });

  // Build weight trend data from daily logs (oldest first)
  const weightData = [...(logs ?? [])]
    .filter((l: any) => l.weight != null)
    .sort((a: any, b: any) => toLocalDateStr(a.logDate).localeCompare(toLocalDateStr(b.logDate)))
    .map((l: any) => {
      const iso = toLocalDateStr(l.logDate);
      const [, mo, d] = iso.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { date: `${parseInt(d)} ${months[parseInt(mo)-1]}`, weight: l.weight };
    });

  // Build waist trend data from measurements (oldest first)
  const waistData = [...sorted].reverse()
    .filter(m => m.waist != null)
    .map(m => {
      const iso = toLocalDateStr(m.measureDate);
      const [, mo, d] = iso.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { date: `${parseInt(d)} ${months[parseInt(mo)-1]}`, waist: m.waist };
    });

  // Merge weight and waist onto a shared date axis
  const combinedTrendData = (() => {
    const map = new Map<string, { date: string; weight?: number; waist?: number }>();
    for (const w of weightData) {
      map.set(w.date, { ...map.get(w.date), date: w.date, weight: w.weight });
    }
    for (const w of waistData) {
      map.set(w.date, { ...map.get(w.date), date: w.date, waist: w.waist as number });
    }
    return Array.from(map.values()).sort((a, b) => {
      // Sort by original order (month/day string — use index from weightData as proxy)
      const ai = weightData.findIndex(x => x.date === a.date);
      const bi = weightData.findIndex(x => x.date === b.date);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
  })();

  if (sorted.length === 0 && weightData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Ruler className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No body composition data recorded yet.</p>
      </div>
    );
  }

  const SITE_COLORS: Record<string, string> = {
    umbilical: '#22c55e',
    suprailiac: '#3b82f6',
    calf: '#f59e0b',
    thigh: '#a855f7',
  };

  // Build skinfold data from measurements (oldest first)
  const skinfoldRaw = [...sorted].reverse()
    .filter(m => totalSkinfold(m) != null)
    .map(m => {
      const iso = toLocalDateStr(m.measureDate);
      const [, mo, d] = iso.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { isoDate: iso, date: `${parseInt(d)} ${months[parseInt(mo)-1]}`, skinfold: totalSkinfold(m) };
    });

  // Build weekly avg weight dots aligned to skinfold measurement dates
  // For each skinfold entry, find the avg weight of daily logs in the same 7-day window
  const skinfoldWeightData = skinfoldRaw.map(s => {
    const measureIso = s.isoDate;
    const measureTs = new Date(measureIso + 'T00:00:00').getTime();
    const weekStart = measureTs - 6 * 86400000;
    const weekLogs = (logs ?? []).filter((l: any) => {
      const t = new Date(toLocalDateStr(l.logDate) + 'T00:00:00').getTime();
      return l.weight != null && t >= weekStart && t <= measureTs;
    });
    const avgWeight = weekLogs.length > 0
      ? Math.round((weekLogs.reduce((sum: number, l: any) => sum + l.weight, 0) / weekLogs.length) * 10) / 10
      : null;
    return { isoDate: measureIso, date: s.date, skinfold: s.skinfold, avgWeight };
  });

  const hasWeightWaist = weightData.length > 1 || waistData.length > 1;
  const hasSkinfold = skinfoldRaw.length > 1;

  return (
    <div className="space-y-5">
      {/* Two-column chart grid */}
      {!historyOnly && (hasWeightWaist || hasSkinfold) && (
        <div className="grid gap-4 grid-cols-1">
          {/* Weight + Waist chart */}
          {hasWeightWaist && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Weight &amp; Waist</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={combinedTrendData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="weight" tick={{ fill: '#3b82f6', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <YAxis yAxisId="waist" orientation="right" tick={{ fill: '#f59e0b', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v: number, name: string) => name === 'weight' ? [`${v} kg`, 'Weight'] : [`${v} cm`, 'Waist']}
                    />
                    <Area yAxisId="weight" type="monotone" dataKey="weight" stroke="#3b82f6" fill="#3b82f622" strokeWidth={2} dot={{ r: 2, fill: '#3b82f6' }} connectNulls />
                    <Line yAxisId="waist" type="monotone" dataKey="waist" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
                    Weight (kg)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block rounded" />
                    Waist (cm)
                  </span>
                </div>
            </div>
          )}
          {/* Skinfold vs Weight dual-axis chart (shared date axis) */}
          {hasSkinfold && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Skinfold vs Weight</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={skinfoldWeightData} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="skinfold" tick={{ fill: '#22c55e', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <YAxis yAxisId="weight" orientation="right" tick={{ fill: '#3b82f6', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v: number, name: string) =>
                        name === 'skinfold' ? [`${v} mm`, 'Total Skinfold'] : [`${v} kg`, 'Weight']
                      }
                    />
                    <Line yAxisId="skinfold" type="monotone" dataKey="skinfold" stroke="#22c55e" strokeWidth={2} dot={(props: any) => props.payload.skinfold != null ? <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#22c55e" stroke="#22c55e" /> : <g key={props.key} />} connectNulls />
                    <Line yAxisId="weight" type="monotone" dataKey="avgWeight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', stroke: '#3b82f6' }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" />
                    Skinfold (mm)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
                    Avg Weight (kg)
                  </span>
                </div>
            </div>
          )}
        </div>
      )}
      {/* Session cards */}
      {!chartOnly && (<div>
        <SectionLabel>Measurements</SectionLabel>
        <div className="space-y-2">
          {sorted.map((m, i) => {
            const iso = toLocalDateStr(m.measureDate);
            const prev = sorted[i + 1] ?? null;
            const isExpanded = expandedId === m.id;
            const total = totalSkinfold(m);
            const prevTotal = prev ? totalSkinfold(prev) : null;
            return (
              <div key={m.id} className="rounded-xl border border-border bg-card transition-colors">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">{fmtDate(iso)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-right">
                      {m.waist != null && (
                        <span className="text-xs text-muted-foreground">Waist: <span className="text-foreground font-semibold">{m.waist} cm</span></span>
                      )}
                      {total != null && (
                        <span className="text-xs text-muted-foreground">Skinfold: <span className="text-foreground font-semibold">{total} mm</span></span>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    {/* Waist */}
                    <div className="pt-3 pb-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Waist Circumference</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-foreground">{m.waist != null ? `${m.waist} cm` : '—'}</span>
                        {waistDiffBadge(m.waist ?? null, prev?.waist ?? null)}
                      </div>
                    </div>

                    {/* Skinfold sites */}
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {SITES.map(s => {
                        const readings = [m[`${s.key}1`], m[`${s.key}2`], m[`${s.key}3`], m[`${s.key}4`], m[`${s.key}5`]];
                        const hasAny = readings.some(v => v != null);
                        const sAvg = siteAvg(m, s.key);
                        const prevAvg = prev ? siteAvg(prev, s.key) : null;
                        return (
                          <div key={s.key} className="bg-secondary rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                              <div className="flex items-center gap-1.5">
                                {sAvg != null && <span className="text-sm font-bold text-foreground">{sAvg} mm</span>}
                                {diffBadge(sAvg, prevAvg)}
                              </div>
                            </div>
                            {hasAny ? (
                              <div className="flex gap-1.5 flex-wrap">
                                {readings.map((v, ri) => (
                                  <span key={ri} className={`text-xs px-2 py-0.5 rounded font-mono ${
                                    v != null ? 'bg-card text-foreground' : 'bg-card/50 text-muted-foreground'
                                  }`}>
                                    {v != null ? `${v}` : '—'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No readings</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Total skinfold summary */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Skinfold</p>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">{total != null ? `${total} mm` : '—'}</span>
                        {total != null && prevTotal != null && (() => {
                          const d = parseFloat((total - prevTotal).toFixed(1));
                          if (d === 0) return null;
                          const isGood = d < 0;
                          return (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                              isGood ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                            }`}>
                              {d > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                              {d > 0 ? '+' : ''}{d} mm vs prev
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>)}
    </div>
  );
}
