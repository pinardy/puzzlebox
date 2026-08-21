import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 9 };
const HUES = [
  "#f5c8c4", "#c6def5", "#cdeccf", "#f5e9b8", "#e0d2f2",
  "#f7d8b4", "#c6ecec", "#dbe6c3", "#e6ddd0", "#f3d4e6",
  "#d4e6f3", "#e6f3d4"
];
const HELP =
  "Divide the grid into galaxies: each dot owns one region that is " +
  "rotationally symmetric — spin it 180° about its dot and it lands on " +
  "itself. Tap a dot to choose its galaxy, then paint cells into it (tap a " +
  "painted cell again to clear it). Every cell belongs to exactly one " +
  "galaxy.";

/** Centres use doubled coordinates: cell (r,c) has centre (2r+1, 2c+1), so
 *  edge midpoints and corners are integers too. */
interface Puzzle {
  n: number;
  dots: [number, number][]; // (y, x) in doubled coordinates
}

function mirrorCell(i: number, n: number, cy: number, cx: number): number | null {
  const r = Math.floor(i / n), c = i % n;
  const my = 2 * cy - (2 * r + 1), mx = 2 * cx - (2 * c + 1);
  if (my < 1 || mx < 1 || my > 2 * n - 1 || mx > 2 * n - 1) return null;
  if (my % 2 === 0 || mx % 2 === 0) return null;
  return ((my - 1) / 2) * n + (mx - 1) / 2;
}

/** Cells that contain the dot point — they must belong to its galaxy. */
function dotCells(n: number, cy: number, cx: number): number[] {
  const rows = cy % 2 === 1 ? [(cy - 1) / 2] : [cy / 2 - 1, cy / 2];
  const cols = cx % 2 === 1 ? [(cx - 1) / 2] : [cx / 2 - 1, cx / 2];
  const out: number[] = [];
  for (const r of rows)
    for (const c of cols)
      if (r >= 0 && r < n && c >= 0 && c < n) out.push(r * n + c);
  return out;
}

/** Grow 180°-symmetric regions; every leftover cell becomes its own tiny
 *  galaxy. The construction is a valid solution, so the puzzle is solvable
 *  by construction; any valid partition wins. */
function generateGalaxies(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);
  const owner = Array(n * n).fill(-1);
  const dots: [number, number][] = [];

  for (const start of shuffled([...Array(n * n).keys()], rng)) {
    if (owner[start] !== -1) continue;
    const r = Math.floor(start / n), c = start % n;

    // Pick a centre: the cell itself, an edge with a free neighbour, or a
    // free 2×2 corner — whichever the roll allows.
    const options: [number, number][] = [[2 * r + 1, 2 * c + 1]];
    if (c < n - 1 && owner[start + 1] === -1)
      options.push([2 * r + 1, 2 * c + 2]);
    if (r < n - 1 && owner[start + n] === -1)
      options.push([2 * r + 2, 2 * c + 1]);
    if (
      r < n - 1 && c < n - 1 &&
      owner[start + 1] === -1 && owner[start + n] === -1 && owner[start + n + 1] === -1
    )
      options.push([2 * r + 2, 2 * c + 2]);
    const [cy, cx] = options[Math.floor(rng() * options.length)];

    const id = dots.length;
    const cells: number[] = [];
    for (const i of dotCells(n, cy, cx)) {
      owner[i] = id;
      cells.push(i);
    }

    const target = cells.length + 2 * Math.floor(rng() * 4);
    while (cells.length < target) {
      const frontier: number[] = [];
      for (const i of cells) {
        const rr = Math.floor(i / n), cc = i % n;
        for (const j of [i - n, i + n, i - 1, i + 1]) {
          const jr = Math.floor(j / n), jc = j % n;
          if (j < 0 || j >= n * n) continue;
          if (Math.abs(jr - rr) + Math.abs(jc - cc) !== 1) continue;
          if (owner[j] !== -1) continue;
          const m = mirrorCell(j, n, cy, cx);
          if (m === null || (owner[m] !== -1 && m !== j)) continue;
          frontier.push(j);
        }
      }
      if (!frontier.length) break;
      const pick = frontier[Math.floor(rng() * frontier.length)];
      const m = mirrorCell(pick, n, cy, cx)!;
      owner[pick] = id;
      cells.push(pick);
      if (m !== pick) {
        owner[m] = id;
        cells.push(m);
      }
    }
    dots.push([cy, cx]);
  }
  return { n, dots };
}

interface SavedState {
  assign: number[]; // cell → galaxy index, -1 unassigned
  done: boolean;
}

export default function Galaxies({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("galaxies", (_s, d) => ({
      assign: Array(SIZE[d] * SIZE[d]).fill(-1),
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateGalaxies(`galaxies-${seed}`, n), [seed, n]);
  const [sel, setSel] = useState(0);
  const paint = useRef<number | null>(null);

  const solvedNow = useMemo(() => {
    if (saved.assign.some((g) => g === -1)) return false;
    for (let g = 0; g < puzzle.dots.length; g++) {
      const [cy, cx] = puzzle.dots[g];
      const cells = saved.assign.flatMap((v, i) => (v === g ? [i] : []));
      if (!cells.length) return false;
      // The dot's cells belong to it.
      if (!dotCells(n, cy, cx).every((i) => saved.assign[i] === g)) return false;
      // 180° symmetry.
      const set = new Set(cells);
      for (const i of cells) {
        const m = mirrorCell(i, n, cy, cx);
        if (m === null || !set.has(m)) return false;
      }
      // Connectivity.
      const seen = new Set([cells[0]]);
      const stack = [cells[0]];
      while (stack.length) {
        const i = stack.pop()!;
        const r = Math.floor(i / n), c = i % n;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          const j = rr * n + cc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && set.has(j) && !seen.has(j)) {
            seen.add(j);
            stack.push(j);
          }
        }
      }
      if (seen.size !== cells.length) return false;
    }
    return true;
  }, [saved.assign, puzzle, n]);

  useEffect(() => {
    if (!saved.done && solvedNow) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("galaxies", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvedNow, saved]);

  function apply(i: number, g: number, undoable: boolean) {
    const assign = saved.assign.slice();
    assign[i] = g;
    commit({ ...saved, assign }, { undoable });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-gal-idx]");
    const v = el instanceof HTMLElement ? el.dataset.galIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSel(0);
  }

  const assigned = saved.assign.filter((g) => g !== -1).length;

  return (
    <div className="game game-galaxies">
      <GameHeader title="Galaxies" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap a dot to pick its galaxy, then paint its cells — each galaxy is
        180° symmetric about its dot.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="gal-wrap"
        style={{ "--n": n } as CSSProperties}
      >
        <div
          className="gal-grid drag-paint"
          role="grid"
          aria-label="Galaxies board"
          onPointerDown={(e) => {
            if (saved.done) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            const i = cellFromPoint(e.clientX, e.clientY);
            if (i === null) return;
            const v = saved.assign[i] === sel ? -1 : sel;
            paint.current = v;
            apply(i, v, true);
          }}
          onPointerMove={(e) => {
            if (paint.current === null) return;
            const i = cellFromPoint(e.clientX, e.clientY);
            if (i !== null && saved.assign[i] !== paint.current)
              apply(i, paint.current, false);
          }}
          onPointerUp={() => { paint.current = null; }}
          onPointerCancel={() => { paint.current = null; }}
        >
          {saved.assign.map((g, i) => {
            const r = Math.floor(i / n), c = i % n;
            return (
              <button
                key={i}
                data-gal-idx={i}
                role="gridcell"
                className={[
                  "gal-cell",
                  g === sel && g !== -1 ? "current" : "",
                  r > 0 && saved.assign[i - n] !== g ? "cage-t" : "",
                  c > 0 && saved.assign[i - 1] !== g ? "cage-l" : ""
                ].join(" ")}
                style={
                  g !== -1
                    ? ({ background: HUES[g % HUES.length] } as CSSProperties)
                    : undefined
                }
                tabIndex={-1}
              />
            );
          })}
        </div>
        {puzzle.dots.map(([cy, cx], g) => (
          <button
            key={g}
            className={`gal-dot${sel === g ? " selected" : ""}`}
            style={
              {
                top: `${(cy / (2 * n)) * 100}%`,
                left: `${(cx / (2 * n)) * 100}%`
              } as CSSProperties
            }
            onClick={() => setSel(g)}
            aria-label={`Galaxy ${g + 1}${sel === g ? ", selected" : ""}`}
          />
        ))}
      </div>

      <div className="lights-meta">
        <span>
          {assigned}/{n * n} cells placed · galaxy {sel + 1} of {puzzle.dots.length}
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="galaxies"
          won
          message="A perfectly symmetric sky!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
