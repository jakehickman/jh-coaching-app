import { useState } from "react";
import { trpc } from "@/lib/trpc";

type FilterType = "all" | "training" | "nutrition" | "cardio";

interface ProgramChangeEntry {
  type: "add" | "remove" | "modify";
  session: string;
  exercise: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

interface CardioChangeEntry {
  field: "stepGoal" | "lissSessionsPerWeek" | "lissMinutesPerSession";
  oldValue?: string | null;
  newValue?: string | null;
}

interface NutritionChanges {
  trainingCalories?: number | null;
  trainingProtein?: number | null;
  trainingCarbs?: number | null;
  trainingFat?: number | null;
  restCalories?: number | null;
  restProtein?: number | null;
  restCarbs?: number | null;
  restFat?: number | null;
}

function formatDate(d: Date) {
  const date = new Date(d);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-AU", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

const CARDIO_FIELD_LABELS: Record<string, string> = {
  stepGoal: "Step goal",
  lissSessionsPerWeek: "LISS sessions / week",
  lissMinutesPerSession: "LISS minutes / session",
};

function Delta({ val, unit = "" }: { val: number; unit?: string }) {
  if (val === 0) return null;
  const sign = val > 0 ? "+" : "";
  return (
    <span className={`text-xs ml-1 ${val > 0 ? "text-emerald-400" : "text-red-400"}`}>
      {sign}{val}{unit}
    </span>
  );
}

function MacroRow({
  label,
  value,
  unit,
  prev,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  prev?: number | null;
}) {
  if (value == null) return null;
  const delta = prev != null ? value - prev : null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {value}{unit}
        {delta != null && <Delta val={delta} unit={unit} />}
      </span>
    </div>
  );
}

function TrainingChanges({ changes }: { changes: ProgramChangeEntry[] }) {
  return (
    <div className="space-y-1 mt-2">
      {changes.map((c, i) => (
        <div key={i} className="text-sm text-muted-foreground flex flex-wrap gap-x-1">
          <span className={
            c.type === "add" ? "text-emerald-400" :
            c.type === "remove" ? "text-red-400" :
            "text-yellow-400"
          }>
            {c.type === "add" ? "+" : c.type === "remove" ? "−" : "~"}
          </span>
          <span className="text-foreground font-medium">{c.session}</span>
          <span>·</span>
          <span>{c.exercise}</span>
          {c.field && (
            <>
              <span>·</span>
              <span className="capitalize">{c.field}</span>
              {c.oldValue && <span className="text-red-400 line-through ml-1">{c.oldValue}</span>}
              {c.newValue && <span className="text-emerald-400 ml-1">{c.newValue}</span>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function NutritionCard({ changes, prev }: { changes: NutritionChanges; prev?: NutritionChanges | null }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
      {/* Training day */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Training Day</p>
        <MacroRow label="Calories" value={changes.trainingCalories} unit=" kcal" prev={prev?.trainingCalories} />
        <MacroRow label="Protein" value={changes.trainingProtein} unit="g" prev={prev?.trainingProtein} />
        <MacroRow label="Carbs" value={changes.trainingCarbs} unit="g" prev={prev?.trainingCarbs} />
        <MacroRow label="Fat" value={changes.trainingFat} unit="g" prev={prev?.trainingFat} />
      </div>
      {/* Rest day */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Rest Day</p>
        <MacroRow label="Calories" value={changes.restCalories} unit=" kcal" prev={prev?.restCalories} />
        <MacroRow label="Protein" value={changes.restProtein} unit="g" prev={prev?.restProtein} />
        <MacroRow label="Carbs" value={changes.restCarbs} unit="g" prev={prev?.restCarbs} />
        <MacroRow label="Fat" value={changes.restFat} unit="g" prev={prev?.restFat} />
      </div>
    </div>
  );
}

function CardioChanges({ changes }: { changes: CardioChangeEntry[] }) {
  return (
    <div className="space-y-1 mt-2">
      {changes.map((c, i) => (
        <div key={i} className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">{CARDIO_FIELD_LABELS[c.field] ?? c.field}</span>
          {c.oldValue != null && (
            <span className="text-red-400 line-through">{c.oldValue}</span>
          )}
          <span className="text-emerald-400">{c.newValue ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  training: "Training",
  nutrition: "Nutrition",
  cardio: "Cardio & Activity",
};

const TYPE_BADGE_CLASSES: Record<string, string> = {
  training: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  nutrition: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cardio: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const FILTER_LABELS: Record<FilterType, string> = {
  all: "All",
  training: "Training",
  nutrition: "Nutrition",
  cardio: "Cardio & Activity",
};

export function UnifiedChangeLog({ clientId }: { clientId: number }) {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data, isLoading } = trpc.changeLog.getUnified.useQuery({ userId: clientId });

  const filtered = (data ?? []).filter(
    (e) => filter === "all" || e.type === filter
  );

  // Build a lookup of the previous nutrition entry for each nutrition entry
  // so we can show deltas
  const nutritionEntries = (data ?? []).filter((e) => e.type === "nutrition");

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "training", "nutrition", "cardio"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No changes recorded yet.</p>
      )}

      <div className="space-y-3">
        {filtered.map((entry) => {
          // For nutrition entries, find the previous nutrition entry to compute deltas
          let prevNutrition: NutritionChanges | null = null;
          if (entry.type === "nutrition") {
            const idx = nutritionEntries.findIndex((e) => e.id === entry.id);
            if (idx < nutritionEntries.length - 1) {
              prevNutrition = nutritionEntries[idx + 1].changes as NutritionChanges;
            }
          }

          return (
            <div
              key={entry.id}
              className="bg-card border border-border rounded-xl px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${TYPE_BADGE_CLASSES[entry.type]}`}
                  >
                    {TYPE_LABELS[entry.type]}
                  </span>
                  {entry.note && (
                    <span className="text-sm text-foreground">{entry.note}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(entry.changedAt)}
                </span>
              </div>

              {entry.type === "training" && (
                <TrainingChanges changes={entry.changes as ProgramChangeEntry[]} />
              )}
              {entry.type === "nutrition" && (
                <NutritionCard
                  changes={entry.changes as NutritionChanges}
                  prev={prevNutrition}
                />
              )}
              {entry.type === "cardio" && (
                <CardioChanges changes={entry.changes as CardioChangeEntry[]} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
