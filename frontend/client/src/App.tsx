import { Switch, Route, useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Builder from "@/pages/builder";
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import FormPass from "@/pages/form-pass";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import FormResults from "@/pages/form-results";
import { CustomLoader } from "@/components/ui/custom-loader";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { accessToken, isLoading } = useAuth();
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!isLoading && !accessToken) {
      setLocation("/auth");
    }
  }, [accessToken, isLoading, setLocation]);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowLoader(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowLoader(false);
    }
  }, [isLoading]);

  if (isLoading) {
    return showLoader ? (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <CustomLoader variant="logo-with-dots" size="lg" />
      </div>
    ) : null;
  }
  
  if (!accessToken) return null;

  return <>{children}</>;
}

function RequireFormEditor({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { user, accessToken, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !accessToken) return;
    const canEditForms = user?.role === "form_creator" || user?.role === "admin";
    if (!canEditForms) {
      setLocation("/");
    }
  }, [user, accessToken, isLoading, setLocation]);

  if (isLoading) return null;
  if (!accessToken) return null;

  const canEditForms = user?.role === "form_creator" || user?.role === "admin";
  if (!canEditForms) return null;

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
      <Route path="/form/:id">
        {(params) => <FormPass params={params} />}
      </Route>
      <Route path="/builder/:id">
        {(params) => (
          <RequireAuth>
            <RequireFormEditor>
              <Builder params={params} />
            </RequireFormEditor>
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
