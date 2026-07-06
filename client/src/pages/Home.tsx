import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (user?.role === "admin") {
        navigate("/coach");
      } else {
        navigate("/dashboard");
      }
    }
  }, [loading, isAuthenticated, user, navigate]);

  // Check for invite_required error in URL params
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const inviteRequired = error === "invite_required";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo / Brand */}
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          JH Coaching
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
          Client Dashboard
        </h1>
        <p className="mt-4 text-muted-foreground text-base max-w-sm mx-auto">
          Track your training, nutrition, and progress — all in one place.
        </p>
      </div>

      {/* Invite-required error */}
      {inviteRequired && (
        <div className="mb-6 max-w-sm w-full bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-4 text-center">
          <p className="text-sm font-semibold text-destructive mb-1">Invite required</p>
          <p className="text-xs text-muted-foreground">
            This app is invite-only. Please use the invite link sent to you by your coach to sign up.
          </p>
        </div>
      )}

      {/* CTA */}
      <a
        href={getLoginUrl()}
        className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
      >
        Sign In to Your Dashboard
      </a>
    </div>
  );
}
