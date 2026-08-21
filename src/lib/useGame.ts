import { useRef, useState } from "react";
import { GameId, Diff, load, save, loadSlot, saveSlot } from "./storage";
import { newSeed } from "./rng";

/** Shared per-game plumbing: seed + difficulty management, persisted state
 *  with an undo stack, and an active-play-time counter (gaps over a minute
 *  don't count, so a paused game doesn't inflate the clock). */
export function useGame<T>(game: GameId, fresh: (seed: string, diff: Diff) => T) {
  const slot = useRef(loadSlot<T>(game)).current;
  const [diff, setDiff] = useState<Diff>(
    slot?.diff ?? load<Diff>(`pref:diff:${game}`, "medium")
  );
  const [seed, setSeed] = useState(slot?.seed ?? newSeed());
  const [saved, setSaved] = useState<T>(() => slot?.state ?? fresh(seed, diff));
  const [history, setHistory] = useState<T[]>([]);
  const [playMs, setPlayMs] = useState(slot?.playMs ?? 0);
  const lastAction = useRef(Date.now());

  function commit(next: T, opts?: { undoable?: boolean }) {
    const now = Date.now();
    const ms = playMs + Math.min(now - lastAction.current, 60000);
    lastAction.current = now;
    setPlayMs(ms);
    if (opts?.undoable !== false) setHistory((h) => [...h.slice(-19), saved]);
    setSaved(next);
    saveSlot(game, seed, next, diff, ms);
  }

  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setSaved(prev);
    saveSlot(game, seed, prev, diff, playMs);
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
    lastAction.current = Date.now();
    saveSlot(game, s, f, nextDiff, 0);
  }

  return {
    seed,
    diff,
    saved,
    commit,
    undo,
    canUndo: history.length > 0,
    newPuzzle,
    playMs
  };
}
