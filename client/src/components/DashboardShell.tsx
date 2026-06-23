import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Salad,
  CalendarCheck,
  ChevronLeft,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  Home,
  LogOut,
  Menu,
  Users,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// ─── Client nav: all tabs in a single scrollable bottom bar ─────────────────
const clientNav: NavItem[] = [
  { href: "/dashboard/overview",      label: "Home",          icon: <Home size={22} /> },
  { href: "/dashboard/daily-log",     label: "Daily Log",     icon: <ClipboardList size={22} /> },
  { href: "/dashboard/nutrition",    label: "Nutrition",    icon: <Utensils size={22} /> },
  { href: "/dashboard/training",      label: "Training",      icon: <Dumbbell size={22} /> },
];

const coachNav: NavItem[] = [
  { href: "/coach/clients",          label: "Clients",          icon: <Users size={18} /> },
  { href: "/coach/check-ins",        label: "Check-ins",         icon: <CalendarCheck size={18} /> },
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

  // Unreviewed check-in count — poll every 5 minutes
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery(undefined, {
    enabled: mode === "coach" && user?.role === "admin",
    refetchInterval: 300_000,
  });
  // Server-side client status list (replaces overdueClients)
  const { data: clientStatusList = [] } = trpc.checkIn.clientStatusList.useQuery(undefined, {
    enabled: mode === "coach" && user?.role === "admin",
    refetchInterval: 300_000,
  });

  // Compute badge count: unreviewed submissions + overdue clients (not double-counted)
  const checkInsAttentionCount = (() => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayJsDay = now.getUTCDay();
    const daysFromMonday = todayJsDay === 0 ? 6 : todayJsDay - 1;
    const mondayUtc = new Date(todayUtc);
    mondayUtc.setUTCDate(todayUtc.getUTCDate() - daysFromMonday);

    const unreviewedIds = new Set<number>();
    const overdueIds = new Set<number>();

    // Unreviewed: has a submission this week that hasn't been reviewed
    for (const ci of latestCheckIns as any[]) {
      if (ci.submittedAt && !ci.reviewedAt) {
        const submittedUtc = new Date(Date.UTC(
          new Date(ci.submittedAt).getUTCFullYear(),
          new Date(ci.submittedAt).getUTCMonth(),
          new Date(ci.submittedAt).getUTCDate()
        ));
        if (submittedUtc >= mondayUtc) {
          unreviewedIds.add(ci.clientId);
        }
      }
    }

    // Overdue: from server-side calculation
    for (const o of clientStatusList as any[]) {
      if (o.status === "overdue") overdueIds.add(o.clientId);
    }

    // Combine: count clients that need attention (unreviewed OR overdue, not double-counted)
    const allIds = new Set([...Array.from(unreviewedIds), ...Array.from(overdueIds)]);
    return allIds.size;
  })();

  // Client: check-in day badge — show dot on Check-in tab on assigned day when not yet submitted
  const weekStartDate = (() => {
    const d = new Date();
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  })();
  const { data: currentCycleData } = trpc.checkIn.myCurrentCycle.useQuery(
    undefined,
    { enabled: mode === "client", refetchInterval: 300_000 }
  );
  const { data: clientProfile } = trpc.profile.get.useQuery(undefined, {
    enabled: mode === "client",
  });
  // Determine if today is the client's check-in day
  const isClientCheckInDay = (() => {
    if (mode !== "client") return false;
    const checkInDay = (clientProfile as any)?.checkInDay as string | undefined;
    if (!checkInDay) return false;
    const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return new Date().getDay() === (dayMap[checkInDay] ?? -1);
  })();
  // Direct submission lookup — covers the case where the coach reviewed and advanced the cycle
  // on the same day (resetting status to 'upcoming' even though the client already submitted).
  const { data: hasSubmittedThisWeekDot } = trpc.checkIn.myHasSubmittedThisWeek.useQuery(
    undefined,
    { enabled: mode === "client" && isClientCheckInDay, staleTime: 0, refetchInterval: 300_000 }
  );
  const showCheckInBadge = isClientCheckInDay
    && currentCycleData?.status !== "submitted"
    && hasSubmittedThisWeekDot !== true;



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
                  {item.href === "/coach/check-ins" && checkInsAttentionCount > 0 && (
                    <span className="ml-auto flex-shrink-0 min-w-[18px] h-4 px-1 rounded-full bg-primary text-black text-[10px] font-bold flex items-center justify-center">
                      {checkInsAttentionCount}
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
                  href={`${item.href}${viewAsParams}`}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 py-3 transition-colors min-h-[68px] flex-shrink-0 w-[82px]",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="relative inline-flex">
                    {item.icon}
                    {item.href === "/dashboard/check-ins" && showCheckInBadge && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-sidebar" />
                    )}
                  </span>
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
