/**
 * Shared primitives used across CoachPanel section files.
 * Keep this file small — only truly shared, stateless helpers belong here.
 */
import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react";
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
}: {
  clients: { id: number; name?: string | null }[];
  selectedUserId: number | null;
  onSelect: (id: number) => void;
  latestCheckIns?: { clientId: number; submittedAt: Date | string }[];
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
