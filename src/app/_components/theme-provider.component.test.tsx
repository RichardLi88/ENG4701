import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { THEME_STORAGE_KEY } from "../_helpers/theme";
import { ThemeProvider } from "./theme-provider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage);
    localStorage.clear();
    document.documentElement.dataset.appTheme = "light";
    document.documentElement.style.colorScheme = "light";
  });

  test("toggles the root theme and persists the selected mode", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <p>Theme content</p>
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("switch", {
      name: "Toggle color theme",
    });

    expect(document.querySelector("nav")).toHaveAttribute(
      "data-workspace-theme",
    );
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-app-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  test("hydrates the toggle from the theme selected before React loads", () => {
    document.documentElement.dataset.appTheme = "dark";

    render(
      <ThemeProvider>
        <p>Theme content</p>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("switch", { name: "Toggle color theme" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
