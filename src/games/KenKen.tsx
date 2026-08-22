import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 5, hard: 6 };
const HELP =
  "Fill each row and column with 1 up to the grid size, no repeats. Each " +
  "outlined cage shows a target and an operation — its cells must combine " +
  "to that target (subtraction and division work in either order).";

interface Cage {
  cells: number[];
  op: "+" | "×" | "−" | "÷" | "=";
  target: number;
}

interface Puzzle {
  cages: Cage[];
  cageOf: number[]; // cell → cage index
}

function generateKenKen(seed: string, n: number): Puzzle {
  const sol = generateLatin(`kenken-${seed}`, n);
  const rng = makeRng(`kenken-cages-${seed}`);

  const cageOf = Array(n * n).fill(-1);
  const cages: Cage[] = [];
  for (const start of shuffled([...Array(n * n).keys()], rng)) {
    if (cageOf[start] !== -1) continue;
    const id = cages.length;
    const cells = [start];
    cageOf[start] = id;
    const want = 2 + Math.floor(rng() * 2); // 2–3 cells; singles only when boxed in
    while (cells.length < want) {
      const frontier = cells.flatMap((i) => {
        const r = Math.floor(i / n), c = i % n;
        const out: number[] = [];
        if (r > 0 && cageOf[i - n] === -1) out.push(i - n);
        if (r < n - 1 && cageOf[i + n] === -1) out.push(i + n);
        if (c > 0 && cageOf[i - 1] === -1) out.push(i - 1);
        if (c < n - 1 && cageOf[i + 1] === -1) out.push(i + 1);
        return out;
      });
      if (!frontier.length) break;
      const pick = frontier[Math.floor(rng() * frontier.length)];
      cageOf[pick] = id;
      cells.push(pick);
    }

    const vals = cells.map((i) => sol[i]);
    let op: Cage["op"], target: number;
    if (vals.length === 1) {
      op = "=";
      target = vals[0];
    } else if (vals.length === 2) {
      const [a, b] = vals;
      const div = a % b === 0 ? a / b : b % a === 0 ? b / a : 0;
      const roll = rng();
      if (div > 1 && roll < 0.35) { op = "÷"; target = div; }
      else if (roll < 0.65) { op = "−"; target = Math.abs(a - b); }
      else if (roll < 0.85) { op = "+"; target = a + b; }
      else { op = "×"; target = a * b; }
    } else if (rng() < 0.5) {
      op = "+";
      target = vals.reduce((x, y) => x + y, 0);
    } else {
      op = "×";
      target = vals.reduce((x, y) => x * y, 1);
    }
    cages.push({ cells, op, target });
  }
  return { cages, cageOf };
}

function cageSatisfied(cage: Cage, board: number[]): boolean | null {
  const vals = cage.cells.map((i) => board[i]);
  if (vals.some((v) => v === 0)) return null; // incomplete
  switch (cage.op) {
    case "=": return vals[0] === cage.target;
    case "+": return vals.reduce((a, b) => a + b, 0) === cage.target;
    case "×": return vals.reduce((a, b) => a * b, 1) === cage.target;
    case "−": return Math.abs(vals[0] - vals[1]) === cage.target;
    case "÷": {
      const [a, b] = vals;
      return a === b * cage.target || b === a * cage.target;
    }
  }
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function KenKen({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("kenken", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { cages, cageOf } = useMemo(() => generateKenKen(seed, n), [seed, n]);
  // Same seed string as generateKenKen, so this is the grid the cage
  // targets were computed from.
  const solution = useMemo(() => generateLatin(`kenken-${seed}`, n), [seed, n]);
  const [selected, setSelected] = useState<number | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const v = board[i];
      if (v === 0) continue;
      const r = Math.floor(i / n), c = i % n;
      for (let k = 0; k < n; k++) {
        const row = r * n + k, col = k * n + c;
        if (row !== i && board[row] === v) bad.add(i);
        if (col !== i && board[col] === v) bad.add(i);
      }
    }
    for (const cage of cages)
      if (cageSatisfied(cage, board) === false)
        cage.cells.forEach((i) => bad.add(i));
    return bad;
  }, [board, cages, n]);

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      conflicts.size === 0 &&
      cages.every((c) => cageSatisfied(c, board) === true)
    ) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("kenken", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, cages, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) => board[i] !== solution[i];
    const cands = [...Array(n * n).keys()].filter(open);
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

  useGridKeys({ cols: n, rows: n, max: n, selected, setSelected, setCell });

  const clueCell = useMemo(
    () => new Map(cages.map((c) => [Math.min(...c.cells), c])),
    [cages]
  );

  return (
    <div className="game game-kenken">
      <GameHeader title="KenKen" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        1–{n} once per row and column; each outlined cage must make its
        number with its operation.
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
        className="kenken-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="KenKen board"
      >
        {board.map((v, i) => {
          const r = Math.floor(i / n), c = i % n;
          const clue = clueCell.get(i);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kenken-cell",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : "",
                r > 0 && cageOf[i - n] !== cageOf[i] ? "cage-t" : "",
                c > 0 && cageOf[i - 1] !== cageOf[i] ? "cage-l" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {clue && (
                <span className="kenken-clue">
                  {clue.target}
                  {clue.op === "=" ? "" : clue.op}
                </span>
              )}
              <span className="kenken-val">{v || ""}</span>
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
          game="kenken"
          won
          message="All cages check out!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
