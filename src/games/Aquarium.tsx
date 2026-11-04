import { useEffect, useMemo, type CSSProperties } from "react";
import { useMarkPaint } from "../lib/drag";
import { makeRng, shuffled } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Aquarium.css";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 8 };
const HELP =
  "Each outlined tank holds water that obeys gravity: within a tank, a " +
  "flooded row floods every tank row below it, and a row is always level — " +
  "all its tank cells match. Edge numbers count the water cells per row " +
  "and column. Mark ✕ on cells you know stay dry; drag to paint.";

interface Puzzle {
  regionOf: number[];
  rows: number[];
  cols: number[];
}

/** Grow tanks, pick a water level for each, read off the counts. */
function generateAquarium(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);

  const regionOf = Array(n * n).fill(-1);
  const regions: number[][] = [];
  for (const start of shuffled([...Array(n * n).keys()], rng)) {
    if (regionOf[start] !== -1) continue;
    const id = regions.length;
    const cells = [start];
    regionOf[start] = id;
    const want = 3 + Math.floor(rng() * 5); // 3–7 cells
    while (cells.length < want) {
      const frontier = cells.flatMap((i) => {
        const r = Math.floor(i / n), c = i % n;
        const out: number[] = [];
        if (r > 0 && regionOf[i - n] === -1) out.push(i - n);
        if (r < n - 1 && regionOf[i + n] === -1) out.push(i + n);
        if (c > 0 && regionOf[i - 1] === -1) out.push(i - 1);
        if (c < n - 1 && regionOf[i + 1] === -1) out.push(i + 1);
        return out;
      });
      if (!frontier.length) break;
      const pick = frontier[Math.floor(rng() * frontier.length)];
      regionOf[pick] = id;
      cells.push(pick);
    }
    regions.push(cells);
  }

  const rows = Array(n).fill(0), cols = Array(n).fill(0);
  for (const cells of regions) {
    const regionRows = [...new Set(cells.map((i) => Math.floor(i / n)))].sort(
      (a, b) => a - b
    );
    const level = Math.floor(rng() * (regionRows.length + 1));
    const wet = new Set(regionRows.slice(regionRows.length - level));
    for (const i of cells)
      if (wet.has(Math.floor(i / n))) {
        rows[Math.floor(i / n)]++;
        cols[i % n]++;
      }
  }
  return { regionOf, rows, cols };
}

type Mark = 0 | 1 | 2; // empty | water | ✕

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Aquarium({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateAquarium(`aquarium-${seed}`, n), [seed, n]);

  const counts = useMemo(() => {
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    saved.marks.forEach((m, i) => {
      if (m === 1) {
        rows[Math.floor(i / n)]++;
        cols[i % n]++;
      }
    });
    return { rows, cols };
  }, [saved.marks, n]);

  /** Gravity violations: a wet cell with a dry tank-mate in the same row,
   *  or a wet tank row above a dry one. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    const byRegion = new Map<number, number[]>();
    puzzle.regionOf.forEach((g, i) =>
      byRegion.set(g, [...(byRegion.get(g) ?? []), i])
    );
    for (const cells of byRegion.values()) {
      const byRow = new Map<number, number[]>();
      for (const i of cells) {
        const r = Math.floor(i / n);
        byRow.set(r, [...(byRow.get(r) ?? []), i]);
      }
      const rows = [...byRow.keys()].sort((a, b) => a - b);
      for (const r of rows) {
        const rowCells = byRow.get(r)!;
        const wet = rowCells.filter((i) => saved.marks[i] === 1);
        if (wet.length && wet.length !== rowCells.length)
          rowCells.forEach((i) => bad.add(i));
      }
      for (let k = 0; k + 1 < rows.length; k++) {
        const above = byRow.get(rows[k])!;
        const below = byRow.get(rows[k + 1])!;
        const aboveWet = above.some((i) => saved.marks[i] === 1);
        const belowDry = below.some((i) => saved.marks[i] !== 1);
        if (aboveWet && belowDry) [...above, ...below].forEach((i) => bad.add(i));
      }
    }
    return bad;
  }, [saved.marks, puzzle, n]);

  const solved =
    conflicts.size === 0 &&
    counts.rows.every((v, r) => v === puzzle.rows[r]) &&
    counts.cols.every((v, c) => v === puzzle.cols[c]);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  // A press cycles the cell; the drag paints that mark over the cells it
  // crosses that differ, and the whole stroke is one undo step.
  const drag = useMarkPaint<Mark>({
    marks: saved.marks,
    next: (i) => (saved.done ? null : (((saved.marks[i] + 1) % 3) as Mark)),
    write: (marks, undoable) => commit({ ...saved, marks }, { undoable })
  });

  const G = n + 1;
  const countClass = (got: number, want: number) =>
    `edge-count${got === want ? " ok" : got > want ? " bad" : ""}`;

  return (
    <div className="game game-aquarium">
      <GameHeader title="Aquarium" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Flood the tanks to match the counts — water always finds its level.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="tents-grid aq-grid drag-paint"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Aquarium board"
        {...drag}
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr === 0 && gc === 0) return <span key={k} />;
          if (gr === 0)
            return (
              <span key={k} className={countClass(counts.cols[gc - 1], puzzle.cols[gc - 1])}>
                {puzzle.cols[gc - 1]}
              </span>
            );
          if (gc === 0)
            return (
              <span key={k} className={countClass(counts.rows[gr - 1], puzzle.rows[gr - 1])}>
                {puzzle.rows[gr - 1]}
              </span>
            );
          const i = (gr - 1) * n + (gc - 1);
          const r = gr - 1, c = gc - 1;
          const m = saved.marks[i];
          return (
            <button
              key={k}
              data-cell={i}
              role="gridcell"
              className={[
                "aq-cell",
                m === 1 ? "water" : m === 2 ? "dry" : "",
                conflicts.has(i) ? "conflict" : "",
                r > 0 && puzzle.regionOf[i - n] !== puzzle.regionOf[i] ? "cage-t" : "",
                c > 0 && puzzle.regionOf[i - 1] !== puzzle.regionOf[i] ? "cage-l" : ""
              ].join(" ")}
            >
              {m === 1 ? "" : m === 2 ? "×" : ""}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every tank at its level!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
