import { useEffect, useState } from "react";
import { GameId, Diff, loadStats, loadSlot, load, save } from "../lib/storage";
import { TEXT_GAMES, useGameShell } from "../lib/shell";
import { playWin, playLose, playHint } from "../lib/sound";

const DIFFS: Diff[] = ["easy", "medium", "hard"];
const DIFF_LABEL: Record<Diff, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** Slim toolbar under the game header: difficulty picker, rules help,
 *  hint, and undo. Every prop is optional so games opt into what fits. */
export function GameTools({
  diff,
  onDiff,
  help,
  onUndo,
  canUndo,
  onHint
}: {
  diff?: Diff;
  onDiff?: (d: Diff) => void;
  help?: string;
  onUndo?: () => void;
  canUndo?: boolean;
  onHint?: () => void;
}) {
  const { info } = useGameShell();
  const [showHelp, setShowHelp] = useState(false);

  // Sixty-six games is a lot of unfamiliar boards: open the rules the
  // first time someone lands on each one, then never again.
  const seenKey = info.game ? `pref:seenrules:${info.game}` : null;
  useEffect(() => {
    if (!help || !seenKey || load(seenKey, false)) return;
    setShowHelp(true);
    save(seenKey, true);
  }, [help, seenKey]);

  useEffect(() => {
    if (!onUndo) return;
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canUndo) onUndo();
        return;
      }
      if (mod || e.altKey) return;
      // Word games read bare letters as guesses.
      if (info.game && TEXT_GAMES.has(info.game)) return;
      if (e.key === "u") {
        e.preventDefault();
        if (canUndo) onUndo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onUndo, canUndo, info.game]);

  return (
    <>
      <div className="game-tools">
        {diff && onDiff && (
          <div className="diff-picker" role="radiogroup" aria-label="Difficulty">
            {DIFFS.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={diff === d}
                className={diff === d ? "active" : ""}
                onClick={() => diff !== d && onDiff(d)}
              >
                {DIFF_LABEL[d]}
              </button>
            ))}
          </div>
        )}
        <span className="tools-gap" />
        {help && (
          <button
            className="tool-chip"
            onClick={() => setShowHelp((s) => !s)}
            aria-expanded={showHelp}
          >
            ? Rules
          </button>
        )}
        {onHint && (
          <button
            className="tool-chip"
            onClick={() => {
              playHint();
              onHint();
            }}
          >
            💡 Hint
          </button>
        )}
        {onUndo && (
          <button className="tool-chip" onClick={onUndo} disabled={!canUndo}>
            ↩ Undo
          </button>
        )}
      </div>
      {help && showHelp && <p className="game-help">{help}</p>}
    </>
  );
}

/** Transient message above the keyboard ("Not in word list"). The live
 *  region stays mounted so screen readers announce each new message. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div className="toast-live" role="status" aria-live="polite">
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** End-of-game banner: result message, time, best time, streak, and the
 *  two actions that matter. Dismissable to inspect the final board. */
export function Result({
  game,
  won,
  message,
  playMs,
  onNew,
  onExit
}: {
  game: GameId;
  won: boolean;
  message: string;
  playMs?: number;
  onNew: () => void;
  onExit: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const stats = loadStats(game);
  // The finishing commit saved the slot before this rendered, so it holds
  // this puzzle's final difficulty, play time, and hint count.
  const slot = loadSlot<unknown>(game);
  const diff = slot?.diff;
  const hinted = (slot?.hints ?? 0) > 0;
  const best = diff ? stats.best?.[diff] : undefined;
  const newBest =
    won && !hinted && playMs !== undefined && playMs > 0 && best === playMs;
  const streak = stats.streak ?? 0;

  useEffect(() => {
    if (won) playWin();
    else playLose();
    try {
      navigator.vibrate?.(won ? [30, 40, 80] : 90);
    } catch {
      /* no haptics available */
    }
  }, [won]);

  if (hidden) return null;
  return (
    <div className="result-backdrop" onClick={() => setHidden(true)}>
      <div
        className={`result ${won ? "won" : "lost"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="result-close"
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
        <span className="result-emoji" aria-hidden="true">
          {won ? "🎉" : "💥"}
        </span>
        <h3>{message}</h3>
        {newBest && <p className="result-best">★ New best time!</p>}
        <p className="result-stats">
          {playMs !== undefined && playMs > 0 && <>{fmtTime(playMs)} · </>}
          {best !== undefined && !newBest && <>best {fmtTime(best)} · </>}
          {stats.won} of {stats.played} solved all-time
        </p>
        {(streak > 1 || (stats.longestStreak ?? 0) > 1) && (
          <p className="result-streak">
            {streak > 1 ? <>🔥 {streak} win streak</> : <>Streak over</>}
            {(stats.longestStreak ?? 0) > streak && (
              <> · longest {stats.longestStreak}</>
            )}
          </p>
        )}
        {won && hinted && <p className="result-hinted">💡 Solved with hints</p>}
        <div className="result-actions">
          <button className="result-primary" onClick={onNew}>
            New puzzle
          </button>
          <button onClick={onExit}>All games</button>
        </div>
      </div>
    </div>
  );
}
