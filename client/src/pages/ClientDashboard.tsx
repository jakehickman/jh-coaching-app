import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { Check, Plus, Trash2, ChevronDown, ChevronUp, Play, X, Minus } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Convert a DB date value (ISO timestamp or plain date string) to local yyyy-mm-dd
// This handles the UTC offset — e.g. "2026-04-05T04:00:00.000Z" is April 6 in AEST (UTC+10)
function toLocalDateStr(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  // If it's a full ISO timestamp, parse as Date and use local date parts
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // Plain date string like "2026-04-06" — use as-is
  return s.slice(0, 10);
}

// Display a DB date value as dd/mm/yyyy in local time
function fmtDate(val: unknown): string {
  if (!val) return "";
  const iso = toLocalDateStr(val);
  const [y, m, d] = iso.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return iso;
}

// DD/MM/YYYY date picker — always shows in Australian format regardless of browser locale
// value and onChange use yyyy-mm-dd strings internally
function DateInput({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [y, m, d] = value ? value.split('-') : ['', '', ''];

  const update = (newD: string, newM: string, newY: string) => {
    if (newD.length <= 2 && newM.length <= 2 && newY.length <= 4) {
      const dPad = newD.padStart(2, '0');
      const mPad = newM.padStart(2, '0');
      if (newY.length === 4 && newM.length >= 1 && newD.length >= 1) {
        onChange(`${newY}-${mPad}-${dPad}`);
      }
    }
  };

  const inputCls = `bg-secondary border border-border rounded-lg px-2 py-3 text-base text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary`;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        type="number" min={1} max={31} placeholder="DD"
        value={d || ''}
        onChange={e => update(e.target.value, m || '', y || '')}
        className={`${inputCls} w-16`}
      />
      <span className="text-muted-foreground">/</span>
      <input
        type="number" min={1} max={12} placeholder="MM"
        value={m || ''}
        onChange={e => update(d || '', e.target.value, y || '')}
        className={`${inputCls} w-16`}
      />
      <span className="text-muted-foreground">/</span>
      <input
        type="number" min={2000} max={2100} placeholder="YYYY"
        value={y || ''}
        onChange={e => update(d || '', m || '', e.target.value)}
        className={`${inputCls} w-24`}
      />
    </div>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

type DailyLogRow = {
  id: number;
  logDate: unknown;
  weight?: number | null;
  sleepHours?: number | null;
  caffeineServings?: number | null;
  trainingCompleted?: boolean | number | null;
  trainingType?: string | null;
  stepsCount?: number | null;
  sleepQuality?: number | null;
  hungerLevel?: number | null;
  offPlanMeal?: boolean | number | null;
  notes?: string | null;
};

function RecentLogsPanel({ logs }: { logs: DailyLogRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logMap: Record<string, DailyLogRow> = {};
  for (const log of logs) {
    const key = toLocalDateStr(log.logDate);
    if (key) logMap[key] = log;
  }

  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  function fmtDay(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function dayLabel(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { weekday: 'short' });
  }
  const isOffPlan = (v: unknown) => v === true || v === 1 || v === '1';
  const isTrained = (v: unknown) => v === true || v === 1 || v === '1';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {days.map((iso) => {
        const log = logMap[iso] ?? null;
        const isExpanded = expandedId === iso;
        const hasData = !!log;
        const trained = log ? isTrained(log.trainingCompleted) : false;
        const sessionLabel = log?.trainingType && log.trainingType !== 'Off'
          ? log.trainingType
          : (trained ? 'Training' : 'Off');
        return (
          <div key={iso} className="border-b border-border last:border-0">
            <button
              onClick={() => hasData && setExpandedId(isExpanded ? null : iso)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                hasData ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default opacity-50'
              }`}
            >
              {/* Left: date + day */}
              <div className="w-20 flex-shrink-0">
                <p className="text-sm font-semibold text-foreground">{fmtDay(iso)}</p>
                <p className="text-[10px] text-muted-foreground">{dayLabel(iso)}</p>
              </div>
              {/* Middle: chips */}
              <div className="flex-1 flex items-center gap-2 flex-wrap px-3">
                {hasData ? (
                  <>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      trained ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>{sessionLabel}</span>
                    {isOffPlan(log.offPlanMeal) && <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400">Off Plan</span>}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No entry</span>
                )}
              </div>
              {/* Right: weight + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasData && log.weight != null && (
                  <span className="text-sm font-semibold text-foreground">{log.weight} kg</span>
                )}
                {hasData && (isExpanded
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {isExpanded && log && (
              <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3">
                  {log.weight != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p><p className="text-sm font-semibold text-foreground">{log.weight} kg</p></div>}
                  {log.stepsCount != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Steps</p><p className="text-sm font-semibold text-foreground">{log.stepsCount.toLocaleString()}</p></div>}
                  {log.sleepHours != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Hours</p><p className="text-sm font-semibold text-foreground">{log.sleepHours} hrs</p></div>}
                  {log.sleepQuality != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sleep Quality</p><p className="text-sm font-semibold text-foreground">{log.sleepQuality}/5</p></div>}
                  {log.hungerLevel != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hunger</p><p className="text-sm font-semibold text-foreground">{log.hungerLevel}/5</p></div>}
                  {log.caffeineServings != null && <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Caffeine</p><p className="text-sm font-semibold text-foreground">{log.caffeineServings} srv</p></div>}
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Training</p><p className="text-sm font-semibold text-foreground">{sessionLabel}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Meals</p><p className="text-sm font-semibold text-foreground">{isOffPlan(log.offPlanMeal) ? 'Off Plan' : 'On Plan'}</p></div>
                </div>
                {log.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-foreground italic">{log.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}
function ScoreInput({ label, value, onChange, max = 10 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded text-sm font-medium transition-colors ${
              value === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Overview / Dashboard ────────────────────────────────────────────────
function OverviewTab() {
  const { data: logs } = trpc.dailyLog.list.useQuery({ limit: 30 });
  const { data: checkIns } = trpc.checkIn.list.useQuery();
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: program } = trpc.training.get.useQuery();
  const { data: measurements } = trpc.measurements.list.useQuery();

  const weightData = (logs ?? [])
    .filter(l => l.weight)
    .slice(0, 14)
    .reverse()
    .map(l => {
      const iso = toLocalDateStr(l.logDate);
      return { date: iso.slice(5), weight: l.weight };
    });

  // 7-day avg weight using true calendar days (string comparison avoids timezone shifts)
  const allLogs = logs ?? [];
  const DAY = 86400000;
  // Build date strings for the window boundaries using local time
  const localDateStr = (offsetDays: number) => {
    const d = new Date(Date.now() - offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = localDateStr(0);
  const day6ago = localDateStr(6);
  const day7ago = localDateStr(7);
  const day13ago = localDateStr(13);

  const thisWeekWeights = allLogs
    .filter(l => {
      const d = toLocalDateStr(l.logDate);
      return d >= day6ago && d <= today && l.weight != null;
    })
    .map(l => l.weight as number);

  const prevWeekWeights = allLogs
    .filter(l => {
      const d = toLocalDateStr(l.logDate);
      return d >= day13ago && d <= day7ago && l.weight != null;
    })
    .map(l => l.weight as number);

  const avgWeight = thisWeekWeights.length > 0
    ? (thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length).toFixed(1)
    : "—";

  const prevAvgWeight = prevWeekWeights.length > 0
    ? prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length
    : null;

  const weightChangePct = prevAvgWeight && thisWeekWeights.length > 0
    ? (((thisWeekWeights.reduce((a, b) => a + b, 0) / thisWeekWeights.length) - prevAvgWeight) / prevAvgWeight * 100).toFixed(1)
    : null;

  const latestLog = logs?.[0];

  // Training adherence — one full rotation window
  // The schedule is e.g. ["A","B","Off","C","D","Off"] — rotation length = schedule.length
  const schedule: string[] = Array.isArray((program as any)?.schedule) ? (program as any).schedule : [];
  const rotationLength = schedule.length > 0 ? schedule.length : 7;
  const prescribedDays = schedule.length > 0
    ? schedule.filter((s: string) => s !== 'Off').length
    : rotationLength;
  // Look back exactly one rotation length in calendar days
  const rotationStartDate = localDateStr(rotationLength - 1);
  const trainedInRotation = allLogs.filter(l => {
    const d = toLocalDateStr(l.logDate);
    return d >= rotationStartDate && d <= today && l.trainingCompleted;
  }).length;
  const adherence = prescribedDays > 0 ? Math.min(100, Math.round((trainedInRotation / prescribedDays) * 100)) : 0;
  const adherenceSub = schedule.length > 0
    ? `${trainedInRotation}/${prescribedDays} days (last ${rotationLength}-day rotation)`
    : `${trainedInRotation} sessions this rotation`;

  // Meal adherence — last 7 calendar days
  const isOffPlan = (v: unknown) => v === true || v === 1 || v === '1';
  const cur7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day6ago && d <= today; });
  const prev7Logs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day13ago && d <= day7ago; });
  const curOnPlan = cur7Logs.filter(l => !isOffPlan(l.offPlanMeal)).length;
  const mealAdherence = cur7Logs.length > 0 ? Math.round((curOnPlan / cur7Logs.length) * 100) : null;
  const prevOnPlan = prev7Logs.filter(l => !isOffPlan(l.offPlanMeal)).length;
  const prevMealAdherence = prev7Logs.length > 0 ? Math.round((prevOnPlan / prev7Logs.length) * 100) : null;
  const mealAdherenceSub = cur7Logs.length > 0
    ? `${curOnPlan}/${cur7Logs.length} on-plan days${prevMealAdherence != null ? ` · prev ${prevMealAdherence}%` : ""}`
    : undefined;

  // Recent logs for display (last 7 entries)
  const recentLogs = allLogs.slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Weekly Summary</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="7-Day Avg Weight" value={avgWeight !== "—" ? `${avgWeight} kg` : "—"} sub={weightChangePct ? `${Number(weightChangePct) > 0 ? "+" : ""}${weightChangePct}% vs prev 7 days` : undefined} />
          <MetricCard label="Training Adherence" value={`${adherence}%`} sub={adherenceSub} />
          <MetricCard label="Meal Adherence" value={mealAdherence != null ? `${mealAdherence}%` : "—"} sub={mealAdherenceSub} />
          <MetricCard label="Goal Weight" value={profile?.goalWeight ? `${profile.goalWeight} kg` : "—"} sub={profile?.startWeight ? `Started: ${profile.startWeight} kg` : undefined} />
        </div>
      </div>

      {weightData.length > 0 && (
        <div>
          <SectionLabel>Weight Trend (14 Days)</SectionLabel>
          <Card>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#666", fontSize: 10 }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#22c55e" }}
                />
                <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ── Measurements Comparison ─────────────────────────────── */}
      {(() => {
        const mList = (measurements ?? []).slice().sort((a, b) =>
          toLocalDateStr(b.measureDate).localeCompare(toLocalDateStr(a.measureDate))
        );
        const latest = mList[0];
        const prev = mList[1];
        if (!latest) return null;

        const siteAvg = (vals: (number | null | undefined)[]) => {
          const nums = vals.filter((v): v is number => v != null);
          return nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
        };

        const sites = [
          { label: "Umbilical", avg: siteAvg([latest.umbilical1, latest.umbilical2, latest.umbilical3, latest.umbilical4, latest.umbilical5]) },
          { label: "Suprailiac", avg: siteAvg([latest.suprailiac1, latest.suprailiac2, latest.suprailiac3, latest.suprailiac4, latest.suprailiac5]) },

        ];
        // Total uses whatever sites have data (not requiring all 4)
        const sitesWithData = sites.filter(s => s.avg != null);
        const latestTotal = sitesWithData.length > 0
          ? parseFloat(sitesWithData.reduce((a, s) => a + s.avg!, 0).toFixed(1))
          : null;

        const prevSites = prev ? [
          { label: "Umbilical", avg: siteAvg([prev.umbilical1, prev.umbilical2, prev.umbilical3, prev.umbilical4, prev.umbilical5]) },
          { label: "Suprailiac", avg: siteAvg([prev.suprailiac1, prev.suprailiac2, prev.suprailiac3, prev.suprailiac4, prev.suprailiac5]) },

        ] : null;
        // Compare only sites that exist in both measurements
        const prevTotal = prevSites
          ? (() => {
              const matchedPrev = prevSites.filter(ps => sites.find(s => s.label === ps.label && s.avg != null) && ps.avg != null);
              const matchedCur = sites.filter(s => prevSites.find(ps => ps.label === s.label && ps.avg != null) && s.avg != null);
              if (matchedPrev.length === 0 || matchedPrev.length !== matchedCur.length) return null;
              return parseFloat(matchedPrev.reduce((a, s) => a + s.avg!, 0).toFixed(1));
            })()
          : null;
        const curTotalForDiff = prevTotal != null && prevSites
          ? (() => {
              const matchedCur = sites.filter(s => prevSites.find(ps => ps.label === s.label && ps.avg != null) && s.avg != null);
              return matchedCur.length > 0 ? parseFloat(matchedCur.reduce((a, s) => a + s.avg!, 0).toFixed(1)) : null;
            })()
          : null;
        const totalDiff = curTotalForDiff != null && prevTotal != null
          ? parseFloat((curTotalForDiff - prevTotal).toFixed(1))
          : null;

        const waistDiff = latest.waist != null && prev?.waist != null
          ? parseFloat((latest.waist - prev.waist).toFixed(1))
          : null;

        return (
          <>
            <div>
              <SectionLabel>Waist Circumference</SectionLabel>
              <Card>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Latest · {fmtDate(latest.measureDate)}</p>
                    {latest.waist != null ? (
                      <p className="text-2xl font-bold text-foreground">{latest.waist} <span className="text-sm font-normal text-muted-foreground">cm</span></p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not recorded</p>
                    )}
                  </div>
                  {waistDiff != null && prev && (
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${waistDiff < 0 ? "text-green-400" : waistDiff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {waistDiff > 0 ? "+" : ""}{waistDiff} cm
                      </p>
                      <p className="text-xs text-muted-foreground">vs {fmtDate(prev.measureDate)}</p>
                    </div>
                  )}
                </div>
                {prev && waistDiff == null && (
                  <p className="text-xs text-muted-foreground mt-2">vs {fmtDate(prev.measureDate)}: {prev.waist ?? "—"} cm</p>
                )}
              </Card>
            </div>
            <div>
              <SectionLabel>Skinfold Thickness</SectionLabel>
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Latest · {fmtDate(latest.measureDate)}</p>
                    <p className="text-[11px] text-muted-foreground">avg of 5 readings per site</p>
                  </div>
                  {totalDiff != null && prev && (
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${totalDiff < 0 ? "text-green-400" : totalDiff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {totalDiff > 0 ? "+" : ""}{totalDiff} mm
                      </p>
                      <p className="text-xs text-muted-foreground">vs {fmtDate(prev.measureDate)}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {sites.map(({ label, avg }) => (
                    <div key={label} className="bg-secondary rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        {avg != null ? <>{avg} <span className="text-xs font-normal text-muted-foreground">mm</span></> : "—"}
                      </p>
                    </div>
                  ))}
                </div>
                {latestTotal != null && (
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Total ({sitesWithData.length} sites)</p>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{latestTotal} mm</p>

                    </div>
                  </div>
                )}
              </Card>
            </div>
          </>
        );
      })()}

      <div>
        <SectionLabel>Recent Logs</SectionLabel>
        <RecentLogsPanel logs={allLogs} />
      </div>
    </div>
  );
}

// ─── Tab: Daily Log ───────────────────────────────────────────────────────────
function DailyLogTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [form, setForm] = useState({
    weight: "", sleepHours: "", caffeineServings: "", trainingCompleted: false,
    trainingType: "", stepsCount: "", sleepQuality: 3, hungerLevel: 3, offPlanMeal: false, notes: ""
  });

  const { data: logs, refetch } = trpc.dailyLog.list.useQuery({ limit: 30 });
  const { data: program } = trpc.training.get.useQuery();
  const upsert = trpc.dailyLog.upsert.useMutation({
    onSuccess: () => { toast.success("Log saved"); refetch(); }
  });
  const del = trpc.dailyLog.delete.useMutation({
    onSuccess: () => { toast.success("Log deleted"); refetch(); }
  });

  // Build session options from training program day names
  const sessionOptions: string[] = program?.days
    ? (program.days as Array<{ name?: string }>)
        .map((d, i) => d.name || `Day ${i + 1}`)
        .filter(Boolean)
    : [];

  // Load existing log for selected date
  useEffect(() => {
    const existing = logs?.find(l => toLocalDateStr(l.logDate) === date);
    if (existing) {
      setForm({
        weight: existing.weight?.toString() ?? "",
        sleepHours: existing.sleepHours?.toString() ?? "",
        caffeineServings: existing.caffeineServings?.toString() ?? "",
        trainingCompleted: existing.trainingCompleted ?? false,
        trainingType: existing.trainingType ?? "",
        stepsCount: existing.stepsCount?.toString() ?? "",
        sleepQuality: existing.sleepQuality ?? 3,
        hungerLevel: existing.hungerLevel ?? 3,
        offPlanMeal: existing.offPlanMeal ?? false,
        notes: existing.notes ?? "",
      });
    } else {
      setForm({ weight: "", sleepHours: "", caffeineServings: "", trainingCompleted: false, trainingType: "", stepsCount: "", sleepQuality: 3, hungerLevel: 3, offPlanMeal: false, notes: "" });
    }
  }, [date, logs]);

  const handleSave = () => {
    upsert.mutate({
      logDate: date,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : undefined,
      caffeineServings: form.caffeineServings ? parseFloat(form.caffeineServings) : undefined,
      trainingCompleted: form.trainingCompleted,
      trainingType: form.trainingType || undefined,
      stepsCount: form.stepsCount ? parseInt(form.stepsCount) : undefined,
      sleepQuality: form.sleepQuality,
      hungerLevel: form.hungerLevel,
      offPlanMeal: form.offPlanMeal,
      notes: form.notes || undefined,
    });
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <SectionLabel>Date</SectionLabel>
        <DateInput value={date} onChange={setDate} />
      </div>

      <div>
        <SectionLabel>Body Metrics</SectionLabel>
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={f("weight")} placeholder="e.g. 82.5"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Sleep (hours)</label>
              <input type="number" step="0.5" value={form.sleepHours} onChange={f("sleepHours")} placeholder="e.g. 7.5"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Caffeine (servings)</label>
              <input type="number" step="0.5" min="0" value={form.caffeineServings} onChange={f("caffeineServings")} placeholder="e.g. 2"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <p className="text-[10px] text-muted-foreground mt-0.5">1 serving ≈ 80–100mg</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Steps</label>
              <input type="number" value={form.stepsCount} onChange={f("stepsCount")} placeholder="e.g. 8000"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Training</SectionLabel>
        <Card className="space-y-3">
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, trainingCompleted: !p.trainingCompleted }))}
            className="flex items-center gap-3 cursor-pointer w-full text-left py-1"
          >
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              form.trainingCompleted ? "bg-primary border-primary" : "border-border"
            }`}>
              {form.trainingCompleted && <Check size={14} className="text-primary-foreground" />}
            </div>
            <span className="text-base text-foreground">Training completed today</span>
          </button>
          {form.trainingCompleted && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Session</label>
              <select value={form.trainingType} onChange={f("trainingType")}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select session</option>
                {sessionOptions.length > 0
                  ? sessionOptions.map(s => <option key={s} value={s}>{s}</option>)
                  : [
                      <option key="ub" value="Upper Body">Upper Body</option>,
                      <option key="lb" value="Lower Body">Lower Body</option>,
                      <option key="push" value="Push">Push</option>,
                      <option key="pull" value="Pull">Pull</option>,
                      <option key="legs" value="Legs">Legs</option>,
                      <option key="fb" value="Full Body">Full Body</option>,
                      <option key="cardio" value="Cardio">Cardio</option>,
                    ]
                }
              </select>
              {sessionOptions.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">No training program assigned yet — showing generic options</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div>
        <SectionLabel>Biofeedback (1–5)</SectionLabel>
        <Card className="space-y-4">
          <ScoreInput label="Sleep Quality" value={form.sleepQuality} onChange={v => setForm(p => ({ ...p, sleepQuality: v }))} max={5} />
          <ScoreInput label="Hunger Level" value={form.hungerLevel} onChange={v => setForm(p => ({ ...p, hungerLevel: v }))} max={5} />
        </Card>
      </div>

      <div>
        <SectionLabel>Nutrition</SectionLabel>
        <Card>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, offPlanMeal: !p.offPlanMeal }))}
            className="flex items-center gap-3 cursor-pointer w-full text-left py-1"
          >
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              form.offPlanMeal ? "bg-amber-500 border-amber-500" : "border-border"
            }`}>
              {form.offPlanMeal && <Check size={14} className="text-white" />}
            </div>
            <div>
              <span className="text-base text-foreground">Off plan meal today</span>
              <p className="text-xs text-muted-foreground mt-0.5">Had 1 or more meals not in my prescribed plan</p>
            </div>
          </button>
        </Card>
      </div>

      <div>
        <SectionLabel>Notes</SectionLabel>
        <textarea value={form.notes} onChange={f("notes")} rows={3} placeholder="Any notes for today..."
          className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>

      <button onClick={handleSave} disabled={upsert.isPending}
        className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
        {upsert.isPending ? "Saving..." : "Save Log"}
      </button>

      <div>
        <SectionLabel>Recent Logs</SectionLabel>
        <RecentLogsPanel logs={logs ?? []} />
      </div>
    </div>
  );
}

// ─── Tab: Measurements ────────────────────────────────────────────────────────
const SKINFOLD_SITES = [
  { key: "umbilical", label: "Umbilical" },
  { key: "suprailiac", label: "Suprailiac" },

] as const;

function avgReadings(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null && v !== undefined);
  return nums.length > 0 ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
}

function MeasurementsTab() {
  const { data: measurements, refetch } = trpc.measurements.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const emptySkinfold = { r1: "", r2: "", r3: "", r4: "", r5: "" };
  const [form, setForm] = useState({
    measureDate: new Date().toISOString().slice(0, 10),
    waist: "",
    umbilical: { ...emptySkinfold },
    suprailiac: { ...emptySkinfold },

    notes: "",
  });
  const add = trpc.measurements.add.useMutation({
    onSuccess: () => { toast.success("Measurements saved"); setShowForm(false); refetch(); }
  });
  const del = trpc.measurements.delete.useMutation({
    onSuccess: () => { toast.success("Entry deleted"); refetch(); }
  });

  const setReading = (site: string, r: string, val: string) =>
    setForm(p => ({ ...p, [site]: { ...(p as any)[site], [r]: val } }));

  const parseR = (v: string) => v ? parseFloat(v) : undefined;

  const waistData = (measurements ?? []).slice(0, 8).reverse().map(m => ({
    date: String(m.measureDate).slice(5, 10),
    waist: m.waist,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Measurements</SectionLabel>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
          <Plus size={14} /> Add Measurement
        </button>
      </div>

      {showForm && (
        <Card className="space-y-5">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Date</label>
            <DateInput value={form.measureDate} onChange={v => setForm(p => ({ ...p, measureDate: v }))} />
          </div>

          {/* Waist */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Waist Circumference (cm)</p>
            <input type="number" step="0.1" value={form.waist} onChange={e => setForm(p => ({ ...p, waist: e.target.value }))} placeholder="e.g. 82.5"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Skinfold sites */}
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
                        onChange={e => setReading(key, r, e.target.value)} placeholder="—"
                        className="w-full bg-secondary border border-border rounded-lg px-1.5 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <button onClick={() => add.mutate({
            measureDate: form.measureDate,
            waist: parseR(form.waist),
            umbilical1: parseR(form.umbilical.r1), umbilical2: parseR(form.umbilical.r2), umbilical3: parseR(form.umbilical.r3), umbilical4: parseR(form.umbilical.r4), umbilical5: parseR(form.umbilical.r5),
            suprailiac1: parseR(form.suprailiac.r1), suprailiac2: parseR(form.suprailiac.r2), suprailiac3: parseR(form.suprailiac.r3), suprailiac4: parseR(form.suprailiac.r4), suprailiac5: parseR(form.suprailiac.r5),

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
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={waistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#666", fontSize: 10 }}
                  interval="preserveStartEnd"
                  tickLine={false}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#22c55e" }} />
                <Line type="monotone" dataKey="waist" stroke="#22c55e" strokeWidth={2} dot={false} name="Waist (cm)" />
              </LineChart>
            </ResponsiveContainer>
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
              const siteAvgs = [umbAvg, supAvg];
              const total = siteAvgs.every(v => v !== null) ? parseFloat(siteAvgs.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-base font-semibold text-foreground">{fmtDate(m.measureDate)}</p>
                    <button onClick={() => { if (confirm("Delete this measurement entry?")) del.mutate({ id: m.id }); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" title="Delete entry">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Waist */}
                  {m.waist && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Waist</p>
                      <p className="text-lg font-bold text-foreground">{m.waist} <span className="text-sm font-normal text-muted-foreground">cm</span></p>
                    </div>
                  )}
                  {/* Skinfold averages */}
                  {siteAvgs.some(v => v !== null) && (
                    <>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Skinfold (avg mm)</p>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[
                          { label: "Umbilical", avg: umbAvg },
                          { label: "Suprailiac", avg: supAvg },

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
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Meal Plan ───────────────────────────────────────────────────────────
function MealPlanTab() {
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: plan } = trpc.mealPlan.get.useQuery({ dayType });
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();

  const meals = (plan?.meals as any[]) ?? [];

  // Helper: convert item amount to grams (handles serving-based foods)
  function itemToGrams(food: any, amount: number): number {
    if (!food) return amount;
    return food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  }

  // Calculate macros per meal and daily totals from food DB
  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const food = foodDb.find((f: any) => f.name === item.food);
      if (!food || !parseFloat(item.grams)) return acc;
      const grams = itemToGrams(food, parseFloat(item.grams));
      const factor = grams / 100;
      return {
        calories: acc.calories + Math.round(food.calories * factor),
        protein: Math.round((acc.protein + food.protein * factor) * 10) / 10,
        carbs: Math.round((acc.carbs + food.carbs * factor) * 10) / 10,
        fiber: Math.round((acc.fiber + food.fiber * factor) * 10) / 10,
        fat: Math.round((acc.fat + food.fat * factor) * 10) / 10,
      };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 })
  );
  const dailyTotals = mealMacros.reduce((acc: any, m: any) => ({
    calories: acc.calories + m.calories,
    protein: Math.round((acc.protein + m.protein) * 10) / 10,
    carbs: Math.round((acc.carbs + m.carbs) * 10) / 10,
    fiber: Math.round((acc.fiber + m.fiber) * 10) / 10,
    fat: Math.round((acc.fat + m.fat) * 10) / 10,
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["training", "rest"] as const).map(t => (
          <button key={t} onClick={() => setDayType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {t === "training" ? "Training Day" : "Rest Day"}
          </button>
        ))}
      </div>

      {plan && (
        <div className="space-y-4">
          {/* Daily totals */}
          {meals.length > 0 && dailyTotals.calories > 0 && (
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Calories", value: dailyTotals.calories, unit: "kcal", highlight: true },
                  { label: "Protein", value: dailyTotals.protein, unit: "g" },
                  { label: "Carbs", value: dailyTotals.carbs, unit: "g" },
                  { label: "Fiber", value: dailyTotals.fiber, unit: "g" },
                  { label: "Fat", value: dailyTotals.fat, unit: "g" },
                ].map(({ label, value, unit, highlight }) => (
                  <div key={label} className={`flex flex-col items-center px-2 py-2 rounded-lg ${ highlight ? "bg-primary/15 border border-primary/30" : "bg-secondary/60" }`}>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
                    <span className={`text-sm font-bold mt-0.5 ${ highlight ? "text-primary" : "text-foreground" }`}>{value} {unit}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {meals.length > 0 ? (
            <div className="space-y-4">
              {meals.map((meal: any, i: number) => {
                const mm = mealMacros[i];
                const hasMacros = mm.calories > 0;
                return (
                  <Card key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground">{meal.name ?? `Meal ${i + 1}`}</p>
                      {meal.time && (
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                          {(() => { try { const [h, m] = meal.time.split(":"); const d = new Date(); d.setHours(+h, +m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return meal.time; } })()}
                        </span>
                      )}
                    </div>
                    {(meal.items ?? []).map((item: any, j: number) => {
                      const food = foodDb.find((f: any) => f.name === item.food);
                      const rawAmount = parseFloat(item.grams) || 0;
                      const effectiveGrams = food ? itemToGrams(food, rawAmount) : rawAmount;
                      const factor = effectiveGrams / 100;
                      const isServingBased = !!(food?.servingUnit && food?.servingGrams);
                      const displayQty = isServingBased
                        ? `${rawAmount} ${food.servingUnit}${rawAmount !== 1 ? "s" : ""} (${effectiveGrams}g)`
                        : rawAmount > 0 ? `${rawAmount}g` : "";
                      const itemCal = food && rawAmount ? Math.round(food.calories * factor) : null;
                      const itemP = food && rawAmount ? Math.round(food.protein * factor * 10) / 10 : null;
                      const itemC = food && rawAmount ? Math.round(food.carbs * factor * 10) / 10 : null;
                      const itemF = food && rawAmount ? Math.round(food.fat * factor * 10) / 10 : null;
                      return (
                        <div key={j} className="py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-foreground">{item.food || <span className="text-muted-foreground italic">Unknown food</span>}</p>
                            <p className="text-xs text-muted-foreground">{displayQty}</p>
                          </div>
                          {itemCal !== null && (
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-xs font-medium text-foreground">{itemCal} kcal</span>
                              <span className="text-xs text-muted-foreground">P {itemP}g</span>
                              <span className="text-xs text-muted-foreground">C {itemC}g</span>
                              <span className="text-xs text-muted-foreground">F {itemF}g</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {hasMacros && (
                      <div className="mt-3 pt-2 border-t border-border/40">
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground self-center">Total:</span>
                          <span className="text-xs font-semibold text-primary">{mm.calories} kcal</span>
                          <span className="text-xs text-muted-foreground">P {mm.protein}g</span>
                          <span className="text-xs text-muted-foreground">C {mm.carbs}g</span>
                          <span className="text-xs text-muted-foreground">Fiber {mm.fiber}g</span>
                          <span className="text-xs text-muted-foreground">F {mm.fat}g</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-8">
              <p className="text-muted-foreground text-sm">No meal plan set for {dayType} days yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan here.</p>
            </Card>
          )}

          {plan.notes && (
            <Card>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
              <p className="text-sm text-foreground">{plan.notes}</p>
            </Card>
          )}
        </div>
      )}

      {!plan && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No meal plan set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan here.</p>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Shopping List ───────────────────────────────────────────────────────
function ShoppingListTab() {
  const [trainingDays, setTrainingDays] = useState(4);
  const [restDays, setRestDays] = useState(3);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const { data: trainingPlan } = trpc.mealPlan.get.useQuery({ dayType: "training" });
  const { data: restPlan } = trpc.mealPlan.get.useQuery({ dayType: "rest" });
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();

  // Helper: convert serving amount to grams
  function itemToGrams(food: any, amount: number): number {
    if (!food) return amount;
    return food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  }

  // Aggregate all food quantities across both plan types × day counts
  const shoppingMap = useMemo(() => {
    const map: Record<string, { totalGrams: number; food: any }> = {};

    const addItems = (plan: any, multiplier: number) => {
      if (!plan || multiplier === 0) return;
      const meals = (plan.meals as any[]) ?? [];
      meals.forEach(meal => {
        (meal.items ?? []).forEach((item: any) => {
          if (!item.food || !parseFloat(item.grams)) return;
          const food = foodDb.find((f: any) => f.name === item.food);
          const grams = itemToGrams(food, parseFloat(item.grams)) * multiplier;
          if (!map[item.food]) map[item.food] = { totalGrams: 0, food };
          map[item.food].totalGrams += grams;
        });
      });
    };

    addItems(trainingPlan, trainingDays);
    addItems(restPlan, restDays);
    return map;
  }, [trainingPlan, restPlan, foodDb, trainingDays, restDays]);

  const items = Object.entries(shoppingMap).sort(([a], [b]) => a.localeCompare(b));
  const checkedCount = items.filter(([name]) => checked[name]).length;

  // Format display quantity: prefer serving units when available
  function formatQty(name: string, totalGrams: number, food: any): string {
    if (food?.servingUnit && food?.servingGrams) {
      const servings = totalGrams / food.servingGrams;
      const rounded = Math.ceil(servings * 2) / 2; // round up to nearest 0.5
      return `${rounded} ${food.servingUnit}${rounded !== 1 ? "s" : ""}`;
    }
    // Round up to nearest 10g for cleaner shopping quantities
    const rounded = Math.ceil(totalGrams / 10) * 10;
    return `${rounded}g`;
  }

  return (
    <div className="space-y-6">
      {/* Day count inputs */}
      <Card>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Shopping For</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Training Days</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setTrainingDays(d => Math.max(0, d - 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">−</button>
              <span className="text-lg font-bold text-foreground w-6 text-center">{trainingDays}</span>
              <button onClick={() => setTrainingDays(d => Math.min(14, d + 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">+</button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Rest Days</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setRestDays(d => Math.max(0, d - 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">−</button>
              <span className="text-lg font-bold text-foreground w-6 text-center">{restDays}</span>
              <button onClick={() => setRestDays(d => Math.min(14, d + 1))}
                className="w-8 h-8 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-secondary/70 flex items-center justify-center">+</button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{trainingDays + restDays} day total · quantities calculated from your meal plan</p>
      </Card>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{checkedCount}/{items.length} items checked</p>
          <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : "0%" }} />
          </div>
        </div>
      )}

      {items.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No meal plan set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your meal plan and quantities will appear here.</p>
        </Card>
      )}

      {items.length > 0 && (
        <Card className="space-y-1">
          {items.map(([name, entry]) => {
            const { totalGrams, food } = entry as { totalGrams: number; food: any };
            const qty = formatQty(name, totalGrams, food);
            const isChecked = !!checked[name];
            return (
              <button
                key={name}
                onClick={() => setChecked(prev => ({ ...prev, [name]: !prev[name] }))}
                className="flex items-center gap-3 py-2.5 w-full text-left group"
              >
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isChecked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                }`}>
                  {isChecked && <Check size={12} className="text-primary-foreground" />}
                </div>
                <span className={`text-sm flex-1 ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {name}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{qty}</span>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Training Program ────────────────────────────────────────────────────
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  // Handle: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\.\w-]+)/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
}

function TrainingTab() {
  const { data: program } = trpc.training.get.useQuery();
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);

  const days = (program?.days as any[]) ?? [];
  const schedule = Array.isArray(program?.schedule) ? (program!.schedule as string[]) : [];

  // Build a lookup map: exercise name → videoUrl
  const videoMap = Object.fromEntries(
    exerciseLib
      .filter((e: any) => e.videoUrl)
      .map((e: any) => [e.name, e.videoUrl as string])
  );

  return (
    <div className="space-y-4">
      {program?.programName && (
        <p className="text-sm font-semibold text-foreground">{program.programName}</p>
      )}

      {schedule.length > 0 && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Training Schedule</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {schedule.map((slot: string, i: number) => (
              <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                slot === "Off"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}>{slot}</span>
            ))}
            <span className="text-[10px] text-muted-foreground/50 ml-1">→ repeat</span>
          </div>
        </Card>
      )}

      {days.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No training program set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your program here.</p>
        </Card>
      )}

      {days.map((day: any, i: number) => (
        <Card key={i} className="overflow-hidden">
          <button
            onClick={() => setExpandedDay(expandedDay === i ? null : i)}
            className="w-full flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{day.name ?? `Day ${i + 1}`}</p>
              {day.focus && <p className="text-xs text-muted-foreground mt-0.5">{day.focus}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(day.exercises ?? []).length} exercises</span>
              {expandedDay === i ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </button>

          {expandedDay === i && (
              <div className="mt-4 space-y-2">
              <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                <p className="col-span-6 text-[10px] text-muted-foreground uppercase tracking-wider">Exercise</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Sets</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Reps</p>
              </div>
              {(day.exercises ?? []).map((ex: any, j: number) => {
                const videoUrl = videoMap[ex.name];
                const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
                return (
                  <div key={j} className="border-t border-border">
                    <div className="grid grid-cols-12 gap-2 items-center py-2">
                      <div className="col-span-6 flex items-center gap-2">
                        <p className="text-sm text-foreground flex-1 min-w-0">{ex.name}</p>
                        {embedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: ex.name, embedUrl })}
                            className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Watch demo"
                          >
                            <Play size={10} />
                            <span className="text-[9px] font-semibold">Demo</span>
                          </button>
                        )}
                      </div>
                      <p className="col-span-3 text-sm text-foreground text-center">{ex.sets}</p>
                      <p className="col-span-3 text-sm text-foreground text-center">{ex.reps}</p>
                    </div>
                    {ex.notes && (
                      <p className="text-xs text-muted-foreground pb-2 leading-relaxed">{ex.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}

      {program?.notes && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
          <p className="text-sm text-foreground">{program.notes}</p>
        </Card>
      )}

      {/* Video Modal */}
      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-card rounded-xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={videoModal.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoModal.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Tab: Workout Log ────────────────────────────────────────────────────────
function WorkoutLogTab() {
  const { data: program } = trpc.training.get.useQuery();
  const { data: sessions = [], refetch } = trpc.workoutSessions.list.useQuery();
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const utils = trpc.useUtils();

  // Build video URL lookup map from exercise library
  const videoMap: Record<string, string> = Object.fromEntries(
    (exerciseLib as any[]).filter((e: any) => e.videoUrl).map((e: any) => [e.name, e.videoUrl as string])
  );
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Build list of program days — DB uses 'name' field (e.g. "A", "B"), map to label for consistency
  const days: Array<{ label: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }> }> =
    ((program?.days as any[]) ?? []).map((d: any) => ({ ...d, label: d.label ?? d.name }));

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(today);
  // exerciseData: { [exerciseName]: Array<{weight: string, reps: string, notes: string}> }
  const [exerciseData, setExerciseData] = useState<Record<string, Array<{ weight: string; reps: string; notes: string }>>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const dailyLogMutation = trpc.dailyLog.upsert.useMutation();

  const saveMutation = trpc.workoutSessions.save.useMutation({
    onSuccess: () => {
      utils.workoutSessions.list.invalidate();
      utils.dailyLog.list.invalidate();
      setSaving(false);
      toast.success("Session saved!");
      // Auto-link to Daily Log: tick training completed + set session type
      if (selectedDay) {
        dailyLogMutation.mutate({
          logDate: sessionDate,
          trainingCompleted: true,
          trainingType: selectedDay,
        });
      }
    },
    onError: () => { setSaving(false); toast.error("Failed to save session."); },
  });
  const deleteMutation = trpc.workoutSessions.delete.useMutation({
    onSuccess: () => { utils.workoutSessions.list.invalidate(); setDeleting(null); toast.success("Session deleted."); },
    onError: () => { setDeleting(null); toast.error("Failed to delete."); },
  });

  // When user picks a day, load existing session for that date+day or init blank
  function selectDay(label: string) {
    setSelectedDay(label);
    const dayDef = days.find(d => d.label === label);
    const existing = sessions.find(s => toLocalDateStr(s.sessionDate) === sessionDate && s.dayLabel === label);
    if (existing) {
      const exData: Record<string, Array<{ weight: string; reps: string; notes: string }>> = {};
      for (const ex of (existing.exercises as any[])) {
        exData[ex.name] = (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
          notes: s.notes ?? "",
        }));
      }
      setExerciseData(exData);
      setSessionNotes((existing.notes as string) ?? "");
    } else {
      const blank: Record<string, Array<{ weight: string; reps: string; notes: string }>> = {};
      for (const ex of (dayDef?.exercises ?? [])) {
        blank[ex.name] = [{ weight: "", reps: "", notes: "" }];
      }
      setExerciseData(blank);
      setSessionNotes("");
    }
  }

  // Re-load when date changes
  useEffect(() => {
    if (selectedDay) selectDay(selectedDay);
  }, [sessionDate, sessions.length]);

  function setSet(exName: string, idx: number, field: "weight" | "reps" | "notes", val: string) {
    setExerciseData(prev => {
      const sets = [...(prev[exName] ?? [{ weight: "", reps: "", notes: "" }])];
      sets[idx] = { ...sets[idx], [field]: val };
      return { ...prev, [exName]: sets };
    });
  }

  function addSet(exName: string) {
    setExerciseData(prev => ({
      ...prev,
      [exName]: [...(prev[exName] ?? []), { weight: "", reps: "", notes: "" }],
    }));
  }

  function removeSet(exName: string, idx: number) {
    setExerciseData(prev => {
      const sets = (prev[exName] ?? []).filter((_, i) => i !== idx);
      return { ...prev, [exName]: sets.length ? sets : [{ weight: "", reps: "", notes: "" }] };
    });
  }

  function handleSave() {
    if (!selectedDay) return;
    setSaving(true);
    const dayDef = days.find(d => d.label === selectedDay);
    const exercises = (dayDef?.exercises ?? []).map(ex => ({
      name: ex.name,
      sets: (exerciseData[ex.name] ?? []).map(s => ({
        weight: s.weight !== "" ? parseFloat(s.weight) : null,
        reps: s.reps !== "" ? parseInt(s.reps) : null,
        notes: s.notes || null,
      })),
    }));
    saveMutation.mutate({ sessionDate, dayLabel: selectedDay, exercises, notes: sessionNotes || null });
  }

  const inputCls = "bg-secondary border border-border rounded-lg px-2 py-3 text-base text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary w-full";

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <Card>
        <SectionLabel>Date</SectionLabel>
        <DateInput value={sessionDate} onChange={v => { setSessionDate(v); setSelectedDay(null); }} />
      </Card>

      {/* Day selector */}
      {days.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">No training program assigned yet.</p></Card>
      ) : (
        <Card>
          <SectionLabel>Select Session</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {days.map(d => (
              <button
                key={d.label}
                onClick={() => selectDay(d.label)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === d.label
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Exercise logging */}
      {selectedDay && (() => {
        const dayDef = days.find(d => d.label === selectedDay);

        // Build last-session lookup: find the most recent session for this day BEFORE sessionDate
        const prevSession = [...sessions]
          .filter(s => s.dayLabel === selectedDay && toLocalDateStr(s.sessionDate) < sessionDate)
          .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)))[0];
        const prevExMap: Record<string, Array<{ weight: number | null; reps: number | null }>> = {};
        if (prevSession) {
          for (const ex of (prevSession.exercises as any[])) {
            prevExMap[ex.name] = (ex.sets ?? []).filter((s: any) => s.weight != null || s.reps != null);
          }
        }

        return (
          <div className="space-y-3">
            {(dayDef?.exercises ?? []).map((ex, i) => {
              const sets = exerciseData[ex.name] ?? [{ weight: "", reps: "", notes: "" }];
              const isExpanded = expandedSets[ex.name];
              const prevSets = prevExMap[ex.name] ?? [];
              const exVideoUrl = videoMap[ex.name];
              const exEmbedUrl = exVideoUrl ? getYouTubeEmbedUrl(exVideoUrl) : null;
              return (
                <Card key={i}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{ex.name}</p>
                        {exEmbedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: ex.name, embedUrl: exEmbedUrl })}
                            className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-1.5 py-0.5 rounded"
                          >
                            <Play size={10} fill="currentColor" /> Demo
                          </button>
                        )}
                      </div>
                      {ex.notes && <p className="text-xs text-muted-foreground mt-0.5">{ex.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{ex.sets} sets × {ex.reps}</p>
                      {prevSets.length > 0 && (
                        <p className="text-xs text-primary/80 mt-1">
                          Last: {prevSets.map((s, si) => `${s.weight ?? '—'}kg × ${s.reps ?? '—'}`).join(' | ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Primary set — always visible, visually prominent */}
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1.5">Set 1 (Primary)</p>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Weight (kg)</p>
                        <input
                          type="number" inputMode="decimal" placeholder="kg"
                          value={sets[0]?.weight ?? ""}
                          onChange={e => setSet(ex.name, 0, "weight", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Reps</p>
                        <input
                          type="number" inputMode="numeric" placeholder="reps"
                          value={sets[0]?.reps ?? ""}
                          onChange={e => setSet(ex.name, 0, "reps", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional sets — collapsible */}
                  {sets.length > 1 && (
                    <div className="space-y-2 mb-2">
                      {sets.slice(1).map((s, idx) => (
                        <div key={idx + 1} className="border-t border-border pt-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Set {idx + 2}</p>
                            <button onClick={() => removeSet(ex.name, idx + 1)} className="text-muted-foreground hover:text-destructive transition-colors"><Minus size={14} /></button>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <input
                                type="number" inputMode="decimal" placeholder="kg"
                                value={s.weight ?? ""}
                                onChange={e => setSet(ex.name, idx + 1, "weight", e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="number" inputMode="numeric" placeholder="reps"
                                value={s.reps ?? ""}
                                onChange={e => setSet(ex.name, idx + 1, "reps", e.target.value)}
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => addSet(ex.name)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus size={13} /> Add Set
                  </button>
                </Card>
              );
            })}

            {/* Session notes */}
            <Card>
              <SectionLabel>Session Notes</SectionLabel>
              <textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="How did the session feel? Any PRs, issues, adjustments..."
                rows={3}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </Card>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-primary text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Session"}
            </button>
          </div>
        );
      })()}

      {/* Video modal */}
      {videoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setVideoModal(null)}>
          <div className="bg-card rounded-xl overflow-hidden w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="aspect-video">
              <iframe
                src={videoModal.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoModal.name}
              />
            </div>
          </div>
        </div>
      )}

      {/* Past sessions */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Past Sessions</SectionLabel>
          {sessions.slice(0, 20).map(s => (
            <Card key={s.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.dayLabel}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(s.sessionDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSessionDate(toLocalDateStr(s.sessionDate)); selectDay(s.dayLabel); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-sm font-medium text-primary hover:bg-secondary/70 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this session?")) { setDeleting(s.id); deleteMutation.mutate({ id: s.id }); } }}
                    disabled={deleting === s.id}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {/* Summary of sets */}
              <div className="mt-2 space-y-1">
                {(s.exercises as any[]).map((ex: any, i: number) => {
                  const validSets = (ex.sets ?? []).filter((st: any) => st.weight != null || st.reps != null);
                  if (!validSets.length) return null;
                  return (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">{ex.name}</span>: {validSets.map((st: any) => `${st.weight ?? "—"}kg × ${st.reps ?? "—"}`).join(" | ")}
                    </p>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ClientDashboard ─────────────────────────────────────────────────────
const TAB_MAP: Record<string, React.ReactNode> = {
  overview: <OverviewTab />,
  "daily-log": <DailyLogTab />,
  measurements: <MeasurementsTab />,
  "meal-plan": <MealPlanTab />,
  shopping: <ShoppingListTab />,
  training: <TrainingTab />,
  "workout-log": <WorkoutLogTab />,
};

const TAB_TITLES: Record<string, string> = {
  overview: "Dashboard",
  "daily-log": "Daily Log",
  measurements: "Measurements",
  "meal-plan": "Meal Plan",
  shopping: "Shopping List",
  training: "Training Program",
  "workout-log": "Workout Log",
};

export default function ClientDashboard() {
  const params = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();
  const tab = params.tab ?? "overview";

  useEffect(() => {
    if (!params.tab) navigate("/dashboard/overview");
  }, [params.tab]);

  return (
    <DashboardShell mode="client">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Client Dashboard</p>
        <h1 className="text-xl font-bold text-foreground mt-0.5">{TAB_TITLES[tab] ?? "Dashboard"}</h1>
      </div>
      {TAB_MAP[tab] ?? <OverviewTab />}
    </DashboardShell>
  );
}
