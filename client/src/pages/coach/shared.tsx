/**
 * Shared primitives used across CoachPanel section files.
 * Keep this file small — only truly shared, stateless helpers belong here.
 */
import React, { useEffect, useState } from "react";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { trpc } from "@/lib/trpc";
import { Check, ChevronsUpDown, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ─── Primitive UI helpers ────────────────────────────────────────────────────

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </p>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}

// ─── Client selector hook ────────────────────────────────────────────────────

export function useClientSelector() {
  const { data: allUsers } = trpc.users.list.useQuery();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const clients = allUsers ?? [];
  useEffect(() => {
    if (clients.length > 0 && !selectedUserId) {
      setSelectedUserId(clients[0].id);
    }
  }, [clients]);
  return { clients, selectedUserId, setSelectedUserId };
}

// ─── Searchable Client Combobox ──────────────────────────────────────────────

export function ClientCombobox({
  clients,
  selectedUserId,
  onSelect,
  latestCheckIns = [],
  draftUserIds,
}: {
  clients: { id: number; name?: string | null }[];
  selectedUserId: number | null;
  onSelect: (id: number) => void;
  latestCheckIns?: { clientId: number; submittedAt: Date | string }[];
  draftUserIds?: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [seenKeys, setSeenKeys] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("coach:seen:checkin:")) {
        const id = parseInt(k.replace("coach:seen:checkin:", ""), 10);
        out[id] = parseInt(localStorage.getItem(k) ?? "0", 10);
      }
    }
    return out;
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith("coach:seen:checkin:")) {
        const id = parseInt(e.key.replace("coach:seen:checkin:", ""), 10);
        setSeenKeys((prev) => ({
          ...prev,
          [id]: parseInt(e.newValue ?? "0", 10),
        }));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const selected = clients.find((c) => c.id === selectedUserId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-xs justify-between bg-card border-border text-foreground hover:bg-secondary"
        >
          <span className="truncate">
            {selected
              ? selected.name ?? `User ${selected.id}`
              : "Select client…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {clients.map((c) => {
                const ci = latestCheckIns.find((x) => x.clientId === c.id);
                const ciTime = ci ? new Date(ci.submittedAt).getTime() : 0;
                const seenTime = seenKeys[c.id] ?? 0;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _hasRecentCheckIn =
                  ci &&
                  Math.floor((Date.now() - ciTime) / 86400000) <= 7 &&
                  ciTime > seenTime;
                return (
                  <CommandItem
                    key={c.id}
                    value={c.name ?? `User ${c.id}`}
                    onSelect={() => {
                      onSelect(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedUserId === c.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <span className="flex items-center gap-1.5">
                      {c.name ?? `User ${c.id}`}
                      {draftUserIds?.has(c.id) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── MeasurementsCard ────────────────────────────────────────────────────────

export function MeasurementsCard({
  latestM,
  prevM,
  latestSkinfold,
  prevSkinfold,
  skinfoldDiff,
  waistDiff,
  toLocalDateStr: toDateStr,
}: {
  latestM: Record<string, unknown>;
  prevM: Record<string, unknown> | null;
  latestSkinfold: number | null;
  prevSkinfold: number | null;
  skinfoldDiff: number | null;
  waistDiff: number | null;
  toLocalDateStr: (d: unknown) => string;
}) {
  const [showMeasureDetail, setShowMeasureDetail] = useState(false);
  const latestDate = toDateStr(latestM.measureDate).split("-").reverse().join("/");
  const prevDate = prevM
    ? toDateStr(prevM.measureDate).split("-").reverse().join("/")
    : null;

  function siteAvg(vals: (number | null | undefined)[]): number | null {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length
      ? parseFloat(
          (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
        )
      : null;
  }

  const umbAvg = siteAvg([
    latestM.umbilical1 as number,
    latestM.umbilical2 as number,
    latestM.umbilical3 as number,
    latestM.umbilical4 as number,
    latestM.umbilical5 as number,
  ]);
  const supAvg = siteAvg([
    latestM.suprailiac1 as number,
    latestM.suprailiac2 as number,
    latestM.suprailiac3 as number,
    latestM.suprailiac4 as number,
    latestM.suprailiac5 as number,
  ]);
  const calfAvg = siteAvg([
    latestM.calf1 as number,
    latestM.calf2 as number,
    latestM.calf3 as number,
    latestM.calf4 as number,
    latestM.calf5 as number,
  ]);
  const thighAvg = siteAvg([
    latestM.thigh1 as number,
    latestM.thigh2 as number,
    latestM.thigh3 as number,
    latestM.thigh4 as number,
    latestM.thigh5 as number,
  ]);

  return (
    <div>
      <SectionLabel>Measurements</SectionLabel>
      <Card className="space-y-0 p-0 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Waist Circumference
            </p>
            <p className="text-xs text-muted-foreground mb-1">{latestDate}</p>
            {latestM.waist != null ? (
              <p className="text-2xl font-bold text-foreground">
                {latestM.waist as number}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  cm
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">&mdash;</p>
            )}
            {waistDiff != null && prevDate && (
              <p
                className={`text-xs font-semibold mt-1 ${
                  waistDiff < 0
                    ? "text-green-400"
                    : waistDiff > 0
                    ? "text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                {waistDiff > 0 ? "+" : ""}
                {waistDiff} cm vs {prevDate}
              </p>
            )}
          </div>
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Skinfold Total
            </p>
            <p className="text-xs text-muted-foreground mb-1">{latestDate}</p>
            {latestSkinfold != null ? (
              <p className="text-2xl font-bold text-foreground">
                {latestSkinfold}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  mm
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">&mdash;</p>
            )}
            {skinfoldDiff != null && prevDate && (
              <p
                className={`text-xs font-semibold mt-1 ${
                  skinfoldDiff < 0
                    ? "text-green-400"
                    : skinfoldDiff > 0
                    ? "text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                {skinfoldDiff > 0 ? "+" : ""}
                {skinfoldDiff} mm vs {prevDate}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowMeasureDetail((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-muted/20 transition-colors"
        >
          {showMeasureDetail ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {showMeasureDetail ? "Hide details" : "View site details"}
        </button>
        {showMeasureDetail && (
          <div className="border-t border-border bg-muted/10 p-4">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { label: "Umbilical avg", value: umbAvg },
                  { label: "Suprailiac avg", value: supAvg },
                  { label: "Calf avg", value: calfAvg },
                  { label: "Thigh avg", value: thighAvg },
                ] as { label: string; value: number | null }[]
              ).map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-card rounded-lg p-3 border border-border"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {value != null ? (
                      <>
                        {value}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          mm
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── DailyLogRow type ────────────────────────────────────────────────────────
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

// ─── MuscleGroupSection ──────────────────────────────────────────────────────
export function MuscleGroupSection({ group, children, globalToggle }: { group: string; children: React.ReactNode; globalToggle?: { expanded: boolean; gen: number } | null }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [lastGen, setLastGen] = useState(0);
  useEffect(() => {
    if (globalToggle && globalToggle.gen !== lastGen) {
      setLocalOpen(globalToggle.expanded);
      setLastGen(globalToggle.gen);
    }
  }, [globalToggle, lastGen]);
  const open = localOpen;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setLocalOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3 bg-card">{children}</div>}
    </div>
  );
}

// ─── ProgressHistoryTable ────────────────────────────────────────────────────
export function ProgressHistoryTable({
  logs,
  measurements,
  startDate,
}: {
  logs: DailyLogRow[];
  measurements: any[];
  startDate?: string | null;
}) {
  function siteAvg(vals: (number | null | undefined)[]): number | null {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
  }

  // ── Build weight and measurement maps ──────────────────────────────────────
  const weightByDate: Record<string, number> = {};
  for (const log of logs) {
    const iso = toLocalDateStr(log.logDate);
    if (!iso || log.weight == null) continue;
    if (startDate && iso < startDate) continue;
    weightByDate[iso] = log.weight as number;
  }

  const measByDate: Record<string, any> = {};
  for (const m of measurements) {
    const iso = toLocalDateStr(m.measureDate);
    if (!iso) continue;
    if (startDate && iso < startDate) continue;
    measByDate[iso] = m;
  }

  // ── Determine date range ────────────────────────────────────────────────────
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const allDates = [...Object.keys(weightByDate), ...Object.keys(measByDate)].sort();
  if (allDates.length === 0) return null;
  const firstDate = startDate && startDate <= allDates[0] ? startDate : allDates[0];

  // Generate every calendar day
  const days: string[] = [];
  const cursor = new Date(firstDate + "T00:00:00");
  const end = new Date(todayIso + "T00:00:00");
  while (cursor <= end) {
    days.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  // ── Group into Mon-Sun weeks ────────────────────────────────────────────────
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  for (const iso of days) {
    const dow = new Date(iso + "T00:00:00").getDay();
    if (dow === 1 && currentWeek.length > 0) { weeks.push(currentWeek); currentWeek = []; }
    currentWeek.push(iso);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // ── Compute per-week stats ──────────────────────────────────────────────────
  function weekAvg(wkDays: string[]): number | null {
    const ws = wkDays.map(d => weightByDate[d]).filter((v): v is number => v != null);
    return ws.length ? parseFloat((ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(2)) : null;
  }
  function weekEntries(wkDays: string[]): number {
    return wkDays.filter(d => weightByDate[d] != null).length;
  }
  // Best measurement in the week (prefer most recent)
  function weekMeas(wkDays: string[]): any | null {
    for (let i = wkDays.length - 1; i >= 0; i--) {
      if (measByDate[wkDays[i]]) return measByDate[wkDays[i]];
    }
    return null;
  }
  function fmtWeekLabel(wkDays: string[]): string {
    const fmt = (iso: string) => {
      const [, m, d] = iso.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${parseInt(d)} ${months[parseInt(m)-1]}`;
    };
    return `${fmt(wkDays[0])} – ${fmt(wkDays[wkDays.length-1])}`;
  }

  // Build rows oldest→newest for chart, newest→oldest for table display
  type WeekRow = {
    label: string;
    avg: number | null;
    entries: number;
    waist: number | null;
    skinfold: number | null;
    pctChange: number | null; // % vs previous week
  };
  const weekRows: WeekRow[] = weeks.map((wkDays, i) => {
    const avg = weekAvg(wkDays);
    const prevAvg = i > 0 ? weekAvg(weeks[i - 1]) : null;
    const pctChange = avg != null && prevAvg != null && prevAvg !== 0
      ? parseFloat(((avg - prevAvg) / prevAvg * 100).toFixed(2))
      : null;
    const m = weekMeas(wkDays);
    const umbAvg = m ? siteAvg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]) : null;
    const supAvg = m ? siteAvg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]) : null;
    const calfAvg = m ? siteAvg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]) : null;
    const thighAvg = m ? siteAvg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]) : null;
    const skinfoldSites = [umbAvg, supAvg, calfAvg, thighAvg].filter(v => v != null) as number[];
    const skinfold = skinfoldSites.length > 0 ? parseFloat(skinfoldSites.reduce((a, b) => a + b, 0).toFixed(1)) : null;
    return {
      label: fmtWeekLabel(wkDays),
      avg,
      entries: weekEntries(wkDays),
      waist: m?.waist ?? null,
      skinfold,
      pctChange,
    };
  });

  if (weekRows.length === 0) return null;

  // Chart data: oldest first
  const chartData = weekRows.map(r => ({
    week: r.label,
    weight: r.avg,
    skinfold: r.skinfold,
  }));

  // Table rows: newest first
  const tableRows = [...weekRows].reverse();

  const INITIAL_WEEKS = 4;
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const visibleRows = showAllWeeks ? tableRows : tableRows.slice(0, INITIAL_WEEKS);

  return (
    <div>
      <SectionLabel>Body Composition History</SectionLabel>
      <div className="space-y-3">
        {visibleRows.map((row, i) => {
          const isFirst = i === 0;
          const pctDown = row.pctChange != null && row.pctChange < 0;
          const pctUp = row.pctChange != null && row.pctChange > 0;
          const pctColor = row.pctChange == null ? 'text-muted-foreground' : pctDown ? 'text-green-400' : pctUp ? 'text-red-400' : 'text-muted-foreground';
          const pctBg = row.pctChange == null ? 'bg-secondary' : pctDown ? 'bg-green-500/15' : pctUp ? 'bg-red-500/15' : 'bg-secondary';
          const pctLabel = row.pctChange != null ? `${row.pctChange > 0 ? '+' : ''}${row.pctChange}%` : null;
          return (
            <div
              key={i}
              className={`rounded-xl border transition-colors ${
                isFirst ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              {/* Week header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  {isFirst && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold uppercase tracking-wide">Latest</span>}
                  <p className={`text-sm font-semibold ${isFirst ? 'text-foreground' : 'text-muted-foreground'}`}>{row.label}</p>
                </div>
                <div className="flex items-center gap-2">
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-px bg-border mx-4 mb-3 rounded-lg overflow-hidden">
                <div className="bg-card px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Avg Weight</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-base font-bold ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                      {row.avg != null ? `${row.avg} kg` : <span className="text-muted-foreground text-sm">—</span>}
                    </p>
                    {pctLabel && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${pctColor} ${pctBg}`}>
                        {pctDown ? <ArrowDown size={9} /> : pctUp ? <ArrowUp size={9} /> : <Minus size={9} />}
                        {pctLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Waist Circumference</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-base font-bold ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                      {row.waist != null ? `${row.waist} cm` : <span className="text-muted-foreground text-sm">—</span>}
                    </p>
                    {(() => {
                      const prev = tableRows[i + 1]?.waist;
                      if (row.waist == null || prev == null) return null;
                      const diff = parseFloat((row.waist - prev).toFixed(1));
                      if (diff === 0) return null;
                      const isDown = diff < 0;
                      return (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                          isDown ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isDown ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
                          {diff > 0 ? '+' : ''}{diff} cm
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Skinfold Thickness</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-base font-bold ${isFirst ? 'text-foreground' : 'text-foreground/80'}`}>
                      {row.skinfold != null ? `${row.skinfold} mm` : <span className="text-muted-foreground text-sm">—</span>}
                    </p>
                    {(() => {
                      const prev = tableRows[i + 1]?.skinfold;
                      if (row.skinfold == null || prev == null) return null;
                      const diff = parseFloat((row.skinfold - prev).toFixed(1));
                      if (diff === 0) return null;
                      const isDown = diff < 0;
                      return (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                          isDown ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isDown ? <ArrowDown size={9} /> : <ArrowUp size={9} />}
                          {diff > 0 ? '+' : ''}{diff} mm
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {tableRows.length > INITIAL_WEEKS && (
        <button
          onClick={() => setShowAllWeeks(v => !v)}
          className="mt-3 text-xs text-primary hover:underline w-full text-center"
        >
          {showAllWeeks ? `Show less` : `View ${tableRows.length - INITIAL_WEEKS} more week${tableRows.length - INITIAL_WEEKS !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

