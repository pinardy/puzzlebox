import { useEffect, useState } from "react";
import { GameId, Diff, loadStats } from "../lib/storage";

const DIFFS: Diff[] = ["easy", "medium", "hard"];
const DIFF_LABEL: Record<Diff, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** Slim toolbar under the game header: difficulty picker, rules help,
 *  and undo. Every prop is optional so games opt into what fits. */
export function GameTools({
  diff,
  onDiff,
  help,
  onUndo,
  canUndo
}: {
  diff?: Diff;
  onDiff?: (d: Diff) => void;
  help?: string;
  onUndo?: () => void;
  canUndo?: boolean;
}) {
  const [showHelp, setShowHelp] = useState(false);
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

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** End-of-game banner: result message, time and lifetime stats, and the
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

  useEffect(() => {
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
        <p className="result-stats">
          {playMs !== undefined && playMs > 0 && <>{fmtTime(playMs)} · </>}
          {stats.won} of {stats.played} solved all-time
        </p>
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
