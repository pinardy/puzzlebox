import { useEffect, useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { hamiltonianPath } from "../lib/zip";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const HELP =
  "Every cell belongs to a thermometer. Mercury fills from the round bulb " +
  "towards the tip, never with gaps. Edge numbers count the filled cells " +
  "in each row and column. Tap a cell to fill up to it; tap a filled cell " +
  "to drain back to it.";

interface Thermo {
  cells: number[]; // bulb first
}

interface Puzzle {
  n: number;
  thermos: Thermo[];
  rows: number[];
  cols: number[];
}

/** Snake a Hamiltonian path through the grid and cut it into thermometers,
 *  then pick a fill level per thermometer and read off the row/column
 *  counts. Solvable by construction. */
function generateThermo(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);
  const path = hamiltonianPath(n, rng);
  const thermos: Thermo[] = [];
  let at = 0;
  while (at < path.length) {
    let len = 2 + Math.floor(rng() * 3); // 2–4
    const left = path.length - at;
    if (left - len === 1) len = left; // never strand a 1-cell tail
    len = Math.min(len, left);
    thermos.push({ cells: path.slice(at, at + len) });
    at += len;
  }

  const rows = Array(n).fill(0), cols = Array(n).fill(0);
  for (const t of thermos) {
    const fill = Math.floor(rng() * (t.cells.length + 1));
    for (const i of t.cells.slice(0, fill)) {
      rows[Math.floor(i / n)]++;
      cols[i % n]++;
    }
  }
  return { n, thermos, rows, cols };
}

interface SavedState {
  fills: number[]; // per thermometer: filled cells from the bulb
  done: boolean;
}

function dirClass(from: number, to: number, n: number): string {
  const d = to - from;
  if (d === 1) return "r";
  if (d === -1) return "l";
  if (d === n) return "d";
  return "u";
}

export default function Thermometers({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("thermo", (s, d) => {
      const p = generateThermo(`thermo-${s}`, SIZE[d]);
      return { fills: Array(p.thermos.length).fill(0), done: false };
    });
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateThermo(`thermo-${seed}`, n), [seed, n]);

  /** cell → {thermo index, position, arms} */
  const cellInfo = useMemo(() => {
    const map = new Map<number, { t: number; p: number; arms: string[] }>();
    puzzle.thermos.forEach((th, t) => {
      th.cells.forEach((i, p) => {
        const arms: string[] = [];
        if (p > 0) arms.push(dirClass(i, th.cells[p - 1], n));
        if (p < th.cells.length - 1) arms.push(dirClass(i, th.cells[p + 1], n));
        map.set(i, { t, p, arms });
      });
    });
    return map;
  }, [puzzle, n]);

  const counts = useMemo(() => {
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    puzzle.thermos.forEach((th, t) => {
      for (const i of th.cells.slice(0, saved.fills[t])) {
        rows[Math.floor(i / n)]++;
        cols[i % n]++;
      }
    });
    return { rows, cols };
  }, [puzzle, saved.fills, n]);

  useEffect(() => {
    if (saved.done) return;
    const ok =
      counts.rows.every((v, r) => v === puzzle.rows[r]) &&
      counts.cols.every((v, c) => v === puzzle.cols[c]);
    if (ok) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("thermo", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, puzzle, saved]);

  function tap(i: number) {
    if (saved.done) return;
    const info = cellInfo.get(i);
    if (!info) return;
    const fills = saved.fills.slice();
    fills[info.t] = fills[info.t] > info.p ? info.p : info.p + 1;
    commit({ ...saved, fills });
  }

  const G = n + 1;
  const countClass = (got: number, want: number) =>
    `edge-count${got === want ? " ok" : got > want ? " bad" : ""}`;

  return (
    <div className="game game-thermo">
      <GameHeader title="Thermometers" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Fill from the bulb to match the row and column counts.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="tents-grid thermo-grid"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Thermometers board"
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
          const info = cellInfo.get(i)!;
          const filled = saved.fills[info.t] > info.p;
          return (
            <button
              key={k}
              role="gridcell"
              className={[
                "thermo-cell",
                filled ? "filled" : "",
                info.p === 0 ? "bulb" : ""
              ].join(" ")}
              onClick={() => tap(i)}
              aria-label={`Thermometer cell${filled ? ", filled" : ""}`}
            >
              {info.arms.map((a) => (
                <span key={a} className={`th-arm arm-${a}`} />
              ))}
              <span className="th-core" />
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="thermo"
          won
          message="Temperatures balanced!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
