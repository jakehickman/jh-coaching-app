const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdrdy6NM8YX7zsKPb5OJLwynny0It852Nk523jYW8Whn_7N2A/viewform?embedded=true";

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-[620px] mx-auto px-5 py-4">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest text-center">
            1:1 Online Coaching with Jake Hickman
          </p>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-10 pb-8 bg-background">
        <div className="max-w-[620px] mx-auto px-5 text-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 text-xs font-body font-medium"
            style={{ backgroundColor: "#052E1A", color: "#22C55E" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Payment confirmed
          </div>
          <h1 className="font-display text-foreground text-4xl md:text-5xl font-bold leading-[1.1] mb-4">
            You're in. Let's get started.
          </h1>
          <p className="font-body text-muted-foreground text-base leading-relaxed mb-3 max-w-md mx-auto">
            The next step is to complete the onboarding form. Once submitted, you'll receive your plan within 24–48 hours.
          </p>
          <p className="font-body text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            This will take around 5–10 minutes. Answer as best you can. There are no perfect answers. The more honest
            and accurate you are, the better I can tailor everything to you.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Google Form */}
      <section className="py-8 bg-background">
        <div className="max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-5">
            Complete your onboarding below
          </p>
          <iframe
            src={GOOGLE_FORM_URL}
            width="100%"
            height="2400"
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            title="Onboarding Form"
            className="w-full"
            style={{ border: "none" }}
          >
            Loading…
          </iframe>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* What happens next */}
      <section className="py-10 bg-background">
        <div className="max-w-[620px] mx-auto px-5">
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-6">
            What happens next
          </p>
          <div className="flex flex-col gap-5">
            {[
              { step: "1", text: "Complete the onboarding form" },
              { step: "2", text: "I'll review your answers and create your plan" },
              {
                step: "3",
                text: "I'll send your plan with a video explaining everything within 24–48 hours",
              },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-4">
                <div
                  className="shrink-0 w-7 h-7 flex items-center justify-center font-display font-bold text-sm"
                  style={{ backgroundColor: "#052E1A", color: "#22C55E" }}
                >
                  {step}
                </div>
                <p className="font-body text-foreground text-base leading-relaxed pt-0.5">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border" style={{ backgroundColor: "#111111" }}>
        <div className="max-w-[620px] mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-2">
          <span className="font-body text-muted-foreground text-xs">Jake Hickman · 1:1 Online Coaching</span>
          <span className="font-body text-muted-foreground text-xs">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
