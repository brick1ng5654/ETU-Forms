import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { getActiveTheme, toggleTheme, type ThemeMode } from "@/lib/theme";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getActiveTheme());
  const { t } = useTranslation();

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      setThemeState(getActiveTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isDark = theme === "dark";
  const title = isDark ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={["h-9 w-9 p-0", className].filter(Boolean).join(" ")}
      onClick={() => setThemeState(toggleTheme())}
      title={title}
      aria-label={title}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
