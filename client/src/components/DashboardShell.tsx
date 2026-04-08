import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  Salad,
  ChevronLeft,
  CheckSquare,
  ClipboardList,
  Dumbbell,
  Home,
  LogOut,
  Menu,
  Ruler,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// ─── Client nav: all tabs in a single scrollable bottom bar ─────────────────
const clientNav: NavItem[] = [
  { href: "/dashboard/overview",      label: "Home",          icon: <Home size={22} /> },
  { href: "/dashboard/daily-log",     label: "Daily Log",     icon: <ClipboardList size={22} /> },
  { href: "/dashboard/meal-plan",     label: "Meal Plan",     icon: <Zap size={22} /> },
  { href: "/dashboard/training",      label: "Training",      icon: <Dumbbell size={22} /> },
  { href: "/dashboard/check-ins",     label: "Check-ins",     icon: <Calendar size={22} /> },
  { href: "/dashboard/measurements",  label: "Measurements",  icon: <Ruler size={22} /> },
];

const coachNav: NavItem[] = [
  { href: "/coach/clients",          label: "Clients",          icon: <Users size={16} /> },
  { href: "/coach/training",         label: "Training Programs", icon: <Dumbbell size={16} /> },
  { href: "/coach/meal-plans",       label: "Meal Plans",        icon: <Zap size={16} /> },
  { href: "/coach/progress",         label: "Client Progress",   icon: <TrendingUp size={16} /> },
  { href: "/coach/exercise-library", label: "Exercise Library",  icon: <BookOpen size={16} /> },
  { href: "/coach/nutrition-data",   label: "Nutrition Data",    icon: <Salad size={16} /> },
  { href: "/coach/habits",           label: "Habits",            icon: <CheckSquare size={16} /> },
];

interface DashboardShellProps {
  children: React.ReactNode;
  mode: "client" | "coach";
}

export default function DashboardShell({ children, mode }: DashboardShellProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => (window.location.href = "/"),
  });

  // Pending approval count — only fetched for coach mode
  const { data: pendingCount = 0 } = trpc.users.pendingCount.useQuery(undefined, {
    enabled: mode === "coach" && user?.role === "admin",
    refetchInterval: 60_000,
  });

  // Track whether any localStorage draft exists for coach meal plans or training programs
  const [hasMealDraft, setHasMealDraft] = useState(false);
  const [hasTrainingDraft, setHasTrainingDraft] = useState(false);

  useEffect(() => {
    if (mode !== "coach") return;
    function checkDrafts() {
      const keys = Object.keys(localStorage);
      setHasMealDraft(keys.some(k => k.startsWith("draft:mealPlan:")));
      setHasTrainingDraft(keys.some(k => k.startsWith("draft:training:")));
    }
    // Run once on mount and whenever localStorage changes (cross-tab or same-tab via storage event)
    checkDrafts();
    window.addEventListener("storage", checkDrafts);
    // Also listen for a custom event dispatched by the forms when they write a draft
    window.addEventListener("draft-changed", checkDrafts);
    return () => {
      window.removeEventListener("storage", checkDrafts);
      window.removeEventListener("draft-changed", checkDrafts);
    };
  }, [mode]);

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
            "fixed top-0 left-0 h-full w-56 bg-sidebar border-r border-border z-30 flex flex-col transition-transform duration-200",
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
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
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
                  {item.href === "/coach/meal-plans" && hasMealDraft && (
                    <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
                  )}
                  {item.href === "/coach/training" && hasTrainingDraft && (
                    <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
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
        <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
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
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header — minimal, just branding + user initial */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar sticky top-0 z-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">JH Coaching</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {clientNav.find(n => location === n.href || (n.href !== "/dashboard/overview" && location.startsWith(n.href)))?.label ?? "Dashboard"}
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

      {/* Main content — padded at bottom to clear bottom nav */}
      <main className="flex-1 px-4 pt-5 pb-24 max-w-2xl w-full mx-auto">
        {children}
      </main>

      {/* Scrollable bottom navigation bar — all 7 tabs in one row */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-sidebar border-t border-border">
        {/* Scroll hint gradient on the right edge */}
        <div className="relative max-w-2xl mx-auto">
          <div
            className="flex items-stretch overflow-x-auto scrollbar-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {clientNav.map(item => {
              const isActive = location === item.href || (item.href !== "/dashboard/overview" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 py-3 transition-colors min-h-[68px] flex-shrink-0 w-[82px]",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.icon}
                  <span className={cn("text-[11px] font-medium leading-none whitespace-nowrap", isActive ? "text-primary" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
