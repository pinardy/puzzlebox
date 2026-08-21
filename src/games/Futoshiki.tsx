import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 5, hard: 6 };
const CLUES: Record<Diff, number> = { easy: 8, medium: 10, hard: 14 };
const GIVENS: Record<Diff, number> = { easy: 2, medium: 3, hard: 4 };
const HELP =
  "A Latin square with inequality clues: every row and column holds each " +
  "number exactly once, and each arrow points at the smaller of its two " +
  "neighbours. Any grid satisfying all the clues wins.";

interface Ineq {
  lo: number; // cell index holding the smaller value
  hi: number; // adjacent cell index holding the larger value
}

interface Puzzle {
  givens: number[]; // 0 = player cell
  ineqs: Ineq[];
}

function generateFutoshiki(seed: string, n: number, clues: number, givenCount: number): Puzzle {
  const sol = generateLatin(`futo-${seed}`, n);
  const rng = makeRng(`futo-clues-${seed}`);

  const pairs: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (c < n - 1) pairs.push([r * n + c, r * n + c + 1]);
      if (r < n - 1) pairs.push([r * n + c, (r + 1) * n + c]);
    }
  const ineqs = shuffled(pairs, rng)
    .slice(0, clues)
    .map(([a, b]) => (sol[a] < sol[b] ? { lo: a, hi: b } : { lo: b, hi: a }));

  const givens = Array(n * n).fill(0);
  for (const idx of shuffled([...Array(n * n).keys()], rng).slice(0, givenCount))
    givens[idx] = sol[idx];
  return { givens, ineqs };
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Futoshiki({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("futoshiki", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { givens, ineqs } = useMemo(
    () => generateFutoshiki(seed, n, CLUES[diff], GIVENS[diff]),
    [seed, n, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

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
    for (const { lo, hi } of ineqs)
      if (board[lo] !== 0 && board[hi] !== 0 && board[lo] >= board[hi]) {
        bad.add(lo);
        bad.add(hi);
      }
    return bad;
  }, [board, ineqs, n]);

  useEffect(() => {
    if (!saved.done && board.every((v) => v !== 0) && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("futoshiki", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: n, rows: n, max: n, selected, setSelected, setCell });

  /** Sign between two adjacent cells, apex pointing at the smaller one. */
  const sign = (a: number, b: number, horizontal: boolean): string => {
    for (const { lo, hi } of ineqs) {
      if (lo === a && hi === b) return horizontal ? "<" : "∧";
      if (lo === b && hi === a) return horizontal ? ">" : "∨";
    }
    return "";
  };

  const G = 2 * n - 1;
  const track = Array(n - 1).fill("1fr 0.42fr").join(" ") + " 1fr";

  return (
    <div className="game game-futoshiki">
      <GameHeader title="Futoshiki" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Every row and column holds 1–{n} once; the arrows point at the smaller
        number.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="futo-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Futoshiki board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = (gr / 2) * n + gc / 2;
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
            const a = (gr / 2) * n + (gc - 1) / 2;
            return (
              <span key={k} className="futo-sign" aria-hidden="true">
                {sign(a, a + 1, true)}
              </span>
            );
          }
          if (gr % 2 === 1 && gc % 2 === 0) {
            const a = ((gr - 1) / 2) * n + gc / 2;
            return (
              <span key={k} className="futo-sign" aria-hidden="true">
                {sign(a, a + n, false)}
              </span>
            );
          }
          return <span key={k} />;
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
          game="futoshiki"
          won
          message="Inequalities satisfied!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
