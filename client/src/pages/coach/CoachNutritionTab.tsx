import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Info, UtensilsCrossed } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

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

function formatMonthYear(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

function formatWeekStart(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─── Calendar Meal Log View ───────────────────────────────────────────────────

type DayData = { meals: any[]; hasOutOfRange: boolean; treatCount: number };

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

  // Build calendar grid (Mon-Sun)
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Monday=0 offset
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete weeks
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
    <div className="flex gap-6">
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">{formatMonthYear(year, month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const key = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayData = byDate[key];
              const isSelected = selectedDate === key;
              const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
              const hasMeals = !!dayData;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors",
                    hasMeals ? "cursor-pointer hover:bg-secondary/80" : "cursor-default",
                    isSelected ? "bg-primary/20 ring-1 ring-primary" : hasMeals ? "bg-secondary/40" : "",
                    isToday && !isSelected ? "ring-1 ring-primary/40" : "",
                    !hasMeals ? "text-muted-foreground/40" : "text-foreground"
                  )}
                >
                  <span className="text-xs">{day}</span>
                  {dayData && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {/* Green dot = meals logged */}
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
    
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Meals logged</span>

        </div>
      </div>

      {/* Day detail panel */}
      <div className="w-96 shrink-0">
        {selectedDate && selectedDayData ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDayData.meals.filter(m => m.mealType === "meal").length} meal{selectedDayData.meals.filter(m => m.mealType === "meal").length !== 1 ? "s" : ""}
                {selectedDayData.treatCount > 0 ? ` · ${selectedDayData.treatCount} treat${selectedDayData.treatCount !== 1 ? "s" : ""}` : ""}
              </p>
            </div>
            <div className="divide-y divide-border">
              {selectedDayData.meals
                .slice()
                .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
                .map((meal: any) => {
                  const h = meal.hungerRating;
                  const f = meal.fullnessRating;
                  return (
                    <div key={meal.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                      {meal.photoUrl ? (
                        <img src={meal.photoUrl} alt="Meal" className="w-full h-full object-cover" />
                      ) : (
                        <UtensilsCrossed size={20} className="text-muted-foreground/50" />
                      )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-muted-foreground">{formatTime(new Date(meal.loggedAt))}</span>
                            {meal.mealType === "treat" && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Treat</span>
                            )}
                            {meal.isOffPlan && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Off Plan</span>
                            )}
                          </div>
                          {meal.name && <p className="text-sm font-medium text-foreground truncate">{meal.name}</p>}
                          {meal.portionSize && <p className="text-xs text-muted-foreground capitalize">{meal.portionSize} portion</p>}
                          {meal.mealType === "meal" && (h != null || f != null) && (
                            <div className="flex items-center gap-3 mt-1.5">
                              {h != null && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">Hunger</span>
                                  <span className={cn("text-xs font-bold", isIdealHunger(h) ? "text-green-400" : "text-amber-400")}>{h}</span>
                                </div>
                              )}
                              {f != null && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">Fullness</span>
                                  <span className={cn("text-xs font-bold", isIdealFullness(f) ? "text-green-400" : "text-amber-400")}>{f}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {meal.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{meal.notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-muted-foreground">
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

function DeltaArrow({ current, previous, idealFn }: {
  current: number | null;
  previous: number | null;
  idealFn: (n: number) => boolean;
}) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return null;
  const movingTowardIdeal = idealFn(Math.round(current)) && !idealFn(Math.round(previous));
  const isGood = movingTowardIdeal || (idealFn(Math.round(previous)) && idealFn(Math.round(current)));
  return diff > 0
    ? <ArrowUp className={cn("w-3 h-3 inline ml-1", isGood ? "text-green-400" : "text-muted-foreground")} />
    : <ArrowDown className={cn("w-3 h-3 inline ml-1", isGood ? "text-green-400" : "text-muted-foreground")} />;
}

function ScatterPlot({ scatter }: { scatter: { h: number; f: number }[] }) {
  const SIZE = 280;
  const PAD = 28;
  const INNER = SIZE - PAD * 2;
  const STEP = INNER / 9; // 10 values: 1..10

  // Count duplicates
  const counts: Record<string, number> = {};
  for (const p of scatter) {
    const k = `${p.h},${p.f}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  function toX(h: number) { return PAD + (h - 1) * STEP; }
  function toY(f: number) { return SIZE - PAD - (f - 1) * STEP; }

  // Ideal zone: hunger 3-4, fullness 6-7
  const zoneX1 = toX(3); const zoneX2 = toX(4) + STEP;
  const zoneY1 = toY(7); const zoneY2 = toY(6) + STEP;

  const plotted = new Set<string>();
  const dots: { x: number; y: number; r: number; ideal: boolean }[] = [];
  for (const p of scatter) {
    const k = `${p.h},${p.f}`;
    if (plotted.has(k)) continue;
    plotted.add(k);
    const cnt = counts[k];
    const r = Math.min(9, 4 + (cnt - 1) * 1.5);
    const ideal = isIdealHunger(p.h) && isIdealFullness(p.f);
    dots.push({ x: toX(p.h), y: toY(p.f), r, ideal });
  }

  return (
    <svg width={SIZE} height={SIZE} className="overflow-visible">
      {/* Grid lines */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <g key={n}>
          <line x1={toX(n)} y1={PAD} x2={toX(n)} y2={SIZE - PAD} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
          <line x1={PAD} y1={toY(n)} x2={SIZE - PAD} y2={toY(n)} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
        </g>
      ))}
      {/* Ideal zone */}
      <rect x={zoneX1} y={zoneY1} width={zoneX2 - zoneX1} height={zoneY2 - zoneY1}
        fill="#4ade80" fillOpacity={0.12} rx={3} />
      {/* Axis labels */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <g key={n}>
          <text x={toX(n)} y={SIZE - PAD + 12} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.4}>{n}</text>
          <text x={PAD - 8} y={toY(n) + 3} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.4}>{n}</text>
        </g>
      ))}
      {/* Axis titles */}
      <text x={SIZE / 2} y={SIZE - 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>Hunger</text>
      <text x={8} y={SIZE / 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}
        transform={`rotate(-90, 8, ${SIZE / 2})`}>Fullness</text>
      {/* Dots */}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r}
          fill={d.ideal ? "#4ade80" : "#6b7280"} fillOpacity={d.ideal ? 0.8 : 0.5} />
      ))}
    </svg>
  );
}

function TreatsChart({ treatsByWeek, fillHeight }: {
  treatsByWeek: { weekStart: string; small: number; medium: number; large: number; total: number }[];
  fillHeight?: boolean;
}) {
  const maxTotal = Math.max(...treatsByWeek.map(w => w.total), 1);

  return (
    <div className={fillHeight ? "flex items-end gap-2 w-full h-full pb-5" : "flex items-end gap-2 h-32 w-full"}>
      {treatsByWeek.map((week) => {
        const totalH = (week.total / maxTotal) * 100;
        const smallH = week.total > 0 ? (week.small / week.total) * totalH : 0;
        const medH = week.total > 0 ? (week.medium / week.total) * totalH : 0;
        const largeH = week.total > 0 ? (week.large / week.total) * totalH : 0;

        return (
          <div key={week.weekStart} className="flex-1 flex flex-col items-center gap-1">
            {week.total > 0 && (
              <span className="text-[9px] font-medium text-foreground/70 mb-0.5">{week.total}</span>
            )}
            <div className="w-full flex flex-col-reverse rounded overflow-hidden" style={{ height: week.total > 0 ? "84px" : "96px" }}>
              {week.total === 0 ? (
                <div className="w-full bg-secondary/30 rounded" style={{ height: "4px" }} />
              ) : (
                <>
                  {week.small > 0 && (
                    <div className="w-full bg-green-500/70" style={{ height: `${smallH}%` }} />
                  )}
                  {week.medium > 0 && (
                    <div className="w-full bg-amber-400/80" style={{ height: `${medH}%` }} />
                  )}
                  {week.large > 0 && (
                    <div className="w-full bg-red-400/80" style={{ height: `${largeH}%` }} />
                  )}
                </>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground text-center leading-tight">
              {new Date(week.weekStart + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InsightsView({ clientId }: { clientId: number }) {
  const [days, setDays] = useState<7 | 30>(30);
  const [showTimingInfo, setShowTimingInfo] = useState(false);

  const { data: insights, isLoading } = trpc.mealLogs.richInsightsForClient.useQuery(
    { userId: clientId, days },
    { enabled: clientId > 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-5">
      {/* Period toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                days === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {insights.totalMeals < 5 && (
        <div className="bg-secondary rounded-xl px-4 py-3 text-sm text-muted-foreground">
          {insights.totalMeals === 0
            ? "No meals logged in this period."
            : `Only ${insights.totalMeals} meals logged — insights will improve with more data.`}
        </div>
      )}

      {/* Top row: 3 stat cards + ideal zone card */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <p className="text-3xl font-bold text-foreground">{insights.totalMeals}</p>
          <div>
            <p className="text-xs text-muted-foreground mt-1">Meals</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">last {days}d</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <p className="text-3xl font-bold text-foreground">
            {insights.avgHunger ?? "—"}
            {insights.avgHunger != null && (
              <DeltaArrow current={insights.avgHunger} previous={insights.prevAvgHunger} idealFn={isIdealHunger} />
            )}
          </p>
          <div>
            <p className="text-xs text-muted-foreground mt-1">Avg Hunger</p>
            {insights.prevAvgHunger != null && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">vs. {insights.prevAvgHunger} prev</p>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <p className="text-3xl font-bold text-foreground">
            {insights.avgFullness ?? "—"}
            {insights.avgFullness != null && (
              <DeltaArrow current={insights.avgFullness} previous={insights.prevAvgFullness} idealFn={isIdealFullness} />
            )}
          </p>
          <div>
            <p className="text-xs text-muted-foreground mt-1">Avg Fullness</p>
            {insights.prevAvgFullness != null && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">vs. {insights.prevAvgFullness} prev</p>
            )}
          </div>
        </div>
        {insights.idealZonePct != null ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 flex flex-col justify-between">
            <p className="text-3xl font-bold text-green-400">{insights.idealZonePct}%</p>
            <div>
              <p className="text-xs text-muted-foreground mt-1">Ideal zone</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Hunger 3–4 · Fullness 6–7</p>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5" />
        )}
      </div>

      {/* Bottom 3-card row: scatter, treats, timing */}
      <div className="grid grid-cols-3 gap-4 items-stretch">
        {/* Scatter */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground shrink-0">Hunger vs. Fullness</p>
          {insights.scatter.length > 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <ScatterPlot scatter={insights.scatter} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No rated meals yet</p>
          )}
        </div>

        {/* Treats */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
          <div className="mb-2 shrink-0">
            <p className="text-sm font-semibold text-foreground">Treats</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {insights.treatsByWeek.reduce((s, w) => s + w.total, 0)} total in last {days}d
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3 shrink-0">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/70 inline-block" />Small</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400/80 inline-block" />Medium</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400/80 inline-block" />Large</span>
          </div>
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <div className="absolute inset-0">
              <TreatsChart treatsByWeek={insights.treatsByWeek} fillHeight />
            </div>
          </div>
        </div>

        {/* Meal timing — moved into 3-col row */}
        {insights.hasTimingData ? (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Meal Timing</p>
              <button
                onClick={() => setShowTimingInfo(v => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {showTimingInfo && (
              <div className="bg-secondary/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                The consistency score is the percentage of all logged meals that fell within 1 hour of their nearest usual meal time. Slot anchors are the median time for each naturally-occurring meal cluster across the period. Treats are excluded.
              </div>
            )}

            {insights.consistencyScore != null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Consistency</span>
                  <span className={cn("font-bold", insights.consistencyScore >= 70 ? "text-green-400" : insights.consistencyScore >= 40 ? "text-orange-400" : "text-red-400")}>
                    {insights.consistencyScore}%
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", insights.consistencyScore >= 70 ? "bg-green-500" : insights.consistencyScore >= 40 ? "bg-orange-500" : "bg-red-500")}
                    style={{ width: `${insights.consistencyScore}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {insights.slots.map((slot: { label: string; anchor: string; driftMin: number }) => (
                <div key={slot.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">{slot.label}</span>
                  <span className="font-medium text-foreground">{slot.anchor}</span>
                  <span className={cn(
                    "text-xs font-medium",
                    slot.driftMin <= 30 ? "text-green-400" : slot.driftMin <= 60 ? "text-teal-400" : "text-red-400"
                  )}>
                    ±{slot.driftMin} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">Not enough data for meal timing</p>
          </div>
        )}
      </div>


    </div>
  );
}

// ─── Coach Nutrition Tab ──────────────────────────────────────────────────────

export function CoachNutritionTab({ clientId }: { clientId: number }) {
  const [sub, setSub] = useState<"log" | "insights">("insights");

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
        {(["insights", "log"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
              sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "insights" ? "Insights" : "Meal Log"}
          </button>
        ))}
      </div>
      {sub === "insights" && <InsightsView clientId={clientId} />}
      {sub === "log" && <MealLogView clientId={clientId} />}
    </div>
  );
}
