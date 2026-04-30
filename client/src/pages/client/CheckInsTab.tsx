import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useViewAs } from "@/contexts/ViewAsContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Card } from "./shared";
import MeasurementsTab from "./MeasurementsTab";
import { CheckInsDetailPanel } from "@/pages/coach/CheckInsSection";

type CycleStatus = "upcoming" | "overdue" | "submitted";

// ─── Dynamic question components ─────────────────────────────────────────────

function SingleChoiceQuestion({
  question,
  value,
  onChange,
  elaboration,
  onElaborationChange,
  hasError,
  scrollRef,
}: {
  question: { id: number; questionText: string; options: string[] | null };
  value: string;
  onChange: (v: string) => void;
  elaboration: string;
  onElaborationChange: (v: string) => void;
  hasError?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const options = question.options ?? [];
  const isRequired = hasError && !value;
  return (
    <div ref={scrollRef}>
      <p className={`text-sm mb-2.5 ${isRequired ? "text-destructive font-semibold" : "text-foreground"}`}>
        {question.questionText}
      </p>
      {isRequired && <p className="text-xs text-destructive mb-2">Please answer this question</p>}
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`w-full py-3 px-3 rounded-lg border text-sm font-medium transition-all text-left ${
              value === opt
                ? "border-primary bg-primary/10 text-primary"
                : isRequired
                ? "border-destructive/60 text-muted-foreground hover:border-destructive"
                : "border-border text-muted-foreground hover:border-muted-foreground/40"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {/* Elaboration textarea — always visible for single_choice questions */}
      <textarea
        value={elaboration}
        onChange={(e) => onElaborationChange(e.target.value)}
        placeholder=""
        className="mt-3 w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        rows={2}
      />
    </div>
  );
}

function FreeTextQuestion({
  question,
  value,
  onChange,
}: {
  question: { id: number; questionText: string };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-foreground mb-2">{question.questionText}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=""
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        rows={3}
      />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CheckInsTab() {
  const { viewAsUserId } = useViewAs();

  if (viewAsUserId) {
    return (
      <div className="space-y-5">
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          <div className="flex-1 py-2 rounded-md text-sm font-medium bg-card text-foreground shadow-sm text-center">
            Check-in
          </div>
        </div>
        <CheckInsDetailPanel clientId={viewAsUserId} />
      </div>
    );
  }

  return <CheckInsTabContent />;
}

function CheckInsTabContent() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const clientId = user?.id ?? 0;
  const { data: currentCycle, refetch: refetchCycle } = trpc.checkIn.myCurrentCycle.useQuery();
  const { data: history = [] } = trpc.checkIn.myHistory.useQuery();
  const { data: questions = [], isLoading: questionsLoading } = trpc.questions.listActiveForClient.useQuery(
    { clientId },
    { enabled: clientId > 0 }
  );

  // answers keyed by questionId
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // elaborations keyed by questionId (only for single_choice questions)
  const [elaborations, setElaborations] = useState<Record<number, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [subTab, setSubTab] = useState<"form" | "measurements">("form");

  // Refs for scrolling to first unanswered required question
  const questionRefs = useRef<Record<number, React.RefObject<HTMLDivElement | null>>>({});
  questions.forEach((q) => {
    if (!questionRefs.current[q.id]) {
      questionRefs.current[q.id] = { current: null };
    }
  });

  const cycleStatus: CycleStatus = (currentCycle?.status as CycleStatus) ?? "upcoming";
  const dueDate = currentCycle?.dueDate ?? null;
  const existingSubmission = currentCycle?.submission ?? null;
  const checkInDay = currentCycle?.checkInDay
    ? currentCycle.checkInDay.charAt(0).toUpperCase() + currentCycle.checkInDay.slice(1)
    : null;

  // Load existing answers when submission changes
  const { data: existingAnswers = [] } = trpc.questions.getAnswers.useQuery(
    { submissionId: existingSubmission?.id ?? 0 },
    { enabled: !!existingSubmission?.id }
  );

  useEffect(() => {
    if (existingAnswers.length > 0) {
      const loaded: Record<number, string> = {};
      const loadedElab: Record<number, string> = {};
      existingAnswers.forEach((a: any) => {
        loaded[a.questionId] = a.value ?? "";
        if (a.elaboration) loadedElab[a.questionId] = a.elaboration;
      });
      setAnswers(loaded);
      setElaborations(loadedElab);
    } else if (!existingSubmission) {
      setAnswers({});
      setElaborations({});
    }
  }, [existingAnswers.length, existingSubmission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Required questions = all single_choice questions
  const requiredQuestions = questions.filter((q) => q.type === "single_choice");

  const submitMutation = trpc.checkIn.submit.useMutation({
    onSuccess: async (data: any) => {
      // Save dynamic answers after submission
      // Server returns { submissionId }, not { id }
      const submissionId = data?.submissionId ?? data?.id;
      if (submissionId) {
        try {
          const answerPayload = questions.map((q) => ({
            questionId: q.id,
            value: answers[q.id] ?? null,
            elaboration: q.type === "single_choice" ? (elaborations[q.id] ?? null) : null,
          }));
          await saveAnswersMutation.mutateAsync({ submissionId, answers: answerPayload });
        } catch (err) {
          console.error("Failed to save check-in answers:", err);
          // Non-critical — submission itself succeeded
        }
      }
      refetchCycle();
      utils.checkIn.myHistory.invalidate();
      utils.checkIn.myCurrentCycle.invalidate();
      setIsEditing(false);
      toast.success("Your check-in has been submitted", { duration: 3000 });
    },
    onError: () => toast.error("Failed to submit. Please try again."),
  });

  const saveAnswersMutation = trpc.questions.saveAnswers.useMutation({
    onSuccess: () => {
      utils.questions.getAnswers.invalidate();
    },
  });

  const handleSubmit = () => {
    const unanswered = requiredQuestions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setShowErrors(true);
      const firstRef = questionRefs.current[unanswered[0].id];
      firstRef?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // All answers are saved via saveAnswers after submission — no legacy fields needed
    submitMutation.mutate({});
  };

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const shouldShowForm =
    (cycleStatus === "upcoming" || cycleStatus === "overdue") ||
    (cycleStatus === "submitted" && isEditing);

  const statusBanner = (() => {
    if (!dueDate) return null;
    switch (cycleStatus) {
      case "upcoming":
        return {
          icon: "📅",
          heading: checkInDay ? `Your check-in day is ${checkInDay}` : `Your next check-in`,
          subtext: `Your next check-in is due ${fmtDate(dueDate)}.`,
          className: "bg-card border-border text-foreground",
        };
      case "overdue":
        return {
          icon: "⚠️",
          heading: checkInDay ? `Your check-in day is ${checkInDay}` : `Check-in overdue`,
          subtext: `Your check-in was due ${fmtDate(dueDate)} — please submit as soon as possible.`,
          className: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        };
      case "submitted":
        return {
          icon: "✓",
          heading: checkInDay ? `Your check-in day is ${checkInDay}` : `Check-in submitted`,
          subtext: `Check-in submitted for ${fmtDate(dueDate)}.`,
          className: "bg-green-500/10 border-green-500/30 text-green-400",
        };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(["form", "measurements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              subTab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "form" ? "Check-in" : "Measurements"}
          </button>
        ))}
      </div>

      {subTab === "measurements" ? (
        <MeasurementsTab />
      ) : (
        <>
          {statusBanner && (
            <div className={`bg-card border rounded-xl px-4 py-4 ${statusBanner.className}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{statusBanner.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{statusBanner.heading}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{statusBanner.subtext}</p>
                </div>
                {cycleStatus === "submitted" && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-primary hover:opacity-80 font-medium flex-shrink-0"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          )}

          {!currentCycle && (
            <div className="bg-card border border-border rounded-xl px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Your coach has not set up your check-in schedule yet.
              </p>
            </div>
          )}

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What to send each check-in
            </p>
            {[
              { num: "1", title: "Log your measurements", sub: "Use the Measurements tab above." },
              { num: "2", title: "Complete the check-in form below", sub: "Questions about your week." },
              { num: "3", title: "Send progress photos on WhatsApp", sub: "Front, side, and back." },
              { num: "4", title: "Send form clips on WhatsApp", sub: "One set per exercise from one full session." },
              { num: "5", title: "Voice note on WhatsApp", sub: "A summary of how your week went." },
            ].map((item) => (
              <div key={item.num} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {item.num}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.sub}</p>
                </div>
              </div>
            ))}
          </Card>

          {shouldShowForm && currentCycle && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {currentCycle?.weekNumber != null ? `Week ${currentCycle.weekNumber} · ` : ""}
                Check-in Form — Due {fmtDate(dueDate)}
              </p>

              {questionsLoading ? (
                <Card>
                  <p className="text-sm text-muted-foreground text-center py-4">Loading questions…</p>
                </Card>
              ) : questions.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No check-in questions have been set up yet.
                  </p>
                </Card>
              ) : (
                <Card className="space-y-0 divide-y divide-border mb-4">
                  <div className="space-y-5 py-4">
                    {questions.map((q) => (
                      <div
                        key={q.id}
                        ref={(el) => {
                          if (questionRefs.current[q.id]) {
                            questionRefs.current[q.id].current = el;
                          }
                        }}
                      >
                        {q.type === "single_choice" ? (
                          <SingleChoiceQuestion
                            question={q as any}
                            value={answers[q.id] ?? ""}
                            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                            elaboration={elaborations[q.id] ?? ""}
                            onElaborationChange={(v) => setElaborations((prev) => ({ ...prev, [q.id]: v }))}
                            hasError={showErrors}
                          />
                        ) : (
                          <FreeTextQuestion
                            question={q}
                            value={answers[q.id] ?? ""}
                            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex gap-3">
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-4 border border-border text-muted-foreground font-semibold text-base rounded-xl hover:opacity-80 transition-opacity"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || saveAnswersMutation.isPending}
                  className="flex-1 py-4 bg-primary text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitMutation.isPending || saveAnswersMutation.isPending
                    ? "Saving..."
                    : isEditing
                    ? "Save Changes"
                    : "Submit Check-in"}
                </button>
              </div>
            </div>
          )}

          <Card className="space-y-3.5 border-border/60">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              After submitting, send on WhatsApp:
            </p>
            {[
              { icon: "📸", text: "Progress photos" },
              { icon: "🎥", text: "Form clips" },
              { icon: "🎙️", text: "Voice note" },
            ].map((item) => (
              <div key={item.text} className="flex gap-3 items-center">
                <span className="text-base">{item.icon}</span>
                <p className="text-sm text-foreground">{item.text}</p>
              </div>
            ))}
          </Card>

          {(history as any[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Past Check-ins
              </p>
              <div className="space-y-2">
                {(history as any[]).map((row: any) => (
                  <Card key={row.id} className="opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {row.weekNumber != null && (
                          <span className="text-xs font-semibold text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                            W{row.weekNumber}
                          </span>
                        )}
                        <p className="text-sm font-semibold text-foreground">
                          Due {fmtDate(row.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.submission?.reviewedAt && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-green-500/15 text-green-400 border-green-500/30">
                            Reviewed
                          </span>
                        )}
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-secondary text-muted-foreground border-border">
                          {row.submissionId ? "Submitted" : "Missed"}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
