import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ─── Scale helpers ────────────────────────────────────────────────────────────

const SCALE_LABELS: Record<number, string> = {
  1: "Ravenous", 2: "Very hungry", 3: "Hungry", 4: "Mild hunger",
  5: "Neutral", 6: "Satisfied", 7: "Full", 8: "Overfull",
  9: "Stuffed", 10: "Painfully full",
};

function isIdealHunger(r: number) { return r >= 3 && r <= 4; }
function isIdealFullness(r: number) { return r >= 6 && r <= 7; }
function isIdealZone(h?: number | null, f?: number | null) {
  return h != null && f != null && isIdealHunger(h) && isIdealFullness(f);
}

function formatTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// ─── Meal Log View ────────────────────────────────────────────────────────────

function MealLogView({ clientId }: { clientId: number }) {
  const { data: meals = [], isLoading } = trpc.mealLogs.listForClient.useQuery(
    { userId: clientId },
    { enabled: clientId > 0 }
  );

  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sorted = [...(meals as any[])].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No meals logged yet.
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, any[]> = {};
  for (const meal of sorted) {
    const d = new Date(meal.loggedAt);
    const key = d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(meal);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([dateLabel, dayMeals]) => (
        <div key={dateLabel}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{dateLabel}</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {dayMeals.map((meal, idx) => {
              const isExpanded = expandedId === meal.id;
              const h = meal.hungerRating;
              const f = meal.fullnessRating;
              const ideal = isIdealZone(h, f);

              return (
                <div key={meal.id} className={cn("border-b border-border last:border-0")}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : meal.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                      {meal.photoUrl ? (
                        <img src={meal.photoUrl} alt="Meal" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No photo</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-muted-foreground">{formatTime(new Date(meal.loggedAt))}</span>
                        {meal.mealType === "treat" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Treat</span>
                        )}
                        {meal.isOffPlan && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Off Plan</span>
                        )}
                      </div>
                      {meal.name && <p className="text-sm font-medium text-foreground truncate">{meal.name}</p>}
                      {meal.portionSize && <p className="text-xs text-muted-foreground capitalize">{meal.portionSize} portion</p>}
                    </div>

                    {/* Ratings */}
                    {meal.mealType === "meal" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {h != null && (
                          <span className={cn("text-xs font-bold", isIdealHunger(h) ? "text-green-400" : "text-amber-400")}>
                            H{h}
                          </span>
                        )}
                        {f != null && (
                          <span className={cn("text-xs font-bold", isIdealFullness(f) ? "text-green-400" : "text-amber-400")}>
                            F{f}
                          </span>
                        )}
                        {ideal && (
                          <span className="text-[10px] text-green-400 font-medium">Ideal</span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/40 bg-muted/10">
                      {meal.photoUrl && (
                        <img
                          src={meal.photoUrl}
                          alt="Meal"
                          className="w-full max-h-64 object-cover rounded-xl mt-3"
                        />
                      )}
                      {meal.mealType === "meal" && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Hunger before</p>
                            {h != null ? (
                              <>
                                <p className={cn("text-2xl font-bold", isIdealHunger(h) ? "text-green-400" : "text-amber-400")}>{h}</p>
                                <p className="text-xs text-muted-foreground">{SCALE_LABELS[h]}</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not recorded</p>
                            )}
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Fullness after</p>
                            {f != null ? (
                              <>
                                <p className={cn("text-2xl font-bold", isIdealFullness(f) ? "text-green-400" : "text-amber-400")}>{f}</p>
                                <p className="text-xs text-muted-foreground">{SCALE_LABELS[f]}</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not recorded</p>
                            )}
                          </div>
                        </div>
                      )}
                      {meal.notes && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                          <p className="text-sm text-foreground">{meal.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Insights View ────────────────────────────────────────────────────────────

function DistributionChart({
  dist,
  idealFn,
}: {
  dist: Record<number, number>;
  idealFn: (n: number) => boolean;
}) {
  const max = Math.max(...Object.values(dist), 1);
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const count = dist[n] ?? 0;
        const pct = (count / max) * 100;
        const ideal = idealFn(n);
        return (
          <div key={n} className="flex items-center gap-2">
            <span className={cn("text-xs w-4 shrink-0 text-right font-medium", ideal ? "text-green-400" : "text-muted-foreground")}>{n}</span>
            <div className="flex-1 h-4 bg-secondary rounded-sm overflow-hidden">
              <div
                className={cn("h-full rounded-sm transition-all", ideal ? "bg-green-500" : "bg-primary/60")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-5 shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function InsightsView({ clientId }: { clientId: number }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data: insights, isLoading } = trpc.mealLogs.insightsForClient.useQuery(
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

  const hasSufficientData = insights.totalMeals >= 5;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        {([7, 30, 90] as const).map((d) => (
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

      {!hasSufficientData && (
        <div className="bg-secondary rounded-xl px-4 py-3 text-sm text-muted-foreground">
          {insights.totalMeals === 0
            ? "This client has not logged any meals yet."
            : `Only ${insights.totalMeals} meals logged in this period — insights will be more meaningful with more data.`}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{insights.totalMeals}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Meals logged</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{insights.totalTreats}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Treats logged</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className={cn("text-2xl font-bold", insights.avgHunger != null && isIdealHunger(Math.round(insights.avgHunger)) ? "text-green-400" : "text-foreground")}>
            {insights.avgHunger ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg hunger</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className={cn("text-2xl font-bold", insights.avgFullness != null && isIdealFullness(Math.round(insights.avgFullness)) ? "text-green-400" : "text-foreground")}>
            {insights.avgFullness ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg fullness</p>
        </div>
      </div>

      {/* Ideal zone bar */}
      {insights.idealZonePct != null && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Meals in ideal zone</span>
            <span className={cn("font-bold", insights.idealZonePct >= 50 ? "text-green-400" : "text-amber-400")}>
              {insights.idealZonePct}%
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", insights.idealZonePct >= 50 ? "bg-green-500" : "bg-amber-500")}
              style={{ width: `${insights.idealZonePct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {insights.idealZoneCount} of {insights.mealsWithBothRatings} rated meals — hunger 3–4 at start, fullness 6–7 at end
          </p>
        </div>
      )}

      {/* Off-plan count */}
      {insights.offPlanCount > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-foreground">Off-plan meals</span>
          <span className="text-sm font-bold text-red-400">{insights.offPlanCount}</span>
        </div>
      )}

      {/* Distributions */}
      {hasSufficientData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Hunger at start of meal</p>
            <DistributionChart dist={insights.hungerDist} idealFn={isIdealHunger} />
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Fullness after meal</p>
            <DistributionChart dist={insights.fullnessDist} idealFn={isIdealFullness} />
          </div>
        </div>
      )}

      {/* Meal timing */}
      {(insights.avgFirstMeal || insights.avgLastMeal || insights.avgGapHours) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Meal timing</p>
          {insights.avgFirstMeal && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">First meal (avg)</span>
              <span className="font-medium text-foreground">{insights.avgFirstMeal}</span>
            </div>
          )}
          {insights.avgLastMeal && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last meal (avg)</span>
              <span className="font-medium text-foreground">{insights.avgLastMeal}</span>
            </div>
          )}
          {insights.avgGapHours != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg gap between meals</span>
              <span className="font-medium text-foreground">{insights.avgGapHours}h</span>
            </div>
          )}
        </div>
      )}
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
