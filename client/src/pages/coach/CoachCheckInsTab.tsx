import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, CheckCircle2, Bold, List, Heading2 } from "lucide-react";
import { toast } from "sonner";

// ─── Label maps (shared with WeeklyReviewTab) ─────────────────────────────────

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

const DEFAULT_VISIBLE = 8;

// ─── Submission Q&A ───────────────────────────────────────────────────────────

function SubmissionQA({ answers }: {
  answers: Array<{ question: { slug: string; questionText: string }; value: string | null; elaboration?: string | null }>;
}) {
  if (!answers || answers.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 py-3">No answers recorded.</p>;
  }
  return (
    <div className="px-4 pt-3 pb-2 space-y-3">
      {answers.map((a, i) => (
        <div key={i} className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{a.question.questionText}</p>
          <p className="text-sm text-foreground font-medium">{a.value ?? "—"}</p>
          {a.elaboration && (
            <p className="text-xs text-muted-foreground italic">{a.elaboration}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tiptap notes field ───────────────────────────────────────────────────────

function TiptapNotesField({
  label,
  placeholder,
  initialContent,
  onSave,
  isPending,
}: {
  label: string;
  placeholder: string;
  initialContent: string | null | undefined;
  onSave: (html: string) => void;
  isPending: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback((html: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave(html);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1200);
  }, [onSave]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        bulletList: {},
        bold: {},
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent || "",
    onUpdate: ({ editor }) => {
      triggerSave(editor.getHTML());
    },
    onBlur: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      onSave(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  if (!editor) return null;

  const isActive = (type: string, attrs?: Record<string, unknown>) =>
    editor.isActive(type, attrs);

  return (
    <div className="px-4 py-3 border-t border-border/50 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] text-green-400">Saved</span>}
          {isPending && <span className="text-[10px] text-muted-foreground">Saving…</span>}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Heading"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
              className={`p-1 rounded transition-colors ${isActive("heading", { level: 2 }) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Heading2 size={13} />
            </button>
            <button
              type="button"
              title="Bold"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
              className={`p-1 rounded transition-colors ${isActive("bold") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              title="Bullet list"
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
              className={`p-1 rounded transition-colors ${isActive("bulletList") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>
      <div className="w-full bg-secondary/50 border border-border rounded-lg text-foreground focus-within:ring-1 focus-within:ring-primary/40 transition-colors">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Coach Notes Field ────────────────────────────────────────────────────────

function CoachNotesField({ submissionId, initialNotes }: { submissionId: number; initialNotes: string | null | undefined }) {
  const saveNotes = trpc.checkIn.saveCoachNotes.useMutation({
    onError: () => toast.error("Failed to save notes"),
  });
  return (
    <TiptapNotesField
      label="Coach Notes"
      placeholder="Add feedback, program adjustments, or observations…"
      initialContent={initialNotes}
      onSave={(html) => saveNotes.mutate({ submissionId, notes: html })}
      isPending={saveNotes.isPending}
    />
  );
}

// ─── Changes Notes Field ──────────────────────────────────────────────────────

function ChangesNotesField({ submissionId, initialNotes }: { submissionId: number; initialNotes: string | null | undefined }) {
  const saveNotes = trpc.checkIn.saveChangesNotes.useMutation({
    onError: () => toast.error("Failed to save changes"),
  });
  return (
    <TiptapNotesField
      label="Changes Made"
      placeholder="Record any adjustments made to meal plan, training, or other changes…"
      initialContent={initialNotes}
      onSave={(html) => saveNotes.mutate({ submissionId, notes: html })}
      isPending={saveNotes.isPending}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  clientId: number;
}

export function CoachCheckInsTab({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInit, setExpandedInit] = useState(false);

  const tzOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);

  // Fetch weekly review data for week labels and numbers
  const { data: reviewData, isLoading: reviewLoading } = trpc.progress.weeklyReview.useQuery(
    { clientId, tzOffsetMinutes },
    { enabled: !!clientId, staleTime: 0, retry: 1 }
  );

  // Fetch check-in history for submissions and answers
  const { data: checkInHistory, isLoading: historyLoading, error } = trpc.checkIn.clientHistory.useQuery(
    { clientId },
    { enabled: !!clientId, staleTime: 0 }
  );

  const utils = trpc.useUtils();
  const markReviewed = trpc.checkIn.markReviewed.useMutation({
    onSuccess: () => {
      utils.checkIn.clientHistory.invalidate();
      utils.progress.weeklyReview.invalidate();
      toast.success("Check-in marked as reviewed");
    },
    onError: () => toast.error("Failed to update review status"),
  });

  const weeks = reviewData?.weeks ?? [];

  // Build a map from weekNumber → history row
  const historyByWeek = useMemo(() => {
    const map = new Map<number, any>();
    for (const row of checkInHistory ?? []) {
      if (row.weekNumber != null) map.set(row.weekNumber, row);
    }
    return map;
  }, [checkInHistory]);

  // Only show weeks that have a check-in submission
  const weeksWithSubmission = useMemo(() =>
    weeks.filter(w => historyByWeek.has(w.weekNumber) && historyByWeek.get(w.weekNumber)?.submissionId),
    [weeks, historyByWeek]
  );

  // Initialise: expand only the most recent week with a submission
  useEffect(() => {
    if (expandedInit || weeksWithSubmission.length === 0) return;
    const toExpand = new Set<string>();
    if (weeksWithSubmission[0]) toExpand.add(weeksWithSubmission[0].weekStart);
    setExpanded(toExpand);
    setExpandedInit(true);
  }, [weeksWithSubmission.length, expandedInit]);

  function toggleCard(weekStart: string) {
    setExpanded(prev => {
      if (prev.has(weekStart)) return new Set<string>();
      return new Set<string>([weekStart]);
    });
  }

  const isLoading = reviewLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 mt-2 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Failed to load check-ins</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </div>
      </div>
    );
  }

  if (weeksWithSubmission.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-base font-medium">No check-in submissions yet</p>
        <p className="text-sm mt-1">Submissions will appear here once the client completes their first check-in.</p>
      </div>
    );
  }

  const visibleWeeks = showAll ? weeksWithSubmission : weeksWithSubmission.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="mt-2 space-y-2">
      {visibleWeeks.map((week) => {
        const historyRow = historyByWeek.get(week.weekNumber);
        const submission = historyRow?.submission ?? null;
        const submissionAnswers = historyRow?.answers ?? [];
        const isReviewed = !!(submission as any)?.reviewedAt;
        const isExpanded = expanded.has(week.weekStart);
        const submittedAt = (submission as any)?.submittedAt;

        return (
          <div
            key={week.weekStart}
            className={`rounded-xl border transition-colors ${
              week.isInProgress
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-border bg-card"
            }`}
          >
            {/* Card header */}
            <button
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors rounded-xl ${
                week.isInProgress ? "hover:bg-amber-500/10" : "hover:bg-muted/20"
              }`}
              onClick={() => toggleCard(week.weekStart)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  W{week.weekNumber}
                </span>
                <span className="text-sm font-semibold text-foreground truncate">{week.label}</span>
                {week.isInProgress && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10 flex-shrink-0">
                    Current
                  </Badge>
                )}
                {!isReviewed && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/50 text-blue-400 bg-blue-500/10 flex-shrink-0">
                    Unreviewed
                  </Badge>
                )}
                {isReviewed && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-400 bg-green-500/10 flex-shrink-0">
                    Reviewed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {submittedAt && (
                  <span className="text-[11px] text-muted-foreground hidden sm:block">
                    {new Date(submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                )}
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border/40">
                {/* Submission date */}
                {submittedAt && (
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Check-in Submission</p>
                    <span className="text-[10px] text-muted-foreground">
                      Submitted {new Date(submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}

                {/* Q&A answers */}
                <SubmissionQA answers={submissionAnswers} />

                {/* Coach Notes (Tiptap) */}
                {submission && (
                  <CoachNotesField
                    submissionId={(submission as any).id}
                    initialNotes={(submission as any).coachNotes}
                  />
                )}

                {/* Changes Made (Tiptap) */}
                {submission && (
                  <ChangesNotesField
                    submissionId={(submission as any).id}
                    initialNotes={(submission as any).changesNotes}
                  />
                )}

                {/* Mark as Reviewed */}
                {submission && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <Button
                      size="sm"
                      variant={isReviewed ? "outline" : "default"}
                      onClick={() => markReviewed.mutate({ id: (submission as any).id, reviewed: !isReviewed, clientId })}
                      disabled={markReviewed.isPending}
                      className="gap-1.5"
                    >
                      <CheckCircle2 size={13} />
                      {isReviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Show all / show less */}
      {weeksWithSubmission.length > DEFAULT_VISIBLE && (
        <div className="flex justify-center mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show less" : `Show all ${weeksWithSubmission.length} check-ins`}
          </Button>
        </div>
      )}
    </div>
  );
}
