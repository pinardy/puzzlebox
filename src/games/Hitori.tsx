import { useEffect, useMemo, type CSSProperties } from "react";
import { useMarkPaint } from "../lib/drag";
import { makeRng, shuffled } from "../lib/rng";
import { generateLatin, floodCount } from "../lib/latin";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Hitori.css";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 8 };
const SHADED: Record<Diff, number> = { easy: 6, medium: 8, hard: 12 };
const HELP =
  "Shade cells until no number repeats in any row or column. Two shaded " +
  "cells may never touch orthogonally, and the unshaded cells must all " +
  "stay connected. Circle cells you're sure survive. Drag to shade a run.";

const orthOf = (i: number, n: number): number[] => {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** Start from a Latin square (no duplicates anywhere), pick a valid shading
 *  (non-adjacent, leaves the rest connected), then overwrite each shaded
 *  cell with a duplicate of an unshaded row/column mate. Shading those
 *  cells again is therefore always a solution; any valid one is accepted.
 *  Returns the grid and that shading (for hints). */
function generateHitori(
  seed: string,
  n: number,
  target: number
): { grid: number[]; shaded: Set<number> } {
  const grid = generateLatin(`hitori-${seed}`, n);
  const rng = makeRng(`hitori-shade-${seed}`);

  const shaded = new Set<number>();
  for (const i of shuffled([...Array(n * n).keys()], rng)) {
    if (shaded.size >= target) break;
    if (orthOf(i, n).some((j) => shaded.has(j))) continue;
    const open = Array(n * n).fill(true);
    for (const s of shaded) open[s] = false;
    open[i] = false;
    const start = open.indexOf(true);
    if (floodCount(open, n, start) !== n * n - shaded.size - 1) continue;
    shaded.add(i);
  }

  for (const i of shaded) {
    const r = Math.floor(i / n), c = i % n;
    const mates: number[] = [];
    for (let k = 0; k < n; k++) {
      const row = r * n + k, col = k * n + c;
      if (row !== i && !shaded.has(row)) mates.push(row);
      if (col !== i && !shaded.has(col)) mates.push(col);
    }
    grid[i] = grid[mates[Math.floor(rng() * mates.length)]];
  }
  return { grid, shaded };
}

type Mark = 0 | 1 | 2; // clear | shaded | circled (kept)

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Hitori({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const { grid, shaded: answer } = useMemo(
    () => generateHitori(seed, n, SHADED[diff]),
    [seed, n, diff]
  );

  /** Only rule breaks the player caused: two shaded cells touching. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      if (saved.marks[i] !== 1) continue;
      for (const j of orthOf(i, n)) if (saved.marks[j] === 1) { bad.add(i); bad.add(j); }
    }
    return bad;
  }, [saved.marks, n]);

  const solved = useMemo(() => {
    if (conflicts.size > 0) return false;
    const shadedCount = saved.marks.filter((m) => m === 1).length;
    if (shadedCount === 0) return false;
    for (let i = 0; i < n * n; i++) {
      if (saved.marks[i] === 1) continue;
      const r = Math.floor(i / n), c = i % n;
      for (let k = 0; k < n; k++) {
        const row = r * n + k, col = k * n + c;
        if (row !== i && saved.marks[row] !== 1 && grid[row] === grid[i]) return false;
        if (col !== i && saved.marks[col] !== 1 && grid[col] === grid[i]) return false;
      }
    }
    const open = saved.marks.map((m) => m !== 1);
    const start = open.indexOf(true);
    return floodCount(open, n, start) === n * n - shadedCount;
  }, [saved.marks, conflicts, grid, n]);

  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  // A press cycles shade → circle → clear; the drag paints that mark over
  // the cells that differ, and the whole stroke is one undo step.
  const drag = useMarkPaint<Mark>({
    marks: saved.marks,
    next: (i) => (saved.done ? null : (((saved.marks[i] + 1) % 3) as Mark)),
    write: (marks, undoable) => commit({ ...saved, marks }, { undoable })
  });

  /** Shade or circle one wrong or unmarked cell from the generated answer. */
  function hint() {
    if (saved.done) return;
    const want = (i: number): Mark => (answer.has(i) ? 1 : 2);
    const wrong = saved.marks.flatMap((m, i) => (m === want(i) ? [] : [i]));
    if (!wrong.length) return;
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    const marks = saved.marks.slice();
    marks[i] = want(i);
    commitHint({ ...saved, marks });
  }

  return (
    <div className="game game-hitori">
      <GameHeader title="Hitori" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Shade duplicates away. Tap: shade → circle → clear; drag to shade a
        run.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="hitori-grid drag-paint"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Hitori board"
        {...drag}
      >
        {grid.map((v, i) => (
          <button
            key={i}
            data-cell={i}
            role="gridcell"
            aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${v}, ${
              saved.marks[i] === 1 ? "shaded" : saved.marks[i] === 2 ? "circled" : "clear"
            }${conflicts.has(i) ? ", conflict" : ""}`}
            className={[
              "hitori-cell",
              saved.marks[i] === 1 ? "shaded" : "",
              saved.marks[i] === 2 ? "circled" : "",
              conflicts.has(i) ? "conflict" : ""
            ].join(" ")}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="lights-meta">
        <span>▩ {saved.marks.filter((m) => m === 1).length} shaded</span>
        <button
          className="mini-btn"
          onClick={() => commit({ marks: Array(n * n).fill(0) as Mark[], done: false })}
        >
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="All duplicates shaded away!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
