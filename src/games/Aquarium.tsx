import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

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
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("aquarium", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateAquarium(`aquarium-${seed}`, n), [seed, n]);
  const paint = useRef<Mark | null>(null);

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

  useEffect(() => {
    if (saved.done || conflicts.size > 0) return;
    const ok =
      counts.rows.every((v, r) => v === puzzle.rows[r]) &&
      counts.cols.every((v, c) => v === puzzle.cols[c]);
    if (ok) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("aquarium", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, conflicts, puzzle, saved]);

  function apply(i: number, v: Mark, undoable: boolean) {
    const marks = saved.marks.slice() as Mark[];
    marks[i] = v;
    commit({ ...saved, marks }, { undoable });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-aq-idx]");
    const v = el instanceof HTMLElement ? el.dataset.aqIdx : undefined;
    return v === undefined ? null : Number(v);
  }

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
            apply(i, paint.current, false);
        }}
        onPointerUp={() => { paint.current = null; }}
        onPointerCancel={() => { paint.current = null; }}
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
              data-aq-idx={i}
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
          game="aquarium"
          won
          message="Every tank at its level!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
