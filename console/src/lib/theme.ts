import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "console.theme";

// Per-viewer convenience only: storage can be blocked, so reads and writes are guarded.
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(KEY, next);
      } catch {}
      return next;
    });
  }, []);
  return { theme, toggle };
}
