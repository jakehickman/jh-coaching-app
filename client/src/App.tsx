import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ClientDashboard from "./pages/ClientDashboard";
import CoachPanel from "./pages/CoachPanel";
import CoachingLanding from "./pages/CoachingLanding";
import Onboarding from "./pages/Onboarding";

// Public routes — accessible at root level (e.g. /onboarding, /coaching)
function PublicRoutes() {
  return (
    <Router base="/">
      <Switch>
        <Route path="/coaching" component={CoachingLanding} />
        <Route path="/onboarding" component={Onboarding} />
      </Switch>
    </Router>
  );
}

// Authenticated app routes — all under /app
function AppRoutes() {
  return (
    <Router base="/app">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={ClientDashboard} />
        <Route path="/dashboard/:tab" component={ClientDashboard} />
        <Route path="/coach" component={CoachPanel} />
        <Route path="/coach/:section" component={CoachPanel} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <PublicRoutes />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
