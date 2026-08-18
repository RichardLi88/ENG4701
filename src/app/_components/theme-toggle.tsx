import { type ThemeMode } from "../_helpers/theme";
import { themeToggleContent } from "./theme-content";

type ThemeToggleProps = {
  themeMode: ThemeMode;
  onToggle: () => void;
};

export function ThemeToggle({ themeMode, onToggle }: ThemeToggleProps) {
  const isDark = themeMode === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={themeToggleContent.ariaLabel}
      className="inline-flex h-10 w-36 items-center justify-between rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-1 text-sm font-semibold text-[var(--app-text-muted)] transition focus:ring-2 focus:ring-[var(--app-focus)] focus:ring-offset-2 focus:ring-offset-[var(--app-page-bg)] focus:outline-none"
      onClick={onToggle}
    >
      <span
        className={
          isDark
            ? "rounded px-3 py-1 text-[var(--app-text-muted)]"
            : "rounded bg-[var(--app-accent)] px-3 py-1 text-[var(--app-accent-text)]"
        }
      >
        {themeToggleContent.lightLabel}
      </span>
      <span
        className={
          isDark
            ? "rounded bg-[var(--app-accent)] px-3 py-1 text-[var(--app-accent-text)]"
            : "rounded px-3 py-1 text-[var(--app-text-muted)]"
        }
      >
        {themeToggleContent.darkLabel}
      </span>
    </button>
  );
}
