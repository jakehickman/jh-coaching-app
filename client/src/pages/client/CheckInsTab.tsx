import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";
import { Card } from "./shared";
import MeasurementsTab from "./MeasurementsTab";
import { CheckInsDetailPanel } from "@/pages/coach/CheckInsSection";

type CheckInFormState = {
  sleepBedtimeConsistency: string;
  dietWeighedFoods: string;
  dietMealPrepAccuracy: string;
  dietExtrasFrequency: string;
  dietAddedFats: string;
  dietMealTiming: string;
  dietOffPlanQuality: string;
  adherenceBarrier: string;
  barrierExplain: string;
  weeklyAssessment: string;
};

type CycleStatus = "upcoming" | "overdue" | "submitted";

function ChoiceQuestion({ label, subtext, field, options, form, setForm, hasError, scrollRef }: {
  label: string;
  subtext?: string;
  field: keyof CheckInFormState;
  options: { value: string; label: string }[];
  form: CheckInFormState;
  setForm: React.Dispatch<React.SetStateAction<CheckInFormState>>;
  hasError?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={scrollRef}>
      <p className={`text-sm mb-1 ${hasError && !form[field] ? 'text-destructive font-semibold' : 'text-foreground'}`}>{label}</p>
      {subtext && <p className="text-sm text-muted-foreground mb-2.5 leading-relaxed">{subtext}</p>}
      {!subtext && <div className="mb-2.5" />}
      {hasError && !form[field] && (
        <p className="text-xs text-destructive mb-2">Please answer this question</p>
      )}
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setForm(p => ({ ...p, [field]: opt.value }))}
            className={`w-full py-3 px-3 rounded-lg border text-sm font-medium transition-all text-left ${
              form[field] === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : hasError && !form[field]
                  ? 'border-destructive/60 text-muted-foreground hover:border-destructive'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const { data: currentCycle, refetch: refetchCycle } = trpc.checkIn.myCurrentCycle.useQuery();
  const { data: history = [] } = trpc.checkIn.myHistory.useQuery();

  const blankForm: CheckInFormState = {
    dietWeighedFoods: '', dietMealPrepAccuracy: '', dietExtrasFrequency: '',
    dietAddedFats: '', dietMealTiming: '', dietOffPlanQuality: '',
    sleepBedtimeConsistency: '', adherenceBarrier: '', barrierExplain: '', weeklyAssessment: '',
  };
  const [form, setForm] = useState(blankForm);
  const [showErrors, setShowErrors] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [subTab, setSubTab] = useState<'form' | 'measurements'>('form');

  const q1Ref = useRef<HTMLDivElement>(null);
  const q2Ref = useRef<HTMLDivElement>(null);
  const q3Ref = useRef<HTMLDivElement>(null);
  const q4Ref = useRef<HTMLDivElement>(null);
  const requiredFields: [keyof CheckInFormState, React.RefObject<HTMLDivElement | null>][] = [
    ['dietWeighedFoods', q1Ref],
    ['dietMealPrepAccuracy', q2Ref],
    ['dietExtrasFrequency', q3Ref],
    ['sleepBedtimeConsistency', q4Ref],
  ];

  const cycleStatus: CycleStatus = (currentCycle?.status as CycleStatus) ?? "upcoming";
  const dueDate = currentCycle?.dueDate ?? null;
  const existingSubmission = currentCycle?.submission ?? null;
  const checkInDay = currentCycle?.checkInDay
    ? currentCycle.checkInDay.charAt(0).toUpperCase() + currentCycle.checkInDay.slice(1)
    : null;

  useEffect(() => {
    if (existingSubmission) {
      setForm({
        dietWeighedFoods: existingSubmission.dietWeighedFoods ?? '',
        dietMealPrepAccuracy: existingSubmission.dietMealPrepAccuracy ?? '',
        dietExtrasFrequency: existingSubmission.dietExtrasFrequency ?? '',
        dietAddedFats: existingSubmission.dietAddedFats ?? '',
        dietMealTiming: existingSubmission.dietMealTiming ?? '',
        dietOffPlanQuality: existingSubmission.dietOffPlanQuality ?? '',
        sleepBedtimeConsistency: (existingSubmission as any).sleepBedtimeConsistency ?? '',
        adherenceBarrier: existingSubmission.adherenceBarrier ?? '',
        barrierExplain: existingSubmission.barrierExplain ?? '',
        weeklyAssessment: existingSubmission.weeklyAssessment ?? '',
      });
    } else {
      setForm(blankForm);
    }
  }, [existingSubmission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = trpc.checkIn.submit.useMutation({
    onSuccess: () => {
      refetchCycle();
      utils.checkIn.myHistory.invalidate();
      // Invalidate the cycle cache so the Overview banner disappears immediately
      utils.checkIn.myCurrentCycle.invalidate();
      setIsEditing(false);
      toast.success('Your check-in has been submitted', { duration: 3000 });
    },
    onError: () => toast.error('Failed to submit. Please try again.'),
  });

  const handleSubmit = () => {
    const required = requiredFields.map(([f]) => form[f]);
    if (required.some(f => !f)) {
      setShowErrors(true);
      const firstUnanswered = requiredFields.find(([field]) => !form[field]);
      if (firstUnanswered) firstUnanswered[1].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    submitMutation.mutate({
      dietWeighedFoods: form.dietWeighedFoods as any,
      dietMealPrepAccuracy: form.dietMealPrepAccuracy as any,
      dietExtrasFrequency: form.dietExtrasFrequency as any,
      dietAddedFats: form.dietAddedFats as any || undefined,
      dietMealTiming: form.dietMealTiming as any || undefined,
      dietOffPlanQuality: form.dietOffPlanQuality as any || undefined,
      sleepBedtimeConsistency: form.sleepBedtimeConsistency as any,
      adherenceBarrier: form.adherenceBarrier as any || undefined,
      barrierExplain: form.barrierExplain || undefined,
      weeklyAssessment: form.weeklyAssessment as any || undefined,
    });
  };

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const shouldShowForm = (cycleStatus === "upcoming" || cycleStatus === "overdue") || (cycleStatus === "submitted" && isEditing);

  const statusBanner = (() => {
    if (!dueDate) return null;
    switch (cycleStatus) {
      case "upcoming":
        return {
          icon: "📅",
          heading: checkInDay ? `Your check-in day is ${checkInDay}` : `Your next check-in`,
          subtext: `Your next check-in is due ${fmtDate(dueDate)}.`,
          className: "bg-card border-border text-foreground"
        };
      case "overdue":
        return {
          icon: "⚠️",
          heading: checkInDay ? `Your check-in day is ${checkInDay}` : `Check-in overdue`,
          subtext: `Your check-in was due ${fmtDate(dueDate)} — please submit as soon as possible.`,
          className: "bg-amber-500/10 border-amber-500/30 text-amber-400"
        };
      case "submitted":
        return {
          icon: "✓",
          heading: checkInDay ? `Your check-in day is ${checkInDay}` : `Check-in submitted`,
          subtext: `Check-in submitted for ${fmtDate(dueDate)}.`,
          className: "bg-green-500/10 border-green-500/30 text-green-400"
        };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(['form', 'measurements'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              subTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'form' ? 'Check-in' : 'Measurements'}
          </button>
        ))}
      </div>

      {subTab === 'measurements' ? <MeasurementsTab /> : (
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
              <button onClick={() => setIsEditing(true)} className="text-xs text-primary hover:opacity-80 font-medium flex-shrink-0">
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {!currentCycle && (
        <div className="bg-card border border-border rounded-xl px-4 py-4">
          <p className="text-sm text-muted-foreground">Your coach has not set up your check-in schedule yet.</p>
        </div>
      )}

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What to send each check-in</p>
        {[
          { num: '1', title: 'Log your measurements', sub: 'Use the Measurements tab above.' },
          { num: '2', title: 'Complete the check-in form below', sub: 'Questions about your week.' },
          { num: '3', title: 'Send progress photos on WhatsApp', sub: 'Front, side, and back.' },
          { num: '4', title: 'Send form clips on WhatsApp', sub: 'One set per exercise from one full session.' },
          { num: '5', title: 'Voice note on WhatsApp', sub: 'A summary of how your week went.' },
        ].map(item => (
          <div key={item.num} className="flex gap-3 items-start">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.num}</span>
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
            Check-in Form — Due {fmtDate(dueDate)}
          </p>
          <Card className="space-y-0 divide-y divide-border mb-4">
            {/* Diet Execution */}
            <div className="space-y-5 pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">Diet Execution</p>
              <ChoiceQuestion
                label="How often did you weigh all of your foods raw/uncooked with a digital scale this week?"
                field="dietWeighedFoods" form={form} setForm={setForm} hasError={showErrors} scrollRef={q1Ref}
                options={[
                  { value: 'every_meal', label: 'Every meal or nearly every meal' },
                  { value: 'most_meals', label: 'Most meals' },
                  { value: 'some_meals', label: 'Some meals' },
                  { value: 'rarely', label: 'Rarely' },
                  { value: 'never', label: 'Never' },
                ]}
              />
              <ChoiceQuestion
                label="How often did you prepare your meals exactly as written in your plan?"
                field="dietMealPrepAccuracy" form={form} setForm={setForm} hasError={showErrors} scrollRef={q2Ref}
                options={[
                  { value: 'every_meal', label: 'Every meal or nearly every meal' },
                  { value: 'most_meals', label: 'Most meals' },
                  { value: 'some_meals', label: 'Some meals' },
                  { value: 'rarely', label: 'Rarely' },
                  { value: 'never', label: 'Never' },
                ]}
              />
              <ChoiceQuestion
                label="Excluding any off-plan meals, how often did you eat or drink anything that was not in your meal plan this week?"
                subtext="e.g. snacks, bites while cooking, handfuls of food, drinks with calories, finishing someone else's food, sauces, dressings, spreads, toppings"
                field="dietExtrasFrequency" form={form} setForm={setForm} hasError={showErrors} scrollRef={q3Ref}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'one_two_days', label: 'On 1–2 days' },
                  { value: 'few_days', label: 'On a few days' },
                  { value: 'most_days', label: 'On most days' },
                  { value: 'every_day', label: 'Every day' },
                ]}
              />
              <ChoiceQuestion
                label="When cooking, how do you use added fats (oil, butter, etc.)?"
                field="dietAddedFats" form={form} setForm={setForm}
                options={[
                  { value: 'light_spray', label: 'Light spray (e.g. cooking spray)' },
                  { value: 'small_amount', label: 'Small amount (less than 1 tsp)' },
                  { value: 'one_tsp_or_more', label: '1 tsp or more' },
                  { value: 'no_added_fats', label: 'No added fats when cooking' },
                ]}
              />
              <ChoiceQuestion
                label="How often did you eat meals more than 2 hours off schedule?"
                field="dietMealTiming" form={form} setForm={setForm}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'one_two_days', label: 'On 1–2 days' },
                  { value: 'few_days', label: 'On a few days' },
                  { value: 'most_days', label: 'On most days' },
                  { value: 'every_day', label: 'Every day' },
                ]}
              />
              <ChoiceQuestion
                label="When you had an off-plan meal, how close was it to your plan in calories/macros?"
                field="dietOffPlanQuality" form={form} setForm={setForm}
                options={[
                  { value: 'very_close', label: 'Very close' },
                  { value: 'somewhat_close', label: 'Somewhat close' },
                  { value: 'not_very_close', label: 'Not very close' },
                  { value: 'very_different', label: 'Very different' },
                  { value: 'no_off_plan_meals', label: 'No off-plan meals this week' },
                ]}
              />
            </div>
            {/* Sleep */}
            <div className="space-y-5 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sleep</p>
              <ChoiceQuestion
                label="How often did you go to bed more than 1 hour later than your planned bedtime?"
                field="sleepBedtimeConsistency" form={form} setForm={setForm} hasError={showErrors} scrollRef={q4Ref}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'one_two_days', label: 'On 1–2 days' },
                  { value: 'few_days', label: 'On a few days' },
                  { value: 'most_days', label: 'On most days' },
                  { value: 'every_day', label: 'Every day' },
                ]}
              />
            </div>
            {/* Adherence Barrier */}
            <div className="space-y-5 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adherence Barrier</p>
              <ChoiceQuestion
                label="What was your biggest barrier to adherence this week?"
                field="adherenceBarrier" form={form} setForm={setForm}
                options={[
                  { value: 'no_issues', label: 'No issues' },
                  { value: 'hunger', label: 'Hunger' },
                  { value: 'cravings', label: 'Cravings' },
                  { value: 'social_events', label: 'Social events' },
                  { value: 'busy_time', label: 'Busy / time constraints' },
                  { value: 'poor_planning', label: 'Poor planning' },
                  { value: 'low_motivation', label: 'Low motivation' },
                  { value: 'travel_disruption', label: 'Travel / disruption' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              {form.adherenceBarrier && form.adherenceBarrier !== 'no_issues' && (
                <div>
                  <p className="text-sm text-foreground mb-2">Can you explain further?</p>
                  <textarea
                    value={form.barrierExplain}
                    onChange={e => setForm(p => ({ ...p, barrierExplain: e.target.value }))}
                    placeholder="Optional — briefly describe what happened"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                  />
                </div>
              )}
            </div>
            {/* Weekly Self-Assessment */}
            <div className="space-y-5 pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Weekly Self-Assessment</p>
              <ChoiceQuestion
                label="Overall, how well did you follow your plan this week?"
                field="weeklyAssessment" form={form} setForm={setForm}
                options={[
                  { value: 'executed_exactly', label: 'Executed exactly as planned' },
                  { value: 'mostly_followed', label: 'Mostly followed' },
                  { value: 'inconsistent', label: 'Inconsistent' },
                  { value: 'didnt_follow', label: "Didn't follow the plan" },
                ]}
              />
            </div>
          </Card>
          <div className="flex gap-3">
            {isEditing && (
              <button onClick={() => setIsEditing(false)} className="flex-1 py-4 border border-border text-muted-foreground font-semibold text-base rounded-xl hover:opacity-80 transition-opacity">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex-1 py-4 bg-primary text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit Check-in'}
            </button>
          </div>
        </div>
      )}

      <Card className="space-y-3.5 border-border/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">After submitting, send on WhatsApp:</p>
        {[
          { icon: '📸', text: 'Progress photos' },
          { icon: '🎥', text: 'Form clips' },
          { icon: '🎙️', text: 'Voice note' },
        ].map(item => (
          <div key={item.text} className="flex gap-3 items-center">
            <span className="text-base">{item.icon}</span>
            <p className="text-sm text-foreground">{item.text}</p>
          </div>
        ))}
      </Card>

      {(history as any[]).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Past Check-ins</p>
          <div className="space-y-2">
            {(history as any[]).map((row: any) => (
              <Card key={row.id} className="opacity-80">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Due {fmtDate(row.dueDate)}</p>
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
