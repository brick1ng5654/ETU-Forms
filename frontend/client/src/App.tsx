import { Switch, Route, useRoute, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Builder from "@/pages/builder";
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import FormResults from "@/pages/form-results";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { accessToken, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !accessToken) {
      setLocation("/auth");
    }
  }, [accessToken, isLoading, setLocation]);

  if (isLoading) return null;
  if (!accessToken) return null;

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => (
          <RequireAuth>
            <Home />
          </RequireAuth>
        )}
      </Route>
      <Route path="/auth" component={Auth} />
      <Route path="/builder/:id">
        {(params) => (
          <RequireAuth>
            <Builder params={params} />
          </RequireAuth>
        )}
      </Route>
      <Route path="/forms/:id/results">
        {(params) => (
          <RequireAuth>
            <FormResults params={params} />
          </RequireAuth>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={0}>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
