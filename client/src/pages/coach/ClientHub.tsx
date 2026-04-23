/**
 * ClientHub — /coach/client/:id
 *
 * A single-client deep-dive page. Renders ProgressSection with the client
 * pre-selected (fixedClientId) so the coach never needs to re-select the
 * client when switching between tabs.
 */
import { useParams, useLocation } from "wouter";
import { ArrowLeft, User } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ProgressSection from "./ProgressSection";

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

  const displayName = clientUser?.displayName ?? clientUser?.name ?? "Client";
  const checkInDay = clientUser?.checkInDay
    ? clientUser.checkInDay.charAt(0).toUpperCase() + clientUser.checkInDay.slice(1)
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
          </div>
        </div>
      </div>

      {/* All progress tabs pre-filtered to this client */}
      {clientId > 0 && <ProgressSection fixedClientId={clientId} />}
    </DashboardShell>
  );
}
