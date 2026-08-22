import { useEffect, useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const GIVENS: Record<Diff, number> = { easy: 3, medium: 2, hard: 1 };
const HELP =
  "Place 1–9 once each so that every circled number equals the sum of " +
  "the four cells around it. The givens pin the puzzle to a single " +
  "solution — work out which corners can carry the big and small sums.";

// The four circles sit at the interior intersections; each sums a 2×2
// quadrant of the 3×3 grid.
const QUADS = [
  [0, 1, 3, 4],
  [1, 2, 4, 5],
  [3, 4, 6, 7],
  [4, 5, 7, 8]
];

interface Puzzle {
  sums: number[];
  givens: number[]; // 0 = player cell
  solution: number[];
}

/** Count fills consistent with the sums and givens (early-exit at 2). */
function countSolutions(sums: number[], givens: number[]): number {
  const grid = givens.slice();
  const used = Array(10).fill(false);
  for (const v of givens) if (v) used[v] = true;
  let found = 0;
  const cells = [...Array(9).keys()].filter((i) => givens[i] === 0);
  const ok = (idx: number): boolean =>
    QUADS.every((q, k) => {
      const vals = q.map((c) => grid[c]);
      if (!q.includes(idx) || vals.some((v) => v === 0)) return true;
      return vals.reduce((a, b) => a + b, 0) === sums[k];
    });
  const walk = (k: number): void => {
    if (found >= 2) return;
    if (k === cells.length) {
      found++;
      return;
    }
    const i = cells[k];
    for (let v = 1; v <= 9; v++) {
      if (used[v]) continue;
      grid[i] = v;
      used[v] = true;
      if (ok(i)) walk(k + 1);
      grid[i] = 0;
      used[v] = false;
    }
  };
  walk(0);
  return found;
}

function generateSujiko(seed: string, givenCount: number): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const solution = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    const sums = QUADS.map((q) => q.reduce((a, c) => a + solution[c], 0));
    const givens = Array(9).fill(0);
    for (const i of shuffled([...Array(9).keys()], rng).slice(0, givenCount))
      givens[i] = solution[i];
    if (countSolutions(sums, givens) === 1) return { sums, givens, solution };
  }
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Sujiko({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("sujiko", () => ({ entries: Array(9).fill(0), done: false }));
  const { sums, givens, solution } = useMemo(
    () => generateSujiko(`sujiko-${seed}`, GIVENS[diff]),
    [seed, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  const quadState = useMemo(
    () =>
      QUADS.map((q, k) => {
        const vals = q.map((c) => board[c]);
        if (vals.some((v) => v === 0)) return "open";
        return vals.reduce((a, b) => a + b, 0) === sums[k] ? "ok" : "bad";
      }),
    [board, sums]
  );

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      quadState.every((s) => s === "ok")
    ) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("sujiko", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, quadState, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    // Each digit is unique: placing one clears it from wherever it was.
    if (val !== 0)
      for (let i = 0; i < 9; i++) if (entries[i] === val) entries[i] = 0;
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) => givens[i] === 0 && board[i] !== solution[i];
    const cands = [...Array(9).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    for (let i = 0; i < 9; i++) if (entries[i] === solution[idx]) entries[i] = 0;
    entries[idx] = solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: 3, rows: 3, max: 9, selected, setSelected, setCell });

  const usedDigits = new Set(board.filter((v) => v !== 0));

  return (
    <div className="game game-sujiko">
      <GameHeader title="Sujiko" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Place 1–9 once each; every circle equals the sum of its four cells.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="sj-wrap" role="grid" aria-label="Sujiko board">
        {board.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "sj-cell",
              givens[i] !== 0 ? "given" : "",
              selected === i ? "selected" : ""
            ].join(" ")}
            onClick={() => setSelected(i)}
          >
            {v || ""}
          </button>
        ))}
        {sums.map((s, k) => (
          <span
            key={k}
            className={`sj-sum ${quadState[k]}`}
            style={{
              left: `${(k % 2) * 33.33 + 33.33}%`,
              top: `${Math.floor(k / 2) * 33.33 + 33.33}%`
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="numpad numpad-9">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            className={`num-key${usedDigits.has(d) ? " dim" : ""}`}
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
          game="sujiko"
          won
          message="All four circles balance!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
