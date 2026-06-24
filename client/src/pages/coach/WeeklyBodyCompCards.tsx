import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";

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

function toDateStr(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

// Site definitions — order determines column order
const SITES = [
  { key: "umbilical", label: "Umbilical", fields: ["umbilical1","umbilical2","umbilical3","umbilical4","umbilical5"] as const },
  { key: "suprailiac", label: "Suprailiac", fields: ["suprailiac1","suprailiac2","suprailiac3","suprailiac4","suprailiac5"] as const },
  { key: "calf",       label: "Calf",       fields: ["calf1","calf2","calf3","calf4","calf5"] as const },
  { key: "thigh",      label: "Thigh",      fields: ["thigh1","thigh2","thigh3","thigh4","thigh5"] as const },
] as const;

function siteAvg(m: any, fields: readonly string[]): number | null {
  return avg(fields.map(f => m[f] as number | null));
}

function skinfoldTotal(m: any): number | null {
  const vals = SITES.map(s => siteAvg(m, s.fields)).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return parseFloat(vals.reduce((a, b) => a + b, 0).toFixed(1));
}

// ─── Main export ─────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 8;

export function WeeklyBodyCompCards({ clientId }: { clientId: number }) {
  const [showAll, setShowAll] = useState(false);

  const { data: measurements = [], isLoading } = trpc.measurements.listForClient.useQuery(
    { userId: clientId },
    { enabled: !!clientId, staleTime: 30_000 }
  );

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

  // Determine which skinfold sites have any data across all measurements
  const activeSites = SITES.filter(s =>
    sorted.some(m => siteAvg(m, s.fields) != null)
  );

  const hasWaist = sorted.some(m => m.waist != null);
  const hasHip   = sorted.some(m => m.hips != null);
  const hasSf    = activeSites.length > 0;
  const hasNotes = sorted.some(m => m.notes);

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="space-y-3">
      <SectionLabel>Measurement History</SectionLabel>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Date</th>
                {hasWaist && <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Waist</th>}
                {hasHip   && <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Hip</th>}
                {activeSites.map(s => (
                  <th key={s.key} className="text-right px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: "rgba(236,237,238,0.35)" }}>{s.label}</th>
                ))}
                {hasSf && <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Total</th>}
                {hasNotes && <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((m: any) => {
                const sf = skinfoldTotal(m);
                return (
                  <tr key={m.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs font-semibold text-foreground">{fmtDate(toDateStr(m.measureDate))}</span>
                    </td>
                    {hasWaist && (
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs tabular-nums text-foreground">{m.waist != null ? `${fmt(m.waist)} cm` : "—"}</span>
                      </td>
                    )}
                    {hasHip && (
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs tabular-nums text-foreground">{m.hips != null ? `${fmt(m.hips)} cm` : "—"}</span>
                      </td>
                    )}
                    {activeSites.map(s => {
                      const val = siteAvg(m, s.fields);
                      return (
                        <td key={s.key} className="px-3 py-2.5 text-right">
                          <span className="text-xs tabular-nums" style={{ color: "rgba(236,237,238,0.45)" }}>{val != null ? `${fmt(val)} mm` : "—"}</span>
                        </td>
                      );
                    })}
                    {hasSf && (
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs font-semibold tabular-nums text-foreground">{sf != null ? `${fmt(sf)} mm` : "—"}</span>
                      </td>
                    )}
                    {hasNotes && (
                      <td className="px-3 py-2.5 max-w-[180px]">
                        {m.notes && <p className="text-xs text-muted-foreground truncate">{m.notes}</p>}
                      </td>
                    )}
                  </tr>
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
