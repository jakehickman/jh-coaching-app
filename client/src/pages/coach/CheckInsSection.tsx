import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { ChevronDown, SkipForward } from "lucide-react";

// ─── Label maps ──────────────────────────────────────────────────────────────

const DIET_LABEL_MAP: Record<string, string> = {
  every_meal: "Every meal or nearly every meal",
  most_meals: "Most meals",
  some_meals: "Some meals",
  rarely: "Rarely",
  never: "Never",
  one_two_days: "On 1–2 days",
  few_days: "On a few days",
  most_days: "On most days",
  every_day: "Every day",
  light_spray: "Light spray (e.g. cooking spray)",
  small_amount: "Small amount (less than 1 tsp)",
  one_tsp_or_more: "1 tsp or more",
  no_added_fats: "No added fats when cooking",
  very_close: "Very close",
  somewhat_close: "Somewhat close",
  not_very_close: "Not very close",
  very_different: "Very different",
  no_off_plan_meals: "No off-plan meals",
};

const fmtCheckInDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};

type CheckInStatus = "upcoming" | "open" | "due_today" | "overdue" | "missed" | "skipped" | "completed" | "completed_late";

function StatusBadge({ status, scheduledDate }: { status: CheckInStatus; scheduledDate?: string | null }) {
  const cfg: Record<CheckInStatus, { label: string; className: string }> = {
    upcoming:       { label: scheduledDate ? `Upcoming · ${fmtCheckInDate(scheduledDate)}` : "Upcoming", className: "bg-secondary text-muted-foreground border-border" },
    open:           { label: "Open",       className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    due_today:      { label: "Due Today",  className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    overdue:        { label: scheduledDate ? `Overdue · ${fmtCheckInDate(scheduledDate)}` : "Overdue", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    missed:         { label: scheduledDate ? `Missed · ${fmtCheckInDate(scheduledDate)}` : "Missed", className: "bg-red-500/15 text-red-400 border-red-500/30" },
    skipped:        { label: "Skipped",   className: "bg-secondary text-muted-foreground border-border" },
    completed:      { label: "Submitted", className: "bg-green-500/15 text-green-400 border-green-500/30" },
    completed_late: { label: "Submitted (late)", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  };
  const { label, className } = cfg[status] ?? cfg.upcoming;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${className}`}>
      {label}
    </span>
  );
}

// ─── CheckInsDetailPanel ─────────────────────────────────────────────────────
// Reusable detail panel for a single client's check-in history.
// Used both in the standalone CheckInsSection and as a sub-tab in ProgressSection.

export function CheckInsDetailPanel({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const [expandedCheckIns, setExpandedCheckIns] = useState<Set<number>>(new Set());

  const { data: clientCheckIns = [], refetch: refetchCheckIns } =
    trpc.checkIn.clientList.useQuery({ clientId }, { enabled: !!clientId });

  const { data: clientOccurrences = [] } =
    trpc.checkIn.clientOccurrences.useQuery({ clientId }, { enabled: !!clientId });

  const deleteCheckIn = trpc.checkIn.delete.useMutation({
    onSuccess: () => {
      toast.success("Check-in deleted");
      refetchCheckIns();
      utils.checkIn.latestPerClient.invalidate();
      utils.checkIn.clientStatusList.invalidate();
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

  const skipWeek = trpc.checkIn.skipWeek.useMutation({
    onSuccess: () => {
      toast.success("Week skipped");
      utils.checkIn.clientStatusList.invalidate();
      utils.checkIn.clientOccurrences.invalidate();
    },
    onError: () => toast.error("Failed to skip week"),
  });

  const unskipWeek = trpc.checkIn.unskipWeek.useMutation({
    onSuccess: () => {
      toast.success("Skip removed");
      utils.checkIn.clientStatusList.invalidate();
      utils.checkIn.clientOccurrences.invalidate();
    },
    onError: () => toast.error("Failed to remove skip"),
  });

  // Mark as seen in localStorage when check-ins load
  useEffect(() => {
    if (!clientId || clientCheckIns.length === 0) return;
    const latest = clientCheckIns.reduce((a: any, b: any) =>
      new Date(b.submittedAt).getTime() > new Date(a.submittedAt).getTime() ? b : a
    );
    const seenAt = new Date((latest as any).submittedAt ?? Date.now()).getTime();
    localStorage.setItem(`coach:seen:checkin:${clientId}`, String(seenAt));
    window.dispatchEvent(new StorageEvent("storage", { key: `coach:seen:checkin:${clientId}` }));
  }, [clientId, clientCheckIns]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {clientCheckIns.length} check-in{clientCheckIns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Upcoming / open occurrence banner */}
      {(() => {
        const upcoming = (clientOccurrences as any[]).find(
          (o: any) => o.status === "upcoming" || o.status === "open" || o.status === "due_today"
        );
        if (!upcoming) return null;
        return (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs ${
            upcoming.status === "due_today"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : upcoming.status === "open"
              ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
              : "bg-secondary border-border text-muted-foreground"
          }`}>
            <span>
              {upcoming.status === "due_today" ? "Due today" : upcoming.status === "open" ? "Open" : "Upcoming"} · Week of {fmtCheckInDate(upcoming.scheduledDate)}
            </span>
            {(upcoming.status === "open" || upcoming.status === "due_today") && (
              <button
                onClick={() => skipWeek.mutate({ clientId, weekStartDate: upcoming.scheduledDate })}
                disabled={skipWeek.isPending}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border transition-colors disabled:opacity-50"
              >
                <SkipForward size={9} /> Skip
              </button>
            )}
          </div>
        );
      })()}

      {clientCheckIns.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No check-ins submitted yet
        </div>
      ) : (
        clientCheckIns.map((ci: any) => {
          const isExpanded = expandedCheckIns.has(ci.id);
          const isReviewed = !!ci.reviewedAt;
          const wsd = typeof ci.weekStartDate === "string"
            ? ci.weekStartDate.slice(0, 10)
            : new Date(ci.weekStartDate).toISOString().slice(0, 10);
          const occurrence = (clientOccurrences as any[]).find((o: any) => o.scheduledDate === wsd);
          const occStatus: CheckInStatus = occurrence?.status ?? "completed";

          return (
            <div
              key={ci.id}
              className={`border rounded-xl overflow-hidden bg-card transition-colors ${
                isReviewed ? "border-border/50 opacity-80" : "border-border"
              }`}
            >
              {/* Header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                onClick={() =>
                  setExpandedCheckIns(prev => {
                    const next = new Set(prev);
                    if (next.has(ci.id)) next.delete(ci.id);
                    else next.add(ci.id);
                    return next;
                  })
                }
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">
                    Week of {fmtCheckInDate(toLocalDateStr(ci.weekStartDate))}
                  </span>
                  <StatusBadge status={occStatus} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(ci.submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Full Q&A grouped by section */}
                  {(() => {
                    const BARRIER_LABEL: Record<string, string> = {
                      no_issues: "No issues", hunger: "Hunger", cravings: "Cravings",
                      social_events: "Social events", busy_time: "Busy / time constraints",
                      poor_planning: "Poor planning", low_motivation: "Low motivation",
                      travel_disruption: "Travel / disruption", other: "Other",
                    };
                    const ASSESSMENT_LABEL: Record<string, string> = {
                      executed_exactly: "Executed exactly as planned",
                      mostly_followed: "Mostly followed",
                      inconsistent: "Inconsistent",
                      didnt_follow: "Didn't follow the plan",
                    };
                    const sections = [
                      {
                        title: "Diet Execution",
                        rows: [
                          { q: "How often did you weigh all foods raw/uncooked with a digital scale?", val: ci.dietWeighedFoods },
                          { q: "How often did you prepare meals exactly as written in your plan?", val: ci.dietMealPrepAccuracy },
                          { q: "Excluding off-plan meals, how often did you eat/drink anything not in your plan?", val: ci.dietExtrasFrequency },
                          { q: "When cooking, how do you use added fats (oil, butter)?", val: ci.dietAddedFats },
                          { q: "How often did you eat meals more than 2 hours off schedule?", val: ci.dietMealTiming },
                          { q: "When you had an off-plan meal, how close was it to your plan in calories/macros?", val: ci.dietOffPlanQuality },
                        ].filter(r => r.val),
                      },
                      {
                        title: "Sleep",
                        rows: [
                          { q: "How often did you go to bed more than 1 hour later than your planned bedtime?", val: (ci as any).sleepBedtimeConsistency },
                        ].filter(r => r.val),
                      },
                      {
                        title: "Adherence Barrier",
                        rows: [
                          { q: "What was your biggest barrier to adherence this week?", val: ci.adherenceBarrier ? (BARRIER_LABEL[ci.adherenceBarrier] ?? ci.adherenceBarrier) : null, raw: true },
                          ...(ci.barrierExplain ? [{ q: "Can you explain further?", val: ci.barrierExplain, raw: true }] : []),
                        ].filter(r => r.val),
                      },
                      {
                        title: "Weekly Self-Assessment",
                        rows: [
                          { q: "Overall, how well did you follow your plan this week?", val: ci.weeklyAssessment ? (ASSESSMENT_LABEL[ci.weeklyAssessment] ?? ci.weeklyAssessment) : null, raw: true },
                        ].filter(r => r.val),
                      },
                    ].filter(s => s.rows.length > 0);

                    if (sections.length === 0) return null;
                    return (
                      <div className="px-4 pt-3 pb-1 space-y-4">
                        {sections.map(section => (
                          <div key={section.title}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section.title}</p>
                            <div className="space-y-3">
                              {section.rows.map((row, i) => (
                                <div key={i} className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">{row.q}</p>
                                  <p className="text-sm text-foreground font-medium">
                                    {(row as any).raw ? row.val : (DIET_LABEL_MAP[(row.val as string)!] ?? row.val)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => markReviewed.mutate({ id: ci.id, reviewed: !isReviewed })}
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
                        if (confirm("Delete this check-in? This cannot be undone.")) {
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

      {/* Skipped occurrences */}
      {(() => {
        const skipped = (clientOccurrences as any[]).filter((o: any) => o.status === "skipped");
        if (skipped.length === 0) return null;
        return (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Skipped Weeks</p>
            {skipped.map((o: any) => (
              <div key={o.scheduledDate} className="flex items-center justify-between px-4 py-2 rounded-xl border border-border/50 bg-secondary/30 text-xs text-muted-foreground">
                <span>Week of {fmtCheckInDate(o.scheduledDate)}</span>
                <button
                  onClick={() => unskipWeek.mutate({ clientId, weekStartDate: o.scheduledDate })}
                  disabled={unskipWeek.isPending}
                  className="text-[10px] hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Undo skip
                </button>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── CheckInsSection (standalone coach sidebar section) ──────────────────────
// Keeps the two-column client-list + detail layout for the standalone page.

export default function CheckInsSection() {
  const { user: currentUser } = useAuth();
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const clients = (allUsers ?? []).filter(
    (u: any) => u.role !== "admin" || u.id === currentUser?.id
  );

  const { data: clientProfiles = [] } = trpc.users.clients.useQuery();
  const { data: statusList = [] } = trpc.checkIn.clientStatusList.useQuery();

  const utils = trpc.useUtils();

  const getClientStatus = (clientId: number): { status: CheckInStatus; scheduledDate: string | null } => {
    const entry = (statusList as any[]).find((s: any) => s.clientId === clientId);
    return { status: entry?.status ?? "upcoming", scheduledDate: entry?.scheduledDate ?? null };
  };

  const mondayUtc = (() => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const daysFromMonday = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
    const m = new Date(todayUtc);
    m.setUTCDate(todayUtc.getUTCDate() - daysFromMonday);
    return m;
  })();

  const sortBucket = (clientId: number, ci: any, reviewed: boolean): number => {
    const { status } = getClientStatus(clientId);
    if (status === "overdue" || status === "due_today") return 0;
    if (status === "open") return 1;
    if (!reviewed && ci) {
      const submittedUtc = new Date(Date.UTC(
        new Date(ci.submittedAt).getUTCFullYear(),
        new Date(ci.submittedAt).getUTCMonth(),
        new Date(ci.submittedAt).getUTCDate()
      ));
      if (submittedUtc >= mondayUtc) return 2;
    }
    if (status === "missed") return 3;
    if (!ci) return 4;
    return 5;
  };

  const sortedClients = [...clients].sort((a, b) => {
    const ciA = latestCheckIns.find((x: any) => x.clientId === a.id);
    const ciB = latestCheckIns.find((x: any) => x.clientId === b.id);
    const bA = sortBucket(a.id, ciA, !!(ciA as any)?.reviewedAt);
    const bB = sortBucket(b.id, ciB, !!(ciB as any)?.reviewedAt);
    if (bA !== bB) return bA - bB;
    const tA = ciA ? new Date((ciA as any).submittedAt).getTime() : 0;
    const tB = ciB ? new Date((ciB as any).submittedAt).getTime() : 0;
    return tB - tA;
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const skipWeek = trpc.checkIn.skipWeek.useMutation({
    onSuccess: () => {
      toast.success("Week skipped");
      utils.checkIn.clientStatusList.invalidate();
      utils.checkIn.clientOccurrences.invalidate();
    },
    onError: () => toast.error("Failed to skip week"),
  });

  const selectedClient = clients.find((c) => c.id === selectedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      {/* Left: client list */}
      <div className="space-y-1">
        {sortedClients.filter((c) => c.id !== undefined).map((client) => {
          const ci = latestCheckIns.find((x: any) => x.clientId === client.id);
          const isReviewed = !!(ci as any)?.reviewedAt;
          const hasCheckIn = !!ci;
          const isSelected = selectedId === client.id;
          const { status, scheduledDate } = getClientStatus(client.id);

          const p = (clientProfiles as any[]).find((x: any) => x.userId === client.id);
          const day = p?.checkInDay as string | undefined;
          const abbr: Record<string, string> = {
            monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
            friday: "Fri", saturday: "Sat", sunday: "Sun",
          };

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
                  {day && (
                    <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      status === "overdue" || status === "due_today"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : status === "open"
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {abbr[day] ?? day}
                    </span>
                  )}
                </div>
                {status === "overdue" || status === "due_today" ? (
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-amber-400 font-medium">
                      {status === "due_today" ? "Due today" : scheduledDate ? `Overdue · ${new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "Overdue"}
                    </p>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (scheduledDate) skipWeek.mutate({ clientId: client.id, weekStartDate: scheduledDate });
                      }}
                      disabled={skipWeek.isPending}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border hover:border-border/80 transition-colors flex items-center gap-0.5 disabled:opacity-50"
                      title="Skip this week"
                    >
                      <SkipForward size={9} />
                      Skip
                    </button>
                  </div>
                ) : status === "missed" ? (
                  <p className="text-xs text-red-400 font-medium">
                    {scheduledDate ? `Missed · ${new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "Missed"}
                  </p>
                ) : ci ? (
                  <p className={`text-xs truncate ${isReviewed ? "text-muted-foreground" : "text-primary"}`}>
                    {isReviewed ? "Complete" : "Awaiting review"} · {new Date((ci as any).submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No check-ins yet</p>
                )}
              </div>
            </button>
          );
        })}
        {sortedClients.length === 0 && (
          <p className="text-sm text-muted-foreground px-3 py-4">No clients yet.</p>
        )}
      </div>

      {/* Right: check-in history */}
      {selectedId ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              {selectedClient?.name ?? `User ${selectedId}`}
            </h2>
          </div>
          <CheckInsDetailPanel clientId={selectedId} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Select a client to view their check-ins
        </div>
      )}
    </div>
  );
}
