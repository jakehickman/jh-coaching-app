import {
  GOOGLE_FORM_URL,
  header,
  hero,
  whatHappensNext,
  steps,
  formSection,
  footer,
} from "@/content/onboardingPageContent";

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-[680px] mx-auto px-6 py-4 text-center">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest">
            {header.eyebrow}
          </p>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-14 pb-12 bg-background">
        <div className="max-w-[680px] mx-auto px-6 text-center">
          {/* Payment badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-8 text-xs font-body font-medium rounded-full"
            style={{ backgroundColor: "#052E1A", color: "#22C55E" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {hero.paymentBadge}
          </div>

          <h1 className="font-display text-foreground text-4xl md:text-5xl font-bold leading-[1.1] mb-5">
            {hero.headline}
          </h1>
          <p className="font-body text-muted-foreground text-base leading-relaxed max-w-sm mx-auto">
            {hero.subheadline}
          </p>
        </div>
      </section>

      {/* What happens next */}
      <section className="py-10 border-y border-border" style={{ backgroundColor: "#0d0d0d" }}>
        <div className="max-w-[680px] mx-auto px-6">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-8 text-center">
            {whatHappensNext.eyebrow}
          </p>
          <div className="flex flex-col items-start gap-6 max-w-xs mx-auto">
            {steps.map(({ step, text }) => (
              <div key={step} className="flex flex-row items-start gap-4 text-left">
                {/* Circle badge */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0"
                  style={{ backgroundColor: "#052E1A", color: "#59BE50", border: "1.5px solid #59BE50" }}
                >
                  {step}
                </div>
                <p className="font-body text-foreground text-sm leading-relaxed pt-1.5">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Google Form */}
      <section className="pt-10 pb-4 bg-background flex-1">
        <div className="max-w-[680px] mx-auto px-6">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-6 text-center">
            {formSection.eyebrow}
          </p>
          <iframe
            src={GOOGLE_FORM_URL}
            width="100%"
            height="1600"
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            title={formSection.iframeTitle}
            className="w-full"
            style={{ border: "none" }}
          >
            {formSection.iframeFallback}
          </iframe>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border mt-auto">
        <div className="max-w-[680px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-body text-muted-foreground text-xs">{footer.left}</span>
          <span className="font-body text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
