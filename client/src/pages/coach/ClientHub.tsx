/**
 * ClientHub — /coach/client/:id
 *
 * A single-client workspace. ProgressSection handles all three tabs:
 *   Overview  — weekly review, habits, recent logs
 *   Progress  — body comp, nutrition history, progression
 *   Program   — training program editor + meal plan editor
 */
import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ProgressSection from "./ProgressSection";

export default function ClientHub() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  const clientId = parseInt(id ?? "0", 10);

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

  return (
    <DashboardShell mode="coach">
      <button
        onClick={() => navigate("/coach/clients")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft size={13} />
        Back to Clients
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary text-base font-bold flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{displayName}</h1>
          {clientUser?.email && (
            <span className="text-xs text-muted-foreground mt-0.5 block">{clientUser.email}</span>
          )}
        </div>
      </div>

      {clientId > 0 && <ProgressSection fixedClientId={clientId} />}
    </DashboardShell>
  );
}
