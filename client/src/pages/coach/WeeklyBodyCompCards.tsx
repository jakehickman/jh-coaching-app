import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

function fmtDate(d: string): string {
  if (!d || d.length < 10) return d;
  const dt = new Date(d.slice(0, 10) + "T12:00:00Z");
  const day = dt.getUTCDate();
  const month = dt.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  const year = dt.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function skinfoldTotal(m: any): number | null {
  const sites = [
    avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
    avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
    avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]),
    avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]),
  ];
  const valid = sites.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return parseFloat(valid.reduce((a, b) => a + b, 0).toFixed(1));
}

function toDateStr(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/** Renders value + optional delta in a single cell */
function MetricCell({
  value,
  unit = "",
  delta,
  invert = false,
  decimals = 1,
}: {
  value: number | null;
  unit?: string;
  delta: number | null;
  invert?: boolean;
  decimals?: number;
}) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;

  let deltaEl: React.ReactNode = null;
  if (delta != null) {
    if (Math.abs(delta) < 0.05) {
      deltaEl = <span className="text-muted-foreground text-[10px]"><Minus size={9} className="inline" /></span>;
    } else {
      const isGood = invert ? delta < 0 : delta > 0;
      const color = isGood ? "text-green-400" : "text-red-400";
      const Icon = delta > 0 ? ArrowUp : ArrowDown;
      deltaEl = (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
          <Icon size={9} />
          {Math.abs(delta).toFixed(decimals)}{unit}
        </span>
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs font-semibold tabular-nums text-foreground">
        {value.toFixed(decimals)}{unit}
      </span>
      {deltaEl}
    </div>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

function MeasurementRow({
  m,
  prev,
}: {
  m: any;
  prev: any | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const dateStr = toDateStr(m.measureDate);
  const sf = skinfoldTotal(m);
  const prevSf = prev ? skinfoldTotal(prev) : null;
  const sfDelta = sf != null && prevSf != null ? parseFloat((sf - prevSf).toFixed(1)) : null;
  const waistDelta = m.waist != null && prev?.waist != null
    ? parseFloat((m.waist - prev.waist).toFixed(1)) : null;
  const hipDelta = m.hips != null && prev?.hips != null
    ? parseFloat((m.hips - prev.hips).toFixed(1)) : null;

  const umbAvg = avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]);
  const supAvg = avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]);
  const calfAvg = avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]);
  const thighAvg = avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]);
  const hasSkinfolds = umbAvg != null || supAvg != null || calfAvg != null || thighAvg != null;

  return (
    <>
      {/* Main summary row */}
      <tr
        className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Date */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {expanded
              ? <ChevronUp size={12} className="text-muted-foreground flex-shrink-0" />
              : <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-foreground">{fmtDate(dateStr)}</span>
          </div>
        </td>

        {/* Waist (value + delta) */}
        <td className="px-3 py-2.5 text-right">
          <MetricCell value={m.waist} unit=" cm" delta={waistDelta} invert decimals={1} />
        </td>

        {/* Hip (value + delta) */}
        <td className="px-3 py-2.5 text-right">
          <MetricCell value={m.hips} unit=" cm" delta={hipDelta} invert decimals={1} />
        </td>

        {/* Skinfold total (value + delta) */}
        <td className="px-3 py-2.5 text-right">
          <MetricCell value={sf} unit=" mm" delta={sfDelta} invert decimals={1} />
        </td>

        {/* Notes */}
        <td className="px-3 py-2.5 max-w-[160px]">
          {m.notes && (
            <p className="text-xs text-muted-foreground truncate">{m.notes}</p>
          )}
        </td>
      </tr>

      {/* Expanded skinfold detail */}
      {expanded && (
        <tr className="border-b border-border/40 bg-muted/10">
          <td colSpan={5} className="px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {hasSkinfolds && (
                <>
                  {umbAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Umbilical</p>
                      <p className="text-sm font-semibold">{fmt(umbAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]
                          .filter((v: any) => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {supAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suprailiac</p>
                      <p className="text-sm font-semibold">{fmt(supAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]
                          .filter((v: any) => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {calfAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Calf</p>
                      <p className="text-sm font-semibold">{fmt(calfAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]
                          .filter((v: any) => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {thighAvg != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Thigh</p>
                      <p className="text-sm font-semibold">{fmt(thighAvg)} mm</p>
                      <p className="text-[10px] text-muted-foreground">
                        {[m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]
                          .filter((v: any) => v != null).map((v: any) => v.toFixed(1)).join(", ")}
                      </p>
                    </div>
                  )}
                </>
              )}
              {!hasSkinfolds && (
                <p className="text-xs text-muted-foreground col-span-4">No skinfold readings recorded.</p>
              )}
              {m.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{m.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 8;

export function WeeklyBodyCompCards({ clientId }: { clientId: number }) {
  const [showAll, setShowAll] = useState(false);

  const { data: measurements = [], isLoading: measLoading } = trpc.measurements.listForClient.useQuery(
    { userId: clientId },
    { enabled: !!clientId, staleTime: 30_000 }
  );

  const isLoading = measLoading;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  // Sort newest first
  const sorted = [...(measurements as any[])].sort((a, b) =>
    toDateStr(b.measureDate).localeCompare(toDateStr(a.measureDate))
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No measurements recorded yet</p>
        <p className="text-xs mt-1">Measurements entered by the client will appear here.</p>
      </div>
    );
  }

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[110px]">Date</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Waist</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hip</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Skinfold</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m: any, idx: number) => {
                const prev = sorted[idx + 1] ?? null;
                return (
                  <MeasurementRow
                    key={m.id}
                    m={m}
                    prev={prev}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sorted.length > DEFAULT_VISIBLE && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(v => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show less" : `Show all ${sorted.length} entries`}
          </Button>
        </div>
      )}
    </div>
  );
}
