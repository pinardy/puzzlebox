import { useEffect, useMemo, type CSSProperties } from "react";
import { generateTango, tangoInvalid, T } from "../lib/tango";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const REMOVALS: Record<Diff, number> = { easy: 22, medium: 26, hard: 30 };
const HELP =
  "Fill the board with suns and moons: three of each in every row and " +
  "column, and never three of the same symbol in a row, across or down. " +
  "Given cells are fixed.";

interface SavedState {
  entries: number[]; // player cells: 0 empty, 1 sun, 2 moon
  done: boolean;
}

export default function Tango({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("tango", () => ({
      entries: Array(T * T).fill(0),
      done: false
    }));
  const { givens, solution } = useMemo(
    () => generateTango(`tango-${seed}`, REMOVALS[diff]),
    [seed, diff]
  );

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  /** Filled cells that currently break a rule. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < T * T; i++) {
      if (board[i] === 0) continue;
      const rest = board.slice();
      rest[i] = 0;
      if (tangoInvalid(rest, i, board[i])) bad.add(i);
    }
    return bad;
  }, [board]);

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      board.every((v, i) => v === solution[i])
    ) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("tango", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, solution, saved]);

  function tap(idx: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = (entries[idx] + 1) % 3; // empty → sun → moon → empty
    commit({ ...saved, entries });
  }

  return (
    <div className="game game-tango">
      <GameHeader title="Suns & Moons" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Three of each per row and column, never three in a row. Tap to cycle
        ☀ → ☾ → empty.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="tango-grid"
        style={{ "--n": T } as CSSProperties}
        role="grid"
        aria-label="Suns and moons board"
      >
        {board.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "tango-cell",
              givens[i] !== 0 ? "given" : "",
              v === 1 ? "sun" : v === 2 ? "moon" : "",
              conflicts.has(i) ? "conflict" : ""
            ].join(" ")}
            onClick={() => tap(i)}
          >
            {v === 1 ? "☀" : v === 2 ? "☾" : ""}
          </button>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="tango"
          won
          message="Perfectly balanced!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
