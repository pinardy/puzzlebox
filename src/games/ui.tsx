import { useEffect, useRef, useState } from "react";
import { GameId, Diff, loadStats, loadSlot, load, save } from "../lib/storage";
import { TEXT_GAMES, useGameShell } from "../lib/shell";
import { playWin, playLose, playHint } from "../lib/sound";
import { fmtTime } from "../lib/format";
import { TIPS } from "../lib/tips";

const DIFFS: Diff[] = ["easy", "medium", "hard"];
const DIFF_LABEL: Record<Diff, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** Ticks on its own so a running clock re-renders four digits rather than
 *  the whole board. It counts the same active time a move would bank, so
 *  it agrees with the time on the win banner: a pause over a minute long
 *  stops counting. */
function Clock({ playMs }: { playMs: number }) {
  const [, bump] = useState(0);
  const since = useRef(Date.now());
  useEffect(() => {
    since.current = Date.now();
  }, [playMs]);
  useEffect(() => {
    const id = window.setInterval(() => bump((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="game-clock" aria-hidden="true">
      {fmtTime(playMs + Math.min(Date.now() - since.current, 60000))}
    </span>
  );
}

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
  const [showTip, setShowTip] = useState(false);
  // Read once on mount: you change this on the preferences screen, so it
  // can't move underneath a board that's already open.
  const [showClock] = useState(() => load("pref:timer", false));

  // Ninety-seven games is a lot of unfamiliar boards: open the rules the
  // first time someone lands on each one, then never again.
  const seenKey = info.game ? `pref:seenrules:${info.game}` : null;
  useEffect(() => {
    if (!help || !seenKey || load(seenKey, false)) return;
    setShowHelp(true);
    save(seenKey, true);
  }, [help, seenKey]);

  // Same idea for a board's unadvertised gesture — a hold-to-flag nobody
  // finds may as well not exist.
  const tip = info.game ? TIPS[info.game] : undefined;
  const tipKey = info.game ? `pref:seentip:${info.game}` : null;
  useEffect(() => {
    if (!tip || !tipKey || load(tipKey, false)) return;
    setShowTip(true);
    save(tipKey, true);
  }, [tip, tipKey]);

  // Escape closes the rules rather than leaving the game. Capture beats the
  // header's own window listener, whichever mounted first.
  useEffect(() => {
    if (!showHelp) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setShowHelp(false);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [showHelp]);

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
        {showClock && <Clock playMs={info.playMs} />}
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

      {showTip && tip && (
        <p className="game-tip">
          <span aria-hidden="true">💡</span> {tip}
          <button
            className="tip-x"
            onClick={() => setShowTip(false)}
            aria-label="Dismiss tip"
          >
            ×
          </button>
        </p>
      )}

      {/* Over the board, not above it — rules you read while looking at the
          thing they describe are worth far more than rules that push it
          off the screen. */}
      {help && showHelp && (
        <div className="help-backdrop" onClick={() => setShowHelp(false)}>
          <div
            className="help-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="How to play"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-head">
              <h3>How to play</h3>
              <button
                className="help-close"
                onClick={() => setShowHelp(false)}
                aria-label="Close rules"
              >
                ×
              </button>
            </div>
            <p className="game-help">{help}</p>
            <button className="help-got" onClick={() => setShowHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
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
