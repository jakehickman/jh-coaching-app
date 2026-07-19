import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { CoachHabitsPanel } from "./HabitsSection";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Info, UtensilsCrossed, ArrowUp, ArrowDown, Minus } from "lucide-react";

// ─── Design tokens (mirroring index.css CSS vars) ─────────────────────────────
const C = {
  bg: "#0F1511",
  surface: "#1A2020",
  surfaceVariant: "#222B28",
  primary: "#52B788",
  border: "#2D3B35",
  fg: "#ECEDEE",
  muted: "#9BA1A6",
  amber: "#FBBF24",
  red: "#F87171",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCALE_LABELS: Record<number, string> = {
  1: "Ravenous", 2: "Very hungry", 3: "Hungry", 4: "Mild hunger",
  5: "Neutral", 6: "Satisfied", 7: "Full", 8: "Overfull",
  9: "Stuffed", 10: "Painfully full",
};

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isIdealHunger(r: number) { return r >= 3 && r <= 4; }
function isIdealFullness(r: number) { return r >= 6 && r <= 7; }

function formatTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

/** Format a UTC timestamp in a specific UTC offset (minutes), e.g. 600 for UTC+10 */
function formatTimeAtOffset(utcMs: number, utcOffsetMins: number) {
  // Shift the timestamp so that getUTCHours/getUTCMinutes return local time
  const shifted = new Date(utcMs + utcOffsetMins * 60 * 1000);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

// Colour helpers
function scoreColor(pct: number): string {
  if (pct >= 70) return C.primary;
  if (pct >= 50) return C.amber;
  return C.red;
}

function trendColor(trend: "up" | "flat" | "down" | null): string {
  if (trend === "up") return C.primary;
  if (trend === "down") return C.red;
  if (trend === "flat") return C.amber;
  return C.muted;
}

function getTrend(current: number | null, previous: number | null, threshold = 5): "up" | "flat" | "down" | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}

// ─── Shared card shell ────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-xl p-4", className)}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.8px]" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] leading-relaxed" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

// ─── Trend indicator ──────────────────────────────────────────────────────────

function TrendBadge({
  current,
  previous,
  higherIsBetter = true,
  threshold = 0.1,
}: {
  current: number | null;
  previous: number | null;
  higherIsBetter?: boolean;
  threshold?: number;
}) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < threshold) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[12px] font-medium" style={{ color: C.muted }}>
        <Minus className="w-3 h-3" />
        flat
      </span>
    );
  }
  const isUp = delta > 0;
  const isGood = higherIsBetter ? isUp : !isUp;
  const color = isGood ? C.primary : C.red;
  const sign = isUp ? "+" : "";
  // Show % sign when both values look like percentages (0–100 integers)
  const isPercent = Number.isInteger(current) && Number.isInteger(previous) && current >= 0 && current <= 100 && previous >= 0 && previous <= 100;
  const formatted = typeof delta === "number" && !Number.isInteger(delta) ? delta.toFixed(1) : delta;
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-medium" style={{ color }}>
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {sign}{formatted}{isPercent ? "%" : ""}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit = "",
  period,
  trend,
  interpretation,
  valueColor,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  period: string;
  trend?: React.ReactNode;
  interpretation?: string;
  valueColor?: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>{label}</SectionLabel>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-bold leading-none"
            style={{ fontSize: 36, color: valueColor ?? C.fg }}
          >
            {value ?? "—"}
          </span>
          {unit && <span className="text-[15px] font-medium" style={{ color: C.muted }}>{unit}</span>}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {trend}
        </div>
      </div>
      {interpretation && <Interpretation>{interpretation}</Interpretation>}
    </Card>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 6, background: `${color}26` }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
    </div>
  );
}

// ─── Ideal Zone Card ──────────────────────────────────────────────────────────

function IdealZoneSparkline({
  weeklyIdealZone,
  allTimeIdealZonePct,
  accentColor,
}: {
  weeklyIdealZone: { weekStart: string; pct: number | null; meals: number }[];
  allTimeIdealZonePct: number | null;
  accentColor: string;
}) {
  const W = 200;
  const H = 56;
  const PAD_X = 8;
  const PAD_Y = 8;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const plotPoints = weeklyIdealZone
    .map((w, i) => ({ idx: i, pct: w.pct }))
    .filter((p): p is { idx: number; pct: number } => p.pct != null);

  if (plotPoints.length < 2) {
    return (
      <p className="text-xs" style={{ color: C.muted }}>
        Not enough weekly data for trend line
      </p>
    );
  }

  const n = weeklyIdealZone.length;
  const allPcts = plotPoints.map(p => p.pct);
  const minPct = Math.max(0, Math.min(...allPcts) - 12);
  const maxPct = Math.min(100, Math.max(...allPcts) + 12);
  const range = maxPct - minPct || 20;

  function toX(idx: number) { return PAD_X + (idx / Math.max(n - 1, 1)) * innerW; }
  function toY(pct: number) { return PAD_Y + (1 - (pct - minPct) / range) * innerH; }

  const polyline = plotPoints.map(p => `${toX(p.idx).toFixed(1)},${toY(p.pct).toFixed(1)}`).join(" ");
  const baselineY = allTimeIdealZonePct != null ? toY(allTimeIdealZonePct) : null;

  // Week labels
  const weekLabels = weeklyIdealZone.map((w, i) => {
    const d = new Date(w.weekStart + "T00:00:00");
    return { idx: i, label: d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) };
  });

  return (
    <div>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {/* Baseline */}
      {baselineY != null && (
        <>
          <line
            x1={PAD_X} y1={baselineY}
            x2={W - PAD_X} y2={baselineY}
            stroke={C.muted} strokeWidth={1} strokeDasharray="3 3" opacity={0.45}
          />
          <text x={W - PAD_X + 3} y={baselineY + 3.5} fontSize={9} fill={C.muted} opacity={0.6}>
            avg {allTimeIdealZonePct}%
          </text>
        </>
      )}
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={accentColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.85}
        />
        {/* Dots */}
        {plotPoints.map(p => (
          <circle key={p.idx} cx={toX(p.idx)} cy={toY(p.pct)} r={3} fill={accentColor} opacity={0.9} />
        ))}
      </svg>
      {/* Week labels */}
      <div className="flex" style={{ width: W }}>
        {weekLabels.map(w => (
          <div
            key={w.idx}
            className="flex-1 text-center"
            style={{ fontSize: 9, color: C.muted, opacity: 0.6, marginTop: 2 }}
          >
            {w.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function IdealZoneCard({
  insights,
  days,
  compact = false,
}: {
  insights: {
    idealZonePct: number | null;
    prevIdealZonePct?: number | null;
    hungerInZonePct?: number | null;
    fullnessInZonePct?: number | null;
    allTimeIdealZonePct?: number | null;
    weeklyIdealZone?: { weekStart: string; pct: number | null; meals: number }[];
    outOfZoneMeals?: { id: number; name: string | null; loggedAt: number; utcOffsetMins: number; hungerRating: number | null; fullnessRating: number | null }[];
  };
  days: number;
  compact?: boolean;
}) {
  const [showOutOfZone, setShowOutOfZone] = useState(false);
  const {
    idealZonePct,
    prevIdealZonePct,
    hungerInZonePct,
    fullnessInZonePct,
    allTimeIdealZonePct,
    weeklyIdealZone,
    outOfZoneMeals,
  } = insights;

  if (idealZonePct == null) {
    return (
      <Card className="flex flex-col gap-1.5">
        <SectionLabel>Ideal Zone</SectionLabel>
        <p className="text-[12px] mt-1" style={{ color: C.muted }}>No rated meals.</p>
      </Card>
    );
  }

  const delta = prevIdealZonePct != null ? idealZonePct - prevIdealZonePct : null;
  const trend = getTrend(idealZonePct, prevIdealZonePct ?? null, 5);
  const accentColor = scoreColor(idealZonePct);
  const trendCol = trendColor(trend);

  if (compact) {
    return (
      <Card className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <SectionLabel>Ideal Zone</SectionLabel>
          <div className="relative group">
            <Info className="w-3 h-3 cursor-pointer" style={{ color: C.muted }} />
            <div className="absolute left-0 top-5 z-10 hidden group-hover:block w-52 rounded-lg px-3 py-2 text-xs leading-relaxed shadow-lg"
              style={{ background: "#1A2020", border: `1px solid ${C.border}`, color: C.muted }}>
              % of meals where hunger (3–4) and fullness (6–7) were both in range
            </div>
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold leading-none" style={{ fontSize: 28, color: C.fg }}>{idealZonePct}%</span>
          {delta != null && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color: trendCol }}>
              {trend === "up" ? <ArrowUp className="w-3 h-3" /> : trend === "down" ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {trend === "flat" ? "flat" : `${delta! > 0 ? "+" : ""}${delta}%`}
            </span>
          )}
        </div>
        {(hungerInZonePct != null || fullnessInZonePct != null) && (
          <div className="space-y-1.5 pt-1">
            {hungerInZonePct != null && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: C.muted }}>Hunger</span>
                  <span style={{ color: C.fg }}>{hungerInZonePct}%</span>
                </div>
                <ProgressBar value={hungerInZonePct} color={scoreColor(hungerInZonePct)} />
              </div>
            )}
            {fullnessInZonePct != null && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: C.muted }}>Fullness</span>
                  <span style={{ color: C.fg }}>{fullnessInZonePct}%</span>
                </div>
                <ProgressBar value={fullnessInZonePct} color={scoreColor(fullnessInZonePct)} />
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <SectionLabel>Ideal Zone</SectionLabel>
          <div className="relative group">
            <Info className="w-3.5 h-3.5 cursor-pointer" style={{ color: C.muted }} />
            <div className="absolute left-0 top-5 z-10 hidden group-hover:block w-56 rounded-lg px-3 py-2 text-xs leading-relaxed shadow-lg"
              style={{ background: "#1A2020", border: `1px solid ${C.border}`, color: C.muted }}>
              % of meals where hunger (3–4) <span style={{ color: C.fg, fontWeight: 600 }}>and</span> fullness (6–7) were both in range at the same meal
            </div>
          </div>
        </div>

      </div>

      {/* Score + trend */}
      <div className="flex items-end gap-4 mb-1">
        <span className="font-bold leading-none" style={{ fontSize: 40, color: C.fg }}>
          {idealZonePct}%
        </span>
        {delta != null && (
          <span
            className="inline-flex items-center gap-0.5 text-[12px] font-medium mb-1"
            style={{ color: trendCol }}
          >
            {trend === "up" ? <ArrowUp className="w-3.5 h-3.5" /> : trend === "down" ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {trend === "flat" ? "flat" : `${delta! > 0 ? "+" : ""}${delta}%`} vs prev
          </span>
        )}
      </div>



      {/* Hunger / Fullness split */}
      {(hungerInZonePct != null || fullnessInZonePct != null) && (
        <div className="mt-4 pt-4 grid grid-cols-2 gap-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {hungerInZonePct != null && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.7px] mb-2" style={{ color: C.muted }}>
                Hunger (3–4)
              </p>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-[22px] font-bold leading-none" style={{ color: C.fg }}>
                  {hungerInZonePct}%
                </span>
                <span className="text-xs" style={{ color: C.muted }}>in zone</span>
              </div>
              <ProgressBar value={hungerInZonePct} color={scoreColor(hungerInZonePct)} />
            </div>
          )}
          {fullnessInZonePct != null && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.7px] mb-2" style={{ color: C.muted }}>
                Fullness (6–7)
              </p>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-[22px] font-bold leading-none" style={{ color: C.fg }}>
                  {fullnessInZonePct}%
                </span>
                <span className="text-xs" style={{ color: C.muted }}>in zone</span>
              </div>
              <ProgressBar value={fullnessInZonePct} color={scoreColor(fullnessInZonePct)} />
            </div>
          )}
        </div>
      )}

      {/* Option B: out-of-zone meal list */}
      {outOfZoneMeals && outOfZoneMeals.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            className="flex items-center justify-between w-full mb-2"
            onClick={() => setShowOutOfZone(v => !v)}
          >
            <span className="text-xs font-medium uppercase tracking-[0.7px]" style={{ color: C.amber }}>
              {outOfZoneMeals.length} out-of-zone meal{outOfZoneMeals.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px]" style={{ color: C.muted }}>{showOutOfZone ? "Hide" : "Show"}</span>
          </button>
          {showOutOfZone && (
            <div className="space-y-2">
              {outOfZoneMeals.map(m => {
                const hBad = m.hungerRating != null && (m.hungerRating < 3 || m.hungerRating > 4);
                const fBad = m.fullnessRating != null && (m.fullnessRating < 6 || m.fullnessRating > 7);
                const dateStr = new Date(m.loggedAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={m.id} className="rounded-lg px-3 py-2.5" style={{ background: `${C.amber}0D`, border: `1px solid ${C.amber}28` }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12px] font-medium truncate" style={{ color: C.fg }}>
                        {m.name ?? "Unnamed meal"}
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: C.muted }}>{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.hungerRating != null && (
                        <span className="text-[11px]" style={{ color: hBad ? C.amber : C.muted }}>
                          Hunger <span className="font-bold" style={{ color: hBad ? C.amber : C.primary }}>{m.hungerRating}</span>
                          {hBad && <span className="ml-1" style={{ color: C.amber }}>{m.hungerRating < 3 ? "(too low)" : "(too high)"}</span>}
                        </span>
                      )}
                      {m.fullnessRating != null && (
                        <span className="text-[11px]" style={{ color: fBad ? C.amber : C.muted }}>
                          Fullness <span className="font-bold" style={{ color: fBad ? C.amber : C.primary }}>{m.fullnessRating}</span>
                          {fBad && <span className="ml-1" style={{ color: C.amber }}>{m.fullnessRating < 6 ? "(too low)" : "(too high)"}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Scatter plot ─────────────────────────────────────────────────────────────

function ScatterPlot({ scatter }: { scatter: { h: number; f: number }[] }) {
  const SIZE = 260;
  const PAD = 28;
  const INNER = SIZE - PAD * 2;
  const STEP = INNER / 9;

  const counts: Record<string, number> = {};
  for (const p of scatter) {
    const k = `${p.h},${p.f}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  function toX(h: number) { return PAD + (h - 1) * STEP; }
  function toY(f: number) { return SIZE - PAD - (f - 1) * STEP; }

  const zoneX1 = toX(3);
  const zoneX2 = toX(4) + STEP;
  const zoneY1 = toY(7);
  const zoneY2 = toY(6) + STEP;

  const plotted = new Set<string>();
  const dots: { x: number; y: number; r: number; ideal: boolean }[] = [];
  for (const p of scatter) {
    const k = `${p.h},${p.f}`;
    if (plotted.has(k)) continue;
    plotted.add(k);
    const cnt = counts[k];
    const r = Math.min(10, 5 + (cnt - 1) * 1.2);
    const ideal = isIdealHunger(p.h) && isIdealFullness(p.f);
    dots.push({ x: toX(p.h), y: toY(p.f), r, ideal });
  }

  return (
    <svg width={SIZE} height={SIZE} className="overflow-visible">
      {/* Grid lines — 8% opacity, no axis borders */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <g key={n}>
          <line x1={toX(n)} y1={PAD} x2={toX(n)} y2={SIZE - PAD} stroke={C.fg} strokeOpacity={0.08} strokeWidth={1} />
          <line x1={PAD} y1={toY(n)} x2={SIZE - PAD} y2={toY(n)} stroke={C.fg} strokeOpacity={0.08} strokeWidth={1} />
        </g>
      ))}
      {/* Ideal zone rectangle */}
      <rect
        x={zoneX1} y={zoneY1}
        width={zoneX2 - zoneX1} height={zoneY2 - zoneY1}
        fill={C.primary} fillOpacity={0.1}
        stroke={C.primary} strokeOpacity={0.25} strokeWidth={1}
        rx={3}
      />

      {/* Axis labels */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <g key={n}>
          <text x={toX(n)} y={SIZE - PAD + 13} textAnchor="middle" fontSize={9} fill={C.muted} opacity={0.5}>{n}</text>
          <text x={PAD - 9} y={toY(n) + 3.5} textAnchor="middle" fontSize={9} fill={C.muted} opacity={0.5}>{n}</text>
        </g>
      ))}
      {/* Axis titles */}
      <text x={SIZE / 2} y={SIZE - 2} textAnchor="middle" fontSize={10} fill={C.muted} opacity={0.55}>Hunger</text>
      <text x={9} y={SIZE / 2} textAnchor="middle" fontSize={10} fill={C.muted} opacity={0.55}
        transform={`rotate(-90, 9, ${SIZE / 2})`}>Fullness</text>
      {/* Dots */}
      {dots.map((d, i) => (
        <circle
          key={i} cx={d.x} cy={d.y} r={d.r}
          fill={d.ideal ? C.primary : C.muted}
          fillOpacity={d.ideal ? 0.75 : 0.35}
        />
      ))}
    </svg>
  );
}

// ─── Treats chart ─────────────────────────────────────────────────────────────

function TreatsChart({
  treatsByWeek,
  days,
}: {
  treatsByWeek: { weekStart: string; small: number; medium: number; large: number; total: number }[];
  days: 7 | 28;
}) {
  const bars = treatsByWeek;
  const maxTotal = Math.max(...bars.map(w => w.total), 1);
  const BAR_MAX_PX = 190;

  return (
    <div className="flex items-end gap-[12%] w-full" style={{ height: BAR_MAX_PX + 40 }}>
      {bars.map((week) => {
        const barPx = week.total > 0 ? Math.max(6, Math.round((week.total / maxTotal) * BAR_MAX_PX)) : 4;
        const dateLabel = days === 7
          ? new Date(week.weekStart + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" })
          : new Date(week.weekStart + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });

        return (
          <div key={week.weekStart} className="flex-1 flex flex-col items-center">
            {/* Count */}
            <span
              className="font-medium mb-1"
              style={{
                fontSize: 11,
                color: week.total > 0 ? C.fg : "transparent",
                opacity: 0.7,
              }}
            >
              {week.total}
            </span>
            {/* Bar */}
            <div
              className="w-full flex flex-col-reverse overflow-visible"
              style={{
                height: barPx,
                borderRadius: 4,
                clipPath: 'inset(0 0 0 0 round 4px)',
              }}
            >
              {week.total === 0 ? (
                <div className="w-full h-full" style={{ background: `${C.border}` }} />
              ) : (
                <>
                  {week.small > 0 && (
                    <div
                      className="w-full relative group/seg"
                      style={{ flex: week.small, background: C.primary, opacity: 0.8 }}
                      title={`Small: ${week.small}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover/seg:opacity-100 transition-opacity z-20"
                        style={{ background: C.surfaceVariant, color: C.fg, border: `1px solid ${C.border}` }}>
                        Small: {week.small}
                      </div>
                    </div>
                  )}
                  {week.medium > 0 && (
                    <div
                      className="w-full relative group/seg"
                      style={{ flex: week.medium, background: C.amber, opacity: 0.85 }}
                      title={`Medium: ${week.medium}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover/seg:opacity-100 transition-opacity z-20"
                        style={{ background: C.surfaceVariant, color: C.fg, border: `1px solid ${C.border}` }}>
                        Medium: {week.medium}
                      </div>
                    </div>
                  )}
                  {week.large > 0 && (
                    <div
                      className="w-full relative group/seg"
                      style={{ flex: week.large, background: C.red, opacity: 0.8 }}
                      title={`Large: ${week.large}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover/seg:opacity-100 transition-opacity z-20"
                        style={{ background: C.surfaceVariant, color: C.fg, border: `1px solid ${C.border}` }}>
                        Large: {week.large}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Label */}
            <span
              className="whitespace-nowrap mt-1.5"
              style={{ fontSize: 10, color: C.muted, opacity: 0.65 }}
            >
              {dateLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Meal timing card ─────────────────────────────────────────────────────────

function MealTimingCard({
  slots,
  consistencyScore,
  totalForConsistency,
  showInfo,
  onToggleInfo,
}: {
  slots: { label: string; anchor: string; driftMin: number; count?: number }[];
  consistencyScore: number | null;
  totalForConsistency?: number;
  showInfo: boolean;
  onToggleInfo: () => void;
}) {
  const consistencyColor =
    consistencyScore == null ? C.muted :
    consistencyScore >= 70 ? C.primary :
    consistencyScore >= 40 ? C.amber :
    C.red;


  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Meal Timing</SectionLabel>
        <button
          onClick={onToggleInfo}
          className="transition-opacity hover:opacity-100"
          style={{ color: C.muted, opacity: 0.6 }}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <div
          className="rounded-lg px-3 py-2.5 text-[12px] leading-relaxed"
          style={{ background: C.surfaceVariant, color: C.muted }}
        >
          Consistency is the percentage of meals that fell within 1 hour of their usual time. Slot anchors are the median time for each meal cluster. Treats are excluded.
        </div>
      )}

      {consistencyScore != null && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px]" style={{ color: C.muted }}>Consistency</span>
            <span className="text-[22px] font-bold leading-none" style={{ color: C.fg }}>
              {consistencyScore}%
            </span>
          </div>
          <ProgressBar value={consistencyScore} color={consistencyColor} />
        </div>
      )}

      <div className="space-y-3 pt-1">
        {slots.map((slot) => {
          const driftColor = slot.driftMin <= 30 ? C.primary : slot.driftMin <= 60 ? C.amber : C.red;
          const pct = slot.count != null && totalForConsistency
            ? Math.round((slot.count / totalForConsistency) * 100)
            : null;
          return (
            <div key={slot.label} className="flex items-center justify-between gap-2">
              <span className="text-[13px] w-16 shrink-0" style={{ color: C.muted }}>{slot.label}</span>
              <span className="text-[13px] font-medium" style={{ color: C.fg }}>{slot.anchor}</span>
              {pct != null && (
                <span className="text-xs" style={{ color: C.muted }}>{slot.count} ({pct}%)</span>
              )}
              <span className="text-[12px] font-medium" style={{ color: driftColor }}>
                ±{slot.driftMin} min
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Calendar Meal Log View ───────────────────────────────────────────────────

type DayData = { meals: any[]; hasOutOfRange: boolean; treatCount: number; utcOffsetMins?: number | null };

function MealLogView({ clientId }: { clientId: number }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: calData = {}, isLoading } = trpc.mealLogs.calendarForClient.useQuery(
    { userId: clientId, year, month },
    { enabled: clientId > 0 }
  );

  const byDate = calData as Record<string, DayData>;

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  const selectedDayData: DayData | null = selectedDate ? (byDate[selectedDate] ?? null) : null;

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      {/* ── Compact month calendar ── */}
      <div className="flex-shrink-0" style={{ width: "min(100%, 320px)" }}>
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-1 rounded transition-colors"
            style={{ color: C.muted }}
            onMouseEnter={e => (e.currentTarget.style.color = C.fg)}
            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-medium" style={{ color: C.fg }}>{formatMonthYear(year, month)}</span>
          <button
            onClick={nextMonth}
            className="p-1 rounded transition-colors"
            style={{ color: C.muted }}
            onMouseEnter={e => (e.currentTarget.style.color = C.fg)}
            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.6px", color: C.muted, opacity: 0.55, paddingBottom: 4 }}>
              {d.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Compact grid — each row is ~32px */}
        {isLoading ? (
          <div className="space-y-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-0.5">
                {[...Array(7)].map((_, j) => (
                  <Skeleton key={j} className="h-8 rounded" style={{ background: `${C.fg}08` }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="h-8" />;
              const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayData = byDate[key];
              const isSelected = selectedDate === key;
              const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
              const hasMeals = !!dayData;
              const dotColor = dayData?.hasOutOfRange ? C.amber : C.primary;
              return (
                <button
                  key={idx}
                  onClick={() => hasMeals && setSelectedDate(isSelected ? null : key)}
                  className="relative h-8 flex flex-col items-center justify-center rounded text-[12px] font-medium transition-colors"
                  style={{
                    cursor: hasMeals ? "pointer" : "default",
                    background: isSelected ? `${dotColor}28` : "transparent",
                    outline: isSelected ? `1px solid ${dotColor}` : isToday && !isSelected ? `1px solid ${C.primary}44` : "none",
                    color: hasMeals ? C.fg : `${C.muted}33`,
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{day}</span>
                  {hasMeals && (
                    <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: dotColor }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2" style={{ fontSize: 10, color: C.muted, opacity: 0.6 }}>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.primary }} />
            All in zone
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.amber }} />
            Out of zone
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selectedDate && selectedDayData ? (
          <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="text-[14px] font-medium" style={{ color: C.fg }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>
                {selectedDayData.meals.filter(m => m.mealType === "meal").length} meal{selectedDayData.meals.filter(m => m.mealType === "meal").length !== 1 ? "s" : ""}
                {selectedDayData.treatCount > 0 ? ` · ${selectedDayData.treatCount} treat${selectedDayData.treatCount !== 1 ? "s" : ""}` : ""}
              </p>
            </div>
            <div>
              {selectedDayData.meals
                .slice()
                .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
                .map((meal: any) => {
                  const h = meal.hungerRating;
                  const f = meal.fullnessRating;
                  return (
                    <div key={meal.id} className="px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: C.surfaceVariant }}>
                          {meal.photoUrl ? (
                            <img src={meal.photoUrl} alt="Meal" className="w-full h-full object-cover" />
                          ) : (
                            <UtensilsCrossed size={18} style={{ color: `${C.muted}55` }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px]" style={{ color: C.muted }}>{formatTimeAtOffset(new Date(meal.loggedAt).getTime(), selectedDayData?.utcOffsetMins ?? meal.utcOffsetMins ?? 0)}</span>
                            {meal.mealType === "treat" && (
                              <span className="text-xs font-medium uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${C.amber}18`, color: C.amber }}>Treat</span>
                            )}
                            {meal.isOffPlan && (
                              <span className="text-xs font-medium uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${C.red}18`, color: C.red }}>Off Plan</span>
                            )}
                          </div>
                          {meal.name && <p className="text-[13px] font-medium truncate" style={{ color: C.fg }}>{meal.name}</p>}
                          {meal.portionSize && <p className="text-[12px] capitalize" style={{ color: C.muted }}>{meal.portionSize}</p>}
                          {meal.mealType === "meal" && (h != null || f != null) && (
                            <div className="flex items-center gap-4 mt-1.5">
                              {h != null && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs" style={{ color: C.muted }}>Hunger</span>
                                  <span className="text-[12px] font-bold" style={{ color: isIdealHunger(h) ? C.primary : C.amber }}>{h}</span>
                                </div>
                              )}
                              {f != null && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs" style={{ color: C.muted }}>Fullness</span>
                                  <span className="text-[12px] font-bold" style={{ color: isIdealFullness(f) ? C.primary : C.amber }}>{f}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {meal.notes && (
                            <p className="text-[12px] mt-1 italic" style={{ color: C.muted }}>"{meal.notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-[13px]" style={{ color: C.muted }}>
            {Object.keys(byDate).length === 0 && !isLoading
              ? "No meals logged this month"
              : "Select a day to view meals"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Insights View ────────────────────────────────────────────────────────────

function InsightsView({ clientId, days }: { clientId: number; days: 7 | 28 }) {
  const [showTimingInfo, setShowTimingInfo] = useState(false);

  const { data: insights, isLoading } = trpc.mealLogs.richInsightsForClient.useQuery(
    { userId: clientId, days },
    { enabled: clientId > 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: C.surface, borderColor: C.border }}>
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: C.surface, borderColor: C.border }}>
              <Skeleton className="h-3 w-28 mb-3" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: C.surface, borderColor: C.border }}>
              <Skeleton className="h-3 w-28 mb-3" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const periodLabel = `Last ${days}d`;

  return (
    <div className="space-y-3">

      {/* Low data warning */}
      {insights.totalMeals < 5 && (
        <div
          className="rounded-lg px-4 py-2.5 text-[12px]"
          style={{ background: C.surfaceVariant, color: C.muted, border: `1px solid ${C.border}` }}
        >
          {insights.totalMeals === 0
            ? "No meals logged in this period."
            : `Only ${insights.totalMeals} meals logged — insights will improve with more data.`}
        </div>
      )}

      {/* ── Row 1: Full-width summary strip ── */}
      <Card className="flex items-stretch p-0 overflow-hidden">
        {/* Ideal Zone */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-5 py-4">
          <div className="flex items-center gap-1.5">
            <SectionLabel>Ideal Zone</SectionLabel>
            <div className="relative group">
              <Info className="w-3 h-3 cursor-pointer" style={{ color: C.muted }} />
              <div className="absolute left-0 top-5 z-10 hidden group-hover:block w-52 rounded-lg px-3 py-2 text-xs leading-relaxed shadow-lg"
                style={{ background: C.surfaceVariant, border: `1px solid ${C.border}`, color: C.muted }}>
                % of meals where hunger (3–4) and fullness (6–7) were both in range
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold leading-none" style={{ fontSize: 28, color: C.fg }}>
              {insights.idealZonePct != null ? `${insights.idealZonePct}%` : "—"}
            </span>
            {insights.idealZonePct != null && insights.prevIdealZonePct != null && (
              <TrendBadge current={insights.idealZonePct} previous={insights.prevIdealZonePct} higherIsBetter threshold={2} />
            )}
          </div>
        </div>
        <div className="w-px self-stretch my-4" style={{ background: C.border }} />
        {/* Meals */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-5 py-4">
          <SectionLabel>Meals</SectionLabel>
          <span className="font-bold leading-none" style={{ fontSize: 28, color: C.fg }}>
            {insights.totalMeals}
          </span>
        </div>
        <div className="w-px self-stretch my-4" style={{ background: C.border }} />
        {/* Avg Hunger */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-5 py-4">
          <SectionLabel>Avg Hunger</SectionLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold leading-none" style={{ fontSize: 28, color: C.fg }}>
              {insights.avgHunger ?? "—"}
            </span>
            <TrendBadge current={insights.avgHunger} previous={insights.prevAvgHunger} higherIsBetter={false} threshold={0.15} />
          </div>
        </div>
        <div className="w-px self-stretch my-4" style={{ background: C.border }} />
        {/* Avg Fullness */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-5 py-4">
          <SectionLabel>Avg Fullness</SectionLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold leading-none" style={{ fontSize: 28, color: C.fg }}>
              {insights.avgFullness ?? "—"}
            </span>
            <TrendBadge current={insights.avgFullness} previous={insights.prevAvgFullness} higherIsBetter threshold={0.15} />
          </div>
        </div>
      </Card>

      {/* ── Row 2: Ideal Zone detail + Scatter + Treats + Meal Timing (4-col, full width) ── */}
      <div className="grid grid-cols-4 gap-3">
        {/* Ideal Zone detail */}
        <IdealZoneCard insights={insights} days={days} />

        {/* Scatter */}
        <Card className="flex flex-col gap-3">
          <SectionLabel>Hunger vs. Fullness</SectionLabel>
          {insights.scatter.length > 0 ? (
            <div className="flex justify-center">
              <ScatterPlot scatter={insights.scatter} />
            </div>
          ) : (
            <p className="text-[12px] py-6 text-center" style={{ color: C.muted }}>No rated meals yet</p>
          )}
        </Card>

        {/* Treats */}
        {(() => {
          const treatBars = days === 7 ? insights.treatsByWeek : insights.treatsByWeek.slice(-4);
          const treatsTotal = treatBars.reduce((s, w) => s + w.total, 0);
          return (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Treats</SectionLabel>
                {treatsTotal > 0 && (
                  <span className="text-[13px] font-bold leading-none" style={{ color: C.fg }}>
                    {treatsTotal} <span className="text-[11px] font-normal" style={{ color: C.muted }}>total</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 11, color: C.muted }}>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: C.primary, opacity: 0.8 }} />
                  Small
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: C.amber, opacity: 0.85 }} />
                  Medium
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: C.red, opacity: 0.8 }} />
                  Large
                </span>
              </div>
              <TreatsChart treatsByWeek={treatBars} days={days} />
            </Card>
          );
        })()}

        {/* Meal Timing */}
        {insights.hasTimingData ? (
          <MealTimingCard
            slots={insights.slots}
            consistencyScore={insights.consistencyScore ?? null}
            totalForConsistency={insights.totalForConsistency}
            showInfo={showTimingInfo}
            onToggleInfo={() => setShowTimingInfo(v => !v)}
          />
        ) : (
          <Card>
            <SectionLabel>Meal Timing</SectionLabel>
            <p className="text-[12px] mt-2" style={{ color: C.muted }}>Not enough data to identify meal timing patterns.</p>
          </Card>
        )}
      </div>

      {/* ── Row 3: Habit Performance ── */}
      <CoachHabitsPanel clientId={clientId} periodDays={days} />
    </div>
  );
}

// ─── Coach Nutrition Tab ──────────────────────────────────────────────────────

export function CoachNutritionTab({ clientId }: { clientId: number }) {
  const [sub, setSub] = useState<"insights" | "log">("insights");
  const [days, setDays] = useState<7 | 28>(28);

  return (
    <div>
      {/* Header row: sub-tabs left, period toggle right */}
      <div className="flex items-center justify-between mb-6">
        <div
          className="flex gap-0.5 p-1 rounded-lg"
          style={{ background: C.surfaceVariant }}
        >
          {(["insights", "log"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors"
              style={{
                background: sub === s ? C.surface : "transparent",
                color: sub === s ? C.fg : C.muted,
              }}
            >
              {s === "insights" ? "Insights" : "Log"}
            </button>
          ))}
        </div>

        {sub === "insights" && (
          <div
            className="flex gap-0.5 p-1 rounded-lg"
            style={{ background: C.surfaceVariant }}
          >
            {([7, 28] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  background: days === d ? C.surface : "transparent",
                  color: days === d ? C.fg : C.muted,
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>

      {sub === "insights" && <InsightsView clientId={clientId} days={days} />}
      {sub === "log" && <MealLogView clientId={clientId} />}
    </div>
  );
}
