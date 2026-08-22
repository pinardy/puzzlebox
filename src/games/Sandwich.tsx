import { useEffect, useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { generateSudoku, peersConflict, Grid } from "../lib/sudoku";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const GIVENS: Record<Diff, number> = { easy: 26, medium: 20, hard: 14 };
const HELP =
  "Ordinary sudoku rules, plus a sandwich clue outside each row and " +
  "column: it gives the sum of the digits lying between the 1 and the 9 " +
  "in that line. A 0 means the 1 and 9 are neighbours; 35 means they sit " +
  "at the two ends.";

interface Puzzle {
  rowSums: number[];
  colSums: number[];
  givens: Grid;
  solution: Grid;
}

/** Sum of the digits strictly between the 1 and the 9 of a line. */
function sandwich(line: number[]): number {
  const a = line.indexOf(1), b = line.indexOf(9);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let s = 0;
  for (let k = lo + 1; k < hi; k++) s += line[k];
  return s;
}

function generateSandwich(seed: string, givenCount: number): Puzzle {
  const { solution } = generateSudoku(`sandwich-${seed}`, 0);
  const rng = makeRng(`sandwich-clues-${seed}`);
  const row = (r: number) => Array.from({ length: 9 }, (_, c) => solution[r * 9 + c]);
  const col = (c: number) => Array.from({ length: 9 }, (_, r) => solution[r * 9 + c]);
  const givens = Array(81).fill(0);
  for (const i of shuffled([...Array(81).keys()], rng).slice(0, givenCount))
    givens[i] = solution[i];
  return {
    rowSums: Array.from({ length: 9 }, (_, r) => sandwich(row(r))),
    colSums: Array.from({ length: 9 }, (_, c) => sandwich(col(c))),
    givens,
    solution
  };
}

interface SavedState {
  entries: Grid;
  done: boolean;
}

export default function Sandwich({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("sandwich", () => ({
      entries: Array(81).fill(0),
      done: false
    }));
  const { rowSums, colSums, givens, solution } = useMemo(
    () => generateSandwich(`${seed}`, GIVENS[diff]),
    [seed, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board: Grid = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  /** A line's clue can only be judged once its 1 and 9 are both down. */
  const lineState = useMemo(() => {
    const judge = (line: number[], want: number): "ok" | "bad" | "open" => {
      const a = line.indexOf(1), b = line.indexOf(9);
      if (a === -1 || b === -1) return "open";
      const [lo, hi] = a < b ? [a, b] : [b, a];
      let sum = 0;
      for (let k = lo + 1; k < hi; k++) {
        if (line[k] === 0) return "open";
        sum += line[k];
      }
      return sum === want ? "ok" : "bad";
    };
    return {
      rows: rowSums.map((want, r) =>
        judge(Array.from({ length: 9 }, (_, c) => board[r * 9 + c]), want)
      ),
      cols: colSums.map((want, c) =>
        judge(Array.from({ length: 9 }, (_, r) => board[r * 9 + c]), want)
      )
    };
  }, [board, rowSums, colSums]);

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      board.every((v, i) => !peersConflict(board, i, v)) &&
      lineState.rows.every((s) => s === "ok") &&
      lineState.cols.every((s) => s === "ok")
    ) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("sandwich", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, lineState, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) => givens[i] === 0 && board[i] !== solution[i];
    const cands = [...Array(81).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    entries[idx] = solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: 9, rows: 9, max: 9, selected, setSelected, setCell });

  return (
    <div className="game game-sandwich">
      <GameHeader title="Sandwich" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Sudoku, plus: each clue sums the digits between that line's 1 and 9.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="sw-wrap">
        <span className="sw-corner" />
        <div className="sw-top">
          {colSums.map((s, c) => (
            <span key={c} className={`sw-clue ${lineState.cols[c]}`}>
              {s}
            </span>
          ))}
        </div>
        <div className="sw-left">
          {rowSums.map((s, r) => (
            <span key={r} className={`sw-clue ${lineState.rows[r]}`}>
              {s}
            </span>
          ))}
        </div>
        <div className="sudoku-grid" role="grid" aria-label="Sandwich sudoku board">
          {board.map((v, i) => {
            const given = givens[i] !== 0;
            const r = Math.floor(i / 9), c = i % 9;
            return (
              <button
                key={i}
                role="gridcell"
                className={[
                  "sudoku-cell",
                  given ? "given" : "",
                  selected === i ? "selected" : "",
                  v !== 0 && !given && peersConflict(board, i, v) ? "conflict" : "",
                  c % 3 === 2 && c !== 8 ? "br" : "",
                  r % 3 === 2 && r !== 8 ? "bb" : ""
                ].join(" ")}
                onClick={() => setSelected(i)}
              >
                {v || ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            className="num-key"
            onClick={() => selected !== null && setCell(selected, d)}
          >
            {d}
          </button>
        ))}
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
          game="sandwich"
          won
          message="Every sandwich adds up!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
