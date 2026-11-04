import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Diff, load, save, loadSlot, saveSlot, recordResult } from "./storage";
import { newSeed } from "./rng";
import { tick } from "./haptics";
import { useGameId, useGameShell } from "./shell";

export interface CommitOpts {
  /** Push the previous state onto the undo stack (default true). Pass
   *  false for the follow-on steps of one gesture, so a drag is one undo. */
  undoable?: boolean;
  /** Count this move as a hint: the win won't set a best time or streak. */
  hint?: boolean;
  /** This move ends the game: record the result in the stats once the
   *  board is saved, so the stats see its final time and hint count. */
  outcome?: "won" | "lost";
}

/** Shared per-game plumbing: seed + difficulty management, persisted state
 *  with an undo stack, an active-play-time counter (gaps over a minute
 *  don't count, so a paused game doesn't inflate the clock), a hint
 *  counter that marks the puzzle as assisted, and recording the result.
 *  The game's id comes from the surrounding `GameShell`.
 *
 *  Pass `stateV` when a game changes the shape of its saved state: boards
 *  saved under a different version are dropped and dealt fresh instead of
 *  being fed to code that no longer understands them. */
export function useGame<T>(fresh: (seed: string, diff: Diff) => T, stateV?: number) {
  const game = useGameId();
  const slot = useRef(loadSlot<T>(game, stateV)).current;
  const [diff, setDiff] = useState<Diff>(
    slot?.diff ?? load<Diff>(`pref:diff:${game}`, "medium")
  );
  const [seed, setSeed] = useState(slot?.seed ?? newSeed());
  const [saved, setSaved] = useState<T>(() => slot?.state ?? fresh(seed, diff));
  const [history, setHistory] = useState<T[]>([]);
  const [playMs, setPlayMs] = useState(slot?.playMs ?? 0);
  const [hints, setHints] = useState(slot?.hints ?? 0);
  const lastAction = useRef(Date.now());

  // Tell the shared header/toolbar how it's going. Play time is restored
  // from the slot, so a resumed board counts as progress too.
  const { publish } = useGameShell();
  const done = (saved as { done?: boolean }).done === true;
  useEffect(() => {
    publish({ dirty: playMs > 0 && !done, playMs });
  }, [publish, playMs, done]);

  function commit(next: T, opts?: CommitOpts) {
    tick();
    const now = Date.now();
    const ms = playMs + Math.min(now - lastAction.current, 60000);
    lastAction.current = now;
    setPlayMs(ms);
    const h = hints + (opts?.hint ? 1 : 0);
    if (opts?.hint) setHints(h);
    if (opts?.undoable !== false) setHistory((prev) => [...prev.slice(-19), saved]);
    setSaved(next);
    saveSlot(game, seed, next, diff, ms, h, stateV);
    if (opts?.outcome) recordResult(game, opts.outcome === "won");
  }

  /** Apply a hint: commits like a normal move but marks the puzzle as
   *  assisted, so the win won't count toward streaks or best times. */
  function commitHint(next: T) {
    commit(next, { hint: true });
  }

  // `finish` is stable so a "has the player solved it?" effect can list it
  // as a dependency; it reaches the latest render's state through a ref.
  const latest = useRef({ saved, commit });
  useLayoutEffect(() => {
    latest.current = { saved, commit };
  });

  /** End the game on the current board: mark it done (merging in `patch`,
   *  e.g. `{ won: true }`) and record the result. A no-op once done, so
   *  it is safe to call from an effect that re-runs. Meant for "solved?"
   *  effects: an event handler that has just built the finishing state
   *  should instead pass it straight to `commit(next, { outcome })`. */
  const finish = useCallback((won = true, patch?: Partial<T>) => {
    const { saved, commit } = latest.current;
    if ((saved as { done?: boolean }).done) return;
    commit({ ...saved, ...patch, done: true }, { undoable: false, outcome: won ? "won" : "lost" });
  }, []);

  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setSaved(prev);
    saveSlot(game, seed, prev, diff, playMs, hints, stateV);
  }

  /** Deal a fresh puzzle; pass a difficulty to change it at the same time. */
  function newPuzzle(nextDiff: Diff = diff) {
    const s = newSeed();
    const f = fresh(s, nextDiff);
    setSeed(s);
    setDiff(nextDiff);
    save(`pref:diff:${game}`, nextDiff);
    setSaved(f);
    setHistory([]);
    setPlayMs(0);
    setHints(0);
    lastAction.current = Date.now();
    saveSlot(game, s, f, nextDiff, 0, 0, stateV);
  }

  return {
    game,
    seed,
    diff,
    saved,
    commit,
    commitHint,
    finish,
    undo,
    canUndo: history.length > 0,
    newPuzzle,
    playMs,
    hints
  };
}
