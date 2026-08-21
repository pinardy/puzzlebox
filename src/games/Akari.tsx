import { useEffect, useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const HELP =
  "Place bulbs so every white cell is lit. A bulb lights its whole row and " +
  "column until a wall — and no bulb may shine on another. A numbered wall " +
  "must have exactly that many bulbs beside it. Tap: bulb → dot → clear.";

interface Puzzle {
  n: number;
  walls: boolean[];
  numbers: Map<number, number>; // wall cell → adjacent-bulb count
}

/** Cells a bulb at `i` shines on (until walls), excluding itself. */
function beam(i: number, n: number, walls: boolean[]): number[] {
  const out: number[] = [];
  const r = Math.floor(i / n), c = i % n;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < n && cc >= 0 && cc < n && !walls[rr * n + cc]) {
      out.push(rr * n + cc);
      rr += dr;
      cc += dc;
    }
  }
  return out;
}

/** Generate by placing a valid bulb set first: greedy non-conflicting
 *  bulbs, then fill any still-dark cell (a dark cell can always take a
 *  bulb). Numbers go on a subset of walls. Solvable by construction. */
function generateAkari(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);
  const walls = Array(n * n).fill(false);
  for (let i = 0; i < n * n; i++) if (rng() < 0.2) walls[i] = true;

  const bulbs = new Set<number>();
  const lit = new Set<number>();
  const place = (i: number) => {
    bulbs.add(i);
    lit.add(i);
    for (const j of beam(i, n, walls)) lit.add(j);
  };
  for (const i of shuffled([...Array(n * n).keys()], rng)) {
    if (walls[i] || lit.has(i)) continue;
    if (rng() < 0.45) place(i);
  }
  for (let i = 0; i < n * n; i++) if (!walls[i] && !lit.has(i)) place(i);

  const numbers = new Map<number, number>();
  for (let i = 0; i < n * n; i++) {
    if (!walls[i]) continue;
    const r = Math.floor(i / n), c = i % n;
    let count = 0;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && bulbs.has(rr * n + cc)) count++;
    }
    if (rng() < 0.6) numbers.set(i, count);
  }
  return { n, walls, numbers };
}

type Mark = 0 | 1 | 2; // empty | bulb | dot

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Akari({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("akari", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateAkari(`akari-${seed}`, n), [seed, n]);

  const bulbs = useMemo(
    () => saved.marks.flatMap((m, i) => (m === 1 ? [i] : [])),
    [saved.marks]
  );

  const lit = useMemo(() => {
    const s = new Set<number>();
    for (const b of bulbs) {
      s.add(b);
      for (const j of beam(b, n, puzzle.walls)) s.add(j);
    }
    return s;
  }, [bulbs, puzzle, n]);

  /** Bulbs that shine on each other. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const b of bulbs)
      for (const j of beam(b, n, puzzle.walls))
        if (saved.marks[j] === 1) { bad.add(b); bad.add(j); }
    return bad;
  }, [bulbs, saved.marks, puzzle, n]);

  useEffect(() => {
    if (saved.done || conflicts.size > 0) return;
    const allLit = puzzle.walls.every((w, i) => w || lit.has(i));
    if (!allLit) return;
    for (const [wall, want] of puzzle.numbers) {
      const r = Math.floor(wall / n), c = wall % n;
      let count = 0;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && saved.marks[rr * n + cc] === 1)
          count++;
      }
      if (count !== want) return;
    }
    commit({ ...saved, done: true }, { undoable: false });
    recordResult("akari", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit, conflicts, puzzle, saved, n]);

  function tap(i: number) {
    if (saved.done || puzzle.walls[i]) return;
    const marks = saved.marks.slice() as Mark[];
    marks[i] = ((marks[i] + 1) % 3) as Mark;
    commit({ ...saved, marks });
  }

  return (
    <div className="game game-akari">
      <GameHeader title="Light Up" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Light every cell; bulbs may not shine on each other. Numbers count
        adjacent bulbs.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="akari-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Light Up board"
      >
        {saved.marks.map((m, i) => {
          if (puzzle.walls[i]) {
            const num = puzzle.numbers.get(i);
            return (
              <span key={i} className="akari-wall">
                {num ?? ""}
              </span>
            );
          }
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "akari-cell",
                lit.has(i) ? "lit" : "",
                m === 1 ? "bulb" : m === 2 ? "dot" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {m === 1 ? "💡" : m === 2 ? "·" : ""}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="akari"
          won
          message="All lit up!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
