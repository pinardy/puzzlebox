import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { generateLatin, floodCount } from "../lib/latin";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

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
 *  cells again is therefore always a solution; any valid one is accepted. */
function generateHitori(seed: string, n: number, target: number): number[] {
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
  return grid;
}

type Mark = 0 | 1 | 2; // clear | shaded | circled (kept)

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Hitori({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("hitori", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const grid = useMemo(() => generateHitori(seed, n, SHADED[diff]), [seed, n, diff]);
  const paint = useRef<Mark | null>(null);

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
    if (!saved.done && solved) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("hitori", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, saved]);

  function apply(i: number, v: Mark, undoable: boolean) {
    const marks = saved.marks.slice() as Mark[];
    marks[i] = v;
    commit({ ...saved, marks }, { undoable });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-hit-idx]");
    const v = el instanceof HTMLElement ? el.dataset.hitIdx : undefined;
    return v === undefined ? null : Number(v);
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
      />

      <div
        className="hitori-grid drag-paint"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Hitori board"
        onPointerDown={(e) => {
          if (saved.done) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i === null) return;
          const v = ((saved.marks[i] + 1) % 3) as Mark;
          paint.current = v;
          apply(i, v, true);
        }}
        onPointerMove={(e) => {
          if (paint.current === null) return;
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i !== null && saved.marks[i] !== paint.current)
            apply(i, paint.current, false); // whole stroke = one undo step
        }}
        onPointerUp={() => { paint.current = null; }}
        onPointerCancel={() => { paint.current = null; }}
      >
        {grid.map((v, i) => (
          <button
            key={i}
            data-hit-idx={i}
            role="gridcell"
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
          game="hitori"
          won
          message="All duplicates shaded away!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
