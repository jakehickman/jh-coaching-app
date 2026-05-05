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
      placeholder=""
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
      placeholder=""
      initialContent={initialNotes}
      onSave={(html) => saveNotes.mutate({ submissionId, notes: html })}
      isPending={saveNotes.isPending}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type EntryType = 'overdue' | 'missed' | 'skipped' | 'submission';
interface UnifiedEntry {
  key: string;
  weekNumber: number | null;
  dueDate: string;
  label: string;
  type: EntryType;
  weekData?: any;
  historyRow?: any;
}

interface Props {
  clientId: number;
}

export function CoachCheckInsTab({ clientId }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedInit, setExpandedInit] = useState(false);
  const { data: checkInHistory, isLoading: historyLoading, error } = trpc.checkIn.clientHistory.useQuery(
    { clientId }, { enabled: !!clientId, staleTime: 0 }
  );
  const { data: currentCycle } = trpc.checkIn.clientCurrentCycle.useQuery(
    { clientId }, { enabled: !!clientId, staleTime: 0 }
  );

  const utils = trpc.useUtils();
  const markReviewed = trpc.checkIn.markReviewed.useMutation({
    onSuccess: () => { utils.checkIn.clientHistory.invalidate(); toast.success('Check-in marked as reviewed'); },
    onError: () => toast.error('Failed to update review status'),
  });

  // Build unified sorted list directly from server-provided history (which already includes synthetic missed entries)
  const allEntries = useMemo((): UnifiedEntry[] => {
    const entries: UnifiedEntry[] = [];
    const seen = new Set<string>();

    // Active overdue cycle with no submission (not yet in history)
    if (currentCycle && !currentCycle.submissionId && currentCycle.status === 'overdue') {
      const d = new Date(currentCycle.dueDate + 'T00:00:00Z');
      const label = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      entries.push({ key: `overdue-${currentCycle.dueDate}`, weekNumber: currentCycle.weekNumber ?? null, dueDate: currentCycle.dueDate, label, type: 'overdue' });
      seen.add(currentCycle.dueDate);
    }

    // All history rows (real submissions, skipped, and synthetic missed)
    for (const row of checkInHistory ?? []) {
      if (seen.has(row.dueDate)) continue;
      seen.add(row.dueDate);
      const d = new Date(row.dueDate + 'T00:00:00Z');
      const label = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const type: EntryType = row.submissionId ? 'submission' : row.skipped ? 'skipped' : 'missed';
      entries.push({ key: `h-${row.dueDate}`, weekNumber: row.weekNumber ?? null, dueDate: row.dueDate, label, type, historyRow: row });
    }

    return entries.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [currentCycle, checkInHistory]);

  const submissionCount = useMemo(() => allEntries.filter(e => e.type === 'submission').length, [allEntries]);

  const visibleEntries = useMemo(() => {
    if (showAll) return allEntries;
    let subCount = 0;
    return allEntries.filter(e => {
      if (e.type !== 'submission') return true;
      return ++subCount <= DEFAULT_VISIBLE;
    });
  }, [allEntries, showAll]);

  // Auto-expand most recent submission
  useEffect(() => {
    if (expandedInit) return;
    const first = allEntries.find(e => e.type === 'submission');
    if (!first) return;
    setExpanded(new Set([first.dueDate]));
    setExpandedInit(true);
  }, [allEntries.length, expandedInit]);

  function toggleCard(key: string) {
    setExpanded(prev => prev.has(key) ? new Set() : new Set([key]));
  }

  const isLoading = historyLoading;

  if (isLoading) return (
    <div className="space-y-2 mt-2">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-muted rounded-xl" />)}
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 p-4 mt-2 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <div><p className="font-medium">Failed to load check-ins</p><p className="text-sm opacity-80">{error.message}</p></div>
    </div>
  );

  if (allEntries.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <p className="text-base font-medium">No check-in submissions yet</p>
      <p className="text-sm mt-1">Submissions will appear here once the client completes their first check-in.</p>
    </div>
  );

  return (
    <div className="mt-2 space-y-2">
      {visibleEntries.map((entry) => {
        // Placeholder cards (overdue / missed / skipped)
        if (entry.type !== 'submission') {
          const isOverdue = entry.type === 'overdue';
          const isSkipped = entry.type === 'skipped';
          return (
            <div key={entry.key} className={`rounded-xl border opacity-80 ${
              isOverdue ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card opacity-60'
            }`}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {entry.weekNumber != null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 border ${
                      isOverdue
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : 'text-muted-foreground bg-muted border-border'
                    }`}>
                      W{entry.weekNumber}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-muted-foreground">{entry.label}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                    isOverdue
                      ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                      : isSkipped
                        ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                        : 'border-border text-muted-foreground bg-secondary'
                  }`}>
                    {isOverdue ? 'Overdue' : isSkipped ? 'Skipped' : 'Missed'}
                  </Badge>
                </div>
                {isOverdue && <span className="text-xs text-muted-foreground">No submission</span>}
              </div>
            </div>
          );
        }

        // Submission cards
        const historyRow = entry.historyRow;
        const submission = historyRow?.submission ?? null;
        const submissionAnswers = historyRow?.answers ?? [];
        const isReviewed = !!(submission as any)?.reviewedAt;
        const isExpanded = expanded.has(entry.key);
        const submittedAt = (submission as any)?.submittedAt;

        return (
          <div
            key={entry.key}
            className="rounded-xl border transition-colors border-border bg-card"
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors rounded-xl hover:bg-muted/20"
              onClick={() => toggleCard(entry.key)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {entry.weekNumber != null && (
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    W{entry.weekNumber}
                  </span>
                )}
                <span className="text-sm font-semibold text-foreground truncate">{entry.label}</span>
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
                    {new Date(submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border/40">
                {submittedAt && (
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Check-in Submission</p>
                    <span className="text-[10px] text-muted-foreground">
                      Submitted {new Date(submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <SubmissionQA answers={submissionAnswers} />
                {submission && (
                  <CoachNotesField
                    submissionId={(submission as any).id}
                    initialNotes={(submission as any).coachNotes}
                  />
                )}
                {submission && (
                  <ChangesNotesField
                    submissionId={(submission as any).id}
                    initialNotes={(submission as any).changesNotes}
                  />
                )}
                {submission && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <Button
                      size="sm"
                      variant={isReviewed ? 'outline' : 'default'}
                      onClick={() => markReviewed.mutate({ id: (submission as any).id, reviewed: !isReviewed, clientId })}
                      disabled={markReviewed.isPending}
                      className="gap-1.5"
                    >
                      <CheckCircle2 size={13} />
                      {isReviewed ? 'Mark as Unreviewed' : 'Mark as Reviewed'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {submissionCount > DEFAULT_VISIBLE && (
        <div className="flex justify-center mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showAll ? 'Show less' : `Show all ${submissionCount} check-ins`}
          </Button>
        </div>
      )}
    </div>
  );
}
