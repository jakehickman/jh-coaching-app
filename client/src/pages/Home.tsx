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

      {/* CTA */}
      <a
        href={getLoginUrl()}
        className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold text-sm uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
      >
        Sign In to Your Dashboard
      </a>

      <p className="mt-6 text-xs text-muted-foreground">
        Coach?{" "}
        <a href={getLoginUrl()} className="text-primary hover:underline">
          Sign in to the coach panel
        </a>
      </p>

      {/* Features */}
      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
        {[
          { label: "Daily Log", desc: "Weight, sleep & training" },
          { label: "Meal Plan", desc: "Training & rest day meals" },
          { label: "Training", desc: "Your program & MESO" },
          { label: "Progress", desc: "Charts & measurements" },
        ].map((f) => (
          <div key={f.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="w-2 h-2 rounded-full bg-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">{f.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
