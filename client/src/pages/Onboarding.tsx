import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

type FormData = {
  fullName: string;
  email: string;
  age: string;
  heightCm: string;
  currentWeightKg: string;
  goalWeightKg: string;
  primaryGoal: string;
  trainingExperience: string;
  trainingFrequency: string;
  equipment: string;
  dietApproach: string;
  injuries: string;
  lifestyle: string;
  additionalInfo: string;
};

const INITIAL: FormData = {
  fullName: "",
  email: "",
  age: "",
  heightCm: "",
  currentWeightKg: "",
  goalWeightKg: "",
  primaryGoal: "",
  trainingExperience: "",
  trainingFrequency: "",
  equipment: "",
  dietApproach: "",
  injuries: "",
  lifestyle: "",
  additionalInfo: "",
};

const EXPERIENCE_OPTIONS = ["None", "Less than 1 year", "1–3 years", "3+ years"];
const FREQUENCY_OPTIONS = ["1–2 days/week", "3 days/week", "4 days/week", "5+ days/week"];
const EQUIPMENT_OPTIONS = ["Commercial gym", "Home gym", "Minimal / bodyweight only"];
const DIET_OPTIONS = [
  "Track calories & macros",
  "Flexible / intuitive eating",
  "No preference — you decide",
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-foreground mb-1.5">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
    />
  );
}

function SelectGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? "" : opt)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            value === opt
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:border-primary/50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const submit = trpc.onboarding.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    submit.mutate({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      age: form.age ? parseInt(form.age) : undefined,
      heightCm: form.heightCm ? parseFloat(form.heightCm) : undefined,
      currentWeightKg: form.currentWeightKg ? parseFloat(form.currentWeightKg) : undefined,
      goalWeightKg: form.goalWeightKg ? parseFloat(form.goalWeightKg) : undefined,
      primaryGoal: form.primaryGoal || undefined,
      trainingExperience: form.trainingExperience || undefined,
      trainingFrequency: form.trainingFrequency || undefined,
      equipment: form.equipment || undefined,
      dietApproach: form.dietApproach || undefined,
      injuries: form.injuries || undefined,
      lifestyle: form.lifestyle || undefined,
      additionalInfo: form.additionalInfo || undefined,
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-primary text-xl">✓</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">You're all set.</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Your onboarding form has been submitted. I'll review your answers and send your plan within 24–48 hours.
          </p>
          <div className="bg-card border border-border rounded-xl p-6 text-left mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">What happens next</p>
            <div className="space-y-4">
              {[
                { n: "1", text: "I review your answers and build your plan" },
                { n: "2", text: "I send your plan with a video explaining everything within 24–48 hours" },
                { n: "3", text: "You sign in to your client dashboard to access everything" },
              ].map((step) => (
                <div key={step.n} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.n}
                  </span>
                  <p className="text-sm text-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
          <Link href="/" className="text-sm text-primary hover:underline">
            Go to client dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 px-6 py-4 max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          1:1 Online Coaching with Jake Hickman
        </p>
      </header>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>✓</span> Payment confirmed
        </div>
        <h1 className="text-4xl font-bold mb-4">You're in. Let's get started.</h1>
        <p className="text-muted-foreground text-base mb-3">
          The next step is to complete the onboarding form. Once submitted, you'll receive your plan within 24–48 hours.
        </p>
        <p className="text-muted-foreground text-sm">
          This will take around 5–10 minutes. Answer as best you can. There are no perfect answers. The more honest and
          accurate you are, the better I can tailor everything to you.
        </p>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-8">
            Complete your onboarding below
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-5 pb-2 border-b border-border">
                Personal Details
              </h2>
              <div className="space-y-4">
                <div>
                  <Label>Full name *</Label>
                  <Input value={form.fullName} onChange={set("fullName")} placeholder="Your name" />
                </div>
                <div>
                  <Label>Email address *</Label>
                  <Input value={form.email} onChange={set("email")} placeholder="you@example.com" type="email" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Age</Label>
                    <Input value={form.age} onChange={set("age")} placeholder="e.g. 28" type="number" />
                  </div>
                  <div>
                    <Label>Height (cm)</Label>
                    <Input value={form.heightCm} onChange={set("heightCm")} placeholder="e.g. 175" type="number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Current weight (kg)</Label>
                    <Input value={form.currentWeightKg} onChange={set("currentWeightKg")} placeholder="e.g. 80" type="number" />
                  </div>
                  <div>
                    <Label>Goal weight (kg, optional)</Label>
                    <Input value={form.goalWeightKg} onChange={set("goalWeightKg")} placeholder="e.g. 70" type="number" />
                  </div>
                </div>
              </div>
            </div>

            {/* Goals */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-5 pb-2 border-b border-border">
                Goals & Training
              </h2>
              <div className="space-y-5">
                <div>
                  <Label>What's your primary goal?</Label>
                  <Textarea
                    value={form.primaryGoal}
                    onChange={set("primaryGoal")}
                    placeholder="e.g. Lose 10kg, build muscle, improve fitness for a specific event..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Training experience</Label>
                  <SelectGroup
                    options={EXPERIENCE_OPTIONS}
                    value={form.trainingExperience}
                    onChange={set("trainingExperience")}
                  />
                </div>
                <div>
                  <Label>How many days per week can you train?</Label>
                  <SelectGroup
                    options={FREQUENCY_OPTIONS}
                    value={form.trainingFrequency}
                    onChange={set("trainingFrequency")}
                  />
                </div>
                <div>
                  <Label>Equipment available</Label>
                  <SelectGroup
                    options={EQUIPMENT_OPTIONS}
                    value={form.equipment}
                    onChange={set("equipment")}
                  />
                </div>
              </div>
            </div>

            {/* Nutrition */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-5 pb-2 border-b border-border">
                Nutrition
              </h2>
              <div>
                <Label>Preferred approach to diet</Label>
                <SelectGroup
                  options={DIET_OPTIONS}
                  value={form.dietApproach}
                  onChange={set("dietApproach")}
                />
              </div>
            </div>

            {/* Health & lifestyle */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-5 pb-2 border-b border-border">
                Health & Lifestyle
              </h2>
              <div className="space-y-4">
                <div>
                  <Label>Any injuries, pain, or physical limitations?</Label>
                  <Textarea
                    value={form.injuries}
                    onChange={set("injuries")}
                    placeholder="e.g. Lower back pain, bad knees, shoulder injury... or 'None'"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Tell me about your lifestyle</Label>
                  <Textarea
                    value={form.lifestyle}
                    onChange={set("lifestyle")}
                    placeholder="Work schedule, stress levels, sleep quality, any constraints I should know about..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Anything else */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-5 pb-2 border-b border-border">
                Anything Else
              </h2>
              <div>
                <Label>Is there anything else you'd like me to know?</Label>
                <Textarea
                  value={form.additionalInfo}
                  onChange={set("additionalInfo")}
                  placeholder="Previous experience, specific concerns, questions, context that might help..."
                  rows={4}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={submit.isPending}
              className="w-full py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submit.isPending ? "Submitting…" : "Submit Onboarding Form"}
            </button>
          </form>
        </div>

        {/* What happens next */}
        <div className="mt-8 bg-card border border-border rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">What happens next</p>
          <div className="space-y-4">
            {[
              { n: "1", text: "Complete the onboarding form" },
              { n: "2", text: "I'll review your answers and create your plan" },
              { n: "3", text: "I'll send your plan with a video explaining everything within 24–48 hours" },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.n}
                </span>
                <p className="text-sm text-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground border-t border-border">
        Jake Hickman · 1:1 Online Coaching · © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
