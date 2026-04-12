import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";

import OverviewTab from "./client/OverviewTab";
import DailyLogTab from "./client/DailyLogTab";
import MeasurementsTab from "./client/MeasurementsTab";
import CombinedMealPlanTab from "./client/MealPlanTab";
import CombinedTrainingTab from "./client/TrainingTab";
import CheckInsTab from "./client/CheckInsTab";

export default function ClientDashboard() {
  const params = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();
  const tab = params.tab ?? "overview";

  useEffect(() => {
    if (!params.tab) navigate("/dashboard/overview");
  }, [params.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderTab = () => {
    switch (tab) {
      case "overview":     return <OverviewTab key="overview" />;
      case "daily-log":    return <DailyLogTab key="daily-log" />;
      case "check-ins":    return <CheckInsTab key="check-ins" />;
      case "measurements": return <MeasurementsTab key="measurements" />;
      case "meal-plan":    return <CombinedMealPlanTab key="meal-plan" defaultSub="plan" />;
      case "shopping":     return <CombinedMealPlanTab key="shopping" defaultSub="shopping" />;
      case "training":     return <CombinedTrainingTab key="training" defaultSub="program" />;
      case "workout-log":  return <CombinedTrainingTab key="workout-log" defaultSub="log" />;
      default:             return <OverviewTab key="overview" />;
    }
  };

  return (
    <DashboardShell mode="client">
      {renderTab()}
    </DashboardShell>
  );
}
