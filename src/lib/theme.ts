/** The light/dark choice, kept in one place rather than in the hub, so the
 *  toggle can live inside a game too — a puzzle at midnight shouldn't need
 *  a trip back to the menu to get dimmed. The flag itself goes on <html>,
 *  which is what the stylesheet keys off, and `index.html` stamps it before
 *  first paint so a saved choice never flashes the wrong palette. */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { load, save } from "./storage";

export type Theme = "light" | "dark";

const KEY = "pref:theme";
const QUERY = "(prefers-color-scheme: dark)";

// Every live `useTheme` caller, so the hub header and the in-game button
// can never disagree about which theme is on.
const listeners = new Set<() => void>();

export const systemTheme = (): Theme =>
  window.matchMedia(QUERY).matches ? "dark" : "light";

/** The player's explicit choice, or null while the OS is still in charge. */
export function themePref(): Theme | null {
  const v = load<Theme | null>(KEY, null);
  return v === "light" || v === "dark" ? v : null;
}

export const currentTheme = (): Theme => themePref() ?? systemTheme();

// Light and dark paper, so the browser/status-bar chrome matches the page
// instead of staying on one hard-coded colour.
const THEME_COLOR: Record<Theme, string> = { light: "#eef1f4", dark: "#14181e" };

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute("data-theme", t);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[t]);
}

export function setTheme(t: Theme): void {
  save(KEY, t);
  applyTheme(t);
  listeners.forEach((f) => f());
}

/** The current theme plus a toggle. Until the player picks a side the
 *  theme follows the OS setting, live. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setLocal] = useState(currentTheme);

  useEffect(() => {
    const sync = () => setLocal(currentTheme());
    listeners.add(sync);
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", sync);
    return () => {
      listeners.delete(sync);
      mq.removeEventListener("change", sync);
    };
  }, []);

  useLayoutEffect(() => applyTheme(theme), [theme]);

  const toggle = useCallback(
    () => setTheme(currentTheme() === "dark" ? "light" : "dark"),
    []
  );
  return { theme, toggle };
}
