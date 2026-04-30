import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

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
              {c.oldValue && <span className="text-red-400 line-through">{c.oldValue}</span>}
              {c.newValue && <span className="text-emerald-400">{c.newValue}</span>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function NutritionChanges({ changes }: { changes: NutritionChanges }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
      {changes.trainingCalories != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Training calories</span>
          <span className="font-medium">{changes.trainingCalories} kcal</span>
        </div>
      )}
      {changes.trainingProtein != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Training protein</span>
          <span className="font-medium">{changes.trainingProtein}g</span>
        </div>
      )}
      {changes.trainingCarbs != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Training carbs</span>
          <span className="font-medium">{changes.trainingCarbs}g</span>
        </div>
      )}
      {changes.trainingFat != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Training fat</span>
          <span className="font-medium">{changes.trainingFat}g</span>
        </div>
      )}
      {changes.restCalories != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rest calories</span>
          <span className="font-medium">{changes.restCalories} kcal</span>
        </div>
      )}
      {changes.restProtein != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rest protein</span>
          <span className="font-medium">{changes.restProtein}g</span>
        </div>
      )}
      {changes.restCarbs != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rest carbs</span>
          <span className="font-medium">{changes.restCarbs}g</span>
        </div>
      )}
      {changes.restFat != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rest fat</span>
          <span className="font-medium">{changes.restFat}g</span>
        </div>
      )}
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
  cardio: "Cardio",
};

const TYPE_BADGE_CLASSES: Record<string, string> = {
  training: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  nutrition: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cardio: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function UnifiedChangeLog({ clientId }: { clientId: number }) {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data, isLoading } = trpc.changeLog.getUnified.useQuery({ userId: clientId });

  const filtered = (data ?? []).filter(
    (e) => filter === "all" || e.type === filter
  );

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
            {f === "all" ? "All" : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">No changes recorded yet.</p>
      )}

      <div className="space-y-3">
        {filtered.map((entry) => (
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
              <NutritionChanges changes={entry.changes as NutritionChanges} />
            )}
            {entry.type === "cardio" && (
              <CardioChanges changes={entry.changes as CardioChangeEntry[]} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
