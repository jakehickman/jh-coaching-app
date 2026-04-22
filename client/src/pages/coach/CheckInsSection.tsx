import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronDown, CheckCircle2, Clock, AlertCircle } from "lucide-react";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

type CycleStatus = "upcoming" | "overdue" | "submitted";

// ─── Submission Q&A display ───────────────────────────────────────────────────

function SubmissionQA({ sub }: { sub: any }) {
  const sections = [
    {
      title: "Diet Execution",
      rows: [
        { q: "How often did you weigh all foods raw/uncooked with a digital scale?", val: sub.dietWeighedFoods },
        { q: "How often did you prepare meals exactly as written in your plan?", val: sub.dietMealPrepAccuracy },
        { q: "Excluding off-plan meals, how often did you eat/drink anything not in your plan?", val: sub.dietExtrasFrequency },
        { q: "How do you use added fats when cooking?", val: sub.dietAddedFats },
        { q: "How often did you eat meals more than 2 hours off schedule?", val: sub.dietMealTiming },
        { q: "When you had an off-plan meal, how close was it to your plan in calories/macros?", val: sub.dietOffPlanQuality },
      ].filter(r => r.val),
    },
    {
      title: "Sleep",
      rows: [
        { q: "How often did you go to bed more than 1 hour later than your planned bedtime?", val: sub.sleepBedtimeConsistency },
      ].filter(r => r.val),
    },
    {
      title: "Adherence Barrier",
      rows: [
        { q: "What was your biggest barrier to adherence this week?", val: sub.adherenceBarrier ? (BARRIER_LABEL[sub.adherenceBarrier] ?? sub.adherenceBarrier) : null, raw: true },
        ...(sub.barrierExplain ? [{ q: "Can you explain further?", val: sub.barrierExplain, raw: true }] : []),
      ].filter(r => r.val),
    },
    {
      title: "Weekly Self-Assessment",
      rows: [
        { q: "Overall, how well did you follow your plan this week?", val: sub.weeklyAssessment ? (ASSESSMENT_LABEL[sub.weeklyAssessment] ?? sub.weeklyAssessment) : null, raw: true },
      ].filter(r => r.val),
    },
  ].filter(s => s.rows.length > 0);

  if (sections.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 py-3">No answers recorded.</p>;
  }

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
}

// ─── CoachNotesField ─────────────────────────────────────────────────────────
// Auto-saving textarea for coach notes on a submission.

function CoachNotesField({ submissionId, initialNotes }: { submissionId: number; initialNotes: string | null | undefined }) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNotes = trpc.checkIn.saveCoachNotes.useMutation({
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
    onError: () => toast.error("Failed to save notes"),
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes.mutate({ submissionId, notes: e.target.value });
    }, 1200);
  };

  const handleBlur = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveNotes.mutate({ submissionId, notes: value });
  };

  return (
    <div className="px-4 py-3 border-t border-border/50 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coach Notes</p>
        {saved && <span className="text-[10px] text-green-400">Saved</span>}
        {saveNotes.isPending && <span className="text-[10px] text-muted-foreground">Saving…</span>}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Add feedback, program adjustments, or observations…"
        rows={3}
        className="w-full text-sm bg-secondary/50 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
      />
    </div>
  );
}

// ─── CheckInsDetailPanel ─────────────────────────────────────────────────────
// Reusable detail panel for a single client's check-in cycle and history.
// Used both in the standalone CheckInsSection and as a sub-tab in ProgressSection.

export function CheckInsDetailPanel({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const [historyExpanded, setHistoryExpanded] = useState<Set<number>>(new Set());

  const { data: currentCycle, isLoading: cycleLoading } =
    trpc.checkIn.clientCurrentCycle.useQuery({ clientId }, { enabled: !!clientId });

  const { data: history = [], isLoading: historyLoading } =
    trpc.checkIn.clientHistory.useQuery({ clientId }, { enabled: !!clientId });

  const markComplete = trpc.checkIn.markComplete.useMutation({
    onSuccess: () => {
      toast.success("Check-in marked complete — next cycle scheduled");
      utils.checkIn.clientCurrentCycle.invalidate();
      utils.checkIn.clientHistory.invalidate();
      utils.checkIn.clientStatusList.invalidate();
    },
    onError: () => toast.error("Failed to mark complete"),
  });

  const markReviewed = trpc.checkIn.markReviewed.useMutation({
    onSuccess: () => {
      utils.checkIn.clientHistory.invalidate();
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Mark as seen in localStorage when current cycle loads
  useEffect(() => {
    if (!clientId || !currentCycle?.submissionId) return;
    const seenAt = Date.now();
    localStorage.setItem(`coach:seen:checkin:${clientId}`, String(seenAt));
    window.dispatchEvent(new StorageEvent("storage", { key: `coach:seen:checkin:${clientId}` }));
  }, [clientId, currentCycle?.submissionId]);

  if (cycleLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;
  }

  if (!currentCycle) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
        No check-in cycle set up for this client
      </div>
    );
  }

  const { status, dueDate, submission } = currentCycle;

  const statusConfig: Record<CycleStatus, { label: string; icon: React.ReactNode; className: string }> = {
    upcoming: {
      label: `Upcoming · Due ${fmtDate(dueDate)}`,
      icon: <Clock size={12} />,
      className: "bg-secondary border-border text-muted-foreground",
    },
    overdue: {
      label: `Overdue · Was due ${fmtDate(dueDate)}`,
      icon: <AlertCircle size={12} />,
      className: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    },
    submitted: {
      label: `Submitted · Due ${fmtDate(dueDate)}`,
      icon: <CheckCircle2 size={12} />,
      className: "bg-green-500/10 border-green-500/30 text-green-400",
    },
  };

  const cfg = statusConfig[status as CycleStatus] ?? statusConfig.upcoming;

  return (
    <div className="space-y-3">
      {/* Current cycle banner */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${cfg.className}`}>
        <div className="flex items-center gap-2 text-xs font-medium">
          {cfg.icon}
          <span>{cfg.label}</span>
        </div>
        {status === "submitted" && (
          <button
            onClick={() => markComplete.mutate({ clientId })}
            disabled={markComplete.isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
          >
            {markComplete.isPending ? "Saving…" : "Mark Complete"}
          </button>
        )}
        {status === "overdue" && (
          <button
            onClick={() => markComplete.mutate({ clientId })}
            disabled={markComplete.isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {markComplete.isPending ? "Saving…" : "Advance Cycle"}
          </button>
        )}
      </div>

      {/* Current submission Q&A */}
      {status === "submitted" && submission && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-sm font-semibold text-foreground">Current Submission</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submitted {new Date((submission as any).submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </p>
          </div>
          <SubmissionQA sub={submission} />
          {/* Mark reviewed */}
          <CoachNotesField submissionId={(submission as any).id} initialNotes={(submission as any).coachNotes} />
          <div className="px-4 py-3 border-t border-border/50">
            <button
              onClick={() => markReviewed.mutate({ id: (submission as any).id, reviewed: !(submission as any).reviewedAt })}
              disabled={markReviewed.isPending}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                (submission as any).reviewedAt
                  ? "border-border text-muted-foreground hover:text-foreground"
                  : "border-primary/40 text-primary hover:bg-primary/10"
              }`}
            >
              {(submission as any).reviewedAt ? "Mark as Unreviewed" : "Mark as Reviewed"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
            History ({history.length})
          </p>
          {(history as any[]).map((row: any) => {
            const isExpanded = historyExpanded.has(row.id);
            const hasSub = !!row.submission;
            return (
              <div key={row.id} className="border border-border rounded-xl overflow-hidden bg-card">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                  onClick={() =>
                    setHistoryExpanded(prev => {
                      const next = new Set(prev);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    })
                  }
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      Due {fmtDate(row.dueDate)}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      hasSub
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {hasSub ? "Submitted" : "Missed"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Completed {fmtShortDate(row.completedAt instanceof Date
                        ? row.completedAt.toISOString().slice(0, 10)
                        : String(row.completedAt).slice(0, 10))}
                    </span>
                    {hasSub && (
                      <ChevronDown
                        size={14}
                        className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    )}
                  </div>
                </button>

                {isExpanded && hasSub && (
                  <div className="border-t border-border">
                    <SubmissionQA sub={row.submission} />
                    <CoachNotesField submissionId={row.submission.id} initialNotes={row.submission.coachNotes} />
                    <div className="px-4 py-3 border-t border-border/50">
                      <button
                        onClick={() => markReviewed.mutate({ id: row.submission.id, reviewed: !row.submission.reviewedAt })}
                        disabled={markReviewed.isPending}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                          row.submission.reviewedAt
                            ? "border-border text-muted-foreground hover:text-foreground"
                            : "border-primary/40 text-primary hover:bg-primary/10"
                        }`}
                      >
                        {row.submission.reviewedAt ? "Mark as Unreviewed" : "Mark as Reviewed"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {history.length === 0 && !historyLoading && (
        <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-xl">
          No completed cycles yet
        </div>
      )}
    </div>
  );
}

// ─── CheckInsSection (standalone coach sidebar section) ──────────────────────

export default function CheckInsSection() {
  const { user: currentUser } = useAuth();
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: statusList = [] } = trpc.checkIn.clientStatusList.useQuery();
  const { data: clientProfiles = [] } = trpc.users.clients.useQuery();

  const clients = (allUsers ?? []).filter(
    (u: any) => u.role !== "admin" || u.id === currentUser?.id
  );

  const getClientStatus = (clientId: number): { status: CycleStatus; dueDate: string | null } => {
    const entry = (statusList as any[]).find((s: any) => s.clientId === clientId);
    return { status: entry?.status ?? "upcoming", dueDate: entry?.dueDate ?? null };
  };

  // Sort: overdue first, then submitted (awaiting review), then upcoming
  const sortBucket = (clientId: number): number => {
    const { status } = getClientStatus(clientId);
    if (status === "overdue") return 0;
    if (status === "submitted") return 1;
    return 2;
  };

  const sortedClients = [...clients].sort((a, b) => sortBucket(a.id) - sortBucket(b.id));

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedClient = clients.find((c) => c.id === selectedId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      {/* Left: client list */}
      <div className="space-y-1">
        {sortedClients.filter((c) => c.id !== undefined).map((client) => {
          const isSelected = selectedId === client.id;
          const { status, dueDate } = getClientStatus(client.id);

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
                {status === "submitted" && (
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
                      status === "overdue"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : status === "submitted"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {abbr[day] ?? day}
                    </span>
                  )}
                </div>
                {status === "overdue" ? (
                  <p className="text-xs text-amber-400 font-medium">
                    {dueDate ? `Overdue · was due ${new Date(dueDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "Overdue"}
                  </p>
                ) : status === "submitted" ? (
                  <p className="text-xs text-green-400 font-medium">Submitted · awaiting review</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {dueDate ? `Due ${new Date(dueDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "No check-in scheduled"}
                  </p>
                )}
              </div>
            </button>
          );
        })}
        {sortedClients.length === 0 && (
          <p className="text-sm text-muted-foreground px-3 py-4">No clients yet.</p>
        )}
      </div>

      {/* Right: check-in detail */}
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
