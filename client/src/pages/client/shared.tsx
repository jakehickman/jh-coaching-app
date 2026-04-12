// Shared primitives used across all client tab files.
// Keep this file small — only put things that are genuinely used in 2+ tab files.

export type DailyLogRow = {
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
  offPlanMeals?: number | null;
  notes?: string | null;
};

export function DateInput({ value, onChange, className = "", min, max }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(e.target.value)}
      className={`bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </p>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
    </Card>
  );
}

export function ScoreInput({ label, value, onChange, max = 10 }: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-11 rounded-lg text-sm font-semibold transition-colors touch-manipulation ${
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
