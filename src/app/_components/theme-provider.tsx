"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  getNextThemeMode,
  isThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../_helpers/theme";
import { ThemeToggle } from "./theme-toggle";

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const rootTheme = document.documentElement.dataset.appTheme;
    setThemeMode(isThemeMode(rootTheme) ? rootTheme : "light");
  }, []);

  function toggleTheme() {
    setThemeMode((currentTheme) => {
      const nextTheme = getNextThemeMode(currentTheme);

      document.documentElement.dataset.appTheme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

      return nextTheme;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] text-[var(--app-text-primary)] transition-colors">
      <nav
        data-workspace-theme
        className="sticky top-0 z-10 border-b border-[var(--workspace-border-muted)] bg-[var(--workspace-page-bg)]/95 px-6 py-3 backdrop-blur transition-colors"
      >
        <div className="mx-auto flex w-full max-w-6xl justify-end">
          <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} />
        </div>
      </nav>

      {children}
    </div>
  );
}
