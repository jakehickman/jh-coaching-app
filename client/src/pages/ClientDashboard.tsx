import { useParams, useLocation, useSearch } from "wouter";
import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardShell from "@/components/DashboardShell";
import { ViewAsContext } from "@/contexts/ViewAsContext";
import { trpc } from "@/lib/trpc";
import { Eye, X } from "lucide-react";

import OverviewTab from "./client/OverviewTab";
import DailyLogTab from "./client/DailyLogTab";
import MeasurementsTab from "./client/MeasurementsTab";
import { CombinedNutritionTab } from "./client/NutritionTab";
import CombinedTrainingTab from "./client/TrainingTab";
import CheckInsTab from "./client/CheckInsTab";

export default function ClientDashboard() {
  const params = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const tab = params.tab ?? "overview";

  // Parse ?viewAs=<userId>&viewAsName=<name> from the URL
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const viewAsUserId = useMemo(() => {
    const v = searchParams.get("viewAs");
    return v ? parseInt(v, 10) : null;
  }, [searchParams]);
  const viewAsName = useMemo(() => searchParams.get("viewAsName"), [searchParams]);

  // Fetch the list of clients so we can resolve the name if not in URL
  const { data: clients = [] } = trpc.users.list.useQuery(undefined, {
    enabled: viewAsUserId !== null && !viewAsName,
  });
  const resolvedName = useMemo(() => {
    if (viewAsName) return decodeURIComponent(viewAsName);
    if (viewAsUserId && clients.length > 0) {
      const c = (clients as any[]).find((u: any) => u.id === viewAsUserId);
      return c ? (c.name || c.email) : "Client";
    }
    return null;
  }, [viewAsName, viewAsUserId, clients]);

  const viewAsState = useMemo(() => ({
    viewAsUserId,
    viewAsName: resolvedName,
  }), [viewAsUserId, resolvedName]);

  // Clear the query cache only when *entering* viewAs mode (viewAsUserId
  // changes from null to a real id, or switches to a different client id).
  // Clearing on every mount (including null -> null) wipes auth.me and
  // causes an infinite loading spinner.
  const queryClient = useQueryClient();
  const prevViewAsRef = useRef<number | null>(undefined as unknown as null);
  useEffect(() => {
    const prev = prevViewAsRef.current;
    prevViewAsRef.current = viewAsUserId;
    if (viewAsUserId !== null && viewAsUserId !== prev) {
      queryClient.clear();
    }
  }, [viewAsUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!params.tab) {
      const qs = search ? `?${search}` : "";
      navigate(`/dashboard/overview${qs}`);
    }
  }, [params.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderTab = () => {
    switch (tab) {
      case "overview":     return <OverviewTab key="overview" />;
      case "daily-log":    return <DailyLogTab key="daily-log" />;
      case "check-ins":    return <CheckInsTab key="check-ins" />;
      case "measurements": return <MeasurementsTab key="measurements" />;
      case "meal-plan":    return <CombinedNutritionTab key="nutrition" defaultSub="today" />;
      case "nutrition":    return <CombinedNutritionTab key="nutrition" defaultSub="today" />;
      case "shopping":     return <CombinedNutritionTab key="nutrition-history" defaultSub="history" />;
      case "training":     return <CombinedTrainingTab key="training" defaultSub="program" />;
      case "workout-log":  return <CombinedTrainingTab key="workout-log" defaultSub="log" />;
      default:             return <OverviewTab key="overview" />;
    }
  };

  return (
    <ViewAsContext.Provider value={viewAsState}>
      <DashboardShell mode="client">
        {viewAsUserId && resolvedName && (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Eye size={15} className="shrink-0" />
              <span>Viewing as <strong>{resolvedName}</strong> — read-only mode</span>
            </div>
            <button
              onClick={() => navigate("/dashboard/overview")}
              className="flex items-center gap-1.5 text-xs hover:text-amber-200 transition-colors"
            >
              <X size={13} /> Exit
            </button>
          </div>
        )}
        {renderTab()}
      </DashboardShell>
    </ViewAsContext.Provider>
  );
}
