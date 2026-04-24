export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

export const getStoredTheme = (): ThemeMode | null => {
  if (!isBrowser()) return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark") return value;
  return null;
};

export const getActiveTheme = (): ThemeMode => {
  if (!isBrowser()) return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

export const setTheme = (mode: ThemeMode) => {
  if (!isBrowser()) return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  window.localStorage.setItem(STORAGE_KEY, mode);
};

export const toggleTheme = (): ThemeMode => {
  const next: ThemeMode = getActiveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
};

export const initTheme = () => {
  if (!isBrowser()) return;
  const stored = getStoredTheme();
  if (stored) {
    document.documentElement.classList.toggle("dark", stored === "dark");
    return;
  }

  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.documentElement.classList.toggle("dark", prefersDark);
};

