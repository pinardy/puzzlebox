import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 5;
const CLUES = 10;
const GIVENS = 3;

interface Ineq {
  lo: number; // cell index holding the smaller value
  hi: number; // adjacent cell index holding the larger value
}

interface Puzzle {
  givens: number[]; // 0 = player cell
  ineqs: Ineq[];
}

function generateFutoshiki(seed: string): Puzzle {
  const sol = generateLatin(`futo-${seed}`, N);
  const rng = makeRng(`futo-clues-${seed}`);

  const pairs: [number, number][] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (c < N - 1) pairs.push([r * N + c, r * N + c + 1]);
      if (r < N - 1) pairs.push([r * N + c, (r + 1) * N + c]);
    }
  const ineqs = shuffled(pairs, rng)
    .slice(0, CLUES)
    .map(([a, b]) => (sol[a] < sol[b] ? { lo: a, hi: b } : { lo: b, hi: a }));

  const givens = Array(N * N).fill(0);
  for (const idx of shuffled([...Array(N * N).keys()], rng).slice(0, GIVENS))
    givens[idx] = sol[idx];
  return { givens, ineqs };
}

interface SavedState {
  entries: number[];
  done: boolean;
}

function fresh(): SavedState {
  return { entries: Array(N * N).fill(0), done: false };
}

export default function Futoshiki({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("futoshiki")?.seed ?? newSeed()
  );
  const { givens, ineqs } = useMemo(() => generateFutoshiki(seed), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("futoshiki")?.state ?? fresh()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  /** Filled cells that duplicate their row/column or break an inequality. */
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
    for (const { lo, hi } of ineqs)
      if (board[lo] !== 0 && board[hi] !== 0 && board[lo] >= board[hi]) {
        bad.add(lo);
        bad.add(hi);
      }
    return bad;
  }, [board, ineqs]);

  useEffect(() => {
    if (!saved.done && board.every((v) => v !== 0) && conflicts.size === 0) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("futoshiki", seed, next);
      recordResult("futoshiki", true);
      setToast("Inequalities satisfied!");
    }
  }, [board, conflicts, saved, seed]);

  function setCell(idx: number, val: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    const next = { ...saved, entries };
    setSaved(next);
    saveSlot("futoshiki", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("futoshiki", s, fresh());
    setSelected(null);
    setToast(null);
  }

  /** Sign between two adjacent cells, apex pointing at the smaller one. */
  const sign = (a: number, b: number, horizontal: boolean): string => {
    for (const { lo, hi } of ineqs) {
      if (lo === a && hi === b) return horizontal ? "<" : "∧";
      if (lo === b && hi === a) return horizontal ? ">" : "∨";
    }
    return "";
  };

  const G = 2 * N - 1;
  const track = Array(N - 1).fill("1fr 0.42fr").join(" ") + " 1fr";

  return (
    <div className="game game-futoshiki">
      <GameHeader title="Futoshiki" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Every row and column holds 1–{N} once; the arrows point at the smaller
        number.
      </p>

      <div
        className="futo-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Futoshiki board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = (gr / 2) * N + gc / 2;
            const given = givens[i] !== 0;
            return (
              <button
                key={k}
                role="gridcell"
                className={[
                  "futo-cell",
                  given ? "given" : "",
                  selected === i ? "selected" : "",
                  conflicts.has(i) ? "conflict" : ""
                ].join(" ")}
                onClick={() => setSelected(i)}
              >
                {board[i] || ""}
              </button>
            );
          }
          if (gr % 2 === 0 && gc % 2 === 1) {
            const a = (gr / 2) * N + (gc - 1) / 2;
            return (
              <span key={k} className="futo-sign" aria-hidden="true">
                {sign(a, a + 1, true)}
              </span>
            );
          }
          if (gr % 2 === 1 && gc % 2 === 0) {
            const a = ((gr - 1) / 2) * N + gc / 2;
            return (
              <span key={k} className="futo-sign" aria-hidden="true">
                {sign(a, a + N, false)}
              </span>
            );
          }
          return <span key={k} />;
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
