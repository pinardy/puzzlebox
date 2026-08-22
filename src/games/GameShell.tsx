import { useCallback, useMemo, useState, type ReactNode } from "react";
import { EMPTY_SHELL, ShellContext, type ShellInfo } from "../lib/shell";

/** Wraps the running game so the shared header and toolbar can see which
 *  game it is and whether it has progress. Mounted per game, so the
 *  state resets cleanly on the way back to the hub. */
export function GameShell({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ShellInfo>(EMPTY_SHELL);
  const publish = useCallback((next: ShellInfo) => {
    // Games publish on every commit; only a real change re-renders.
    setInfo((prev) =>
      prev.game === next.game && prev.dirty === next.dirty ? prev : next
    );
  }, []);
  const value = useMemo(() => ({ info, publish }), [info, publish]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
