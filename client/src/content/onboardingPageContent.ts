/**
 * onboardingPageContent.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All user-facing copy for the /onboarding page (Onboarding.tsx).
 *
 * HOW TO EDIT COPY IN FUTURE
 * ──────────────────────────
 * - Change any string value in this file.
 * - Do NOT touch Onboarding.tsx unless you need to change layout or design.
 * - The `steps` array can have items added, removed, or reordered here —
 *   the page will reflect the change automatically.
 *
 * SECTIONS IN ORDER
 * ─────────────────
 * 1. URLs
 * 2. Header
 * 3. Hero
 * 4. What happens next (steps)
 * 5. Form section
 * 6. Footer
 */

// ─── 1. URLs ─────────────────────────────────────────────────────────────────

export const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeL6SYdRwha1US-ububaG5VWVpkAxMzhyoJxVASKWQBp0G7vw/viewform?embedded=true";

// ─── 2. Header ───────────────────────────────────────────────────────────────

export const header = {
  eyebrow: "1:1 Online Coaching with Jake Hickman",
};

// ─── 3. Hero ─────────────────────────────────────────────────────────────────

export const hero = {
  paymentBadge: "Payment confirmed",
  headline: "You're in. Let's get started.",
  subheadline: "I'm looking forward to working with you. Fill in the form below and I'll take it from there.",
};

// ─── 4. What happens next (steps) ────────────────────────────────────────────

export const whatHappensNext = {
  eyebrow: "What happens next",
};

export const steps: { step: string; text: string }[] = [
  { step: "1", text: "Complete the onboarding form below" },
  { step: "2", text: "I'll review your answers and build your plan" },
  { step: "3", text: "I'll be in touch within 48 hours with your plan." },
];

// ─── 5. Form section ─────────────────────────────────────────────────────────

export const formSection = {
  eyebrow: "Complete your onboarding below",
  iframeTitle: "Onboarding Form",
  iframeFallback: "Loading…",
};

// ─── 6. Footer ───────────────────────────────────────────────────────────────

export const footer = {
  left: "Jake Hickman · 1:1 Online Coaching",
};
