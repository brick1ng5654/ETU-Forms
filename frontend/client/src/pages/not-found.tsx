import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 px-4">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-8xl font-bold leading-none tracking-[0.15em] pl-[0.15em]">404</h1>
        <p className="mt-3 text-2xl text-foreground">Страница не найдена</p>
        <div className="mt-8">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              На главную
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
