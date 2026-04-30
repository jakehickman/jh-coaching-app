/**
 * ClientHub — /coach/client/:id
 *
 * A single-client workspace. ProgressSection handles all three tabs:
 *   Overview  — weekly review, habits, recent logs, check-ins
 *   Progress  — body comp, nutrition history, progression
 *   Program   — training program editor + meal plan editor
 *
 * All content is pre-filtered to the client in the URL.
 */
import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ProgressSection from "./ProgressSection";

const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  "Gaining":          { bg: "bg-blue-500/15",   text: "text-blue-400" },
  "Mini Cut":         { bg: "bg-orange-500/15",  text: "text-orange-400" },
  "General Fat Loss": { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  "Contest Prep":     { bg: "bg-purple-500/15",  text: "text-purple-400" },
};

export default function ClientHub() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  const clientId = parseInt(id ?? "0", 10);

  // Fetch all users to get name/email/checkInDay for the header
  const { data: allUsers } = trpc.users.list.useQuery();
  const clientUser = allUsers?.find((u) => u.id === clientId);

  if (!loading && isAuthenticated && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Access denied. Coach accounts only.</p>
      </div>
    );
  }

  const displayName = (clientUser as any)?.displayName ?? clientUser?.name ?? "Client";
  const checkInDay = (clientUser as any)?.checkInDay
    ? ((clientUser as any).checkInDay as string).charAt(0).toUpperCase() + ((clientUser as any).checkInDay as string).slice(1)
    : null;

  // Current phase badge
  const { data: phases = [] } = trpc.phases.list.useQuery(
    { clientId },
    { enabled: clientId > 0 }
  );
  const today = new Date().toISOString().slice(0, 10);
  const activePhase = (phases as any[]).find((p) => p.startDate <= today && (!p.endDate || p.endDate >= today)) ?? null;
  const startDateMs = activePhase ? new Date(activePhase.startDate + "T00:00:00").getTime() : null;
  const weeksIn = startDateMs ? Math.floor((Date.now() - startDateMs) / (7 * 24 * 60 * 60 * 1000)) + 1 : null;
  const totalWeeks = activePhase?.endDate && activePhase?.startDate
    ? Math.round((new Date(activePhase.endDate + "T00:00:00").getTime() - new Date(activePhase.startDate + "T00:00:00").getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <DashboardShell mode="coach">
      {/* Back navigation */}
      <button
        onClick={() => navigate("/coach/clients")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft size={13} />
        Back to Clients
      </button>

      {/* Client header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary text-base font-bold flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{displayName}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {clientUser?.email && (
              <span className="text-xs text-muted-foreground">{clientUser.email}</span>
            )}
            {checkInDay && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                Check-in: {checkInDay}
              </span>
            )}
            {activePhase && (() => {
              const c = PHASE_COLORS[activePhase.label] ?? { bg: "bg-secondary", text: "text-muted-foreground" };
              return (
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                  {activePhase.label}{weeksIn != null ? ` - Week ${weeksIn}${totalWeeks != null ? `/${totalWeeks}` : ""}` : ""}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Three tabs: Overview · Progress · Program */}
      {clientId > 0 && <ProgressSection fixedClientId={clientId} />}
    </DashboardShell>
  );
}
