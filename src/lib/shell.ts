import { createContext, useContext } from "react";
import { GameId } from "./storage";

/** What the shared header and toolbar need to know about the running
 *  game. `useGame` publishes it, so no game component has to thread
 *  these through as props. */
export interface ShellInfo {
  game: GameId | null;
  /** The board holds progress worth a confirm before discarding it. */
  dirty: boolean;
}

export const EMPTY_SHELL: ShellInfo = { game: null, dirty: false };

export const ShellContext = createContext<{
  info: ShellInfo;
  publish: (info: ShellInfo) => void;
}>({ info: EMPTY_SHELL, publish: () => {} });

export function useGameShell() {
  return useContext(ShellContext);
}

/** Games whose own key handlers consume plain letters — a bare-letter
 *  shortcut would type into them instead. */
export const TEXT_GAMES = new Set<GameId>([
  "word",
  "hangman",
  "anagram",
  "crypto",
  "ladder",
  "mini",
  "equation"
]);
