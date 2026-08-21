import { useEffect, useMemo, useState } from "react";
import { generateSudoku, isSolved, peersConflict, Grid } from "../lib/sudoku";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const REMOVALS: Record<Diff, number> = { easy: 42, medium: 47, hard: 53 };
const HELP =
  "Fill every row, column, and 3×3 box with the digits 1–9, no repeats. " +
  "Pencil notes (✏️) mark candidates; placing a digit clears that note from " +
  "the row, column, and box around it.";

interface SavedState {
  entries: Grid; // player-entered values only (0 where empty / given)
  notes: number[][]; // pencil marks per cell
  done: boolean;
}

function fresh(): SavedState {
  return {
    entries: Array(81).fill(0),
    notes: Array.from({ length: 81 }, () => []),
    done: false
  };
}

function peers(idx: number): number[] {
  const r = Math.floor(idx / 9), c = idx % 9;
  const out = new Set<number>();
  for (let k = 0; k < 9; k++) {
    out.add(r * 9 + k);
    out.add(k * 9 + c);
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++) out.add((br + dr) * 9 + (bc + dc));
  out.delete(idx);
  return [...out];
}

export default function Sudoku({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("sudoku", fresh);
  const { puzzle, solution } = useMemo(
    () => generateSudoku(`sudoku-${seed}`, REMOVALS[diff]),
    [seed, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);

  const board: Grid = useMemo(
    () => puzzle.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [puzzle, saved.entries]
  );

  useEffect(() => {
    if (!saved.done && board.every((v) => v !== 0) && isSolved(board, solution)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("sudoku", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, solution, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || puzzle[idx] !== 0) return;
    const next: SavedState = {
      ...saved,
      entries: saved.entries.slice(),
      notes: saved.notes.map((n) => n.slice())
    };
    if (pencil && val !== 0) {
      const n = next.notes[idx];
      next.notes[idx] = n.includes(val) ? n.filter((x) => x !== val) : [...n, val].sort();
    } else {
      next.entries[idx] = next.entries[idx] === val ? 0 : val;
      next.notes[idx] = [];
      // Placing a digit clears it from the pencil notes of its peers.
      if (val !== 0 && next.entries[idx] === val)
        for (const p of peers(idx))
          next.notes[p] = next.notes[p].filter((x) => x !== val);
    }
    commit(next);
  }

  /** Reveal the solution's digit in the selected cell if it's open or
   *  wrong, otherwise in a random such cell. Marks the puzzle assisted. */
  function hint() {
    const open = (i: number) => puzzle[i] === 0 && board[i] !== solution[i];
    const cands = [...Array(81).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const next: SavedState = {
      ...saved,
      entries: saved.entries.slice(),
      notes: saved.notes.map((n) => n.slice())
    };
    next.entries[idx] = solution[idx];
    next.notes[idx] = [];
    for (const p of peers(idx))
      next.notes[p] = next.notes[p].filter((x) => x !== solution[idx]);
    commitHint(next);
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({
    cols: 9,
    rows: 9,
    max: 9,
    selected,
    setSelected,
    setCell
  });

  const selVal = selected !== null ? board[selected] : 0;

  return (
    <div className="game game-sudoku">
      <GameHeader title="Sudoku" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap a cell, then a number — or type. Use ✏️ for pencil notes.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="sudoku-grid" role="grid" aria-label="Sudoku board">
        {board.map((v, i) => {
          const given = puzzle[i] !== 0;
          const conflict = v !== 0 && !given && peersConflict(board, i, v);
          const r = Math.floor(i / 9);
          const c = i % 9;
          const sameVal = selVal !== 0 && v === selVal;
          const inLine =
            selected !== null &&
            (Math.floor(selected / 9) === r || selected % 9 === c);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "sudoku-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                sameVal ? "same" : "",
                inLine ? "inline" : "",
                conflict ? "conflict" : "",
                c % 3 === 2 && c !== 8 ? "br" : "",
                r % 3 === 2 && r !== 8 ? "bb" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {v !== 0 ? (
                v
              ) : saved.notes[i].length ? (
                <span className="notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <i key={d}>{saved.notes[i].includes(d) ? d : ""}</i>
                  ))}
                </span>
              ) : (
                ""
              )}
            </button>
          );
        })}
      </div>

      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
          const remaining = 9 - board.filter((v) => v === d).length;
          return (
            <button
              key={d}
              className="num-key"
              disabled={remaining <= 0 && !pencil}
              onClick={() => selected !== null && setCell(selected, d)}
            >
              {d}
              <small>{remaining > 0 ? remaining : ""}</small>
            </button>
          );
        })}
        <button
          className={`num-key tool${pencil ? " active" : ""}`}
          onClick={() => setPencil((p) => !p)}
          aria-pressed={pencil}
        >
          ✏️<small>notes</small>
        </button>
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫<small>erase</small>
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="sudoku"
          won
          message="Solved!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
