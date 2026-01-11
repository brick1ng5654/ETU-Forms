import { Switch, Route, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Builder from "@/pages/builder";
import Home from "@/pages/home";
import PublicationPage from "@/pages/publication";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/builder/:id">
        {(params) => <Builder params={params} />}
      </Route>
      <Route path="/publication" component={PublicationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
