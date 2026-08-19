export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "eng4701-theme";

export const THEME_INITIALISATION_SCRIPT = `
(() => {
  try {
    const storedTheme = localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.dataset.appTheme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.appTheme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export function isThemeMode(value: string | undefined): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function getNextThemeMode(themeMode: ThemeMode): ThemeMode {
  return themeMode === "light" ? "dark" : "light";
}
