import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import rawContent from "./getting-started-content.md?raw";

// ---------------------------------------------------------------------------
// Markdown parser — maps the .md file conventions to typed content nodes
// ---------------------------------------------------------------------------

type TextNode = { type: "text"; text: string };
type BulletNode = { type: "bullets"; items: string[] };
type CalloutNode = { type: "callout"; text: string };
type ImageNode = { type: "image"; src: string; alt: string; width?: string };
type WhatsAppNode = { type: "whatsapp"; href: string; label: string };
type SupplementsNode = { type: "supplements"; items: { name: string; desc: string; use: string }[] };
type DataLogNode = { type: "datalog"; items: { label: string; detail: string }[] };
type FAQNode = { type: "faq"; items: { q: string; a: string }[] };

type ContentNode =
  | TextNode
  | BulletNode
  | CalloutNode
  | ImageNode
  | WhatsAppNode
  | SupplementsNode
  | DataLogNode
  | FAQNode;

type SubSection = { title: string; nodes: ContentNode[] };
type Section = {
  id: string;
  number: string;
  title: string;
  nodes: ContentNode[];
  subsections: SubSection[];
};

function parseContent(md: string): Section[] {
  const lines = md.split("\n");
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let currentSub: SubSection | null = null;
  let bulletBuffer: string[] = [];
  let i = 0;

  function flushBullets(target: ContentNode[]) {
    if (bulletBuffer.length > 0) {
      target.push({ type: "bullets", items: [...bulletBuffer] });
      bulletBuffer = [];
    }
  }

  function currentNodes(): ContentNode[] {
    if (currentSub) return currentSub.nodes;
    if (currentSection) return currentSection.nodes;
    return [];
  }

  while (i < lines.length) {
    const line = lines[i];

    // SECTION directive
    const sectionMatch = line.match(/<!--\s*SECTION\s+id="([^"]+)"\s+number="([^"]+)"\s+title="([^"]+)"\s*-->/);
    if (sectionMatch) {
      flushBullets(currentNodes());
      currentSub = null;
      currentSection = { id: sectionMatch[1], number: sectionMatch[2], title: sectionMatch[3], nodes: [], subsections: [] };
      sections.push(currentSection);
      i++;
      continue;
    }

    // H2 subsection (## X.Y Title)
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushBullets(currentNodes());
      currentSub = { title: h2Match[1], nodes: [] };
      currentSection?.subsections.push(currentSub);
      i++;
      continue;
    }

    // Blockquote callout (> text)
    const bqMatch = line.match(/^>\s+(.+)$/);
    if (bqMatch) {
      flushBullets(currentNodes());
      currentNodes().push({ type: "callout", text: bqMatch[1] });
      i++;
      continue;
    }

    // Bullet item (- text)
    const bulletMatch = line.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      i++;
      continue;
    }

    // IMAGE directive
    const imgMatch = line.match(/<!--\s*IMAGE\s+src="([^"]+)"\s+alt="([^"]+)"(?:\s+width="([^"]+)")?\s*-->/);
    if (imgMatch) {
      flushBullets(currentNodes());
      currentNodes().push({ type: "image", src: imgMatch[1], alt: imgMatch[2], width: imgMatch[3] });
      i++;
      continue;
    }

    // WHATSAPP directive
    const waMatch = line.match(/<!--\s*WHATSAPP\s+href="([^"]+)"\s+label="([^"]+)"\s*-->/);
    if (waMatch) {
      flushBullets(currentNodes());
      currentNodes().push({ type: "whatsapp", href: waMatch[1], label: waMatch[2] });
      i++;
      continue;
    }

    // SUPPLEMENTS block
    if (line.trim() === "<!-- SUPPLEMENTS") {
      flushBullets(currentNodes());
      const items: { name: string; desc: string; use: string }[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "-->") {
        const parts = lines[i].split("|").map(s => s.trim());
        if (parts.length === 3) items.push({ name: parts[0], desc: parts[1], use: parts[2] });
        i++;
      }
      currentNodes().push({ type: "supplements", items });
      i++; // skip -->
      continue;
    }

    // DATALOG block
    if (line.trim() === "<!-- DATALOG") {
      flushBullets(currentNodes());
      const items: { label: string; detail: string }[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "-->") {
        const parts = lines[i].split("|").map(s => s.trim());
        if (parts.length >= 1) items.push({ label: parts[0], detail: parts[1] ?? "" });
        i++;
      }
      currentNodes().push({ type: "datalog", items });
      i++; // skip -->
      continue;
    }

    // FAQ block
    if (line.trim() === "<!-- FAQ") {
      flushBullets(currentNodes());
      const faqItems: { q: string; a: string }[] = [];
      i++;
      const faqLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "-->") {
        faqLines.push(lines[i]);
        i++;
      }
      // Split on "---" separator
      const rawItems = faqLines.join("\n").split(/\n---\n/);
      for (const raw of rawItems) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const nl = trimmed.indexOf("\n");
        if (nl === -1) continue;
        faqItems.push({ q: trimmed.slice(0, nl).trim(), a: trimmed.slice(nl + 1).trim() });
      }
      currentNodes().push({ type: "faq", items: faqItems });
      i++; // skip -->
      continue;
    }

    // Skip HTML comments and blank lines (don't flush bullets on blank — allow multi-paragraph lists)
    if (line.trim().startsWith("<!--") || line.trim() === "") {
      // Flush bullets on blank line only if next non-blank line is NOT a bullet
      if (line.trim() === "") {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === "") j++;
        if (j < lines.length && !lines[j].match(/^-\s+/)) {
          flushBullets(currentNodes());
        }
      }
      i++;
      continue;
    }

    // Skip H1 title
    if (line.startsWith("# ")) { i++; continue; }

    // Plain paragraph
    if (currentSection) {
      flushBullets(currentNodes());
      currentNodes().push({ type: "text", text: line.trim() });
    }
    i++;
  }

  flushBullets(currentNodes());
  return sections;
}

// ---------------------------------------------------------------------------
// Styled render components (identical to original design)
// ---------------------------------------------------------------------------

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5 mt-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#59BE50" }} />
          <span className="font-body text-foreground/85 text-[15px] sm:text-[15px] leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-foreground/80 text-base leading-[1.75] mt-3">{children}</p>;
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
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between gap-4 py-4 text-left">
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

function renderNode(node: ContentNode, key: number) {
  switch (node.type) {
    case "text":
      return <Body key={key}>{node.text}</Body>;
    case "bullets":
      return <BulletList key={key} items={node.items} />;
    case "callout":
      return <Callout key={key}>{node.text}</Callout>;
    case "image":
      return (
        <div key={key} className="mt-4">
          <img src={node.src} alt={node.alt} className={`w-full rounded-lg ${node.width ?? "max-w-xs"}`} />
        </div>
      );
    case "whatsapp":
      return (
        <a
          key={key}
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-border bg-secondary hover:bg-primary/10 hover:border-primary transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#59BE50">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
          <span className="font-body text-foreground font-medium text-[15px]">{node.label}</span>
        </a>
      );
    case "supplements":
      return (
        <ul key={key} className="space-y-5 mt-3">
          {node.items.map(({ name, desc, use }) => (
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
      );
    case "datalog":
      return (
        <ul key={key} className="space-y-3 mt-3">
          {node.items.map(({ label, detail }, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#59BE50" }} />
              <span className="font-body text-base leading-[1.75]">
                <span className="text-foreground font-medium">{label}</span>
                {detail && <span className="text-foreground/65"> — {detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      );
    case "faq":
      return (
        <div key={key}>
          {node.items.map((item, idx) => (
            <FAQItem key={idx} question={item.q} answer={item.a} />
          ))}
        </div>
      );
  }
}

function renderNodes(nodes: ContentNode[]) {
  return nodes.map((n, i) => renderNode(n, i));
}

// ---------------------------------------------------------------------------
// TOC — derived from parsed sections
// ---------------------------------------------------------------------------

const parsedSections = parseContent(rawContent);

const sections = parsedSections.map((s, i) => ({
  id: s.id,
  label: `${i + 1}. ${s.title}`,
}));

// ---------------------------------------------------------------------------
// Section layout components
// ---------------------------------------------------------------------------

function SubSectionBlock({ sub }: { sub: SubSection }) {
  return (
    <div className="mt-8">
      <h3 className="font-display text-foreground text-base font-semibold mb-3 tracking-tight">{sub.title}</h3>
      {renderNodes(sub.nodes)}
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <section id={section.id} className="pt-14 pb-4 border-t border-border/50 scroll-mt-[72px]">
      <div className="flex items-start gap-3 mb-5">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 mt-0.5"
          style={{ backgroundColor: "#052E1A", color: "#59BE50", border: "1.5px solid #59BE50" }}
        >
          {section.number}
        </span>
        <h2 className="font-display text-foreground text-[22px] font-bold leading-tight">{section.title}</h2>
      </div>
      {renderNodes(section.nodes)}
      {section.subsections.map((sub, i) => (
        <SubSectionBlock key={i} sub={sub} />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

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
  }, [isAuthenticated]);

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
    scrollTimerRef.current = setTimeout(() => { isScrollingRef.current = false; }, 1200);
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
        <a href={getLoginUrl()} className="px-6 py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity">
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
          <p className="font-body text-muted-foreground text-xs uppercase tracking-widest mb-4">Getting Started</p>
          <h1 className="font-display text-foreground text-2xl sm:text-4xl font-bold leading-[1.15] mb-3">Getting Started Guide</h1>
          <p className="font-body text-muted-foreground text-[15px] leading-relaxed max-w-xl">
            Read through this guide carefully before getting started. If anything is unclear, let me know.
          </p>
        </div>
      </section>

      {/* In-page TOC bar — mobile only */}
      <div ref={inPageTocRef} className="lg:hidden sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-[900px] mx-auto px-4">
          <button onClick={() => setTocOpen(o => !o)} className="w-full flex items-center justify-between py-3 text-sm font-body">
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
                      ? "text-foreground font-medium"
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
      <div className="flex-1 max-w-[900px] mx-auto w-full px-4 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12 py-6">
        {/* Desktop sidebar TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-[calc(56px+24px)] space-y-0.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-[13px] font-body transition-colors ${
                  activeSection === s.id
                    ? "text-foreground font-medium bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 space-y-0">
          {parsedSections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}

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
        </main>
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
