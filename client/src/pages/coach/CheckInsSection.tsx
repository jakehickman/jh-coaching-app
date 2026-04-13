import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { ChevronDown } from "lucide-react";

// ─── Label maps ──────────────────────────────────────────────────────────────

const DIET_LABEL_MAP: Record<string, string> = {
  // Q1 & Q2 (weigh foods / meal prep accuracy)
  every_meal: "Every meal or nearly every meal",
  most_meals: "Most meals",
  some_meals: "Some meals",
  rarely: "Rarely",
  never: "Never",
  // Q3 & Q5 (extras frequency / meal timing)
  one_two_days: "On 1–2 days",
  few_days: "On a few days",
  most_days: "On most days",
  every_day: "Every day",
  // Q4 (added fats)
  light_spray: "Light spray (e.g. cooking spray)",
  small_amount: "Small amount (less than 1 tsp)",
  one_tsp_or_more: "1 tsp or more",
  no_added_fats: "No added fats when cooking",
  // Q6 (off-plan quality)
  very_close: "Very close",
  somewhat_close: "Somewhat close",
  not_very_close: "Not very close",
  very_different: "Very different",
  no_off_plan_meals: "No off-plan meals",
};

const fmtCheckInDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// ─── CheckInsSection ─────────────────────────────────────────────────────────

export default function CheckInsSection() {
  const { user: currentUser } = useAuth();
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  // Show regular clients + the current admin (for testing their own check-in flow)
  const clients = (allUsers ?? []).filter(
    (u: any) => u.role !== "admin" || u.id === currentUser?.id
  );

  // Fetch client profiles to get checkInDay for pill display
  const { data: clientProfiles = [] } = trpc.users.clients.useQuery();
  // Server-side overdue clients list
  const { data: overdueList = [] } = trpc.checkIn.overdueClients.useQuery();

  // UTC-based Monday for this week (used for unreviewed check)
  const mondayUtc = (() => {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const daysFromMonday = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
    const m = new Date(todayUtc);
    m.setUTCDate(todayUtc.getUTCDate() - daysFromMonday);
    return m;
  })();

  // Helper: is a client overdue? Uses server-side list.
  const isOverdue = (clientId: number): boolean =>
    (overdueList as any[]).some((o: any) => o.clientId === clientId);

  // Helper: does this client's pill show green today?
  // Matches the pill logic: check-in day === today AND today is on or after their start date (not in the future, not their literal start date).
  const todayDayNameLocal = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ][new Date().getDay()];
  const todayIsoLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const isCheckInToday = (clientId: number): boolean => {
    const p = (clientProfiles as any[]).find((x: any) => x.userId === clientId);
    if (!p?.checkInDay || p.checkInDay !== todayDayNameLocal) return false;
    const clientStart = p?.startDate
      ? (typeof p.startDate === "string" ? p.startDate.slice(0, 10) : new Date(p.startDate).toISOString().slice(0, 10))
      : null;
    // Exclude if start date is today (first day) or in the future
    if (!clientStart || clientStart >= todayIsoLocal) return false;
    return true;
  };

  const sortBucket = (ci: any, reviewed: boolean, id: number): number => {
    if (isOverdue(id)) return 0; // overdue = highest priority
    if (isCheckInToday(id)) return 1; // today's check-in day (green pill)
    if (!reviewed && ci) {
      const submittedUtc = new Date(
        Date.UTC(
          new Date(ci.submittedAt).getUTCFullYear(),
          new Date(ci.submittedAt).getUTCMonth(),
          new Date(ci.submittedAt).getUTCDate()
        )
      );
      if (submittedUtc >= mondayUtc) return 2; // unreviewed this week
    }
    if (!ci) return 3; // no check-ins yet
    return 4; // reviewed / complete
  };

  const sortedClients = [...clients].sort((a, b) => {
    const ciA = latestCheckIns.find((x: any) => x.clientId === a.id);
    const ciB = latestCheckIns.find((x: any) => x.clientId === b.id);
    const bA = sortBucket(ciA, !!(ciA as any)?.reviewedAt, a.id);
    const bB = sortBucket(ciB, !!(ciB as any)?.reviewedAt, b.id);
    if (bA !== bB) return bA - bB;
    const tA = ciA ? new Date((ciA as any).submittedAt).getTime() : 0;
    const tB = ciB ? new Date((ciB as any).submittedAt).getTime() : 0;
    return tB - tA;
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: clientCheckIns = [], refetch: refetchCheckIns } =
    trpc.checkIn.clientList.useQuery(
      { clientId: selectedId! },
      { enabled: !!selectedId }
    );
  const deleteCheckIn = trpc.checkIn.delete.useMutation({
    onSuccess: () => {
      toast.success("Check-in deleted");
      refetchCheckIns();
      utils.checkIn.latestPerClient.invalidate();
    },
    onError: () => toast.error("Failed to delete check-in"),
  });
  const markReviewed = trpc.checkIn.markReviewed.useMutation({
    onSuccess: () => {
      refetchCheckIns();
      utils.checkIn.latestPerClient.invalidate();
    },
    onError: () => toast.error("Failed to update status"),
  });
  const [expandedCheckIns, setExpandedCheckIns] = useState<Set<number>>(
    new Set()
  );

  // Mark as seen in localStorage when client's check-ins load
  useEffect(() => {
    if (!selectedId || clientCheckIns.length === 0) return;
    const latest = clientCheckIns.reduce((a: any, b: any) => {
      return new Date(b.submittedAt).getTime() >
        new Date(a.submittedAt).getTime()
        ? b
        : a;
    });
    const seenAt = new Date(
      (latest as any).submittedAt ?? Date.now()
    ).getTime();
    localStorage.setItem(`coach:seen:checkin:${selectedId}`, String(seenAt));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: `coach:seen:checkin:${selectedId}`,
      })
    );
  }, [selectedId, clientCheckIns]);

  const selectedClient = clients.find((c) => c.id === selectedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      {/* Left: client list */}
      <div className="space-y-1">
        {sortedClients
          .filter((c) => c.id !== undefined)
          .map((client) => {
            const ci = latestCheckIns.find(
              (x: any) => x.clientId === client.id
            );
            const isReviewed = !!(ci as any)?.reviewedAt;
            const hasCheckIn = !!ci;
            const isSelected = selectedId === client.id;
            return (
              <button
                key={client.id}
                onClick={() => setSelectedId(client.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  isSelected
                    ? "bg-primary/15 border border-primary/30"
                    : "hover:bg-secondary border border-transparent"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
                    {(client.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                  {hasCheckIn && !isReviewed && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {client.name ?? `User ${client.id}`}
                    </p>
                    {(() => {
                      const p = (clientProfiles as any[]).find(
                        (x: any) => x.userId === client.id
                      );
                      const day = p?.checkInDay as string | undefined;
                      if (!day) return null;
                      const abbr: Record<string, string> = {
                        monday: "Mon",
                        tuesday: "Tue",
                        wednesday: "Wed",
                        thursday: "Thu",
                        friday: "Fri",
                        saturday: "Sat",
                        sunday: "Sun",
                      };
                      const todayDayName = [
                        "sunday",
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                      ][new Date().getDay()];
                      const todayIsoLocal = (() => {
                        const d = new Date();
                        return `${d.getFullYear()}-${String(
                          d.getMonth() + 1
                        ).padStart(2, "0")}-${String(d.getDate()).padStart(
                          2,
                          "0"
                        )}`;
                      })();
                      const clientStart = p?.startDate
                        ? typeof p.startDate === "string"
                          ? p.startDate.slice(0, 10)
                          : new Date(p.startDate).toISOString().slice(0, 10)
                        : null;
                      const isStartDay = clientStart === todayIsoLocal;
                      const isFutureStart = !!clientStart && clientStart > todayIsoLocal;
                      const isToday = day === todayDayName && !isStartDay && !isFutureStart;
                      const overdue = isOverdue(client.id);
                      const pillClass = overdue
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : isToday
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-secondary text-muted-foreground border-border";
                      return (
                        <span
                          className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${pillClass}`}
                        >
                          {abbr[day] ?? day}
                        </span>
                      );
                    })()}
                  </div>
                  {isOverdue(client.id) ? (
                    <p className="text-xs text-amber-400 font-medium">
                      {(() => {
                        const o = (overdueList as any[]).find(
                          (x: any) => x.clientId === client.id
                        );
                        if (!o?.dueDate) return "Overdue";
                        const dateStr = new Date(o.dueDate).toLocaleDateString(
                          "en-AU",
                          { day: "numeric", month: "short" }
                        );
                        return `Overdue · ${dateStr}`;
                      })()}
                    </p>
                  ) : ci ? (
                    <p
                      className={`text-xs truncate ${
                        isReviewed
                          ? "text-muted-foreground"
                          : "text-primary"
                      }`}
                    >
                      {isReviewed ? "Complete" : "Awaiting review"} ·{" "}
                      {new Date((ci as any).submittedAt).toLocaleDateString(
                        "en-AU",
                        { day: "numeric", month: "short" }
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No check-ins yet
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        {sortedClients.length === 0 && (
          <p className="text-sm text-muted-foreground px-3 py-4">
            No clients yet.
          </p>
        )}
      </div>

      {/* Right: check-in history */}
      {selectedId ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">
              {selectedClient?.name ?? `User ${selectedId}`}
            </h2>
            <span className="text-xs text-muted-foreground">
              {clientCheckIns.length} check-in
              {clientCheckIns.length !== 1 ? "s" : ""}
            </span>
          </div>
          {clientCheckIns.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No check-ins submitted yet
            </div>
          ) : (
            clientCheckIns.map((ci: any) => {
              const isExpanded = expandedCheckIns.has(ci.id);
              const isReviewed = !!ci.reviewedAt;
              return (
                <div
                  key={ci.id}
                  className={`border rounded-xl overflow-hidden bg-card transition-colors ${
                    isReviewed
                      ? "border-border/50 opacity-80"
                      : "border-border"
                  }`}
                >
                  {/* Header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                    onClick={() =>
                      setExpandedCheckIns((prev) => {
                        const next = new Set(prev);
                        if (next.has(ci.id)) next.delete(ci.id);
                        else next.add(ci.id);
                        return next;
                      })
                    }
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        Week of{" "}
                        {fmtCheckInDate(toLocalDateStr(ci.weekStartDate))}
                      </span>
                      {isReviewed && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-green-500/15 text-green-400">
                          Complete
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(ci.submittedAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* All Q&A rows in a single table */}
                      {(() => {
                        const rows = [
                          { label: "Food weighing", q: "How often did you weigh all foods raw/uncooked with a digital scale?", val: ci.dietWeighedFoods },
                          { label: "Meal prep accuracy", q: "How often did you prepare meals exactly as written in your plan?", val: ci.dietMealPrepAccuracy },
                          { label: "Off-plan eating", q: "Excluding off-plan meals, how often did you eat/drink anything not in your plan?", val: ci.dietExtrasFrequency },
                          { label: "Added fats", q: "When cooking, how do you use added fats (oil, butter)?", val: ci.dietAddedFats },
                          { label: "Meal timing", q: "How often did you eat meals more than 2 hours off schedule?", val: ci.dietMealTiming },
                          { label: "Off-plan quality", q: "When you had an off-plan meal, how close was it to your plan?", val: ci.dietOffPlanQuality },
                          { label: "Bedtime consistency", q: "How often did you go to bed more than 1 hour later than your planned bedtime?", val: (ci as any).sleepBedtimeConsistency },
                        ].filter((r) => r.val);
                        if (rows.length === 0) return null;
                        return (
                          <div className="px-4 pt-3 pb-1">
                            <table className="w-full">
                              <tbody>
                                {rows.map((row, i) => (
                                  <tr key={row.label} className={i < rows.length - 1 ? "border-b border-border/40" : ""}>
                                    <td className="py-2.5 pr-4 align-top w-[38%]">
                                      <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                                    </td>
                                    <td className="py-2.5 align-top">
                                      <span className="text-sm text-foreground">{DIET_LABEL_MAP[row.val!] ?? row.val}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between gap-2">
                        <button
                          onClick={() =>
                            markReviewed.mutate({
                              id: ci.id,
                              reviewed: !isReviewed,
                            })
                          }
                          disabled={markReviewed.isPending}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                            isReviewed
                              ? "border-border text-muted-foreground hover:text-foreground"
                              : "border-green-500/40 text-green-400 hover:bg-green-500/10"
                          }`}
                        >
                          {isReviewed ? "Mark as Incomplete" : "Mark as Complete"}
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Delete this check-in? This cannot be undone."
                              )
                            ) {
                              deleteCheckIn.mutate({ id: ci.id });
                            }
                          }}
                          disabled={deleteCheckIn.isPending}
                          className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Select a client to view their check-ins
        </div>
      )}
    </div>
  );
}
