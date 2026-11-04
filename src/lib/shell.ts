import { createContext, useContext } from "react";
import type { GameId } from "./storage";

/** What the shared header and toolbar need to know about the running
 *  game. `game` comes from the shell itself (App knows which game it
 *  mounted); `useGame` publishes the rest, so no game component has to
 *  thread any of it through as props. */
export interface ShellInfo {
  game: GameId | null;
  /** The board holds progress worth a confirm before discarding it. */
  dirty: boolean;
  /** Active play time banked so far, for the optional on-board clock. */
  playMs: number;
}

export type Progress = Omit<ShellInfo, "game">;

export const ShellContext = createContext<{
  info: ShellInfo;
  publish: (progress: Progress) => void;
}>({ info: { game: null, dirty: false, playMs: 0 }, publish: () => {} });

export function useGameShell() {
  return useContext(ShellContext);
}

/** The running game's id. Every game renders inside `GameShell`, which is
 *  what makes this safe to rely on. */
export function useGameId(): GameId {
  const { game } = useContext(ShellContext).info;
  if (!game) throw new Error("useGameId() called outside a GameShell");
  return game;
}
