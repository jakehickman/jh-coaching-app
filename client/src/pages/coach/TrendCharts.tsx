import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { X } from "lucide-react";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";

const DAY = 86400000;

export type TrendPoint = { label: string; value: number | null };

// ─── TrendSparklineCard ────────────────────────────────────────────────────────
interface TrendSparklineCardProps {
  title: string;
  unit: string;
  color: string;
  data: TrendPoint[];
  maxScale?: number;
  isScore?: boolean;
  onClick: () => void;
}
export function TrendSparklineCard({ title, unit, color, data, isScore, onClick }: TrendSparklineCardProps) {
  const validData = data.filter(d => d.value != null);
  const avg = validData.length > 0
    ? (validData.reduce((s, d) => s + d.value!, 0) / validData.length).toFixed(isScore ? 1 : 0)
    : null;
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-3 text-left w-full hover:border-primary/40 transition-colors active:scale-[0.98]"
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{title}</p>
      </div>
      {avg != null && (
        <p className="text-lg font-bold text-foreground mb-1.5" style={{ color }}>
          {avg}{unit}
          <span className="text-xs font-normal text-muted-foreground ml-1">avg</span>
        </p>
      )}
      {validData.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-4 text-center">No data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} barSize={6}>
            <Bar dataKey="value" fill={color} opacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </button>
  );
}

// ─── TrendFullModal ────────────────────────────────────────────────────────────
interface TrendFullModalProps {
  title: string;
  unit: string;
  color: string;
  data: TrendPoint[];
  isScore?: boolean;
  rangeLabel: string;
  onClose: () => void;
}
export function TrendFullModal({ title, unit, color, data, isScore, rangeLabel, onClose }: TrendFullModalProps) {
  const validData = data.filter(d => d.value != null);
  const avg = validData.length > 0
    ? (validData.reduce((s, d) => s + d.value!, 0) / validData.length).toFixed(isScore ? 1 : 0)
    : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-t-2xl w-full max-w-lg p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-base font-bold text-foreground">{title}</p>
            {avg != null && (
              <p className="text-xs text-muted-foreground">{rangeLabel} average: {avg}{unit}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>
        {validData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No data logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            {isScore ? (
              <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} interval={Math.floor(data.length / 8)} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "#555", fontSize: 10 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }}
                  labelStyle={{ color: "#aaa", fontSize: 11 }}
                  itemStyle={{ color }}
                  formatter={(v: any) => [`${v}${unit}`, title]}
                />
                {avg != null && <ReferenceLine y={Number(avg)} stroke={color} strokeDasharray="4 2" strokeOpacity={0.5} />}
                <Bar dataKey="value" fill={color} opacity={0.85} radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} tickLine={false} interval={Math.floor(data.length / 8)} />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#555", fontSize: 10 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }}
                  labelStyle={{ color: "#aaa", fontSize: 11 }}
                  itemStyle={{ color }}
                  formatter={(v: any) => [`${v}${unit}`, title]}
                />
                {avg != null && <ReferenceLine y={Number(avg)} stroke={color} strokeDasharray="4 2" strokeOpacity={0.5} />}
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── DailyLogTrendsPanel ───────────────────────────────────────────────────────
interface LogRow {
  logDate: string | Date;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  hungerLevel?: number | null;
  stressLevel?: number | null;
  stepsCount?: number | null;
}

interface DailyLogTrendsPanelProps {
  logs: LogRow[];
  clientStartDate?: string | null;
  /** Grid columns class — defaults to "grid-cols-2" for mobile, "grid-cols-4" for coach desktop */
  gridCols?: string;
}

type RangeKey = '4w' | '8w' | 'all';

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '4w', label: '4 weeks', days: 28 },
  { key: '8w', label: '8 weeks', days: 56 },
  { key: 'all', label: 'All time', days: null },
];

export function DailyLogTrendsPanel({ logs, clientStartDate, gridCols = "grid-cols-2" }: DailyLogTrendsPanelProps) {
  const [expandedTrend, setExpandedTrend] = useState<keyof typeof trendConfig | null>(null);
  const [range, setRange] = useState<RangeKey>('8w');

  const selectedRange = RANGE_OPTIONS.find(r => r.key === range)!;

  // Build the list of days to show based on selected range
  const trendDays = useMemo(() => {
    const days: string[] = [];
    // For "all time", go back to clientStartDate or max 365 days
    const maxDays = selectedRange.days ?? 365;
    for (let i = maxDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // For "all time", trim to clientStartDate
      if (selectedRange.days === null && clientStartDate && iso < clientStartDate) continue;
      days.push(iso);
    }
    return days;
  }, [selectedRange.days, clientStartDate]);

  const logMap = useMemo(() => {
    const m: Record<string, LogRow> = {};
    for (const l of logs) {
      const iso = toLocalDateStr(l.logDate);
      if (iso) m[iso] = l;
    }
    return m;
  }, [logs]);

  const makeTrendData = (field: keyof Pick<LogRow, 'sleepHours' | 'sleepQuality' | 'hungerLevel' | 'stressLevel' | 'stepsCount'>): TrendPoint[] => {
    return trendDays
      .filter(d => !clientStartDate || d >= clientStartDate)
      .map(d => {
        const log = logMap[d];
        const val = log ? (log as any)[field] : null;
        return { label: d.slice(5), value: val != null ? Number(val) : null };
      });
  };

  const sleepData = useMemo(() => makeTrendData('sleepHours'), [logMap, trendDays, clientStartDate]);
  const hungerData = useMemo(() => makeTrendData('hungerLevel'), [logMap, trendDays, clientStartDate]);
  const stressData = useMemo(() => makeTrendData('stressLevel'), [logMap, trendDays, clientStartDate]);
  const stepsData = useMemo(() => makeTrendData('stepsCount'), [logMap, trendDays, clientStartDate]);

  const hasTrendData = [...sleepData, ...hungerData, ...stressData, ...stepsData].some(d => d.value != null);

  const trendConfig = {
    sleep:  { title: 'Sleep', unit: 'h', color: '#818cf8', data: sleepData, isScore: false },
    hunger: { title: 'Hunger', unit: '/5', color: '#fb923c', data: hungerData, isScore: true },
    stress: { title: 'Stress', unit: '/5', color: '#f87171', data: stressData, isScore: true },
    steps:  { title: 'Steps', unit: '', color: '#34d399', data: stepsData, isScore: false },
  } as const;

  if (!hasTrendData) return null;

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Trends</p>
          {/* Range toggle */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                  range === opt.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`grid ${gridCols} gap-3`}>
          {(Object.keys(trendConfig) as Array<keyof typeof trendConfig>).map(key => {
            const cfg = trendConfig[key];
            return (
              <TrendSparklineCard
                key={key}
                title={cfg.title}
                unit={cfg.unit}
                color={cfg.color}
                data={cfg.data}
                isScore={cfg.isScore}
                onClick={() => setExpandedTrend(key)}
              />
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">Click a card to expand</p>
      </div>
      {expandedTrend && (
        <TrendFullModal
          {...trendConfig[expandedTrend]}
          rangeLabel={selectedRange.label}
          onClose={() => setExpandedTrend(null)}
        />
      )}
    </>
  );
}
