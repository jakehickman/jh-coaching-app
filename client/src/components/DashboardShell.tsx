import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Calendar,
  Salad,
  ChevronLeft,
  ClipboardList,
  Dumbbell,
  Home,
  LogOut,
  Menu,
  Ruler,
  ShoppingCart,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const clientNav: NavItem[] = [
  { href: "/dashboard/overview", label: "Dashboard", icon: <Home size={18} /> },
  { href: "/dashboard/daily-log", label: "Daily Log", icon: <ClipboardList size={18} /> },
  { href: "/dashboard/measurements", label: "Measurements", icon: <Ruler size={18} /> },
  { href: "/dashboard/meal-plan", label: "Meal Plan", icon: <Zap size={18} /> },
  { href: "/dashboard/shopping", label: "Shopping List", icon: <ShoppingCart size={18} /> },
  { href: "/dashboard/training", label: "Training Program", icon: <Dumbbell size={18} /> },
  { href: "/dashboard/workout-log", label: "Workout Log", icon: <BarChart3 size={18} /> },
];

const coachNav: NavItem[] = [
  { href: "/coach/clients", label: "Clients", icon: <Users size={18} /> },
  { href: "/coach/training", label: "Training Programs", icon: <Dumbbell size={18} /> },
  { href: "/coach/meal-plans", label: "Meal Plans", icon: <Zap size={18} /> },
  { href: "/coach/progress", label: "Client Progress", icon: <TrendingUp size={18} /> },
  { href: "/coach/exercise-library", label: "Exercise Library", icon: <BookOpen size={18} /> },
  { href: "/coach/nutrition-data", label: "Nutrition Data", icon: <Salad size={18} /> },
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

  const nav = mode === "client" ? clientNav : coachNav;

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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-sidebar border-r border-border z-30 flex flex-col transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-6 border-b border-border">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              JH Coaching
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">
              {mode === "coach" ? "Coach Panel" : "Client Dashboard"}
            </p>
          </div>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Switch role link */}
        {user?.role === "admin" && (
          <div className="px-4 py-2 border-b border-border">
            <Link
              href={mode === "coach" ? "/dashboard" : "/coach"}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors py-1"
            >
              <ChevronLeft size={14} />
              {mode === "coach" ? "View as Client" : "Coach Panel"}
            </Link>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/dashboard/overview" &&
                item.href !== "/coach/clients" &&
                location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-base transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-1"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border bg-sidebar sticky top-0 z-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <Menu size={24} />
          </button>
          <p className="text-base font-bold text-foreground">JH Coaching</p>
          <div className="w-8" />
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
