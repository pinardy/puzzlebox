import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateKakuro } from "../lib/kakuro";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 8 };
const HELP =
  "Like a crossword with digits: each run of white cells adds up to its " +
  "clue — across clues sit top-right of a black cell, down clues " +
  "bottom-left — and a digit never repeats within a run. Digits are 1–9.";

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Kakuro({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("kakuro", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const G = SIZE[diff];
  const puzzle = useMemo(() => generateKakuro(`kakuro-${seed}`, G), [seed, G]);
  const [selected, setSelected] = useState<number | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const run of puzzle.runs) {
      const vals = run.cells.map((i) => board[i]);
      for (let a = 0; a < vals.length; a++)
        for (let b = a + 1; b < vals.length; b++)
          if (vals[a] !== 0 && vals[a] === vals[b]) {
            bad.add(run.cells[a]);
            bad.add(run.cells[b]);
          }
      if (vals.every((v) => v !== 0) && vals.reduce((x, y) => x + y, 0) !== run.sum)
        run.cells.forEach((i) => bad.add(i));
    }
    return bad;
  }, [board, puzzle]);

  useEffect(() => {
    const complete = puzzle.runs.every((run) =>
      run.cells.every((i) => board[i] !== 0)
    );
    if (!saved.done && complete && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("kakuro", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, puzzle, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || puzzle.black[idx]) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({
    cols: G,
    rows: G,
    max: 9,
    selected,
    setSelected,
    setCell,
    isCell: (i) => !puzzle.black[i]
  });

  return (
    <div className="game game-kakuro">
      <GameHeader title="Kakuro" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Runs of digits 1–9, no repeats, adding to the clue — across top-right,
        down bottom-left.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="kakuro-grid"
        style={{ "--n": G } as CSSProperties}
        role="grid"
        aria-label="Kakuro board"
      >
        {Array.from({ length: G * G }).map((_, i) => {
          if (puzzle.black[i]) {
            const a = puzzle.across.get(i);
            const d = puzzle.down.get(i);
            return (
              <span key={i} className={`kk-black${a !== undefined || d !== undefined ? " clued" : ""}`}>
                {a !== undefined && <i className="kk-across">{a}</i>}
                {d !== undefined && <i className="kk-down">{d}</i>}
              </span>
            );
          }
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kk-cell",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {board[i] || ""}
            </button>
          );
        })}
      </div>

      <div className="numpad numpad-9">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((dgt) => (
          <button
            key={dgt}
            className="num-key"
            onClick={() => selected !== null && setCell(selected, dgt)}
          >
            {dgt}
          </button>
        ))}
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="kakuro"
          won
          message="All sums add up!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
