"use client";

import { useState, type ReactNode } from "react";

import { getNextThemeMode, type ThemeMode } from "../_helpers/theme";
import { ThemeToggle } from "./theme-toggle";

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  return (
    <div
      data-app-theme={themeMode}
      className="min-h-screen bg-[var(--app-page-bg)] text-[var(--app-text-primary)] transition-colors"
    >
      <nav className="sticky top-0 z-10 border-b border-[var(--app-border-subtle)] bg-[var(--app-page-bg)]/95 px-6 py-3 backdrop-blur transition-colors">
        <div className="mx-auto flex w-full max-w-6xl justify-end">
          <ThemeToggle
            themeMode={themeMode}
            onToggle={() => setThemeMode(getNextThemeMode(themeMode))}
          />
        </div>
      </nav>

      {children}
    </div>
  );
}
