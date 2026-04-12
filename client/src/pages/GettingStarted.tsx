import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

const sections = [
  { id: "welcome", label: "1. Welcome" },
  { id: "how-it-works", label: "2. How the Coaching Works" },
  { id: "app-walkthrough", label: "3. App Walkthrough" },
  { id: "core-expectations", label: "4. Core Expectations" },
  { id: "nutrition", label: "5. Nutrition" },
  { id: "supplements", label: "6. Supplements" },
  { id: "training", label: "7. Training" },
  { id: "data-collection", label: "8. Data Collection" },
  { id: "weekly-check-in", label: "9. Weekly Check-in" },
  { id: "lifestyle", label: "10. Lifestyle Factors" },
  { id: "habits", label: "11. Habits" },
  { id: "common-mistakes", label: "12. Common Mistakes" },
  { id: "communication", label: "13. Communication" },
  { id: "faq", label: "14. FAQ" },
  { id: "final-notes", label: "15. Final Notes" },
];

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5 mt-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "#59BE50" }}
          />
          <span className="font-body text-foreground/85 text-[15px] sm:text-[15px] leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="font-display text-foreground text-base font-semibold mb-3 tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function Section({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pt-14 pb-4 border-t border-border/50 scroll-mt-[72px]">
      <div className="flex items-start gap-3 mb-5">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 mt-0.5"
          style={{ backgroundColor: "#052E1A", color: "#59BE50", border: "1.5px solid #59BE50" }}
        >
          {number}
        </span>
        <h2 className="font-display text-foreground text-[22px] font-bold leading-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-foreground/80 text-base leading-[1.75] mt-3">{children}</p>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-4 px-4 py-3 rounded-lg border-l-2 text-[15px] font-body leading-relaxed"
      style={{ borderColor: "#59BE50", backgroundColor: "#052E1A33", color: "var(--foreground)" }}
    >
      {children}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = answer.split("\n\n").filter(Boolean);

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="font-body text-foreground text-base font-medium leading-relaxed">{question}</span>
        <span
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-transform duration-200"
          style={{ backgroundColor: "#052E1A", color: "#59BE50", transform: open ? "rotate(45deg)" : "none" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-4 space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="font-body text-foreground/75 text-base leading-[1.75]">{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GettingStarted() {
  const { isAuthenticated, loading } = useAuth();
  const [activeSection, setActiveSection] = useState("welcome");
  const [tocOpen, setTocOpen] = useState(false);
  const inPageTocRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const headerRef = useRef<HTMLElement>(null);

  // Active section tracking — only runs when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const sectionEls = sections.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          setActiveSection(topmost.target.id);
        }
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: 0 }
    );
    sectionEls.forEach(el => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  // Close mobile TOC on outside tap
  useEffect(() => {
    if (!tocOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (inPageTocRef.current && !inPageTocRef.current.contains(e.target as Node)) {
        setTocOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [tocOpen]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    setActiveSection(id);
    isScrollingRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 1200);

    setTocOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const headerEl = headerRef.current;
        const tocEl = inPageTocRef.current;
        const headerH = headerEl ? headerEl.getBoundingClientRect().height : 56;
        const tocH = tocEl ? tocEl.getBoundingClientRect().height : 44;
        const offset = headerH + tocH + 12;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">You need to sign in to access this page.</p>
        <a
          href={getLoginUrl()}
          className="px-6 py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <header ref={headerRef} className="border-b border-border sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm font-body text-muted-foreground hover:text-foreground transition-colors shrink-0 py-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </button>
          <div className="flex-1" />
        </div>
      </header>

      {/* Hero */}
      <section className="pt-8 pb-6 sm:pt-12 sm:pb-10 bg-background">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-4">
            Getting Started
          </p>
          <h1 className="font-display text-foreground text-2xl sm:text-4xl font-bold leading-[1.15] mb-3">
            Getting Started Guide
          </h1>
          <p className="font-body text-muted-foreground text-[15px] leading-relaxed max-w-xl">
            Read through this guide carefully before getting started. If anything is unclear, let me know.
          </p>
        </div>
      </section>

      {/* In-page TOC bar — mobile only */}
      <div
        ref={inPageTocRef}
        className="lg:hidden sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b border-border"
      >
        <div className="max-w-[900px] mx-auto px-4">
          <button
            onClick={() => setTocOpen(o => !o)}
            className="w-full flex items-center justify-between py-3 text-sm font-body"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span className="text-[11px] uppercase tracking-widest">On this page</span>
            </span>
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              <span className="truncate max-w-[180px]">{sections.find(s => s.id === activeSection)?.label ?? ""}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${tocOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          {tocOpen && (
            <nav className="pb-2 border-t border-border/50 pt-1 space-y-0.5">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left px-2 py-2.5 rounded-md text-sm font-body transition-colors ${
                    activeSection === s.id
                      ? "text-primary font-medium bg-primary/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 max-w-[900px] mx-auto w-full px-4 sm:px-6 pb-16">
        <div className="flex gap-10 xl:gap-14 items-start">

          {/* Sticky sidebar TOC — desktop only */}
          <aside className="hidden lg:block w-48 shrink-0 sticky top-20 self-start">
            <p className="font-body text-muted-foreground text-[10px] uppercase tracking-widest mb-3">Contents</p>
            <nav className="space-y-0.5">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-[13px] font-body transition-colors ${
                    activeSection === s.id
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 space-y-2">

            {/* 1. Welcome */}
            <Section id="welcome" number="1" title="Welcome">
              <Body>This guide is here to get you up to speed on how everything works, what is expected of you, and how to get the best result from the process. Read through it carefully before getting started, and if anything is unclear, let me know.</Body>
              <Body>This coaching is a structured, personalised, evidence-based system for body transformation. It gives you a clear plan to follow, keeps you accountable, and uses your data to keep progress moving in the right direction.</Body>
              <Body>My job is to get you results. I do that by giving you a clear plan, helping you work through any issues that come up, making sure the process is realistic and sustainable, and adjusting things when needed so you keep progressing.</Body>
              <Body>Your job is to follow the plan as closely as you can, communicate honestly, and take ownership of the process. That means doing the work, being accurate with your nutrition and tracking, staying consistent, and telling me early if something is not working.</Body>
              <Callout>If you stick to the plan, report honestly, and apply the adjustments made along the way, you will put yourself in the best position to get results.</Callout>
            </Section>

            {/* 2. How the Coaching Works */}
            <Section id="how-it-works" number="2" title="How the Coaching Works">
              <Body>Everything is set up for you in the coaching app from the start. That includes your training program, meal plan, daily log, and weekly check-in process.</Body>
              <Body>The coaching is built around four core pillars.</Body>

              <SubSection title="2.1 Training Program">
                <Body>Your training is designed to build or maintain muscle while you lose fat. The goal is not just to lose weight, but to make sure the weight you lose comes from fat rather than muscle.</Body>
              </SubSection>

              <SubSection title="2.2 Nutrition Plan">
                <Body>Nutrition is usually set up using a meal plan approach. I use this because it keeps things simple, accurate, and repeatable. It reduces decision fatigue and makes it easier to consistently hit the intake needed for progress, while keeping food choices nutritious and supportive of health.</Body>
                <Body>That being said, if calorie and macro tracking is a better fit for you, this can be used instead. The goal is to use an approach that works and can be followed properly.</Body>
                <Body>I also do not expect you to use a rigid meal plan forever. Part of the process is building habits alongside the fat loss phase, so you are not only getting a result now, but also learning how to maintain it long term.</Body>
              </SubSection>

              <SubSection title="2.3 Data Collection">
                <Body>Your daily log in the app is where your day-to-day data is collected. This includes body composition data, sleep, steps, hunger, off-plan meals, and habit tracking.</Body>
                <Body>This information helps me see how your body is responding, what may be influencing progress, and whether anything needs to be adjusted. It also gives useful context during your weekly check-in.</Body>
              </SubSection>

              <SubSection title="2.4 Weekly Check-ins">
                <Body>Your weekly check-in is where everything comes together. It gives you the chance to tell me how the week went, what went well, where you struggled, and anything else I need to know.</Body>
                <Body>It is also where I review your progress and decide whether anything needs to change. If progress is good, the plan will often stay the same. If something needs to change, I adjust based on the data and feedback you provide.</Body>
                <Body>In simple terms, you follow the plan, complete your daily log, and check in each week. I review the information, assess your progress, and make the adjustments needed to keep things moving forward.</Body>
              </SubSection>
            </Section>

            {/* 3. App Walkthrough */}
            <Section id="app-walkthrough" number="3" title="App Walkthrough">
              <Body>Everything you need is inside the app. Before you get started, take a few minutes to look through each tab so you know where everything is.</Body>
              <Body>I also recommend adding the app to your home screen so it is easier to access day to day.</Body>
              <BulletList items={[
                "On iPhone / Safari: tap the Share button, then scroll down and tap Add to Home Screen",
                "On Android / Chrome: tap the menu in the top right, then tap Add to Home screen",
              ]} />
              <Body>The main tabs you will be using are Home, Daily Log, Meal Plan, Training, and Check-in.</Body>

              <SubSection title="3.1 Home">
                <Body>The Home tab gives you a quick overview of your progress and adherence. Here you can see your weekly summary, average weight, training adherence, off-plan meals, average daily steps, weight trend, current habits, and the Getting Started guide.</Body>
              </SubSection>

              <SubSection title="3.2 Daily Log">
                <Body>The Daily Log is where you enter your day-to-day data, including body weight, sleep duration &amp; quality, caffeine, steps, hunger level, off-plan meals, and habit completion. You can also edit recent entries here if needed.</Body>
              </SubSection>

              <SubSection title="3.3 Meal Plan">
                <Body>The Meal Plan tab is where you will find your nutrition plan. You can view your Training Day and Rest Day meal plans, along with your daily totals.</Body>
                <Body>There is also a Shopping List tab, which calculates what you need based on your meal plan.</Body>
              </SubSection>

              <SubSection title="3.4 Training">
                <Body>The Training tab is where you will find your program and log your workouts.</Body>
                <Body>Use the Program section to view your training schedule and sessions. Use the Log section to select a session and enter your weight and reps performed for each exercise.</Body>
                <Body>Demo videos appear as a red Demo button next to the exercise name. If you need to swap an exercise, use the Sub button when logging your workout.</Body>
              </SubSection>

              <SubSection title="3.5 Check-in">
                <Body>The Check-in tab is where you complete your weekly check-in. This includes your check-in form and your measurements.</Body>
                <Body>Spend a few minutes getting familiar with the layout now. Once you know where everything is, the app is straightforward to use.</Body>
              </SubSection>
            </Section>

            {/* 4. Core Expectations */}
            <Section id="core-expectations" number="4" title="Core Expectations">
              <Body>To get the best results from this coaching, there are a few things I need from you.</Body>
              <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">You are expected to:</p>
              <BulletList items={[
                "Follow your meal plan as closely as possible",
                "Complete your scheduled training sessions",
                "Complete your daily log consistently",
                "Complete your weekly check-in on time",
                "Communicate honestly",
              ]} />
              <Callout>These are the basics. They are not optional.</Callout>
              <Body>This process works best when you follow the plan properly and be as consistent as possible. That gives me a clear picture of how things are going and whether anything needs to be adjusted.</Body>
              <Body>You don't need to be perfect, but you do need to take the process seriously. That means being accurate with your nutrition, staying consistent, and being honest about how things are going.</Body>
              <Body>My job is to guide the process and make the right changes when needed. Your job is to carry out the plan and give me the information I need to coach you properly.</Body>
              <Body>If you do that, you will get results.</Body>
            </Section>

            {/* 5. Nutrition */}
            <Section id="nutrition" number="5" title="Nutrition">
              <SubSection title="5.1 Accuracy">
                <Body>All foods should be weighed raw or uncooked unless otherwise stated.</Body>
                <Body>Use a digital food scale. Do not guess portions or rely on eyeballing them.</Body>
                <Body>Small inaccuracies add up quickly. A little extra here and there may not seem like much, but over the course of a week it can make a difference to your intake and slow progress.</Body>
                <Callout>The more accurate you are, the better the plan works.</Callout>
              </SubSection>

              <SubSection title="5.2 Hidden Extras">
                <Body>One of the easiest ways calories creep in is through small extras that often go unnoticed.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">This can include things like:</p>
                <BulletList items={["Cooking oils & butter", "Sauces & dressings", "Snacks or little bites throughout the day", "Liquid calories"]} />
                <Body>These may seem minor, but they add up quickly and can easily throw off your intake without you realising it.</Body>
                <Body>Be especially careful with cooking oils. If you use oil, it is best to use an aerosol spray and only use as much as needed to stop your food from sticking.</Body>
                <Body>The closer you keep your intake to the plan as written, the better your results will be.</Body>
              </SubSection>

              <SubSection title="5.3 Branded Foods">
                <Body>If your meal plan includes a packaged food product, choose a brand with calories as close as possible to the one intended.</Body>
                <Body>For example, if your plan includes non-fat Greek yogurt, check the label and find one with calories as close as possible. Products can vary from brand to brand, even when they seem very similar.</Body>
              </SubSection>

              <SubSection title="5.4 Seasonings & Low-Calorie Condiments">
                <Body>I recommend using seasonings and low-calorie condiments to improve the flavour of your meals. Meals are easier to stick to when they taste good.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">Examples of low-calorie condiments include:</p>
                <BulletList items={["Maggi", "Mustard", "Salsa", "Hot sauce", "Reduced-sugar ketchup", "Low-calorie BBQ sauce"]} />
                <Body>Use these in moderation.</Body>
                <Body>You should also salt all meals to taste with iodized salt. This helps you get enough iodine, which is an essential mineral that many people do not get enough of.</Body>
              </SubSection>

              <SubSection title="5.5 Eating Out">
                <Body>I am not telling you that you cannot eat out while working with me. You do not need to stop seeing friends, going to restaurants, or putting your social life on hold.</Body>
                <Body>What you do need to understand is that eating out will usually make fat loss harder. Restaurant meals are often much higher in calories than they seem because of oils, sauces, and portion sizes. Too many meals out will impact your results.</Body>
                <Body>If you do eat out, do so with some caution and keep it sensible. There is a big difference between a reasonable meal out and turning it into an all-out blowout.</Body>
                <Body>Any restaurant meal should be logged as an off-plan meal in your daily log.</Body>
                <Body>As a general recommendation, 1 to 3 off-plan meals per week is reasonable for most people during a fat loss phase. The more often you eat out, and the less controlled those meals are, the more likely it is to slow progress.</Body>
              </SubSection>

              <SubSection title="5.6 Meal Prep vs Fresh Cooking">
                <Body>Both meal prep and fresh cooking can work. The best option is the one that helps you stay most consistent.</Body>
                <Body>Meal prep saves time and makes the week easier to manage, but some people enjoy their food less when meals are prepared in advance. Cooking each meal takes more time, but some people prefer to eat their meals fresh.</Body>
                <Body>There is no right or wrong choice here.</Body>
                <Body>If you are meal prepping, I recommend preparing meals no more than 3 days in advance for freshness.</Body>
              </SubSection>
            </Section>

            {/* 6. Supplements */}
            <Section id="supplements" number="6" title="Supplements">
              <Body>Supplements can be useful, but they are there to support the basics. Your training, nutrition, sleep, and consistency matter far more.</Body>
              <Body>If you do use supplements, choose products that are third-party lab tested.</Body>

              <SubSection title="6.1 Recommended Supplements">
                <ul className="space-y-5 mt-3">
                  {[
                    {
                      name: "Creatine monohydrate",
                      desc: "Supports strength, power output, and training performance.",
                      use: "5g daily, any time.",
                    },
                    {
                      name: "Protein powder",
                      desc: "A convenient way to help you hit your daily protein target when needed. Whey protein is a good default for most people. If regular whey does not agree with your digestion, try whey isolate instead. If you do not consume dairy, use a plant-based blend.",
                      use: "As needed to help meet your protein intake.",
                    },
                    {
                      name: "Vitamin D3",
                      desc: "Supports general health, immune function, and bone health.",
                      use: "3,000 to 5,000 IU daily with food.",
                    },
                    {
                      name: "Omega-3 fish oils",
                      desc: "Support cardiovascular health, joint health, and inflammation control.",
                      use: "1 to 2g combined EPA and DHA daily with food.",
                    },
                  ].map(({ name, desc, use }) => (
                    <li key={name} className="flex items-start gap-3">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#59BE50" }} />
                      <span className="font-body text-base leading-[1.75]">
                        <span className="text-foreground font-medium">{name}</span>
                        <span className="text-foreground/65"> — {desc}</span>
                        <span className="block text-foreground/65 text-[14px] mt-0.5">Use: {use}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </SubSection>
            </Section>

            {/* 7. Training */}
            <Section id="training" number="7" title="Training">
              <SubSection title="7.1 Structure">
                <Body>Your training program is built around efficient, hypertrophy-focused strength training. The goal is to build or maintain muscle mass while you lose fat, so that the weight you lose comes from fat rather than muscle.</Body>
                <Body>Your full program is set up for you in the app, along with your training schedule. Complete the sessions in the order assigned and log all of your workouts in the app.</Body>
                <Body>Demo videos are available where needed, so use them if you are unsure on an exercise.</Body>
                <Body>If you cannot do a planned exercise for a practical reason, such as equipment being taken, use the substitute exercise feature in the app. In most cases, the best substitute is a similar movement using a different implement. For example, if the smith machine is not available, the same exercise with a barbell or dumbbells would usually be a sensible alternative.</Body>
              </SubSection>

              <SubSection title="7.2 The Stack">
                <Body>For most exercises, aim to keep your ribcage stacked over your pelvis. This is referred to as "keeping a stack".</Body>
                <Body>In simple terms, that means keeping your ribs down and your abs on lightly, rather than letting your chest lift too high and your lower back arch too much.</Body>
                <Body>This helps you stay controlled, keep better position, and direct tension where you want it.</Body>
                <Body>A simple cue is: ribs over pelvis.</Body>
                <div className="mt-4">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663515200499/HZf6zqYa94nKHY3YxXLHa5/TheStack_c2ab4914.png"
                    alt="The Stack — Stacked vs Not Stacked"
                    className="w-full max-w-md rounded-lg"
                  />
                </div>
              </SubSection>

              <SubSection title="7.3 Progression">
                <Body>When you can perform more reps or use more weight with good form, that is a sign that progress is happening.</Body>
                <Body>Increase the weight next session when you hit the top of the target rep range on your first working set with good technique.</Body>
                <Body>For example, if an exercise is programmed for 6 to 8 reps, and you get 8 reps on your first working set with solid form, that is your cue to increase the weight next time.</Body>
                <Body>Always prioritise good form over adding load. The goal is not to use the most weight possible. The goal is to make the target muscle work hard.</Body>
              </SubSection>

              <SubSection title="7.4 Training Intensity">
                <Body>For your training to work as intended, the sets need to be hard enough.</Body>
                <Body>Each working set should be taken to within 1 to 3 reps of failure. Failure means the point where you cannot complete another rep with good form.</Body>
                <Body>Just reaching the target number of reps is not enough. If you get to the top end of the rep range but still had another 5 to 10 reps left, the weight is too light and the set is not hard enough.</Body>
                <Body>The goal is not just to complete the reps. The goal is to train hard enough to create a stimulus for adaptation.</Body>
              </SubSection>

              <SubSection title="7.5 Warming Up">
                <Body>Keep warm-ups simple. The goal is to increase blood flow, get your nervous system firing, and prepare the joints and muscles for the exercise ahead.</Body>
                <Body>In most cases, your warm-up should just be the same exercise with a lighter weight for 1 to 3 sets. Warm-up sets do not need to be logged.</Body>
                <Body>Your first exercise for a muscle group will usually need the most warm-up. After that, one lighter set is often enough just to get a feel for the movement before going into your working sets.</Body>
                <Body>Warm-up sets should not be hard. They are there to prepare you, not tire you out. In most cases, 3 to 8 reps with a submaximal load is enough.</Body>
                <Body>There is no need to rest long between warm-up sets. Keep them moving and save your effort for the working sets.</Body>
              </SubSection>

              <SubSection title="7.6 Rest Times">
                <Body>Rest long enough between sets to feel ready for the next one.</Body>
                <Body>In most cases, this will be somewhere between 1 and 3 minutes, but it can vary depending on the exercise and how demanding the set was.</Body>
                <Body>The main thing is not to rush your rest. You want to be recovered enough to perform the next set properly.</Body>
              </SubSection>

              <SubSection title="7.7 Filming Your Lifts">
                <Body>Please film your lifts in the gym and send them to me in your weekly check-ins. This is an essential part of the coaching process.</Body>
                <Body>Because I coach online, I cannot be there with you in person. Filming your lifts is the best alternative and allows me to assess your technique properly, make corrections where needed, and help you get more out of your training.</Body>
                <Body>A lot of people feel awkward filming themselves at first or worry about what other people in the gym might think. In reality, most people are too focused on themselves to care. This is part of the process, and it's there to help you.</Body>
                <Body>I recommend using a MagSafe tripod to make filming easier. Set the camera up at an angle that allows me to clearly see your technique and the full movement.</Body>
                <Body>The better the footage, the better the feedback I can give you.</Body>
              </SubSection>

              <SubSection title="7.8 Pain vs Soreness">
                <Body>Muscle soreness and pain are not the same thing.</Body>
                <Body>Soreness is normal, especially in the first few weeks of a new training program. Your body will adapt, and this will settle down over time.</Body>
                <Body>Pain is different. Pain is a sign that something is not right, and pushing through it can lead to injury.</Body>
                <Callout>If you feel pain during an exercise, stop the exercise and let me know. Do not push through pain under any circumstance.</Callout>
              </SubSection>
            </Section>

            {/* 8. Data Collection */}
            <Section id="data-collection" number="8" title="Data Collection">
              <Body>Your daily log should be completed in the app every day.</Body>
              <Body>This is where I collect the information I use to assess how things are going, identify patterns, and decide whether anything needs to change. It gives context to your body composition progress and helps inform the decision-making process during your weekly check-in.</Body>
              <p className="font-body text-foreground/80 text-base leading-[1.75] mt-3">You will be logging:</p>
              <ul className="space-y-3 mt-3">
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
                    <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#59BE50" }} />
                    <span className="font-body text-base leading-[1.75]">
                      <span className="text-foreground font-medium">{label}</span>
                      {detail && <span className="text-foreground/65"> — {detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Body>If you eat a meal that is not in your meal plan, mark it as an off-plan meal.</Body>
              <Body>This data matters because it gives me a clearer picture of what is influencing your progress and whether anything needs to change.</Body>
              <Callout>Be honest with your logging. The more accurate the information is, the better I can coach you.</Callout>
            </Section>

            {/* 9. Weekly Check-in */}
            <Section id="weekly-check-in" number="9" title="Weekly Check-in">
              <Body>Your weekly check-in is where I review your week, assess your progress, and decide what needs to happen next.</Body>
              <Body>You will have an assigned check-in day, which you can see in the app. Your check-in needs to be completed once per week and done on time.</Body>
              <Body>It is your responsibility to complete your weekly check-in on time. I will not chase you for check-ins.</Body>
              <Callout>If you miss 3 check-ins in a row, you will be removed from the program.</Callout>

              <SubSection title="9.1 Check-in Form">
                <Body>Your check-in form should be completed in the app.</Body>
                <Body>Answer it honestly. The more accurate your check-in is, the better I can assess what is going on and make the right decisions.</Body>
              </SubSection>

              <SubSection title="9.2 Measurements">
                <Body>Your waist measurement should be taken on your check-in day, first thing in the morning, after using the bathroom, before eating or drinking.</Body>
                <Body>Use a tape measure with automatic tightness.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">To take it properly:</p>
                <BulletList items={["Fully exhale", "Tense your abs", "Measure around the navel"]} />
                <Body>Keep the conditions the same each week so the measurement is as useful as possible.</Body>
              </SubSection>

              <SubSection title="9.3 Progress Photos">
                <Body>Progress photos should be taken at the same time as your waist measurement.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">You will need to take:</p>
                <BulletList items={["Front", "Side", "Back"]} />
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-4">Make sure:</p>
                <BulletList items={[
                  "Your full body is visible from head to toe",
                  "The lighting is good",
                  "You use the same conditions each week",
                  "You are in a relaxed pose",
                  "You use a tripod, not mirror selfies",
                ]} />
                <Body>Please send your progress photos to me on WhatsApp.</Body>
              </SubSection>

              <SubSection title="9.4 Form Videos">
                <Body>Please send me one filmed set of each exercise from one full training session you completed that week on WhatsApp.</Body>
                <Body>This allows me to continuously review your lifts as you progress and make sure your technique stays where it needs to be.</Body>
              </SubSection>

              <SubSection title="9.5 Voice Note">
                <Body>Please also send me a voice note each week, no longer than 10 minutes.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">Use this to cover:</p>
                <BulletList items={[
                  "Wins from the week",
                  "Struggles or issues you ran into",
                  "Any questions you want answered",
                  "Additional context to your check-in form",
                  "Anything else you think I should know",
                ]} />
              </SubSection>

              <SubSection title="9.6 What You Receive">
                <Body>You will receive a video response from me within 24 hours.</Body>
                <Body>This will include feedback on your progress, answers to your questions, technique feedback where needed, any adjustments that need to be made, and clear next steps for the week ahead.</Body>
                <Callout>The better your check-in, the better I can coach you.</Callout>
              </SubSection>
            </Section>

            {/* 10. Lifestyle Factors */}
            <Section id="lifestyle" number="10" title="Lifestyle Factors">
              <Body>Lifestyle factors play an important role in your results.</Body>

              <SubSection title="10.1 Sleep">
                <Body>Poor sleep can negatively impact fat loss and make sticking to your diet harder. Most people notice the same pattern when sleep is off: hunger goes up, food decisions get worse, and the process feels harder than it needs to.</Body>
                <Body>The aim is to get enough sleep to feel well rested when you wake up. For most people, that will usually mean at least around 8 hours, but this can vary from person to person. Keep in mind that 8 hours in bed does not necessarily mean 8 hours asleep, so in practice it is often a good idea to aim for around 8.5 to 9 hours in bed.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">A few things that help:</p>
                <BulletList items={[
                  "Keep a consistent sleep and wake time",
                  "Limit screens before bed",
                  "Avoid caffeine too late in the day",
                  "Keep your room cool, dark, and quiet",
                  "Have a simple wind-down routine before bed",
                ]} />
                <Body>You do not need a perfect routine. You just need one that helps you sleep well consistently.</Body>
              </SubSection>

              <SubSection title="10.2 Steps">
                <Body>You will have a step target in the app. Try to reach that target on average across the week.</Body>
                <Body>Walking is a simple way to increase your overall activity levels and energy expenditure, which helps support fat loss. It is also good for general health.</Body>
                <p className="font-body text-foreground/80 text-[15px] leading-relaxed mt-3">A few easy ways to get more steps in:</p>
                <BulletList items={[
                  "Go for 10-minute walks after meals",
                  "Use a walking pad",
                  "Park further away when possible",
                  "Take the stairs instead of the lift or escalator where practical",
                  "Add a walk at the start or end of your day",
                ]} />
                <Body>Small bits of movement done consistently add up over the week and make a real difference.</Body>
              </SubSection>
            </Section>

            {/* 11. Habits */}
            <Section id="habits" number="11" title="Habits">
              <Body>Alongside everything else, we will also be working on building habits.</Body>
              <Body>The goal is not just to help you get results now, but to help you maintain them later without always needing precise tracking or a strict meal plan.</Body>
              <Body>These habits are mainly about food and how you approach it day to day. Over time, they should help you become more independent and less reliant on a highly structured setup.</Body>
              <Body>Habits are how you will maintain your results after we stop working together.</Body>
              <Callout>If you miss a day, just keep going. The aim is to build habits that stick.</Callout>
            </Section>

            {/* 12. Common Mistakes */}
            <Section id="common-mistakes" number="12" title="Common Mistakes">
              <Body>Most people struggle because the basics are not being done consistently enough. The most common mistakes I see are:</Body>
              <BulletList items={[
                "Not being accurate with food, such as estimating or eyeballing portions",
                "Too many off-plan meals or hidden extras",
                "Missing training sessions",
                "Not prioritising sleep",
              ]} />
              <Body>These things can add up over the week and slow progress.</Body>
              <Body>Slip-ups happen. If you go off plan, overeat, or have a bad meal, get back on track as soon as possible. Do not let one mistake turn into a bad day or weekend.</Body>
              <Callout>Avoid an all-or-nothing mindset. One meal off plan is not the issue. Repeating it is.</Callout>
            </Section>

            {/* 12. Communication */}
            <Section id="communication" number="13" title="Communication">
              <Body>We will mainly use WhatsApp to communicate, and my contact details are provided for you below.</Body>
              <a
                href="https://wa.me/61468764276"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-border bg-secondary hover:bg-primary/10 hover:border-primary transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#59BE50">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
                <span className="font-body text-foreground font-medium text-[15px]">Message me on WhatsApp</span>
              </a>
              <Body>The weekly check-in is where we will review your progress in full, but you do not need to wait until then if something comes up and you need help. You are welcome to message me anytime if you have a question, are struggling with something, or want to share a win.</Body>
              <Body>I will always aim to reply within 24 hours.</Body>
              <Body>If you are genuinely unsure about something, ask. If something is affecting your ability to follow the plan, let me know. Good communication makes the coaching process easier and more effective for both of us.</Body>
            </Section>

            {/* 13. FAQ */}
            <Section id="faq" number="14" title="FAQ">
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
                  q: "What if I feel pain during exercise?",
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

            {/* 14. Final Notes */}
            <Section id="final-notes" number="15" title="Final Notes">
              <Body>At this point, you should be clear on how the coaching works, what is expected of you, and how to get the best result from the process.</Body>
              <Body>Your plan is ready, everything is set up, and you have a clear path forward. Now it's about putting it into action and doing the basics well, week after week.</Body>
              <Callout>Get started, trust the process, and let's build some momentum.</Callout>

              {/* Back to dashboard CTA */}
              <div className="mt-10 pt-8 border-t border-border/50">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg text-base font-body font-medium transition-colors cursor-pointer"
                  style={{ backgroundColor: "#052E1A", color: "#59BE50", border: "1.5px solid #59BE50" }}
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
      <footer className="py-5 border-t border-border">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-body text-muted-foreground text-xs">Jake Hickman · 1:1 Online Coaching</span>
          <span className="font-body text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
