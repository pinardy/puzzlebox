import { useEffect, useMemo, useState } from "react";
import { newSeed } from "../lib/rng";
import { generateSudoku, isSolved, peersConflict, Grid } from "../lib/sudoku";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

interface SavedState {
  entries: Grid; // player-entered values only (0 where empty / given)
  notes: number[][]; // pencil marks per cell
  done: boolean;
}

const REMOVALS = 47; // medium difficulty

function fresh(): SavedState {
  return {
    entries: Array(81).fill(0),
    notes: Array.from({ length: 81 }, () => []),
    done: false
  };
}

export default function Sudoku({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("sudoku")?.seed ?? newSeed()
  );
  const { puzzle, solution } = useMemo(
    () => generateSudoku(`sudoku-${seed}`, REMOVALS),
    [seed]
  );
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("sudoku")?.state ?? fresh()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const board: Grid = useMemo(
    () => puzzle.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [puzzle, saved.entries]
  );

  useEffect(() => {
    if (!saved.done && board.every((v) => v !== 0) && isSolved(board, solution)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("sudoku", seed, next);
      recordResult("sudoku", true);
      setToast("Solved!");
    }
  }, [board, solution, saved, seed]);

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
    }
    setSaved(next);
    saveSlot("sudoku", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("sudoku", s, fresh());
    setSelected(null);
    setToast(null);
  }

  const selVal = selected !== null ? board[selected] : 0;

  return (
    <div className="game game-sudoku">
      <GameHeader title="Sudoku" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Tap a cell, then a number. Use ✏️ for pencil notes.
      </p>

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

      {toast && <div className="toast">{toast}</div>}

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
    </div>
  );
}
