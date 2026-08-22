import { useEffect, useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { generateSudoku, peersConflict, Grid } from "../lib/sudoku";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const GIVENS: Record<Diff, number> = { easy: 12, medium: 5, hard: 0 };
const HELP =
  "Classic sudoku rules — 1–9 once per row, column, and box — but the " +
  "dotted cages carry the clues: each cage's cells add up to its small " +
  "number, and a digit never repeats inside a cage. Start from the " +
  "smallest and largest cage sums.";

interface Cage {
  cells: number[];
  sum: number;
}

interface Puzzle {
  cages: Cage[];
  cageOf: number[];
  givens: Grid; // 0 = player cell
  solution: Grid;
}

/** Grow 2–4 cell cages over a solved grid. A cell only joins a cage if
 *  its digit isn't already inside (killer cages never repeat a digit). */
function generateKiller(seed: string, givenCount: number): Puzzle {
  const { solution } = generateSudoku(`killer-${seed}`, 0);
  const rng = makeRng(`killer-cages-${seed}`);

  const cageOf = Array(81).fill(-1);
  const cages: Cage[] = [];
  for (const start of shuffled([...Array(81).keys()], rng)) {
    if (cageOf[start] !== -1) continue;
    const id = cages.length;
    const cells = [start];
    const digits = new Set([solution[start]]);
    cageOf[start] = id;
    const want = 2 + Math.floor(rng() * 3); // 2–4; singles only when boxed in
    while (cells.length < want) {
      const frontier = cells.flatMap((i) => {
        const r = Math.floor(i / 9), c = i % 9;
        const out: number[] = [];
        if (r > 0 && cageOf[i - 9] === -1 && !digits.has(solution[i - 9])) out.push(i - 9);
        if (r < 8 && cageOf[i + 9] === -1 && !digits.has(solution[i + 9])) out.push(i + 9);
        if (c > 0 && cageOf[i - 1] === -1 && !digits.has(solution[i - 1])) out.push(i - 1);
        if (c < 8 && cageOf[i + 1] === -1 && !digits.has(solution[i + 1])) out.push(i + 1);
        return out;
      });
      if (!frontier.length) break;
      const pick = frontier[Math.floor(rng() * frontier.length)];
      cageOf[pick] = id;
      digits.add(solution[pick]);
      cells.push(pick);
    }
    cages.push({ cells, sum: cells.reduce((a, i) => a + solution[i], 0) });
  }

  const givens = Array(81).fill(0);
  for (const i of shuffled([...Array(81).keys()], rng).slice(0, givenCount))
    givens[i] = solution[i];
  return { cages, cageOf, givens, solution };
}

interface SavedState {
  entries: Grid;
  notes: number[][];
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

export default function Killer({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("killer", fresh);
  const { cages, cageOf, givens, solution } = useMemo(
    () => generateKiller(seed, GIVENS[diff]),
    [seed, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);

  const board: Grid = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  const cageBad = useMemo(() => {
    const bad = new Set<number>();
    for (const cage of cages) {
      const vals = cage.cells.map((i) => board[i]);
      for (let a = 0; a < vals.length; a++)
        for (let b = a + 1; b < vals.length; b++)
          if (vals[a] !== 0 && vals[a] === vals[b]) {
            bad.add(cage.cells[a]);
            bad.add(cage.cells[b]);
          }
      if (
        vals.every((v) => v !== 0) &&
        vals.reduce((x, y) => x + y, 0) !== cage.sum
      )
        cage.cells.forEach((i) => bad.add(i));
    }
    return bad;
  }, [board, cages]);

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      cageBad.size === 0 &&
      board.every((v, i) => !peersConflict(board, i, v))
    ) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("killer", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, cageBad, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || givens[idx] !== 0) return;
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
      if (val !== 0 && next.entries[idx] === val)
        for (const p of peers(idx))
          next.notes[p] = next.notes[p].filter((x) => x !== val);
    }
    commit(next);
  }

  function hint() {
    const open = (i: number) => givens[i] === 0 && board[i] !== solution[i];
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

  useGridKeys({ cols: 9, rows: 9, max: 9, selected, setSelected, setCell });

  const clueCell = useMemo(
    () => new Map(cages.map((c) => [Math.min(...c.cells), c])),
    [cages]
  );
  const selVal = selected !== null ? board[selected] : 0;

  return (
    <div className="game game-killer">
      <GameHeader title="Killer Sudoku" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Rows, columns, and boxes hold 1–9 once; each dotted cage adds to its
        number, no repeats inside.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="sudoku-grid" role="grid" aria-label="Killer sudoku board">
        {board.map((v, i) => {
          const given = givens[i] !== 0;
          const conflict =
            (v !== 0 && !given && peersConflict(board, i, v)) || cageBad.has(i);
          const r = Math.floor(i / 9);
          const c = i % 9;
          const clue = clueCell.get(i);
          const sameVal = selVal !== 0 && v === selVal;
          const inLine =
            selected !== null &&
            (Math.floor(selected / 9) === r || selected % 9 === c);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "sudoku-cell killer-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                sameVal ? "same" : "",
                inLine ? "inline" : "",
                conflict ? "conflict" : "",
                c % 3 === 2 && c !== 8 ? "br" : "",
                r % 3 === 2 && r !== 8 ? "bb" : "",
                r > 0 && cageOf[i - 9] !== cageOf[i] ? "kc-t" : "",
                c > 0 && cageOf[i - 1] !== cageOf[i] ? "kc-l" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {clue && <span className="killer-sum">{clue.sum}</span>}
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
          game="killer"
          won
          message="Every cage adds up!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
