import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ShellContext, type Progress } from "../lib/shell";
import type { GameId } from "../lib/storage";

/** Wraps the running game so the shared header, toolbar, and `useGame`
 *  know which game it is and whether it has progress. Mounted per game,
 *  so the state resets cleanly on the way back to the hub. */
export function GameShell({ game, children }: { game: GameId; children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>({ dirty: false, playMs: 0 });
  const publish = useCallback((next: Progress) => {
    // Games publish on every commit; only a real change re-renders.
    setProgress((prev) =>
      prev.dirty === next.dirty && prev.playMs === next.playMs ? prev : next
    );
  }, []);
  const value = useMemo(
    () => ({ info: { game, ...progress }, publish }),
    [game, progress, publish]
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
