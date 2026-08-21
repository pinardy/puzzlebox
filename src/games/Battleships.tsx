import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 7, medium: 8, hard: 10 };
const FLEETS: Record<Diff, number[]> = {
  easy: [3, 2, 2, 1, 1],
  medium: [4, 3, 3, 2, 2, 1, 1, 1],
  hard: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
};
const HELP =
  "The fleet hides in the grid: ships are straight lines that never touch " +
  "each other, not even diagonally. Edge numbers count the ship cells in " +
  "each row and column; a few cells are revealed. Mark water to rule cells " +
  "out; drag to mark several.";

interface Puzzle {
  rows: number[];
  cols: number[];
  givenShip: number[];
  givenWater: number[];
}

/** Hide the fleet (ships never touch, even diagonally), read off the
 *  row/column counts, and reveal a few cells as a foothold. */
function generateShips(seed: string, n: number, fleet: number[]): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const ship = Array(n * n).fill(false);
    const blocked = Array(n * n).fill(false);
    let ok = true;
    for (const len of fleet) {
      let placed = false;
      for (let attempt = 0; attempt < 120 && !placed; attempt++) {
        const horizontal = rng() < 0.5;
        const r = Math.floor(rng() * (horizontal ? n : n - len + 1));
        const c = Math.floor(rng() * (horizontal ? n - len + 1 : n));
        const cells = Array.from({ length: len }, (_, k) =>
          horizontal ? r * n + c + k : (r + k) * n + c
        );
        if (cells.some((i) => blocked[i])) continue;
        for (const i of cells) {
          ship[i] = true;
          const rr = Math.floor(i / n), cc = i % n;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const r2 = rr + dr, c2 = cc + dc;
              if (r2 >= 0 && r2 < n && c2 >= 0 && c2 < n) blocked[r2 * n + c2] = true;
            }
        }
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (!ok) continue;

    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    const shipCells: number[] = [], waterCells: number[] = [];
    ship.forEach((s, i) => {
      if (s) { rows[Math.floor(i / n)]++; cols[i % n]++; shipCells.push(i); }
      else waterCells.push(i);
    });
    return {
      rows,
      cols,
      givenShip: shuffled(shipCells, rng).slice(0, 2),
      givenWater: shuffled(waterCells, rng).slice(0, 2)
    };
  }
}

/** A ship set is a valid fleet layout when the components are straight
 *  lines of the right sizes and never touch diagonally. */
function fleetOk(shipSet: Set<number>, n: number, fleet: number[]): boolean {
  for (const i of shipSet) {
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && shipSet.has(rr * n + cc))
        return false;
    }
  }
  const seen = new Set<number>();
  const sizes: number[] = [];
  for (const start of shipSet) {
    if (seen.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop()!;
      comp.push(i);
      const r = Math.floor(i / n), c = i % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        const j = rr * n + cc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && shipSet.has(j) && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    const rs = comp.map((i) => Math.floor(i / n)), cs = comp.map((i) => i % n);
    if (new Set(rs).size !== 1 && new Set(cs).size !== 1) return false;
    sizes.push(comp.length);
  }
  return sizes.sort().join(",") === [...fleet].sort().join(",");
}

type Mark = 0 | 1 | 2; // unknown | ship | water

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Battleships({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("ships", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const fleet = FLEETS[diff];
  const puzzle = useMemo(
    () => generateShips(`ships-${seed}`, n, fleet),
    [seed, n, fleet]
  );
  const paint = useRef<Mark | null>(null);

  const givenShip = useMemo(() => new Set(puzzle.givenShip), [puzzle]);
  const givenWater = useMemo(() => new Set(puzzle.givenWater), [puzzle]);

  const ships = useMemo(() => {
    const s = new Set<number>(puzzle.givenShip);
    saved.marks.forEach((m, i) => { if (m === 1) s.add(i); });
    return s;
  }, [saved.marks, puzzle]);

  useEffect(() => {
    if (saved.done) return;
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    for (const i of ships) { rows[Math.floor(i / n)]++; cols[i % n]++; }
    const countsOk =
      rows.every((v, r) => v === puzzle.rows[r]) &&
      cols.every((v, c) => v === puzzle.cols[c]);
    if (countsOk && fleetOk(ships, n, fleet)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("ships", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ships, puzzle, saved, n, fleet]);

  function apply(i: number, v: Mark, undoable: boolean) {
    if (givenShip.has(i) || givenWater.has(i)) return;
    const marks = saved.marks.slice() as Mark[];
    marks[i] = v;
    commit({ ...saved, marks }, { undoable });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-ship-idx]");
    const v = el instanceof HTMLElement ? el.dataset.shipIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  const G = n + 1;

  return (
    <div className="game game-ships">
      <GameHeader title="Battleships" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Find the hidden fleet ({fleet.join(" · ")}). Tap: ship → water → clear.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="tents-grid ships-grid drag-paint"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Battleships board"
        onPointerDown={(e) => {
          if (saved.done) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i === null || givenShip.has(i) || givenWater.has(i)) return;
          const v = ((saved.marks[i] + 1) % 3) as Mark;
          paint.current = v;
          apply(i, v, true);
        }}
        onPointerMove={(e) => {
          if (paint.current === null) return;
          const i = cellFromPoint(e.clientX, e.clientY);
          if (
            i !== null &&
            !givenShip.has(i) &&
            !givenWater.has(i) &&
            saved.marks[i] !== paint.current
          )
            apply(i, paint.current, false);
        }}
        onPointerUp={() => { paint.current = null; }}
        onPointerCancel={() => { paint.current = null; }}
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr === 0 && gc === 0) return <span key={k} />;
          if (gr === 0)
            return <span key={k} className="edge-count">{puzzle.cols[gc - 1]}</span>;
          if (gc === 0)
            return <span key={k} className="edge-count">{puzzle.rows[gr - 1]}</span>;
          const i = (gr - 1) * n + (gc - 1);
          const isShip = givenShip.has(i) || saved.marks[i] === 1;
          const isWater = givenWater.has(i) || saved.marks[i] === 2;
          const given = givenShip.has(i) || givenWater.has(i);
          return (
            <button
              key={k}
              data-ship-idx={i}
              role="gridcell"
              className={[
                "ships-cell",
                isShip ? "ship" : "",
                isWater ? "water" : "",
                given ? "given" : ""
              ].join(" ")}
            >
              {isShip ? "■" : isWater ? "≈" : ""}
            </button>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>■ {ships.size} / {fleet.reduce((a, b) => a + b, 0)}</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="ships"
          won
          message="Fleet found!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
