import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Salad,
  ChevronLeft,
  CheckSquare,
  ClipboardList,
  Dumbbell,
  LogOut,
  Menu,
  PersonStanding,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";

// ─── Global fullness reminder ─────────────────────────────────────────────────

function toLocalDateStr(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useUnratedMeal() {
  const todayStr = toLocalDateStr(new Date());
  const { data: meals = [] } = trpc.mealLogs.listByDay.useQuery(
    { date: todayStr },
    { refetchInterval: 60_000 }
  );
  const now = Date.now();
  const unrated = (meals as any[])
    .filter((m) => {
      if (m.mealType !== "meal" || m.fullnessRating != null) return false;
      const age = now - new Date(m.loggedAt).getTime();
      return age > 0 && age < 2 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  return unrated[0] ?? null;
}

// ─── Inline FullnessSheet for global banner ────────────────────────────────────────────────────

const SCALE_LABELS = [
  "Ravenous", "Very hungry", "Hungry", "Mild hunger", "Neutral",
  "Satisfied", "Full", "Overfull", "Stuffed", "Painfully full",
];

function GlobalFullnessSheet({
  open, mealId, onClose, onSaved,
}: {
  open: boolean;
  mealId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullness, setFullness] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const rateMutation = trpc.mealLogs.rateFullness.useMutation({
    onSuccess: () => { onSaved(); onClose(); setFullness(null); setNotes(""); },
    onError: (e: any) => console.error(e.message),
  });

  function handleClose() { setFullness(null); setNotes(""); onClose(); }

  const current = fullness ?? 5;
  const isIdeal = current >= 6 && current <= 7;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8" hideCloseButton>
        <SheetHeader className="flex flex-row items-center justify-between mb-2">
          <SheetTitle>How are you feeling?</SheetTitle>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={20} />
          </button>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mb-5">Rate your fullness from 1–10.</p>
        <div className="space-y-5">
          {/* Stepper */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <button onClick={() => setFullness(Math.max(1, current - 1))} disabled={current <= 1}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-3xl font-light text-foreground hover:bg-secondary/80 disabled:opacity-30 transition-all">
                −
              </button>
              <div className="flex-1 text-center">
                <p className={cn("text-7xl font-bold leading-none", isIdeal ? "text-green-400" : "text-foreground")}>{current}</p>
                <p className={cn("text-sm mt-2 font-medium", isIdeal ? "text-green-400" : "text-muted-foreground")}>{SCALE_LABELS[current - 1]}</p>
              </div>
              <button onClick={() => setFullness(Math.min(10, current + 1))} disabled={current >= 10}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-3xl font-light text-foreground hover:bg-secondary/80 disabled:opacity-30 transition-all">
                +
              </button>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-muted-foreground">1</span>
              <div className="flex-1 flex gap-1 justify-between px-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} onClick={() => setFullness(n)}
                    className={cn("flex-1 h-1.5 rounded-full transition-all",
                      n <= current ? (n >= 6 && n <= 7 ? "bg-green-400" : "bg-foreground/40") : "bg-secondary"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">10</span>
            </div>
          </div>
          {/* Notes */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Notes</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to add?" rows={2}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <Button className="w-full" disabled={fullness == null || rateMutation.isPending || mealId == null}
            onClick={() => mealId != null && fullness != null && rateMutation.mutate({ id: mealId, fullnessRating: fullness, notes: notes || null })}>
            {rateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// ─── Client nav: 4 tabs ─────────────────────────────────────────────────────
const clientNav: NavItem[] = [
  { href: "/dashboard/daily-log", label: "Daily Log", icon: <ClipboardList size={22} /> },
  { href: "/dashboard/body-comp", label: "Body Comp", icon: <PersonStanding size={22} /> },
  { href: "/dashboard/nutrition", label: "Nutrition", icon: <Utensils size={22} /> },
  { href: "/dashboard/training",  label: "Training",  icon: <Dumbbell size={22} /> },
];

const coachNav: NavItem[] = [
  { href: "/coach/clients",          label: "Clients",          icon: <Users size={18} /> },
  { href: "/coach/exercise-library", label: "Exercise Library",  icon: <BookOpen size={18} /> },
  { href: "/coach/nutrition-data",   label: "Nutrition Data",    icon: <Salad size={18} /> },
  { href: "/coach/habits",           label: "Habits",            icon: <CheckSquare size={18} /> },
];

interface DashboardShellProps {
  children: React.ReactNode;
  mode: "client" | "coach";
}

export default function DashboardShell({ children, mode }: DashboardShellProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const [location] = useLocation();
  const currentSearch = useSearch();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Preserve viewAs params when navigating between client tabs
  const viewAsParams = (() => {
    const sp = new URLSearchParams(currentSearch);
    const viewAs = sp.get("viewAs");
    const viewAsName = sp.get("viewAsName");
    if (viewAs) return `?viewAs=${viewAs}${viewAsName ? `&viewAsName=${viewAsName}` : ""}`;
    return "";
  })();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => (window.location.href = "/"),
  });

  // Pending approval count — only fetched for coach mode
  const { data: pendingCount = 0 } = trpc.users.pendingCount.useQuery(undefined, {
    enabled: mode === "coach" && user?.role === "admin",
    refetchInterval: 60_000,
  });



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

  // Approval gate — only applies to client dashboard (not coach panel)
  if (mode === "client" && user?.role !== "admin" && !(user as any)?.approved) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-3">Awaiting access</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Your account has been created. Your coach will grant you access shortly — usually within 24 hours of signing up.
          </p>
          <button
            onClick={() => logout.mutate()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ─── Coach layout: desktop-first, full-width, compact sidebar ───────────────
  if (mode === "coach") {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar — compact for desktop */}
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-60 bg-sidebar border-r border-border z-30 flex flex-col transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Brand */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                JH Coaching
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">Coach Panel</p>
            </div>
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Switch role link */}
          {user?.role === "admin" && (
            <div className="px-3 py-1.5 border-b border-border">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1"
              >
                <ChevronLeft size={12} />
                View as Client
              </Link>
            </div>
          )}

          {/* Nav — compact items */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {coachNav.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/coach/clients" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.href === "/coach/clients" && pendingCount > 0 && (
                    <span className="ml-auto flex-shrink-0 min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}

                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="px-3 py-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user?.name ?? "User"}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={() => logout.mutate()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-0.5"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content — full width on desktop, no max-w cap */}
        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar sticky top-0 z-10">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <Menu size={22} />
            </button>
            <p className="text-sm font-bold text-foreground">JH Coaching</p>
            <div className="w-8" />
          </header>

          {/* Desktop header bar */}
          <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar/50 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">Coach Panel</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{user?.name}</span>
              <button
                onClick={() => logout.mutate()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6 w-full">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // ─── Client layout: mobile-first with scrollable bottom navigation ────────────
  return <ClientLayout mode={mode} user={user} logout={logout} location={location} viewAsParams={viewAsParams} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>{children}</ClientLayout>;
}

function ClientLayout({
  children, user, logout, location, viewAsParams,
}: {
  children: React.ReactNode;
  mode: string;
  user: any;
  logout: any;
  location: string;
  viewAsParams: string;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const unratedMeal = useUnratedMeal();
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const [fullnessOpen, setFullnessOpen] = useState(false);
  const [fullnessMealId, setFullnessMealId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const showBanner = unratedMeal != null && dismissedId !== unratedMeal.id;

  function handleRateFullness() {
    setFullnessMealId(unratedMeal!.id);
    setFullnessOpen(true);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header — minimal, just branding + user initial */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar sticky top-0 z-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">JH Coaching</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {clientNav.find(n => location === n.href || location.startsWith(n.href))?.label ?? "Dashboard"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <Link
              href="/coach"
              className="text-xs text-primary font-medium px-2.5 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              Coach Panel
            </Link>
          )}
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
        </div>
      </header>

      {/* Global fullness reminder banner */}
      {showBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-sm">
          <span className="text-muted-foreground text-xs truncate">How full are you after your last meal?</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRateFullness}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Rate fullness
            </button>
            <button onClick={() => setDismissedId(unratedMeal!.id)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main content — padded at bottom to clear bottom nav */}
      <main className="flex-1 px-4 pt-5 pb-24 max-w-2xl w-full mx-auto">
        {children}
      </main>

      {/* Fullness rating sheet */}
      <GlobalFullnessSheet
        open={fullnessOpen}
        mealId={fullnessMealId}
        onClose={() => { setFullnessOpen(false); setFullnessMealId(null); }}
        onSaved={() => { utils.mealLogs.listByDay.invalidate(); setDismissedId(null); }}
      />

      {/* Bottom navigation bar — 4 evenly-spaced tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-sidebar border-t border-border">
        <div className="max-w-2xl mx-auto flex items-stretch">
          {clientNav.map(item => {
            const isActive = location === item.href || location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`${item.href}${viewAsParams}`}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1.5 py-3 transition-colors min-h-[68px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative inline-flex">
                  {item.icon}
                </span>
                <span className={cn("text-[11px] font-medium leading-none whitespace-nowrap", isActive ? "text-primary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
