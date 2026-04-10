import { useState, useEffect, useRef } from "react";

const sections = [
  { id: "welcome", label: "Welcome" },
  { id: "how-it-works", label: "How the Coaching Works" },
  { id: "core-expectations", label: "Core Expectations" },
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
  { id: "data-collection", label: "Data Collection" },
  { id: "weekly-check-in", label: "Weekly Check-in" },
  { id: "lifestyle", label: "Lifestyle Factors" },
  { id: "common-mistakes", label: "Common Mistakes" },
  { id: "communication", label: "Communication" },
  { id: "faq", label: "FAQ" },
  { id: "final-notes", label: "Final Notes" },
];

// ─── Primitive components ────────────────────────────────────────────────────

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-foreground/80 text-[16px] leading-[1.8] mt-4 font-body">
      {children}
    </p>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-5 px-4 py-3.5 rounded-md text-[15px] font-body leading-[1.75] border-l-2"
      style={{
        borderColor: "oklch(0.72 0.18 142)",
        backgroundColor: "oklch(0.72 0.18 142 / 0.06)",
        color: "var(--foreground)",
      }}
    >
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-[9px] w-1 h-1 rounded-full shrink-0 opacity-70"
            style={{ backgroundColor: "oklch(0.72 0.18 142)" }}
          />
          <span className="font-body text-foreground/80 text-[16px] leading-[1.75]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="font-display text-foreground/90 text-[15px] font-semibold tracking-tight uppercase opacity-70 mb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="pt-12 pb-2 scroll-mt-[108px]"
    >
      {/* Section divider */}
      <div className="flex items-center gap-3 mb-6">
        <span
          className="text-[11px] font-body font-medium tabular-nums shrink-0"
          style={{ color: "oklch(0.72 0.18 142)" }}
        >
          {number.padStart(2, "0")}
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
      <h2 className="font-display text-foreground text-[21px] sm:text-[24px] font-bold leading-tight tracking-tight mb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = answer.split("\n\n").filter(Boolean);

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="font-body text-foreground/90 text-[16px] leading-[1.65]">{question}</span>
        <span
          className="shrink-0 mt-0.5 transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "none", color: "oklch(0.72 0.18 142)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-5 space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="font-body text-foreground/70 text-[16px] leading-[1.8]">
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GettingStarted() {
  const [activeSection, setActiveSection] = useState("welcome");
  const [sheetOpen, setSheetOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Active section tracking via IntersectionObserver
  useEffect(() => {
    const sectionEls = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          setActiveSection(topmost.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    sectionEls.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sheetOpen]);

  const scrollTo = (id: string) => {
    setSheetOpen(false);
    // Small delay so sheet close animation finishes before scroll
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const offset = 108; // header (56) + TOC bar (52)
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }, 50);
  };

  const activeSectionLabel = sections.find((s) => s.id === activeSection)?.label ?? "";

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Global sticky header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-[860px] mx-auto px-5 sm:px-8 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-[13px] font-body text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </button>

          {/* Separator */}
          <span className="text-border/60 text-lg font-light select-none hidden sm:block">/</span>

          <span className="hidden sm:block font-body text-muted-foreground/60 text-[12px] truncate">
            Getting Started Guide
          </span>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="max-w-[860px] mx-auto w-full px-5 sm:px-8">
        <div className="pt-9 pb-7 sm:pt-12 sm:pb-10">
          <p
            className="font-body text-[11px] uppercase tracking-[0.12em] mb-3"
            style={{ color: "oklch(0.72 0.18 142)" }}
          >
            1:1 Online Coaching
          </p>
          <h1 className="font-display text-foreground text-[26px] sm:text-[34px] font-bold leading-[1.15] tracking-tight mb-3">
            Getting Started Guide
          </h1>
          <p className="font-body text-muted-foreground text-[15px] leading-relaxed max-w-[520px]">
            Read through this guide carefully before getting started. If anything is unclear, message me.
          </p>
        </div>
      </div>

      {/* ── In-page TOC bar — mobile only, sticky below header ───────── */}
      <div className="lg:hidden sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-[860px] mx-auto px-5">
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full flex items-center justify-between py-3.5 text-left"
          >
            {/* Left: icon + label */}
            <span className="flex items-center gap-2 text-muted-foreground/70">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="18" y2="18" />
              </svg>
              <span className="font-body text-[11px] uppercase tracking-[0.1em]">On this page</span>
            </span>

            {/* Right: active section + chevron */}
            <span className="flex items-center gap-1.5 font-body text-[13px] text-foreground/80 font-medium">
              <span className="truncate max-w-[160px]">{activeSectionLabel}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {/* ── Bottom sheet overlay ──────────────────────────────────────── */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-2xl border-t border-border bg-background pb-safe"
            style={{ maxHeight: "72vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-border/60" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
              <span className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70">
                On this page
              </span>
              <button
                onClick={() => setSheetOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Section list */}
            <nav className="overflow-y-auto px-3 py-3" style={{ maxHeight: "calc(72vh - 80px)" }}>
              {sections.map((s, i) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                      isActive ? "bg-primary/8" : "hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className="font-body text-[11px] tabular-nums w-5 shrink-0 text-right"
                      style={{ color: isActive ? "oklch(0.72 0.18 142)" : "var(--muted-foreground)", opacity: isActive ? 1 : 0.5 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`font-body text-[15px] leading-snug ${
                        isActive ? "text-foreground font-medium" : "text-foreground/70"
                      }`}
                    >
                      {s.label}
                    </span>
                    {isActive && (
                      <span
                        className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "oklch(0.72 0.18 142)" }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* ── Main layout ───────────────────────────────────────────────── */}
      <div className="flex-1 max-w-[860px] mx-auto w-full px-5 sm:px-8 pb-20">
        <div className="flex gap-12 xl:gap-16 items-start">

          {/* Desktop sidebar TOC */}
          <aside className="hidden lg:block w-44 shrink-0 sticky top-20 self-start pt-2">
            <p className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50 mb-4">
              Contents
            </p>
            <nav className="space-y-0.5">
              {sections.map((s) => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-[12.5px] font-body transition-colors leading-snug ${
                      isActive
                        ? "font-medium"
                        : "text-muted-foreground/60 hover:text-foreground/80"
                    }`}
                    style={isActive ? { color: "oklch(0.72 0.18 142)" } : {}}
                  >
                    {s.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Article content */}
          <main className="flex-1 min-w-0">

            {/* 1. Welcome */}
            <Section id="welcome" number="1" title="Welcome">
              <Body>Your plan is now ready. This guide is here to get you up to speed on how everything works, what is expected of you, and how to get the best result from the process. Read through it carefully before getting started, and if anything is unclear, message me.</Body>
              <Body>This coaching is a structured, personalised, evidence-based system for body transformation. It gives you a clear plan to follow, keeps you accountable, and uses your data to keep progress moving in the right direction.</Body>
              <Body>My job is to get you a result. I do that by giving you a clear plan, helping you work through any issues that come up, making sure the process is realistic and sustainable, and adjusting things when needed so you keep progressing.</Body>
              <Body>Your job is to follow the plan closely, communicate honestly, and take ownership of the process. That means doing the work, being accurate with your nutrition and tracking, staying consistent, and telling me early if something is not working.</Body>
              <Callout>If you stick to the plan, report honestly, and apply the changes made along the way, you will put yourself in the best position to get results.</Callout>
              <Body>Go through this guide properly, get clear on how the coaching works, and then get started.</Body>
            </Section>

            {/* 2. How the Coaching Works */}
            <Section id="how-it-works" number="2" title="How the Coaching Works">
              <Body>Everything is set up for you in the coaching app from the start. That includes your training program, meal plan, Daily Log, and weekly check-in process.</Body>
              <Body>The coaching is built around four core parts.</Body>

              <SubSection title="2.1 Training Program">
                <Body>Your training is designed to build or maintain muscle while you lose fat. The goal is not just to lose weight, but to make sure the weight you lose comes from fat rather than muscle.</Body>
              </SubSection>

              <SubSection title="2.2 Nutrition Plan">
                <Body>Nutrition is usually set up using a meal plan approach. I use this because it keeps things simple, accurate, and repeatable. It reduces decision fatigue and makes it easier to consistently hit the intake needed for progress, while keeping food choices nutritious and supportive of health.</Body>
                <Body>If calorie and macro tracking is a better fit for you, that can be used instead. The goal is to use an approach that works and can be followed properly.</Body>
                <Body>I also do not expect you to use a rigid meal plan forever. Part of the process is building habits alongside the fat loss phase, so you are not only getting a result now, but also learning how to maintain it long term.</Body>
              </SubSection>

              <SubSection title="2.3 Data Collection">
                <Body>Your Daily Log is where your day-to-day data is collected. This includes body composition data, sleep, steps, hunger, off-plan meals, and habit tracking.</Body>
                <Body>This information helps me see how your body is responding, what may be influencing progress, and whether anything needs to be adjusted. It also gives useful context during your weekly check-in.</Body>
              </SubSection>

              <SubSection title="2.4 Weekly Check-ins">
                <Body>Your weekly check-in is where everything comes together. It gives you the chance to tell me how the week went, what went well, where you struggled, and anything else I need to know.</Body>
                <Body>It is also where I review your progress and decide whether anything needs to change. If progress is good, the plan will often stay the same. If something needs to change, I adjust based on the data and feedback you provide.</Body>
                <Body>In simple terms, you follow the plan, complete your Daily Log, and check in each week. I review the information, assess your progress, and make the adjustments needed to keep things moving forward.</Body>
              </SubSection>
            </Section>

            {/* 3. Core Expectations */}
            <Section id="core-expectations" number="3" title="Core Expectations">
              <Body>To get the best results from this coaching, there are a few things I need from you.</Body>
              <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">You are expected to:</p>
              <BulletList items={[
                "Follow your meal plan as closely as possible",
                "Complete your scheduled training sessions",
                "Complete your Daily Log consistently",
                "Complete your weekly check-in on time",
                "Communicate honestly",
              ]} />
              <Callout>These are the basics. They are not optional.</Callout>
              <Body>This process works best when you follow the plan properly and stay consistent. That gives me a clear picture of how things are going and whether anything needs to be adjusted.</Body>
              <Body>You do not need to be perfect, but you do need to take the process seriously. That means being accurate with your nutrition, staying consistent, and being honest about how things are going.</Body>
              <Body>My job is to guide the process and make the right changes when needed. Your job is to carry out the plan and give me the information I need to coach you properly.</Body>
              <Body>If you do that, you will get results.</Body>
            </Section>

            {/* 4. Nutrition */}
            <Section id="nutrition" number="4" title="Nutrition">
              <SubSection title="4.1 Accuracy">
                <Body>All foods should be weighed raw or uncooked unless otherwise stated.</Body>
                <Body>Use a digital food scale. Do not guess portions or rely on eyeballing them.</Body>
                <Body>This matters because small inaccuracies add up quickly. A little extra here and there may not seem like much, but over the course of a week it can make a real difference to your intake and slow progress.</Body>
                <Callout>The more accurate you are, the better the plan works.</Callout>
              </SubSection>

              <SubSection title="4.2 Hidden Extras">
                <Body>One of the easiest ways calories creep in is through small extras that often go unnoticed.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">This can include things like:</p>
                <BulletList items={["Cooking oils", "Butter", "Sauces", "Dressings", "Snacks or little bites throughout the day", "Liquid calories"]} />
                <Body>These may seem minor, but they add up quickly and can easily throw off your intake without you realising it.</Body>
                <Body>Be especially careful with cooking oils. If you use oil, it is best to use an aerosol spray and only use as much as needed to stop your food from sticking.</Body>
                <Body>The closer you keep your intake to the plan as written, the better your results will be.</Body>
              </SubSection>

              <SubSection title="4.3 Branded Foods">
                <Body>If your meal plan includes a packaged food product, choose a brand with calories as close as possible to the one intended.</Body>
                <Body>For example, if your plan includes non-fat Greek yogurt, check the label and find one with calories as close as possible. Products can vary from brand to brand, even when they seem very similar.</Body>
              </SubSection>

              <SubSection title="4.4 Seasonings & Low-Calorie Condiments">
                <Body>I recommend using seasonings and low-calorie condiments to improve the flavour of your meals. Meals are easier to stick to when they taste good.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">Examples of low-calorie condiments include:</p>
                <BulletList items={["Mustard", "Salsa", "Hot sauce", "Reduced-sugar ketchup", "Low-calorie BBQ sauce", "Light soy sauce"]} />
                <Body>Use these in moderation.</Body>
                <Body>You should also salt all meals to taste with iodized salt. This helps you get enough iodine, which is an essential mineral that many people do not get enough of.</Body>
              </SubSection>

              <SubSection title="4.5 Eating Out">
                <Body>I am not telling you that you cannot eat out while working with me. You do not need to stop seeing friends, going to restaurants, or putting your social life on hold.</Body>
                <Body>What you do need to understand is that eating out will usually make fat loss harder. Restaurant meals are often much higher in calories than they seem because of oils, sauces, and portion sizes. Too many meals out will impact your results.</Body>
                <Body>If you do eat out, do it with some caution and keep it sensible. There is a big difference between a reasonable meal out and turning it into an all-out blowout.</Body>
                <Body>Any restaurant meal should be logged as an off-plan meal.</Body>
                <Body>As a general recommendation, 1 to 3 off-plan meals per week is reasonable for most people during a fat loss phase. The more often you eat out, and the less controlled those meals are, the more likely it is to slow progress.</Body>
              </SubSection>

              <SubSection title="4.6 Meal Prep vs Fresh Cooking">
                <Body>Both meal prep and fresh cooking can work. The best option is the one that helps you stay most consistent.</Body>
                <Body>Meal prep saves time and makes the week easier to manage, but some people enjoy their food less when meals are prepared in advance. Fresh cooking takes more time, but some people prefer it and find it easier to stick to.</Body>
                <Body>There is no right or wrong choice here.</Body>
                <Body>If you are meal prepping, I recommend preparing meals no more than 3 days in advance for freshness.</Body>
              </SubSection>
            </Section>

            {/* 5. Training */}
            <Section id="training" number="5" title="Training">
              <SubSection title="5.1 Structure">
                <Body>Your training program is built around efficient, hypertrophy-focused strength training. The goal is to build or maintain muscle mass while you lose fat, so that the weight you lose comes from fat rather than muscle.</Body>
                <Body>Your full program is set up for you in the app, along with your training schedule. This will usually follow a pattern such as A / B / off / repeat.</Body>
                <Body>Complete the sessions in the order assigned and log all of your workouts in the app.</Body>
                <Body>Demo videos are available where needed, so use them if you are unsure on an exercise.</Body>
                <Body>If you cannot do a planned exercise for a practical reason, such as equipment being taken, use the substitute exercise feature in the app. In most cases, the best substitute is a similar movement using a different implement. For example, if the smith machine is not available, the same exercise with a barbell or dumbbells would usually be a sensible alternative.</Body>
              </SubSection>

              <SubSection title="5.2 Progression">
                <Body>Increase the load when you hit the top of the target rep range on your first working set with good technique.</Body>
                <Body>For example, if an exercise is programmed for 6 to 8 reps, and you get 8 reps on your first working set with solid form, that is your cue to increase the weight next time.</Body>
                <Body>Always prioritise good form over adding load. The goal is not to use the most weight possible. The goal is to make the target muscle work hard.</Body>
                <Body>When you can perform more reps or use more load with good form, that is a sign that progress is happening. Building on that over time is a key part of building muscle.</Body>
              </SubSection>

              <SubSection title="5.3 Filming Your Lifts">
                <Body>Please film your lifts in the gym and send them to me in your weekly check-ins. This is an essential part of the coaching process.</Body>
                <Body>Because I coach online, I cannot be there with you in person. Filming your lifts is the best alternative and allows me to assess your technique properly, make corrections where needed, and help you get more out of your training.</Body>
                <Body>A lot of people feel awkward filming themselves at first or worry about what other people in the gym might think. In reality, most people are too focused on themselves to care. This is part of the process, and it is there to help you.</Body>
                <Body>I recommend using a tripod with a magnetic ring to make filming easier. Set the camera up at an angle that allows me to clearly see your technique and the full movement.</Body>
                <Body>The better the footage, the better the feedback I can give you.</Body>
              </SubSection>

              <SubSection title="5.4 Pain vs Soreness">
                <Body>Muscle soreness and pain are not the same thing.</Body>
                <Body>Soreness is normal, especially in the first few weeks of a new training program. Your body will adapt, and this will settle down over time.</Body>
                <Body>Pain is different. Pain is a sign that something is not right, and pushing through it can lead to injury.</Body>
                <Callout>If you feel pain during an exercise, stop the exercise and inform me. Do not push through pain under any circumstance.</Callout>
              </SubSection>
            </Section>

            {/* 6. Data Collection */}
            <Section id="data-collection" number="6" title="Data Collection">
              <Body>Your Daily Log should be completed in the app every day.</Body>
              <Body>This is where I collect the information I use to assess how things are going, identify patterns, and decide whether anything needs to change. It gives context to your body composition progress and helps inform the decision-making process during your weekly check-in.</Body>
              <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">You will be logging:</p>
              <ul className="mt-4 space-y-3">
                {[
                  { label: "Body weight", detail: "taken first thing in the morning, after using the bathroom, before eating or drinking" },
                  { label: "Sleep (hours)", detail: "total hours slept" },
                  { label: "Caffeine (servings)", detail: "number of servings, where 1 serving is roughly 80 to 100mg, or about one small coffee or espresso" },
                  { label: "Steps", detail: "total daily steps, tracked by your phone or watch" },
                  { label: "Sleep quality (1 to 5)", detail: "how well rested you feel after waking — 1 = slept very poorly, feel very tired / 5 = slept great, feel well rested" },
                  { label: "Hunger level (1 to 5)", detail: "your overall hunger across the day — 1 = not hungry at all / 5 = very hungry throughout the day" },
                  { label: "Number of off-plan meals", detail: "" },
                  { label: "Habit tracking", detail: "" },
                  { label: "Notes", detail: "anything out of the ordinary that may be relevant" },
                ].map(({ label, detail }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-[9px] w-1 h-1 rounded-full shrink-0 opacity-70" style={{ backgroundColor: "oklch(0.72 0.18 142)" }} />
                    <span className="font-body text-[16px] leading-[1.75]">
                      <span className="text-foreground font-medium">{label}</span>
                      {detail && <span className="text-foreground/60"> — {detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Body>This data matters because it gives me a clearer picture of what is influencing your progress and whether anything needs to change.</Body>
              <Callout>Be honest with your logging. The more accurate the information is, the better I can coach you.</Callout>
            </Section>

            {/* 7. Weekly Check-in */}
            <Section id="weekly-check-in" number="7" title="Weekly Check-in">
              <Body>Your weekly check-in is an important part of the coaching process. This is where I review your week, assess your progress, and decide what needs to happen next.</Body>
              <Body>You will have an assigned check-in day, which you can see in the app. Your check-in needs to be completed once per week and done on time.</Body>

              <SubSection title="7.1 Check-in Form">
                <Body>Your check-in form should be completed in the app.</Body>
                <Body>Answer it honestly. The more accurate your check-in is, the better I can assess what is going on and make the right decisions. If you need to add more context, you can do that in your voice note.</Body>
              </SubSection>

              <SubSection title="7.2 Measurements">
                <Body>Your waist measurement should be taken first thing in the morning, after using the bathroom, before eating or drinking.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">To take it properly:</p>
                <BulletList items={[
                  "Stand with your feet together",
                  "Breathe out normally and relax",
                  "Measure at the narrowest point of your waist, which is usually just above your belly button",
                  "Keep the tape parallel to the floor",
                  "Do not pull the tape tight — it should sit snug but not compress the skin",
                ]} />
                <Body>Enter your waist measurement into the app each week as part of your check-in.</Body>
              </SubSection>

              <SubSection title="7.3 Progress Photos">
                <Body>Progress photos should be taken at the same time as your waist measurement where possible.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">You will need to take:</p>
                <BulletList items={["Front", "Side", "Back"]} />
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">Make sure:</p>
                <BulletList items={[
                  "Your full body is visible from head to toe",
                  "The lighting is good",
                  "You use the same conditions each week",
                  "You are in a relaxed pose",
                  "You use a tripod, not mirror selfies",
                ]} />
                <Body>Please send your progress photos to me on WhatsApp.</Body>
              </SubSection>

              <SubSection title="7.4 Form Videos">
                <Body>Please send me one full training session per week on WhatsApp.</Body>
                <Body>This allows me to continuously review your lifts as you progress and make sure your technique stays where it needs to be.</Body>
              </SubSection>

              <SubSection title="7.5 Voice Note">
                <Body>Please also send me a voice note each week, no longer than 10 minutes.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">Use this to cover:</p>
                <BulletList items={[
                  "Wins from the week",
                  "Struggles or issues you ran into",
                  "Any questions you want answered",
                  "Anything else you think I should know",
                ]} />
              </SubSection>

              <SubSection title="7.6 What You Receive">
                <Body>You will receive a video response from me within 24 hours.</Body>
                <Body>This will include feedback on your progress, answers to your questions, technique feedback where needed, any adjustments that need to be made, and clear next steps for the week ahead.</Body>
                <Callout>The better your check-in, the better I can coach you.</Callout>
              </SubSection>
            </Section>

            {/* 8. Lifestyle Factors */}
            <Section id="lifestyle" number="8" title="Lifestyle Factors">
              <Body>Lifestyle factors play an important role in your results. They affect fat loss, but they also affect how easy or difficult the process feels day to day.</Body>

              <SubSection title="8.1 Sleep">
                <Body>Poor sleep can negatively impact fat loss and make sticking to your diet harder. Most people notice the same pattern when sleep is off: hunger goes up, food decisions get worse, and the process feels harder than it needs to.</Body>
                <Body>The aim is to get enough sleep to feel well rested when you wake up. For most people, that will usually mean at least around 7.5 hours, but this can vary from person to person.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">A few things that help:</p>
                <BulletList items={[
                  "Keep a consistent sleep and wake time",
                  "Limit screens before bed",
                  "Avoid caffeine too late in the day",
                  "Keep your room cool, dark, and quiet",
                  "Have a simple wind-down routine before bed",
                ]} />
                <Body>You do not need a perfect routine. You just need one that helps you sleep well consistently.</Body>
              </SubSection>

              <SubSection title="8.2 Steps">
                <Body>You will have a step target in the app. Try to reach that target on average across the week.</Body>
                <Body>Walking helps increase your overall activity levels, supports fat loss, and is a simple way to increase energy expenditure. It is also good for general health.</Body>
                <p className="font-body text-foreground/80 text-[16px] leading-[1.8] mt-4">A few easy ways to get more steps in:</p>
                <BulletList items={[
                  "Go for 10-minute walks after meals",
                  "Use a walking pad",
                  "Park further away when possible",
                  "Take the stairs instead of the lift or escalator where practical",
                  "Add a walk at the start or end of your day",
                ]} />
                <Body>No need to overcomplicate this. Small bits of movement done consistently add up over the week and make a real difference.</Body>
              </SubSection>
            </Section>

            {/* 9. Common Mistakes */}
            <Section id="common-mistakes" number="9" title="Common Mistakes">
              <Body>Most people struggle because the basics are not being done consistently enough. The most common mistakes I see are:</Body>
              <BulletList items={[
                "Not being accurate with food, such as estimating or eyeballing portions",
                "Too many off-plan meals",
                "Missing training sessions",
                "Not prioritising sleep",
              ]} />
              <Body>These things can add up over the week and slow progress.</Body>
              <Body>Slip-ups happen. If you go off plan, overeat, or have a bad meal, get back on track as soon as possible. Do not let one mistake turn into a bad day or weekend.</Body>
              <Callout>Avoid the all-or-nothing mindset. One meal off plan is not the issue. Repeating it is.</Callout>
            </Section>

            {/* 10. Communication */}
            <Section id="communication" number="10" title="Communication">
              <Body>We will mainly use WhatsApp to communicate, and my contact details are provided for you below.</Body>
              <a
                href="https://wa.me/61468764276"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-primary/8 hover:border-primary/40 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="oklch(0.72 0.18 142)">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
                <span className="font-body text-foreground/90 font-medium text-[15px]">Message me on WhatsApp</span>
              </a>
              <Body>The weekly check-in is where we will review your progress in full, but you do not need to wait until then if something comes up and you need help. You are welcome to message me anytime if you have a question, are struggling with something, or want to share a win.</Body>
              <Body>I will always aim to reply within 24 hours.</Body>
              <Body>If you are genuinely unsure about something, ask. If something is affecting your ability to follow the plan, let me know. Good communication makes the coaching process easier and more effective for both of us.</Body>
            </Section>

            {/* 11. FAQ */}
            <Section id="faq" number="11" title="FAQ">
              {[
                {
                  q: "Do I have to eat the same thing every day?",
                  a: "No.\n\nThe meal plan gives you structure, but that does not mean every day has to look exactly the same. If you prefer, a calorie and macro tracking approach can also work, where you track manually and create your own meals. The main thing is that calories and protein are matched.\n\nThat said, use some common sense. Matching calories and macros does not automatically make two food choices equal. Food quality still matters, and so do health and micronutrients. Every meal should include fruit and/or vegetables, and the overall diet should still be built around mostly whole, nutritious foods.",
                },
                {
                  q: "Can I eat out?",
                  a: "Yes.\n\nYou do not need to stop eating out while working with me. Just understand that the more often you eat out, the harder fat loss becomes. Restaurant meals are usually much higher in calories than they seem, so this needs to be done with some caution and in moderation.",
                },
                {
                  q: "Will I have to weigh food forever?",
                  a: "No.\n\nWeighing food is a tool to help you be accurate and consistent. It is not something I expect you to do forever.\n\nAlongside targeted fat loss, we will also be working on habits so you are not just getting a result now, but learning how to maintain it later.\n\nThe goal is not only to help you lose fat, but to help you build the habits and understanding needed to keep the result once you have achieved it.",
                },
                {
                  q: "What if I feel pain?",
                  a: "Stop the exercise and let me know.\n\nDo not push through pain. Pain is not the same as normal training discomfort or soreness, and ignoring it can turn a small issue into a bigger one.",
                },
                {
                  q: "I messed up my diet. What do I do?",
                  a: "Get back to the plan at the next meal.\n\nDo not wait until tomorrow, and do not turn one off-plan meal into a full day or weekend off plan. One slip-up is not the problem. Repeating it is.",
                },
                {
                  q: "I'm hungry. What do I do?",
                  a: "First, stick to the plan.\n\nHunger is a normal part of the process, especially during a fat loss phase. It is not an emergency. Sometimes it simply needs to be accepted as part of dieting.\n\nThat said, if hunger is becoming a regular issue, mention it in your check-in. We may need to look at things like food volume, sleep, and whether the deficit is at a sustainable level.",
                },
              ].map(({ q, a }, i) => (
                <FAQItem key={i} question={q} answer={a} />
              ))}
            </Section>

            {/* 12. Final Notes */}
            <Section id="final-notes" number="12" title="Final Notes">
              <Body>At this point, you should be clear on how the coaching works, what is expected of you, and how to get the best result from the process.</Body>
              <Body>Now the focus is simple: follow the plan closely, be accurate with your nutrition, stay consistent, and communicate honestly. You do not need to be perfect, but you do need to take the process seriously.</Body>
              <Body>Everything is set up for you in the app, and your plan is ready.</Body>
              <Callout>Read through this guide properly, get started, and if you need anything, reach out.</Callout>

              {/* Back to dashboard */}
              <div className="mt-12 pt-8 border-t border-border/40">
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center gap-2 font-body text-[14px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back to Dashboard
                </button>
              </div>
            </Section>

          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-5 border-t border-border/40">
        <div className="max-w-[860px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-body text-muted-foreground/50 text-[12px]">Jake Hickman · 1:1 Online Coaching</span>
          <span className="font-body text-muted-foreground/50 text-[12px]">© {new Date().getFullYear()}</span>
        </div>
      </footer>

    </div>
  );
}
