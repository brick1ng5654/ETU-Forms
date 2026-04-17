import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getActiveTheme, toggleTheme, type ThemeMode } from "@/lib/theme";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getActiveTheme());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      setThemeState(getActiveTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={["h-9 w-9 p-0", className].filter(Boolean).join(" ")}
      onClick={() => setThemeState(toggleTheme())}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

