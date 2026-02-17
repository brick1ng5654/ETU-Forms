import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-xl border-border/60 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">404</CardTitle>
            <CardDescription className="text-base">
              <p className="text-foreground">Страница не найдена</p>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8 text-center">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              На главную
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
