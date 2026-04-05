import { useState } from "react";
import { Link } from "wouter";

const WORK_WITH_ME_URL = "https://jakehickman.com/coaching#work-with-me";

const features = [
  "Training program built for you",
  "Nutrition plan tailored to you",
  "Weekly check-ins & accountability",
  "Simple, sustainable approach",
  "Ongoing plan adjustments",
  "Work directly with me",
];

const coachingPoints = [
  {
    title: "I'll build a plan that fits your life",
    desc: "Your training and nutrition are built around your goals and what you can realistically stick to. Not a template.",
  },
  {
    title: "I'll keep you accountable",
    desc: "Regular check-ins mean you can't quietly fall off. I'll notice, I'll follow up, and I'll help you get back on track.",
  },
  {
    title: "I'm available when you need me",
    desc: "You'll have direct access to me. If something comes up, send me a message and I'll respond.",
  },
  {
    title: "I'll adjust as you progress",
    desc: "What works in week one won't be what you need in week eight. I'll update your plan so you keep moving forward.",
  },
];

const outcomes = [
  {
    label: "Fat loss",
    desc: "Lose fat with a clear plan. No guessing, no trial and error.",
  },
  {
    label: "Muscle gain",
    desc: "Build strength and muscle with training that actually changes how your body looks over time.",
  },
  {
    label: "Consistency",
    desc: "A clear structure that keeps you showing up, even when motivation isn't there.",
  },
];

const forYou = [
  "You're serious about making a change",
  "You want a plan built for you, not a template",
  "You're willing to put in the work",
  "You want someone keeping you accountable",
];

const notForYou = [
  "You're looking for a quick fix",
  "You're not willing to be consistent",
  "You expect results without putting in the work",
];

const testimonials = [
  {
    quote:
      "I feel completely different. I'm more confident, I'm not out of breath from simple activity anymore, and even my joints feel better. No more constant popping or knee pain when I bend down. It's made a huge difference to how I feel day to day.",
    name: "Alex",
    result: "Lost 15kg",
  },
  {
    quote:
      "Working with Jake helped me build habits I can actually stick to. Having him there kept me accountable, and now I feel confident continuing on my own and pushing myself. Everything I learned over the past few months has made a lasting difference.",
    name: "Aurelie",
    result: "Lost 7kg",
  },
];

const faqs = [
  {
    q: "Do I need gym experience?",
    a: "Nope. I'll guide you through everything. Whether you're new or experienced, the plan is built around your level.",
  },
  {
    q: "Do I need to track calories?",
    a: "Not necessarily. For some people it helps, for others we keep things simpler. It depends on what works best for you.",
  },
  {
    q: "How does accountability work?",
    a: "We check in regularly, review your progress, and adjust your plan as needed. If things slip, I step in early and get you back on track.",
  },
  {
    q: "Will I be in contact with you?",
    a: "Yes. You'll have direct access to me. If something comes up between check-ins, reach out and I'll respond.",
  },
  {
    q: "How quickly will I see results?",
    a: "Most people start noticing changes within the first 2–4 weeks, with more visible results as you continue.",
  },
  {
    q: "What if I've tried before and it didn't work?",
    a: "That's exactly who this is for. The difference here is structure, accountability, and a plan that's built to work in real life.",
  },
  {
    q: "Why is it a 3-month commitment?",
    a: "Real progress takes time. The first phase is about setting everything up, then we build momentum and start seeing results.",
  },
  {
    q: "What if I'm not happy or don't see results?",
    a: "If you're not happy within the first 30 days, I'll give you a full refund. No questions asked.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There's no lock-in. You can cancel whenever you want.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left text-sm font-semibold text-foreground hover:text-primary transition-colors"
      >
        {q}
        <span className="ml-4 text-muted-foreground text-lg leading-none flex-shrink-0">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function CoachingLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          1:1 Online Coaching with Jake Hickman
        </p>
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Client Login →
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
          Transform Your Body In 12 Weeks
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          Lose fat, build muscle, and stay consistent with a plan you can actually stick to.
        </p>

        {/* Price */}
        <div className="mb-8">
          <span className="text-5xl font-bold text-foreground">$199</span>
          <span className="text-muted-foreground ml-2 text-base">AUD / month (3-month minimum)</span>
          <p className="text-xs text-muted-foreground mt-1">Cancel anytime. No lock-in.</p>
        </div>

        <a
          href={WORK_WITH_ME_URL}
          className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
        >
          Work With Me
        </a>
        <p className="mt-3 text-xs text-muted-foreground">Start immediately. Full access after checkout.</p>

        {/* Guarantee */}
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-primary">✓</span>
          <span>30-Day Money-Back Guarantee · No lock-in · Cancel anytime</span>
        </div>

        {/* Feature list */}
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-2 text-left max-w-sm mx-auto">
          {features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-foreground">
              <span className="text-primary mt-0.5">✓</span>
              {f}
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-10 items-center">
          <div className="w-32 h-32 rounded-full bg-muted flex-shrink-0 overflow-hidden">
            <img
              src="https://jakehickman.com/jake.jpg"
              alt="Jake Hickman"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">About Me</p>
            <h2 className="text-2xl font-bold mb-1">Jake Hickman</h2>
            <p className="text-xs text-primary mb-4">Certified, Henselmans PT Course</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I help people lose fat, build muscle, and stay consistent long term. I focus on effective training plans
              and a diet that's easy to follow. Everything is personalised and adjusted as you go, with ongoing
              accountability to keep you on track.
            </p>
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">My Approach</p>
        <h2 className="text-3xl font-bold mb-4">No guesswork. Just a clear plan.</h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-3">
          You get a training and nutrition plan built for you, with regular reviews and adjustments so you always know
          exactly what to do next.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed mb-3">
          Everything is built around your body, your goals, and what you can realistically stick to.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          You'll have direct access to me for questions, form checks, or when you need a push.
        </p>
      </section>

      {/* Coaching points */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">The Coaching</p>
          <h2 className="text-3xl font-bold mb-10">This isn't a plan you follow alone.</h2>
          <p className="text-muted-foreground text-sm mb-10 leading-relaxed">
            Most people have tried a program before. The difference here is that I'm with you throughout: guiding,
            adjusting, and keeping you moving forward.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {coachingPoints.map((p) => (
              <div key={p.title} className="bg-background border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What to Expect</p>
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {outcomes.map((o) => (
            <div key={o.label} className="border border-border rounded-xl p-5">
              <div className="w-2 h-2 rounded-full bg-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-2">{o.label}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{o.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For you / not for you */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              This is for you if…
            </p>
            <ul className="space-y-3">
              {forYou.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              This isn't for you if…
            </p>
            <ul className="space-y-3">
              {notForYou.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-destructive mt-0.5">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="max-w-2xl mx-auto px-6 py-16 text-center">
        <a
          href={WORK_WITH_ME_URL}
          className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
        >
          Work With Me · $199/mo (3-month minimum)
        </a>
        <div className="mt-4 text-xs text-muted-foreground">
          30-Day Money-Back Guarantee · No lock-in · Cancel anytime
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Client Results</p>
          <p className="text-sm text-muted-foreground mb-10">Join others already making progress</p>
          <div className="grid md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-background border border-border rounded-xl p-6">
                <p className="text-sm text-foreground leading-relaxed mb-4 italic">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wide">{t.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Questions</p>
        <div>
          {faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-card border-y border-border">
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Ready to get started?
          </p>
          <h2 className="text-3xl font-bold mb-4">
            Get a clear plan, ongoing accountability, and direct support.
          </h2>
          <p className="text-muted-foreground text-sm mb-8">
            Everything you need to start making progress immediately.
          </p>
          <a
            href={WORK_WITH_ME_URL}
            className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
          >
            Work With Me Now
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            $199 AUD/month (3-month minimum). Cancel anytime.
          </p>
          <div className="mt-3 text-xs text-muted-foreground">
            30-Day Money-Back Guarantee · No lock-in · Cancel anytime
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
        <span>Jake Hickman · 1:1 Online Coaching</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
