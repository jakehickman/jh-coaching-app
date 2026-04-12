import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useViewAs } from "@/contexts/ViewAsContext";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr, localToday } from "@/lib/dates";
import { Card } from "./shared";
import MeasurementsTab from "./MeasurementsTab";

// ─── Types ────────────────────────────────────────────────────────────────────
type CheckInFormState = {
  sleepBedtimeConsistency: string;
  dietWeighedFoods: string;
  dietMealPrepAccuracy: string;
  dietExtrasFrequency: string;
};

// ─── ChoiceQuestion ───────────────────────────────────────────────────────────
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

// ─── CheckInsTab ────────────────────────────────────────────────────────────────────────────────
export default function CheckInsTab() {
  const { viewAsUserId } = useViewAs();
  const { data: profileOwn } = trpc.profile.get.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: profileAdmin } = trpc.profile.getById.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const profile = viewAsUserId ? profileAdmin : profileOwn;
  const today = localToday();

  const getMondayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const currentWeekStart = getMondayOfWeek(today);
  const { data: existingCheckInOwn, refetch: refetchOwn } = trpc.checkIn.myWeek.useQuery({ weekStartDate: currentWeekStart }, { enabled: !viewAsUserId });
  const { data: existingCheckInAdmin, refetch: refetchAdmin } = trpc.checkIn.weekForClient.useQuery({ clientId: viewAsUserId!, weekStartDate: currentWeekStart }, { enabled: !!viewAsUserId });
  const existingCheckIn = viewAsUserId ? existingCheckInAdmin : existingCheckInOwn;
  const refetch = viewAsUserId ? refetchAdmin : refetchOwn;
  const { data: allCheckInsOwn = [] } = trpc.checkIn.myList.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: allCheckInsAdmin = [] } = trpc.checkIn.clientList.useQuery({ clientId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const allCheckIns = viewAsUserId ? allCheckInsAdmin : allCheckInsOwn;
  const blankForm: CheckInFormState = {
    dietWeighedFoods: '',
    dietMealPrepAccuracy: '',
    dietExtrasFrequency: '',
    sleepBedtimeConsistency: '',
  };
  const [form, setForm] = useState(blankForm);
  const [submitted, setSubmitted] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const q1Ref = useRef<HTMLDivElement>(null);
  const q2Ref = useRef<HTMLDivElement>(null);
  const q3Ref = useRef<HTMLDivElement>(null);
  const q4Ref = useRef<HTMLDivElement>(null);
  const questionRefs: [keyof CheckInFormState, React.RefObject<HTMLDivElement | null>][] = [
    ['dietWeighedFoods', q1Ref],
    ['dietMealPrepAccuracy', q2Ref],
    ['dietExtrasFrequency', q3Ref],
    ['sleepBedtimeConsistency', q4Ref],
  ];

  useEffect(() => {
    if (existingCheckIn) {
      setForm({
        dietWeighedFoods: existingCheckIn.dietWeighedFoods ?? '',
        dietMealPrepAccuracy: existingCheckIn.dietMealPrepAccuracy ?? '',
        dietExtrasFrequency: existingCheckIn.dietExtrasFrequency ?? '',
        sleepBedtimeConsistency: existingCheckIn.sleepBedtimeConsistency ?? '',
      });
      setSubmitted(true);
    } else {
      setForm(blankForm);
      setSubmitted(false);
    }
  }, [existingCheckIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = trpc.checkIn.submit.useMutation({
    onSuccess: () => {
      refetch();
      setSubmitted(true);
      toast.success('Your check-in has been submitted', { duration: 3000 });
    },
    onError: () => toast.error('Failed to submit. Please try again.'),
  });

  const handleSubmit = () => {
    const dietFields = [form.dietWeighedFoods, form.dietMealPrepAccuracy, form.dietExtrasFrequency, form.sleepBedtimeConsistency];
    if (dietFields.some(f => !f)) {
      setShowErrors(true);
      const firstUnanswered = questionRefs.find(([field]) => !form[field]);
      if (firstUnanswered) {
        firstUnanswered[1].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    submitMutation.mutate({
      weekStartDate: currentWeekStart,
      dietWeighedFoods: form.dietWeighedFoods as any,
      dietMealPrepAccuracy: form.dietMealPrepAccuracy as any,
      dietExtrasFrequency: form.dietExtrasFrequency as any,
      sleepBedtimeConsistency: form.sleepBedtimeConsistency as any,
    });
  };

  const checkInDay = (profile as any)?.checkInDay;
  const dayLabel = checkInDay ? checkInDay.charAt(0).toUpperCase() + checkInDay.slice(1) : null;

  const fmtWeekStart = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const [subTab, setSubTab] = useState<'form' | 'measurements'>('form');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (submitted) setIsEditing(false);
  }, [submitted]);

  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(['form', 'measurements'] as const).map(t => (
          <button
            key={t}
            type="button"
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
      {/* Check-in Day Banner */}
      <div className="bg-card border border-border rounded-xl px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="text-primary text-lg mt-0.5">📅</span>
          <div className="flex-1">
            {dayLabel ? (
              <>
                <p className="text-sm font-semibold text-foreground">Your check-in day: {dayLabel}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Complete your weekly check-in on your assigned day. Start by logging your measurements, then fill in the form below and send your progress photos, form clips, and a voice note to me on WhatsApp.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Your coach hasn't assigned a check-in day yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* What to send each check-in */}
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
              {item.sub
                ? <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.sub}</p>
                : <p className="text-sm text-muted-foreground/0 mt-0.5 leading-relaxed select-none">&nbsp;</p>
              }
            </div>
          </div>
        ))}
      </Card>

      {/* Submitted summary card */}
      {submitted && !isEditing && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-primary text-lg">✓</span>
              <p className="text-sm font-semibold text-foreground">You've submitted this week's check-in</p>
            </div>
            {!viewAsUserId && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-primary hover:opacity-80 font-medium"
              >
                Edit
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Check-in Form */}
      {(!submitted || isEditing) && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Check-in Form — Week of {fmtWeekStart(currentWeekStart)}</p>

        <Card className="space-y-6 mb-4">
          <ChoiceQuestion
            label="How often did you weigh all of your foods raw/uncooked with a digital scale this week?"
            field="dietWeighedFoods"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q1Ref}
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
            field="dietMealPrepAccuracy"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q2Ref}
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
            field="dietExtrasFrequency"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q3Ref}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'one_two_days', label: 'On 1–2 days' },
              { value: 'few_days', label: 'On a few days' },
              { value: 'most_days', label: 'On most days' },
              { value: 'every_day', label: 'Every day' },
            ]}
          />

          <ChoiceQuestion
            label="How often did you go to bed more than 1 hour later than your planned bedtime?"
            field="sleepBedtimeConsistency"
            form={form}
            setForm={setForm}
            hasError={showErrors}
            scrollRef={q4Ref}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'one_two_days', label: 'On 1–2 days' },
              { value: 'few_days', label: 'On a few days' },
              { value: 'most_days', label: 'On most days' },
              { value: 'every_day', label: 'Every day' },
            ]}
          />
        </Card>

        {!viewAsUserId && (
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
              disabled={submitMutation.isPending}
              className="flex-1 py-4 bg-primary text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit Check-in'}
            </button>
          </div>
        )}
      </div>
      )}

      {/* WhatsApp reminder */}
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

      {/* Past Check-ins */}
      {allCheckIns.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Past Check-ins</p>
          <div className="space-y-2">
            {allCheckIns.slice(1).map(ci => (
              <Card key={ci.id} className="opacity-80">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Week of {fmtWeekStart(toLocalDateStr(ci.weekStartDate))}</p>
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
