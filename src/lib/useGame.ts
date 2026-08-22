import { useRef, useState } from "react";
import { GameId, Diff, load, save, loadSlot, saveSlot } from "./storage";
import { newSeed } from "./rng";

/** Shared per-game plumbing: seed + difficulty management, persisted state
 *  with an undo stack, an active-play-time counter (gaps over a minute
 *  don't count, so a paused game doesn't inflate the clock), and a hint
 *  counter that marks the puzzle as assisted. */
export function useGame<T>(game: GameId, fresh: (seed: string, diff: Diff) => T) {
  const slot = useRef(loadSlot<T>(game)).current;
  const [diff, setDiff] = useState<Diff>(
    slot?.diff ?? load<Diff>(`pref:diff:${game}`, "medium")
  );
  const [seed, setSeed] = useState(slot?.seed ?? newSeed());
  const [saved, setSaved] = useState<T>(() => slot?.state ?? fresh(seed, diff));
  const [history, setHistory] = useState<T[]>([]);
  const [playMs, setPlayMs] = useState(slot?.playMs ?? 0);
  const [hints, setHints] = useState(slot?.hints ?? 0);
  const lastAction = useRef(Date.now());

  function commit(next: T, opts?: { undoable?: boolean; hint?: boolean }) {
    const now = Date.now();
    const ms = playMs + Math.min(now - lastAction.current, 60000);
    lastAction.current = now;
    setPlayMs(ms);
    const h = hints + (opts?.hint ? 1 : 0);
    if (opts?.hint) setHints(h);
    if (opts?.undoable !== false) setHistory((prev) => [...prev.slice(-19), saved]);
    setSaved(next);
    saveSlot(game, seed, next, diff, ms, h);
  }

  /** Apply a hint: commits like a normal move but marks the puzzle as
   *  assisted, so the win won't count toward streaks or best times. */
  function commitHint(next: T) {
    commit(next, { hint: true });
  }

  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setSaved(prev);
    saveSlot(game, seed, prev, diff, playMs, hints);
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
    saveSlot(game, s, f, nextDiff, 0, 0);
  }

  return {
    seed,
    diff,
    saved,
    commit,
    commitHint,
    undo,
    canUndo: history.length > 0,
    newPuzzle,
    playMs,
    hints
  };
}
