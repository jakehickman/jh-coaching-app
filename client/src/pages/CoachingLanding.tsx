import { useState } from "react";

const WORK_WITH_ME_URL = "https://jakehickman.com/coaching#work-with-me";
const JAKE_PHOTO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663515200499/HZf6zqYa94nKHY3YxXLHa5/jake-portrait_22da64f5.png";

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

// Icon components matching the original
function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconMessage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconTrending() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}

const coachingIcons = [<IconTarget />, <IconShield />, <IconMessage />, <IconTrending />];

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
      {/* Nav — no border, no login link */}
      <header className="px-6 py-5 text-center max-w-3xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          1:1 Online Coaching with Jake Hickman
        </p>
      </header>

      {/* Hero */}
      <section className="max-w-2xl mx-auto px-6 pt-10 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
          Transform Your Body In 12 Weeks
        </h1>
        <p className="text-muted-foreground text-lg mb-10">
          Lose fat, build muscle, and stay consistent with a plan you can actually stick to.
        </p>

        {/* Price */}
        <div className="mb-6">
          <span className="text-5xl font-bold text-foreground">$199</span>
          <span className="text-muted-foreground ml-2 text-base">AUD / month (3-month minimum)</span>
          <p className="text-xs text-muted-foreground mt-1">Cancel anytime. No lock-in.</p>
        </div>

        <a
          href={WORK_WITH_ME_URL}
          className="inline-flex items-center justify-center w-full max-w-sm px-10 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
        >
          Work With Me
        </a>
        <p className="mt-3 text-xs text-muted-foreground">Start immediately. Full access after checkout.</p>

        {/* Guarantee */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary flex-shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className="font-semibold text-foreground">30-Day Money-Back Guarantee</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">No lock-in · Cancel anytime</p>

        {/* Feature list */}
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-2.5 text-left max-w-sm mx-auto">
          {features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary mt-0.5 flex-shrink-0">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {f}
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-8">About Me</p>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-48 h-56 rounded-xl bg-muted flex-shrink-0 overflow-hidden">
              <img
                src={JAKE_PHOTO_URL}
                alt="Jake Hickman"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">Jake Hickman</h2>
              <div className="flex items-center gap-1.5 mb-4">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <p className="text-xs text-primary">Certified, Henselmans PT Course</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                I help people lose fat, build muscle, and stay consistent long term. I focus on effective training plans
                and a diet that's easy to follow. Everything is personalised and adjusted as you go, with ongoing
                accountability to keep you on track.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">My Approach</p>
        <h2 className="text-3xl font-bold mb-5">No guesswork. Just a clear plan.</h2>
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

      {/* Coaching points — list style matching original */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">The Coaching</p>
          <h2 className="text-3xl font-bold mb-4">This isn't a plan you follow alone.</h2>
          <p className="text-muted-foreground text-sm mb-10 leading-relaxed">
            Most people have tried a program before. The difference here is that I'm with you throughout: guiding,
            adjusting, and keeping you moving forward.
          </p>
          <div className="space-y-6">
            {coachingPoints.map((p, i) => (
              <div key={p.title} className="flex items-start gap-4 pb-6 border-b border-border last:border-0 last:pb-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {coachingIcons[i]}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What to Expect</p>
        <div className="grid md:grid-cols-3 gap-5 mt-6">
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
        <div className="max-w-3xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              This is for you if…
            </p>
            <ul className="space-y-3">
              {forYou.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary mt-0.5 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              This isn't for you if…
            </p>
            <ul className="space-y-3">
              {notForYou.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-destructive mt-0.5 flex-shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="max-w-2xl mx-auto px-6 py-14 text-center">
        <a
          href={WORK_WITH_ME_URL}
          className="inline-flex items-center justify-center w-full max-w-sm px-10 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
        >
          Work With Me · $199/mo (3-month minimum)
        </a>
        <div className="mt-4 text-xs text-muted-foreground">
          30-Day Money-Back Guarantee · No lock-in · Cancel anytime
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Client Results</p>
          <p className="text-sm text-muted-foreground mb-10">Join others already making progress</p>
          <div className="grid md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-background border border-border rounded-xl p-6">
                <p className="text-sm text-foreground leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wide mt-0.5">{t.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-14">
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
            className="inline-flex items-center justify-center w-full max-w-sm px-10 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
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
      <footer className="max-w-5xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground border-t border-border">
        <span>Jake Hickman · 1:1 Online Coaching</span>
      </footer>
    </div>
  );
}
