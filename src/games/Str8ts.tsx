import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 6, hard: 7 };
const REVEAL: Record<Diff, number> = { easy: 0.42, medium: 0.32, hard: 0.28 };
const HELP =
  "Fill the white cells with digits — no repeats in any row or column, " +
  "counting the digits printed on black cells. Every horizontal or " +
  "vertical stretch of white cells (a 'straight') must hold consecutive " +
  "numbers, in any order: 4-2-3 works, 4-2-5 doesn't.";

interface Puzzle {
  black: boolean[];
  blackDigit: number[]; // 0 = plain black cell
  givens: number[]; // 0 = player cell (white)
  solution: number[];
  compRow: number[][]; // compartments (cell lists)
  compCol: number[][];
  compOfRow: number[];
  compOfCol: number[];
}

function generateStr8ts(seed: string, n: number, reveal: number): Puzzle {
  const rng = makeRng(seed);

  for (;;) {
    // Symmetric black pattern, never a fully-black row or column.
    const black = Array(n * n).fill(false);
    const target = Math.round(n * n * 0.21);
    let placed = 0;
    let guard = 200;
    while (placed < target && guard-- > 0) {
      const i = Math.floor(rng() * n * n);
      const j = n * n - 1 - i;
      if (black[i] || black[j]) continue;
      black[i] = black[j] = true;
      placed += i === j ? 1 : 2;
      for (let r = 0; r < n; r++) {
        let rc = 0, cc = 0;
        for (let k = 0; k < n; k++) {
          if (black[r * n + k]) rc++;
          if (black[k * n + r]) cc++;
        }
        if (rc === n || cc === n) {
          black[i] = black[j] = false;
          placed -= i === j ? 1 : 2;
          break;
        }
      }
    }

    const compRow: number[][] = [];
    const compCol: number[][] = [];
    const compOfRow = Array(n * n).fill(-1);
    const compOfCol = Array(n * n).fill(-1);
    const scan = (line: number[], comps: number[][], of: number[]) => {
      let run: number[] = [];
      for (const i of [...line, -1]) {
        if (i !== -1 && !black[i]) {
          run.push(i);
          continue;
        }
        if (run.length) {
          const id = comps.length;
          comps.push(run);
          for (const c of run) of[c] = id;
        }
        run = [];
      }
    };
    for (let r = 0; r < n; r++)
      scan(Array.from({ length: n }, (_, c) => r * n + c), compRow, compOfRow);
    for (let c = 0; c < n; c++)
      scan(Array.from({ length: n }, (_, r) => r * n + c), compCol, compOfCol);

    const grid = Array(n * n).fill(0);
    const whites = [...Array(n * n).keys()].filter((i) => !black[i]);
    let nodes = 0;

    const feasible = (comps: number[][], id: number): boolean => {
      const cells = comps[id];
      const vals = cells.map((c) => grid[c]).filter((v) => v > 0);
      if (!vals.length) return true;
      const mn = Math.min(...vals), mx = Math.max(...vals);
      if (mx - mn >= cells.length) return false;
      const lo = Math.max(1, mx - cells.length + 1);
      const hi = Math.min(n, mn + cells.length - 1);
      return hi - lo + 1 >= cells.length;
    };
    const okAt = (i: number, v: number): boolean => {
      const r = Math.floor(i / n), c = i % n;
      for (let k = 0; k < n; k++) {
        if (k !== c && grid[r * n + k] === v) return false;
        if (k !== r && grid[k * n + c] === v) return false;
      }
      return feasible(compRow, compOfRow[i]) && feasible(compCol, compOfCol[i]);
    };
    const fill = (k: number): boolean => {
      if (++nodes > 20000) return false;
      if (k === whites.length) return true;
      const i = whites[k];
      for (const v of shuffled([...Array(n).keys()].map((x) => x + 1), rng)) {
        grid[i] = v;
        if (okAt(i, v) && fill(k + 1)) return true;
        grid[i] = 0;
      }
      return false;
    };
    if (!fill(0)) continue;

    // Digits on some black cells — extra row/column blockers.
    const blackDigit = Array(n * n).fill(0);
    for (let i = 0; i < n * n; i++) {
      if (!black[i] || rng() > 0.45) continue;
      const r = Math.floor(i / n), c = i % n;
      const used = new Set<number>();
      for (let k = 0; k < n; k++) {
        used.add(grid[r * n + k]);
        used.add(grid[k * n + c]);
        if (blackDigit[r * n + k]) used.add(blackDigit[r * n + k]);
        if (blackDigit[k * n + c]) used.add(blackDigit[k * n + c]);
      }
      const options = [...Array(n).keys()].map((x) => x + 1).filter((v) => !used.has(v));
      if (options.length) blackDigit[i] = options[Math.floor(rng() * options.length)];
    }

    const givens = Array(n * n).fill(0);
    for (const i of shuffled(whites, rng).slice(0, Math.round(whites.length * reveal)))
      givens[i] = grid[i];
    return {
      black,
      blackDigit,
      givens,
      solution: grid,
      compRow,
      compCol,
      compOfRow,
      compOfCol
    };
  }
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Str8ts({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("str8ts", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(
    () => generateStr8ts(`str8ts-${seed}`, n, REVEAL[diff]),
    [seed, n, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => puzzle.givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [puzzle, saved.entries]
  );

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    // Row/column uniqueness, black digits included.
    const at = (i: number) => (puzzle.black[i] ? puzzle.blackDigit[i] : board[i]);
    for (let i = 0; i < n * n; i++) {
      const v = at(i);
      if (v === 0 || puzzle.black[i]) continue;
      const r = Math.floor(i / n), c = i % n;
      for (let k = 0; k < n; k++) {
        const row = r * n + k, col = k * n + c;
        if (row !== i && at(row) === v) bad.add(i);
        if (col !== i && at(col) === v) bad.add(i);
      }
    }
    // A compartment whose spread can no longer fit a straight.
    for (const comps of [puzzle.compRow, puzzle.compCol])
      for (const cells of comps) {
        const vals = cells.map((c) => board[c]).filter((v) => v > 0);
        if (!vals.length) continue;
        if (Math.max(...vals) - Math.min(...vals) >= cells.length)
          cells.forEach((c) => bad.add(c));
      }
    return bad;
  }, [board, puzzle, n]);

  useEffect(() => {
    if (saved.done || conflicts.size > 0) return;
    const whitesFull = board.every((v, i) => puzzle.black[i] || v !== 0);
    if (!whitesFull) return;
    const straight = (cells: number[]) => {
      const vals = cells.map((c) => board[c]);
      return Math.max(...vals) - Math.min(...vals) === cells.length - 1;
    };
    if (puzzle.compRow.every(straight) && puzzle.compCol.every(straight)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("str8ts", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, saved, puzzle]);

  function setCell(idx: number, val: number) {
    if (saved.done || puzzle.black[idx] || puzzle.givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) =>
      !puzzle.black[i] && puzzle.givens[i] === 0 && board[i] !== puzzle.solution[i];
    const cands = [...Array(n * n).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    entries[idx] = puzzle.solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({
    cols: n,
    rows: n,
    max: n,
    selected,
    setSelected,
    setCell,
    isCell: (i) => !puzzle.black[i]
  });

  return (
    <div className="game game-str8ts">
      <GameHeader title="Str8ts" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        White runs must be consecutive numbers in any order; rows and columns
        never repeat.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="st-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Str8ts board"
      >
        {board.map((v, i) => {
          if (puzzle.black[i])
            return (
              <span key={i} className="st-black">
                {puzzle.blackDigit[i] || ""}
              </span>
            );
          const given = puzzle.givens[i] !== 0;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "st-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {v || ""}
            </button>
          );
        })}
      </div>

      <div className="numpad numpad-5">
        {Array.from({ length: n }, (_, d) => d + 1).map((d) => (
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
          ⌫
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="str8ts"
          won
          message="Every straight lines up!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
