import { useState, useEffect, useRef } from "react";
import { ChevronDown, Shield, Check, Target, Calendar, MessageCircle, TrendingUp } from "lucide-react";

const STRIPE_URL = "https://buy.stripe.com/3cI3co8I670DgtZ23J9AA01";
const JAKE_PHOTO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663515200499/5nqL5RuopGEHVKSxcXsdAJ/jake-portrait-new_47aa37c9.png";

const GREEN = "#22C55E";
const GREEN_HOVER = "#16A34A";
const GREEN_TINT = "#052E1A";

function openStripe() {
  window.open(STRIPE_URL, "_blank", "noopener,noreferrer");
}

function GreenButton({ children, className = "", small = false }: { children: React.ReactNode; className?: string; small?: boolean }) {
  return (
    <button
      onClick={openStripe}
      className={`font-body font-semibold uppercase tracking-widest transition-colors duration-200 ${small ? "text-xs py-4" : "text-sm py-4"} ${className}`}
      style={{ backgroundColor: GREEN, color: "#000000" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
    >
      {children}
    </button>
  );
}

function Guarantee({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-2 mb-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          style={{ color: GREEN }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p className={`font-body font-semibold text-sm ${onDark ? "text-white/90" : "text-foreground"}`}>
          30-Day Money-Back Guarantee
        </p>
      </div>
      <p className={`font-body text-xs text-center max-w-xs mx-auto ${onDark ? "text-white/40" : "text-muted-foreground"}`}>
        No lock-in · Cancel anytime
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between py-4 text-left gap-4"
        aria-expanded={open}
      >
        <span className="font-body font-medium text-sm text-foreground leading-snug">{q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground mt-0.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-64 pb-4" : "max-h-0"}`}>
        <p className="font-body text-muted-foreground text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

function useFadeUp(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

const coachingPoints = [
  {
    icon: <Target size={16} />,
    title: "I'll build a plan that fits your life",
    desc: "Your training and nutrition are built around your goals and what you can realistically stick to. Not a template.",
  },
  {
    icon: <Calendar size={16} />,
    title: "I'll keep you accountable",
    desc: "Regular check-ins mean you can't quietly fall off. I'll notice, I'll follow up, and I'll help you get back on track.",
  },
  {
    icon: <MessageCircle size={16} />,
    title: "I'm available when you need me",
    desc: "You'll have direct access to me. If something comes up, send me a message and I'll respond.",
  },
  {
    icon: <TrendingUp size={16} />,
    title: "I'll adjust as you progress",
    desc: "What works in week one won't be what you need in week eight. I'll update your plan so you keep moving forward.",
  },
];

export default function CoachingLanding() {
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Show sticky CTA after scrolling past hero
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        setStickyVisible(heroRef.current.getBoundingClientRect().bottom < 0);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fade-up refs
  const aboutRef = useRef<HTMLDivElement>(null);
  const approachRef = useRef<HTMLDivElement>(null);
  const coachingRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);

  useFadeUp(aboutRef);
  useFadeUp(approachRef);
  useFadeUp(coachingRef);
  useFadeUp(testimonialsRef);
  useFadeUp(faqRef);
  useFadeUp(finalCtaRef);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky mobile CTA */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${stickyVisible ? "translate-y-0" : "translate-y-full"}`}
      >
        <GreenButton className="w-full" small>
          Work with Jake · $199 AUD/mo (3-month minimum)
        </GreenButton>
      </div>

      {/* Hero */}
      <section className="bg-background pt-10 pb-12 md:pt-14 md:pb-16">
        <div ref={heroRef} className="max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-8 text-center">
            1:1 Online Coaching with Jake Hickman
          </p>
          <h1 className="font-display text-foreground text-5xl md:text-5xl font-bold leading-[1.1] text-center mb-4">
            Transform Your Body In 12 Weeks
          </h1>
          <p className="font-body text-muted-foreground text-lg md:text-lg leading-relaxed text-center mb-8">
            Lose fat, build muscle, and stay consistent with a plan you can actually stick to.
          </p>

          {/* Price */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="font-display text-foreground text-4xl font-bold">$199</span>
            <div className="text-left">
              <p className="font-body text-foreground text-sm font-medium leading-tight">AUD / month (3-month minimum)</p>
              <p className="font-body text-muted-foreground text-sm">Cancel anytime. No lock-in.</p>
            </div>
          </div>

          {/* CTA */}
          <GreenButton className="w-full">Work With Me</GreenButton>
          <p className="font-body text-muted-foreground text-sm text-center mt-2">
            Start immediately. Full access after checkout.
          </p>
          <Guarantee />
        </div>
      </section>

      {/* Feature list */}
      <div className="border-t border-border" />
      <section className="bg-card py-8">
        <div className="max-w-[620px] mx-auto px-5">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              "Training program built for you",
              "Nutrition plan tailored to you",
              "Weekly check-ins & accountability",
              "Simple, sustainable approach",
              "Ongoing plan adjustments",
              "Work directly with me",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 font-body text-foreground text-base">
                <Check size={13} className="shrink-0" style={{ color: GREEN }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* About */}
      <div className="border-t border-border" />
      <section className="py-14 bg-background">
        <div ref={aboutRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-6">About Me</p>
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="shrink-0 w-full md:w-56">
              <div
                className="w-full max-w-[200px] md:max-w-none"
                style={{ backgroundColor: "#111111", padding: "8px", border: "1px solid #1F1F1F" }}
              >
                <img
                  src={JAKE_PHOTO_URL}
                  alt="Jake Hickman, Online Fitness Coach"
                  className="w-full object-contain md:h-full md:object-top"
                  style={{ filter: "brightness(0.97) contrast(1.02)", backgroundColor: "#111111" }}
                />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-display text-foreground text-2xl font-bold mb-1">Jake Hickman</p>
              <div className="flex items-center gap-1.5 mb-4">
                <Shield size={13} className="text-muted-foreground shrink-0" />
                <p className="font-body text-muted-foreground text-sm">Certified, Henselmans PT Course</p>
              </div>
              <p className="font-body text-muted-foreground text-base leading-relaxed">
                I help people lose fat, build muscle, and stay consistent long term. I focus on effective training plans
                and a diet that's easy to follow. Everything is personalised and adjusted as you go, with ongoing
                accountability to keep you on track.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Approach */}
      <div className="border-t border-border" />
      <section className="py-14 bg-background">
        <div ref={approachRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-4">My approach</p>
          <h2 className="font-display text-foreground text-2xl md:text-3xl font-bold leading-tight mb-5">
            No guesswork. Just a clear plan.
          </h2>
          <div className="flex flex-col gap-4 font-body text-muted-foreground text-base leading-relaxed">
            <p>
              You get a training and nutrition plan built for you, with regular reviews and adjustments so you always
              know exactly what to do next.
            </p>
            <p>Everything is built around your body, your goals, and what you can realistically stick to.</p>
            <p>You'll have direct access to me for questions, form checks, or when you need a push.</p>
          </div>
        </div>
      </section>

      {/* Coaching points */}
      <div className="border-t border-border" />
      <section className="py-14 bg-background">
        <div ref={coachingRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-4">The coaching</p>
          <h2 className="font-display text-foreground text-2xl md:text-3xl font-bold leading-tight mb-3">
            This isn't a plan you follow alone.
          </h2>
          <p className="font-body text-muted-foreground text-base leading-relaxed mb-8">
            Most people have tried a program before. The difference here is that I'm with you throughout: guiding,
            adjusting, and keeping you moving forward.
          </p>
          <div className="flex flex-col">
            {coachingPoints.map((point) => (
              <div key={point.title} className="flex items-start gap-4 py-5 border-t border-border">
                <div
                  className="shrink-0 w-8 h-8 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: GREEN_TINT, color: GREEN }}
                >
                  {point.icon}
                </div>
                <div>
                  <p className="font-body font-semibold text-foreground text-base mb-0.5">{point.title}</p>
                  <p className="font-body text-muted-foreground text-base leading-relaxed">{point.desc}</p>
                </div>
              </div>
            ))}
            <div className="border-t border-border" />
          </div>

          {/* What to expect */}
          <div className="mt-10 mb-10">
            <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-5">What to expect</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { result: "Fat loss", detail: "Lose fat with a clear plan. No guessing, no trial and error." },
                {
                  result: "Muscle gain",
                  detail: "Build strength and muscle with training that actually changes how your body looks over time.",
                },
                {
                  result: "Consistency",
                  detail: "A clear structure that keeps you showing up, even when motivation isn't there.",
                },
              ].map(({ result, detail }) => (
                <div
                  key={result}
                  className="p-4"
                  style={{ border: "1px solid #1F1F1F", backgroundColor: "#111111" }}
                >
                  <p className="font-display text-foreground font-bold text-base mb-1">{result}</p>
                  <p className="font-body text-muted-foreground text-sm leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* For / Not for */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div>
              <p className="font-body text-foreground text-xs font-semibold uppercase tracking-widest mb-3">
                This is for you if…
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  "You're serious about making a change",
                  "You want a plan built for you, not a template",
                  "You're willing to put in the work",
                  "You want someone keeping you accountable",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-muted-foreground text-base">
                    <Check size={13} className="shrink-0 mt-0.5" style={{ color: GREEN }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-body text-foreground text-xs font-semibold uppercase tracking-widest mb-3">
                This isn't for you if…
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  "You're looking for a quick fix",
                  "You're not willing to be consistent",
                  "You expect results without putting in the work",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-muted-foreground text-base">
                    <span className="shrink-0 text-muted-foreground mt-0.5 text-xs leading-none">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Mid CTA */}
          <GreenButton className="w-full">Work with me · $199/mo (3-month minimum)</GreenButton>
          <Guarantee />
        </div>
      </section>

      {/* Testimonials */}
      <div className="border-t border-border" />
      <section className="py-14" style={{ backgroundColor: GREEN_TINT }}>
        <div ref={testimonialsRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-xs uppercase tracking-widest mb-8" style={{ color: GREEN }}>
            Client results
          </p>
          <div className="flex flex-col gap-6">
            {[
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
            ].map((t) => (
              <div
                key={t.name}
                className="p-6"
                style={{ backgroundColor: "#111111", borderLeft: `2px solid ${GREEN}` }}
              >
                <p className="font-display italic text-foreground text-lg leading-snug mb-3">"{t.quote}"</p>
                <p className="font-body text-foreground text-sm font-semibold">{t.name}</p>
                <p className="font-body text-muted-foreground text-xs uppercase tracking-wider">{t.result}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="border-t border-border" />
      <section className="py-14 bg-background">
        <div ref={faqRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-6">Questions</p>
          {[
            {
              q: "Do I need gym experience?",
              a: "Nope. I'll guide you through everything. Whether you're new or experienced, the plan is built around your level.",
            },
            {
              q: "Do I need to track calories?",
              a: "Not necessarily. For some people it helps, for others I keep things simpler. It depends on what works best for you.",
            },
            {
              q: "How does accountability work?",
              a: "I check in regularly, review your progress, and adjust your plan as needed. If things slip, I step in early and get you back on track.",
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
              a: "Real progress takes time. The first phase is about setting everything up, then I help you build momentum and start seeing results.",
            },
            {
              q: "What if I'm not happy or don't see results?",
              a: "If you're not happy within the first 30 days, I'll give you a full refund. No questions asked.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. There's no lock-in. You can cancel whenever you want.",
            },
          ].map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
          <div className="border-t border-border" />
        </div>
      </section>

      {/* Join others */}
      <div className="border-t border-border" />
      <p className="font-body text-muted-foreground text-xs uppercase tracking-widest text-center py-6">
        Join others already making progress
      </p>

      {/* Final CTA */}
      <section className="py-14 md:py-20" style={{ backgroundColor: "#111111" }}>
        <div ref={finalCtaRef} className="fade-up max-w-[620px] mx-auto px-5 text-center">
          <h2 className="font-display text-foreground text-3xl md:text-4xl font-bold leading-tight mb-4">
            Ready to get started?
          </h2>
          <p className="font-body text-muted-foreground text-base leading-relaxed mb-8 max-w-sm mx-auto">
            Get a clear plan, ongoing accountability, and direct support. Everything you need to start making progress
            immediately.
          </p>
          <GreenButton className="w-full max-w-sm mx-auto block">Work With Me Now</GreenButton>
          <p className="font-body text-muted-foreground text-sm text-center mt-2">
            $199 AUD/month (3-month minimum). Cancel anytime.
          </p>
          <Guarantee onDark />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border" style={{ backgroundColor: "#111111" }}>
        <div className="max-w-[620px] mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-2">
          <span className="font-body text-muted-foreground text-xs">Jake Hickman · 1:1 Online Coaching</span>
          <span className="font-body text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Mobile spacer for sticky button */}
      <div className="h-14 md:hidden" />
    </div>
  );
}
