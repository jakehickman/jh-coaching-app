import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { Check, Plus, Trash2, ChevronDown, ChevronUp, Play, X } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Safely extract YYYY-MM-DD from any date value (Date object, ISO string, plain date string)
function fmtDate(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  return s.includes('T') ? s.slice(0, 10) : s.slice(0, 10);
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}
function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}
function ScoreInput({ label, value, onChange, max = 10 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
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

   const weightData = (logs ?? [])
    .filter(l => l.weight)
    .slice(0, 14)
    .reverse()
    .map(l => {
      const raw = String(l.logDate);
      // Handle both ISO datetime strings and plain date strings
      const dateStr = raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10);
      return { date: dateStr.slice(5), weight: l.weight };
    });

  const recentLogs = (logs ?? []).slice(0, 7);
  const trainedDays = recentLogs.filter(l => l.trainingCompleted).length;
  const adherence = recentLogs.length > 0 ? Math.round((trainedDays / recentLogs.length) * 100) : 0;

  const weights = recentLogs.filter(l => l.weight).map(l => l.weight as number);
  const avgWeight = weights.length > 0 ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : "—";

  const latestLog = logs?.[0];
  const prevWeekLogs = (logs ?? []).slice(7, 14);
  const prevWeights = prevWeekLogs.filter(l => l.weight).map(l => l.weight as number);
  const prevAvg = prevWeights.length > 0 ? prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length : null;
  const weightChange = prevAvg && weights.length > 0
    ? ((weights.reduce((a, b) => a + b, 0) / weights.length) - prevAvg).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Weekly Summary</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="7-Day Avg Weight" value={avgWeight ? `${avgWeight} kg` : "—"} sub={weightChange ? `${Number(weightChange) > 0 ? "+" : ""}${weightChange} kg vs last week` : undefined} />
          <MetricCard label="Training Adherence" value={`${adherence}%`} sub={`${trainedDays}/${recentLogs.length} sessions`} />
          <MetricCard label="Latest Weight" value={latestLog?.weight ? `${latestLog.weight} kg` : "—"} sub={latestLog?.logDate ? String(latestLog.logDate).slice(0, 10) : undefined} />
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
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 11 }} />
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

      {recentLogs.length > 0 && (
        <div>
          <SectionLabel>Recent Logs</SectionLabel>
          <Card>
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{fmtDate(log.logDate)}</p>
                    <p className="text-xs text-muted-foreground">{log.trainingType ?? (log.trainingCompleted ? "Training" : "Rest")}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    {log.weight && <div><p className="text-sm font-semibold text-foreground">{log.weight} kg</p><p className="text-[10px] text-muted-foreground">weight</p></div>}
                    {log.sleepHours && <div><p className="text-sm font-semibold text-foreground">{log.sleepHours}h</p><p className="text-[10px] text-muted-foreground">sleep</p></div>}
                    <div className={`w-2 h-2 rounded-full ${log.trainingCompleted ? "bg-primary" : "bg-muted"}`} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
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

  // Build session options from training program day names
  const sessionOptions: string[] = program?.days
    ? (program.days as Array<{ name?: string }>)
        .map((d, i) => d.name || `Day ${i + 1}`)
        .filter(Boolean)
    : [];

  // Load existing log for selected date
  useEffect(() => {
    const existing = logs?.find(l => String(l.logDate).slice(0, 10) === date);
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
        <SectionLabel>Select Date</SectionLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      <div>
        <SectionLabel>Body Metrics</SectionLabel>
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={f("weight")} placeholder="e.g. 82.5"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sleep (hours)</label>
              <input type="number" step="0.5" value={form.sleepHours} onChange={f("sleepHours")} placeholder="e.g. 7.5"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Caffeine (servings)</label>
              <input type="number" step="0.5" min="0" value={form.caffeineServings} onChange={f("caffeineServings")} placeholder="e.g. 2"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <p className="text-[10px] text-muted-foreground mt-0.5">1 serving ≈ 80–100mg</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Steps</label>
              <input type="number" value={form.stepsCount} onChange={f("stepsCount")} placeholder="e.g. 8000"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
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
            className="flex items-center gap-3 cursor-pointer w-full text-left"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              form.trainingCompleted ? "bg-primary border-primary" : "border-border"
            }`}>
              {form.trainingCompleted && <Check size={12} className="text-primary-foreground" />}
            </div>
            <span className="text-sm text-foreground">Training completed today</span>
          </button>
          {form.trainingCompleted && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Session</label>
              <select value={form.trainingType} onChange={f("trainingType")}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
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
            className="flex items-center gap-3 cursor-pointer w-full text-left"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              form.offPlanMeal ? "bg-amber-500 border-amber-500" : "border-border"
            }`}>
              {form.offPlanMeal && <Check size={12} className="text-white" />}
            </div>
            <div>
              <span className="text-sm text-foreground">Off plan meal today</span>
              <p className="text-[10px] text-muted-foreground">Had 1 or more meals not in my prescribed plan</p>
            </div>
          </button>
        </Card>
      </div>

      <div>
        <SectionLabel>Notes</SectionLabel>
        <textarea value={form.notes} onChange={f("notes")} rows={3} placeholder="Any notes for today..."
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>

      <button onClick={handleSave} disabled={upsert.isPending}
        className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
        {upsert.isPending ? "Saving..." : "Save Log"}
      </button>
    </div>
  );
}

// ─── Tab: Measurements ────────────────────────────────────────────────────────
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

function MeasurementsTab() {
  const { data: measurements, refetch } = trpc.measurements.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const emptySkinfold = { r1: "", r2: "", r3: "", r4: "", r5: "" };
  const [form, setForm] = useState({
    measureDate: new Date().toISOString().slice(0, 10),
    waist: "",
    umbilical: { ...emptySkinfold },
    suprailiac: { ...emptySkinfold },
    calf: { ...emptySkinfold },
    thigh: { ...emptySkinfold },
    notes: "",
  });
  const add = trpc.measurements.add.useMutation({
    onSuccess: () => { toast.success("Measurements saved"); setShowForm(false); refetch(); }
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
          <Plus size={14} /> Add Session
        </button>
      </div>

      {showForm && (
        <Card className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date</label>
            <input type="date" value={form.measureDate} onChange={e => setForm(p => ({ ...p, measureDate: e.target.value }))}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Waist */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Waist Circumference (cm)</p>
            <input type="number" step="0.1" value={form.waist} onChange={e => setForm(p => ({ ...p, waist: e.target.value }))} placeholder="e.g. 82.5"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
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
            <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
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
            className="w-full py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50">
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
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 11 }} />
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
              const calfAvg = avgReadings([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]);
              const thighAvg = avgReadings([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]);
              const siteAvgs = [umbAvg, supAvg, calfAvg, thighAvg];
              const total = siteAvgs.every(v => v !== null) ? parseFloat(siteAvgs.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
              return (
                <Card key={m.id}>
                  <p className="text-sm font-semibold text-foreground mb-3">{fmtDate(m.measureDate)}</p>
                  {/* Waist */}
                  {m.waist && (
                    <div className="mb-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Waist</p>
                      <p className="text-base font-bold text-foreground">{m.waist} <span className="text-xs font-normal text-muted-foreground">cm</span></p>
                    </div>
                  )}
                  {/* Skinfold averages */}
                  {siteAvgs.some(v => v !== null) && (
                    <>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Skinfold (avg mm)</p>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[
                          { label: "Umbilical", avg: umbAvg },
                          { label: "Suprailiac", avg: supAvg },
                          { label: "Calf", avg: calfAvg },
                          { label: "Thigh", avg: thighAvg },
                        ].map(({ label, avg }) => (
                          <div key={label} className="text-center">
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold text-foreground">{avg ?? "—"}</p>
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

  // Calculate macros per meal and daily totals from food DB
  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const food = foodDb.find((f: any) => f.name === item.food);
      if (!food || !parseFloat(item.grams)) return acc;
      const factor = parseFloat(item.grams) / 100;
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
                      const grams = parseFloat(item.grams) || 0;
                      const factor = grams / 100;
                      const itemCal = food && grams ? Math.round(food.calories * factor) : null;
                      const itemP = food && grams ? Math.round(food.protein * factor * 10) / 10 : null;
                      const itemC = food && grams ? Math.round(food.carbs * factor * 10) / 10 : null;
                      const itemF = food && grams ? Math.round(food.fat * factor * 10) / 10 : null;
                      return (
                        <div key={j} className="py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-foreground">{item.food || <span className="text-muted-foreground italic">Unknown food</span>}</p>
                            <p className="text-xs text-muted-foreground">{grams > 0 ? `${grams}g` : ""}</p>
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
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground self-center">Meal:</span>
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
  const { data: items, refetch } = trpc.shopping.list.useQuery();
  const toggle = trpc.shopping.toggle.useMutation({ onSuccess: () => refetch() });

  const grouped = (items ?? []).reduce((acc, item) => {
    const cat = item.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const checkedCount = (items ?? []).filter(i => i.checked).length;
  const total = (items ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <SectionLabel>Shopping List</SectionLabel>
          <p className="text-xs text-muted-foreground">{checkedCount}/{total} items checked</p>
        </div>
        <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: total > 0 ? `${(checkedCount / total) * 100}%` : "0%" }} />
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No shopping list items yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add items here.</p>
        </Card>
      )}

      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category}>
          <SectionLabel>{category}</SectionLabel>
          <Card className="space-y-1">
            {(catItems ?? []).map(item => (
              <label key={item.id} className="flex items-center gap-3 py-2.5 cursor-pointer group">
                <div
                  onClick={() => toggle.mutate({ id: item.id, checked: !item.checked })}
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    item.checked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                  }`}
                >
                  {item.checked && <Check size={12} className="text-primary-foreground" />}
                </div>
                <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.itemName}
                </span>
                {item.quantity && <span className="text-xs text-muted-foreground">{item.quantity}</span>}
              </label>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Training Program ────────────────────────────────────────────────────
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
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
      <div className="flex items-center justify-between">
        <div>
          <SectionLabel>Training Program</SectionLabel>
          {program?.programName && <p className="text-sm font-semibold text-foreground">{program.programName}</p>}
        </div>
      </div>

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
                <p className="col-span-5 text-[10px] text-muted-foreground uppercase tracking-wider">Exercise</p>
                <p className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Sets</p>
                <p className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Reps</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Notes</p>
              </div>
              {(day.exercises ?? []).map((ex: any, j: number) => {
                const videoUrl = videoMap[ex.name];
                const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
                return (
                  <div key={j} className="grid grid-cols-12 gap-2 items-center py-2 border-t border-border">
                    <div className="col-span-5 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{ex.name}</p>
                        {ex.notes && <p className="text-[10px] text-muted-foreground">{ex.notes}</p>}
                      </div>
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
                    <p className="col-span-2 text-sm text-foreground text-center">{ex.sets}</p>
                    <p className="col-span-2 text-sm text-foreground text-center">{ex.reps}</p>
                    <p className="col-span-3 text-xs text-muted-foreground text-center">{ex.notes}</p>
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

// ─── Tab: MESO 1 ─────────────────────────────────────────────────────────────
function MesoTab() {
  const { data: cycles } = trpc.meso.cycles.useQuery();
  const [selectedMeso, setSelectedMeso] = useState<number | null>(null);
  const { data: sessions } = trpc.meso.sessions.useQuery(
    { mesoId: selectedMeso! },
    { enabled: !!selectedMeso }
  );

  useEffect(() => {
    if (cycles && cycles.length > 0 && !selectedMeso) {
      setSelectedMeso(cycles[0].id);
    }
  }, [cycles]);

  const currentCycle = cycles?.find(c => c.id === selectedMeso);
  const weeks = sessions ? Array.from(new Set(sessions.map(s => s.weekNumber))).sort((a, b) => (a ?? 0) - (b ?? 0)) : [];

  return (
    <div className="space-y-6">
      {(cycles ?? []).length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No MESO cycles set up yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will set up your periodization here.</p>
        </Card>
      )}

      {(cycles ?? []).length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cycles!.map(c => (
            <button key={c.id} onClick={() => setSelectedMeso(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedMeso === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {c.mesoName ?? `MESO ${c.id}`}
            </button>
          ))}
        </div>
      )}

      {currentCycle && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-lg font-bold text-foreground">{currentCycle.mesoName ?? "MESO 1"}</p>
              {currentCycle.startDate && currentCycle.endDate && (
                <p className="text-xs text-muted-foreground">
                  {fmtDate(currentCycle.startDate)} → {fmtDate(currentCycle.endDate)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Weeks</p>
              <p className="text-lg font-bold text-foreground">{currentCycle.totalWeeks}</p>
            </div>
          </div>

          {weeks.map(week => (
            <div key={week} className="mb-6">
              <SectionLabel>Week {week}</SectionLabel>
              <div className="space-y-3">
                {sessions!.filter(s => s.weekNumber === week).map(session => (
                  <Card key={session.id}>
                    <p className="text-sm font-semibold text-foreground mb-3">{session.dayLabel}</p>
                    {session.sessionDate && <p className="text-xs text-muted-foreground mb-2">{fmtDate(session.sessionDate)}</p>}
                    {(session.exercises as any[])?.map((ex: any, i: number) => (
                      <div key={i} className="mb-3">
                        <p className="text-sm font-medium text-foreground mb-1">{ex.name}</p>
                        <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground mb-1">
                          <span>Set</span><span>Weight</span><span>Reps</span><span>RIR</span>
                        </div>
                        {(ex.sets ?? []).map((set: any, j: number) => (
                          <div key={j} className="grid grid-cols-4 gap-1 text-xs py-1 border-t border-border">
                            <span className="text-muted-foreground">{j + 1}</span>
                            <span className="text-foreground">{set.weight ?? "—"}</span>
                            <span className="text-foreground">{set.reps ?? "—"}</span>
                            <span className="text-foreground">{set.rir ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Timeline ────────────────────────────────────────────────────────────
function TimelineTab() {
  const { data: milestones, refetch } = trpc.timeline.list.useQuery();
  const toggle = trpc.timeline.toggle.useMutation({ onSuccess: () => refetch() });

  const today = new Date();
  const upcoming = (milestones ?? []).filter(m => new Date(String(m.milestoneDate)) >= today);
  const past = (milestones ?? []).filter(m => new Date(String(m.milestoneDate)) < today);

  const showDate = milestones?.find(m => m.category === "Show Day");
  const daysToShow = showDate
    ? Math.ceil((new Date(String(showDate.milestoneDate)).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const categoryColors: Record<string, string> = {
    "Show Day": "text-primary border-primary",
    "Peak Week": "text-yellow-400 border-yellow-400",
    "Check-in": "text-blue-400 border-blue-400",
    "Adjustment": "text-purple-400 border-purple-400",
    default: "text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      {daysToShow !== null && daysToShow > 0 && (
        <Card className="text-center py-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Show Day Countdown</p>
          <p className="text-5xl font-bold text-primary mt-2">{daysToShow}</p>
          <p className="text-sm text-muted-foreground mt-1">days to go</p>
        </Card>
      )}

      {(milestones ?? []).length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No timeline milestones set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your show prep timeline here.</p>
        </Card>
      )}

      {upcoming.length > 0 && (
        <div>
          <SectionLabel>Upcoming</SectionLabel>
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {upcoming.map(m => {
                const colorClass = categoryColors[m.category ?? ""] ?? categoryColors.default;
                const daysAway = Math.ceil((new Date(String(m.milestoneDate)).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={m.id} className="relative pl-4">
                    <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-background ${colorClass}`} />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.milestoneDate)} · {daysAway} days away</p>
                        {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                      </div>
                      <button
                        onClick={() => toggle.mutate({ id: m.id, completed: !m.completed })}
                        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                          m.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                        }`}
                      >
                        {m.completed && <Check size={11} className="text-primary-foreground" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <SectionLabel>Completed</SectionLabel>
          <div className="space-y-2">
            {past.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <p className="text-sm text-muted-foreground line-through">{m.title}</p>
                <p className="text-xs text-muted-foreground ml-auto">{fmtDate(m.milestoneDate)}</p>
              </div>
            ))}
          </div>
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
  meso: <MesoTab />,
  timeline: <TimelineTab />,
};

const TAB_TITLES: Record<string, string> = {
  overview: "Dashboard",
  "daily-log": "Daily Log",
  measurements: "Measurements",
  "meal-plan": "Meal Plan",
  shopping: "Shopping List",
  training: "Training Program",
  meso: "MESO 1",
  timeline: "Timeline",
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
