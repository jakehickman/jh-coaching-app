/**
 * coachingPageContent.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All user-facing copy for the /coaching landing page (CoachingLanding.tsx).
 *
 * HOW TO EDIT COPY IN FUTURE
 * ──────────────────────────
 * - Change any string value in this file.
 * - Do NOT touch CoachingLanding.tsx unless you need to change layout or design.
 * - Arrays (featureList, coachingPoints, etc.) can have items added, removed,
 *   or reordered here — the page will reflect the change automatically.
 * - The `icon` fields in coachingPoints are Lucide icon names (strings);
 *   the page component maps them to the actual icon components.
 *
 * SECTIONS IN ORDER
 * ─────────────────
 * 1. URLs & constants
 * 2. Sticky / mobile CTA
 * 3. Hero
 * 4. Feature list
 * 5. About
 * 6. Approach
 * 7. Coaching points
 * 8. What to expect
 * 9. For / Not for
 * 10. Testimonials
 * 11. FAQ
 * 12. Join others banner
 * 13. Final CTA
 * 14. Footer
 */

// ─── 1. URLs & constants ─────────────────────────────────────────────────────

export const STRIPE_URL = "https://buy.stripe.com/3cI3co8I670DgtZ23J9AA01";

export const JAKE_PHOTO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663515200499/5nqL5RuopGEHVKSxcXsdAJ/jake-portrait-new_47aa37c9.png";

// ─── 2. Sticky / mobile CTA ──────────────────────────────────────────────────

export const stickyCta = "Work with Jake · $199 AUD/mo (3-month minimum)";

// ─── 3. Hero ─────────────────────────────────────────────────────────────────

export const hero = {
  eyebrow: "1:1 Online Coaching with Jake Hickman",
  headline: "Transform Your Body In 12 Weeks",
  subheadline: "Lose fat, build muscle, and stay consistent with a plan you can actually stick to.",
  price: "$199",
  priceLabel: "AUD / month (3-month minimum)",
  priceSub: "Cancel anytime. No lock-in.",
  ctaButton: "Work With Me",
  ctaNote: "Start immediately. Full access after checkout.",
};

// ─── 4. Feature list ─────────────────────────────────────────────────────────

export const featureList: string[] = [
  "Training program built for you",
  "Nutrition plan tailored to you",
  "Weekly check-ins & accountability",
  "Simple, sustainable approach",
  "Ongoing plan adjustments",
  "Work directly with me",
];

// ─── 5. About ────────────────────────────────────────────────────────────────

export const about = {
  eyebrow: "About Me",
  name: "Jake Hickman",
  credential: "Certified, Henselmans PT Course",
  bio: "I help people lose fat, build muscle, and stay consistent long term. I focus on effective training plans and a diet that's easy to follow. Everything is personalised and adjusted as you go, with ongoing accountability to keep you on track.",
  photoAlt: "Jake Hickman, Online Fitness Coach",
};

// ─── 6. Approach ─────────────────────────────────────────────────────────────

export const approach = {
  eyebrow: "My approach",
  headline: "No guesswork. Just a clear plan.",
  paragraphs: [
    "You get a training and nutrition plan built specifically for you, along with regular check-ins so you always know exactly what to do next.",
    "Everything is built around your body, your goals, and what you can realistically stick to.",
    "You'll have direct access to me for questions, form checks, or when you need a push.",
  ],
};

// ─── 7. Coaching points ──────────────────────────────────────────────────────
// icon: one of "Target" | "Calendar" | "MessageCircle" | "TrendingUp"

export const coachingSection = {
  eyebrow: "The coaching",
  headline: "This isn't a plan you follow alone.",
  intro:
    "Most people have tried a program before. The difference here is that I'm with you throughout: guiding, adjusting, and keeping you moving forward.",
};

export const coachingPoints: { icon: string; title: string; desc: string }[] = [
  {
    icon: "Target",
    title: "I'll build a plan that fits your life",
    desc: "Your training and nutrition are built around your goals and what you can realistically stick to. Not a template.",
  },
  {
    icon: "Calendar",
    title: "I'll keep you accountable",
    desc: "Regular check-ins mean you can't quietly fall off. I'll notice, I'll follow up, and I'll help you get back on track.",
  },
  {
    icon: "MessageCircle",
    title: "I'm available when you need me",
    desc: "You'll have direct access to me. If something comes up, send me a message and I'll respond.",
  },
  {
    icon: "TrendingUp",
    title: "I'll adjust as you progress",
    desc: "What works in week one won't be what you need in week eight. I'll update your plan so you keep moving forward.",
  },
];

// ─── 8. What to expect ───────────────────────────────────────────────────────

export const whatToExpect = {
  eyebrow: "What to expect",
  results: [
    {
      result: "Fat loss",
      detail: "Lose fat with a clear plan. No guessing, no trial and error.",
    },
    {
      result: "Muscle gain",
      detail: "Build strength and muscle with training that actually changes how your body looks over time.",
    },
    {
      result: "Consistency",
      detail: "A clear structure that keeps you showing up, even when motivation isn't there.",
    },
  ],
};

// ─── 9. For / Not for ────────────────────────────────────────────────────────

export const forSection = {
  forLabel: "This is for you if…",
  forItems: [
    "You're serious about making a change",
    "You want a plan built for you, not a template",
    "You're willing to put in the work",
    "You want someone keeping you accountable",
  ],
  notForLabel: "This isn't for you if…",
  notForItems: [
    "You're looking for a quick fix",
    "You're not willing to be consistent",
    "You expect results without putting in the work",
  ],
};

// ─── 10. Testimonials ────────────────────────────────────────────────────────

export const testimonialsSection = {
  eyebrow: "Client results",
};

export const testimonials: { quote: string; name: string; result: string }[] = [
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

// ─── 11. FAQ ─────────────────────────────────────────────────────────────────

export const faqSection = {
  eyebrow: "Questions",
};

export const faqs: { q: string; a: string }[] = [
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
];

// ─── 12. Join others banner ───────────────────────────────────────────────────

export const joinBanner = "Join others already making progress";

// ─── 13. Final CTA ───────────────────────────────────────────────────────────

export const finalCta = {
  headline: "Ready to get started?",
  body: "Get a clear plan, ongoing accountability, and direct support. Everything you need to start making progress immediately.",
  ctaButton: "Work With Me Now",
  ctaNote: "$199 AUD/month (3-month minimum). Cancel anytime.",
};

// ─── 14. Guarantee ───────────────────────────────────────────────────────────

export const guarantee = {
  label: "30-Day Money-Back Guarantee",
  sub: "No lock-in · Cancel anytime",
};

// ─── 15. Footer ──────────────────────────────────────────────────────────────

export const footer = {
  left: "Jake Hickman · 1:1 Online Coaching",
};

// ─── 16. Mid-section CTA button ──────────────────────────────────────────────

export const midCta = "Work with me · $199/mo (3-month minimum)";
