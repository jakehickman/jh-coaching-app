/**
 * ClientHub — /coach/client/:id
 *
 * A single-client workspace with four top-level tabs:
 *   Dashboard        — overview, body comp, progression, nutrition logs
 *   Training Program — full training program editor (no client selector)
 *   Nutrition        — full meal plan editor (no client selector)
 *   Check-ins        — check-in history and detail panel
 *
 * All tabs are pre-filtered to the client in the URL — the coach never needs
 * to re-select the client when switching tabs.
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import ProgressSection from "./ProgressSection";
import TrainingSection from "./TrainingSection";
import MealPlansSection from "./MealPlansSection";
import { ClientCheckInsTab } from "./ClientCheckInsTab";

export default function ClientHub() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

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

      {/* Four top-level tabs — all scoped to this client */}
      {clientId > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="training">Training Program</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="check-ins">Check-ins</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ProgressSection fixedClientId={clientId} />
          </TabsContent>

          <TabsContent value="training">
            <TrainingSection fixedClientId={clientId} />
          </TabsContent>

          <TabsContent value="nutrition">
            <MealPlansSection fixedClientId={clientId} />
          </TabsContent>

          <TabsContent value="check-ins">
            <ClientCheckInsTab clientId={clientId} />
          </TabsContent>
        </Tabs>
      )}
    </DashboardShell>
  );
}
