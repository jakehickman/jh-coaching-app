import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ClientDashboard from "./pages/ClientDashboard";
import CoachPanel from "./pages/CoachPanel";
import CoachingLanding from "./pages/CoachingLanding";
import Onboarding from "./pages/Onboarding";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router>
            <Switch>
              {/* Root redirect */}
              <Route path="/">
                <Redirect to="/app/" />
              </Route>

              {/* Public routes */}
              <Route path="/coaching" component={CoachingLanding} />
              <Route path="/onboarding" component={Onboarding} />

              {/* App routes under /app */}
              <Route path="/app/" component={Home} />
              <Route path="/app/dashboard" component={ClientDashboard} />
              <Route path="/app/dashboard/:tab" component={ClientDashboard} />
              <Route path="/app/coach" component={CoachPanel} />
              <Route path="/app/coach/:section" component={CoachPanel} />

              <Route component={NotFound} />
            </Switch>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
