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
      className="inline-flex h-10 w-36 items-center justify-between rounded-md border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-1 text-sm font-semibold text-[var(--workspace-text-muted)] transition-colors hover:border-[var(--workspace-accent)] focus:ring-2 focus:ring-[var(--workspace-focus)] focus:ring-offset-2 focus:ring-offset-[var(--workspace-page-bg)] focus:outline-none"
      onClick={onToggle}
    >
      <span
        className={
          isDark
            ? "rounded px-3 py-1 text-[var(--workspace-text-muted)]"
            : "rounded bg-[var(--workspace-accent-soft)] px-3 py-1 text-[var(--workspace-accent)]"
        }
      >
        {themeToggleContent.lightLabel}
      </span>
      <span
        className={
          isDark
            ? "rounded bg-[var(--workspace-accent-soft)] px-3 py-1 text-[var(--workspace-accent)]"
            : "rounded px-3 py-1 text-[var(--workspace-text-muted)]"
        }
      >
        {themeToggleContent.darkLabel}
      </span>
    </button>
  );
}
