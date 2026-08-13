export type ThemeMode = "light" | "dark";

export function getNextThemeMode(themeMode: ThemeMode): ThemeMode {
  return themeMode === "light" ? "dark" : "light";
}
