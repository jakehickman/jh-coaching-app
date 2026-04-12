import { useState, useEffect, useRef } from "react";
import { ChevronDown, Shield, Check, Target, Calendar, MessageCircle, TrendingUp } from "lucide-react";
import {
  STRIPE_URL,
  JAKE_PHOTO_URL,
  stickyCta,
  hero,
  featureList,
  about,
  approach,
  coachingSection,
  coachingPoints,
  whatToExpect,
  forSection,
  testimonialsSection,
  testimonials,
  faqSection,
  faqs,
  joinBanner,
  finalCta,
  guarantee,
  footer,
  midCta,
} from "@/content/coachingPageContent";

const GREEN = "#22C55E";
const GREEN_HOVER = "#16A34A";
const GREEN_TINT = "#052E1A";

// Map icon name strings from the content file to Lucide components
const ICON_MAP: Record<string, React.ReactNode> = {
  Target: <Target size={16} />,
  Calendar: <Calendar size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  TrendingUp: <TrendingUp size={16} />,
};

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
          {guarantee.label}
        </p>
      </div>
      <p className={`font-body text-xs text-center max-w-xs mx-auto ${onDark ? "text-white/40" : "text-muted-foreground"}`}>
        {guarantee.sub}
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
          {stickyCta}
        </GreenButton>
      </div>

      {/* Hero */}
      <section className="bg-background pt-10 pb-12 md:pt-14 md:pb-16">
        <div ref={heroRef} className="max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-8 text-center">
            {hero.eyebrow}
          </p>
          <h1 className="font-display text-foreground text-5xl md:text-5xl font-bold leading-[1.1] text-center mb-4">
            {hero.headline}
          </h1>
          <p className="font-body text-muted-foreground text-lg md:text-lg leading-relaxed text-center mb-8">
            {hero.subheadline}
          </p>

          {/* Price */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="font-display text-foreground text-4xl font-bold">{hero.price}</span>
            <div className="text-left">
              <p className="font-body text-foreground text-sm font-medium leading-tight">{hero.priceLabel}</p>
              <p className="font-body text-muted-foreground text-sm">{hero.priceSub}</p>
            </div>
          </div>

          {/* CTA */}
          <GreenButton className="w-full">{hero.ctaButton}</GreenButton>
          <p className="font-body text-muted-foreground text-sm text-center mt-2">
            {hero.ctaNote}
          </p>
          <Guarantee />
        </div>
      </section>

      {/* Feature list */}
      <div className="border-t border-border" />
      <section className="bg-card py-8">
        <div className="max-w-[620px] mx-auto px-5">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
            {featureList.map((item) => (
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
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-6">{about.eyebrow}</p>
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="shrink-0 w-full md:w-56">
              <div
                className="w-full max-w-[200px] md:max-w-none"
                style={{ backgroundColor: "#111111", padding: "8px", border: "1px solid #1F1F1F" }}
              >
                <img
                  src={JAKE_PHOTO_URL}
                  alt={about.photoAlt}
                  className="w-full object-contain md:h-full md:object-top"
                  style={{ filter: "brightness(0.97) contrast(1.02)", backgroundColor: "#111111" }}
                />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-display text-foreground text-2xl font-bold mb-1">{about.name}</p>
              <div className="flex items-center gap-1.5 mb-4">
                <Shield size={13} className="text-muted-foreground shrink-0" />
                <p className="font-body text-muted-foreground text-sm">{about.credential}</p>
              </div>
              <p className="font-body text-muted-foreground text-base leading-relaxed">
                {about.bio}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Approach */}
      <div className="border-t border-border" />
      <section className="py-14 bg-background">
        <div ref={approachRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-4">{approach.eyebrow}</p>
          <h2 className="font-display text-foreground text-2xl md:text-3xl font-bold leading-tight mb-5">
            {approach.headline}
          </h2>
          <div className="flex flex-col gap-4 font-body text-muted-foreground text-base leading-relaxed">
            {approach.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Coaching points */}
      <div className="border-t border-border" />
      <section className="py-14 bg-background">
        <div ref={coachingRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-4">{coachingSection.eyebrow}</p>
          <h2 className="font-display text-foreground text-2xl md:text-3xl font-bold leading-tight mb-3">
            {coachingSection.headline}
          </h2>
          <p className="font-body text-muted-foreground text-base leading-relaxed mb-8">
            {coachingSection.intro}
          </p>
          <div className="flex flex-col">
            {coachingPoints.map((point) => (
              <div key={point.title} className="flex items-start gap-4 py-5 border-t border-border">
                <div
                  className="shrink-0 w-8 h-8 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: GREEN_TINT, color: GREEN }}
                >
                  {ICON_MAP[point.icon]}
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
            <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-5">{whatToExpect.eyebrow}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {whatToExpect.results.map(({ result, detail }) => (
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
                {forSection.forLabel}
              </p>
              <ul className="flex flex-col gap-2">
                {forSection.forItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-muted-foreground text-base">
                    <Check size={13} className="shrink-0 mt-0.5" style={{ color: GREEN }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-body text-foreground text-xs font-semibold uppercase tracking-widest mb-3">
                {forSection.notForLabel}
              </p>
              <ul className="flex flex-col gap-2">
                {forSection.notForItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 font-body text-muted-foreground text-base">
                    <span className="shrink-0 text-muted-foreground mt-0.5 text-xs leading-none">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Mid CTA */}
          <GreenButton className="w-full">{midCta}</GreenButton>
          <Guarantee />
        </div>
      </section>

      {/* Testimonials */}
      <div className="border-t border-border" />
      <section className="py-14" style={{ backgroundColor: GREEN_TINT }}>
        <div ref={testimonialsRef} className="fade-up max-w-[620px] mx-auto px-5">
          <p className="font-body text-xs uppercase tracking-widest mb-8" style={{ color: GREEN }}>
            {testimonialsSection.eyebrow}
          </p>
          <div className="flex flex-col gap-6">
            {testimonials.map((t) => (
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
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-6">{faqSection.eyebrow}</p>
          {faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
          <div className="border-t border-border" />
        </div>
      </section>

      {/* Join others */}
      <div className="border-t border-border" />
      <p className="font-body text-muted-foreground text-xs uppercase tracking-widest text-center py-6">
        {joinBanner}
      </p>

      {/* Final CTA */}
      <section className="py-14 md:py-20" style={{ backgroundColor: "#111111" }}>
        <div ref={finalCtaRef} className="fade-up max-w-[620px] mx-auto px-5 text-center">
          <h2 className="font-display text-foreground text-3xl md:text-4xl font-bold leading-tight mb-4">
            {finalCta.headline}
          </h2>
          <p className="font-body text-muted-foreground text-base leading-relaxed mb-8 max-w-sm mx-auto">
            {finalCta.body}
          </p>
          <GreenButton className="w-full max-w-sm mx-auto block">{finalCta.ctaButton}</GreenButton>
          <p className="font-body text-muted-foreground text-sm text-center mt-2">
            {finalCta.ctaNote}
          </p>
          <Guarantee onDark />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border" style={{ backgroundColor: "#111111" }}>
        <div className="max-w-[620px] mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-2">
          <span className="font-body text-muted-foreground text-xs">{footer.left}</span>
          <span className="font-body text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Mobile spacer for sticky button */}
      <div className="h-14 md:hidden" />
    </div>
  );
}
