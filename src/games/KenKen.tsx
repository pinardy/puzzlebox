import { useEffect, useMemo, useState } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 5;

interface Cage {
  cells: number[];
  op: "+" | "×" | "−" | "÷" | "=";
  target: number;
}

interface Puzzle {
  cages: Cage[];
  cageOf: number[]; // cell → cage index
}

function generateKenKen(seed: string): Puzzle {
  const sol = generateLatin(`kenken-${seed}`, N);
  const rng = makeRng(`kenken-cages-${seed}`);

  const cageOf = Array(N * N).fill(-1);
  const cages: Cage[] = [];
  for (const start of shuffled([...Array(N * N).keys()], rng)) {
    if (cageOf[start] !== -1) continue;
    const id = cages.length;
    const cells = [start];
    cageOf[start] = id;
    const want = 2 + Math.floor(rng() * 2); // 2–3 cells; singles only when boxed in
    while (cells.length < want) {
      const frontier = cells.flatMap((i) => {
        const r = Math.floor(i / N), c = i % N;
        const out: number[] = [];
        if (r > 0 && cageOf[i - N] === -1) out.push(i - N);
        if (r < N - 1 && cageOf[i + N] === -1) out.push(i + N);
        if (c > 0 && cageOf[i - 1] === -1) out.push(i - 1);
        if (c < N - 1 && cageOf[i + 1] === -1) out.push(i + 1);
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

function fresh(): SavedState {
  return { entries: Array(N * N).fill(0), done: false };
}

export default function KenKen({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("kenken")?.seed ?? newSeed()
  );
  const { cages, cageOf } = useMemo(() => generateKenKen(seed), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("kenken")?.state ?? fresh()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < N * N; i++) {
      const v = board[i];
      if (v === 0) continue;
      const r = Math.floor(i / N), c = i % N;
      for (let k = 0; k < N; k++) {
        const row = r * N + k, col = k * N + c;
        if (row !== i && board[row] === v) bad.add(i);
        if (col !== i && board[col] === v) bad.add(i);
      }
    }
    for (const cage of cages)
      if (cageSatisfied(cage, board) === false)
        cage.cells.forEach((i) => bad.add(i));
    return bad;
  }, [board, cages]);

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      conflicts.size === 0 &&
      cages.every((c) => cageSatisfied(c, board) === true)
    ) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("kenken", seed, next);
      recordResult("kenken", true);
      setToast("All cages check out!");
    }
  }, [board, conflicts, cages, saved, seed]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    const next = { ...saved, entries };
    setSaved(next);
    saveSlot("kenken", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("kenken", s, fresh());
    setSelected(null);
    setToast(null);
  }

  /** The clue sits in the cage's top-left-most cell. */
  const clueCell = useMemo(
    () => new Map(cages.map((c) => [Math.min(...c.cells), c])),
    [cages]
  );

  return (
    <div className="game game-kenken">
      <GameHeader title="KenKen" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        1–{N} once per row and column; each outlined cage must make its
        number with its operation.
      </p>

      <div className="kenken-grid" role="grid" aria-label="KenKen board">
        {board.map((v, i) => {
          const r = Math.floor(i / N), c = i % N;
          const clue = clueCell.get(i);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kenken-cell",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : "",
                r > 0 && cageOf[i - N] !== cageOf[i] ? "cage-t" : "",
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

      {toast && <div className="toast">{toast}</div>}

      <div className="numpad numpad-5">
        {[1, 2, 3, 4, 5].map((d) => (
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
    </div>
  );
}
