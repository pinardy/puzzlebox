import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 7, medium: 8, hard: 10 };
const TENTS: Record<Diff, number> = { easy: 8, medium: 10, hard: 14 };
const HELP =
  "Every tree owns exactly one tent, orthogonally beside it. Tents never " +
  "touch each other, not even diagonally, and the edge numbers count the " +
  "tents in each row and column. Mark grass to rule squares out; drag to " +
  "mark several.";

interface Puzzle {
  n: number;
  trees: number[];
  rows: number[];
  cols: number[];
}

/** Place tents (never touching, even diagonally), then a tree beside each,
 *  then read off the row/column tent counts. Solvable by construction. */
function generateTents(seed: string, n: number, tentCount: number): Puzzle {
  const rng = makeRng(seed);
  const orth = (i: number): number[] => {
    const r = Math.floor(i / n), c = i % n;
    const out: number[] = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  };
  const kings = (i: number): number[] => {
    const r = Math.floor(i / n), c = i % n;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
      }
    return out;
  };
  for (;;) {
    const used = new Set<number>();
    const tents: number[] = [];
    const trees: number[] = [];
    for (const cell of shuffled([...Array(n * n).keys()], rng)) {
      if (tents.length >= tentCount) break;
      if (used.has(cell)) continue;
      if (kings(cell).some((j) => tents.includes(j))) continue;
      const spots = shuffled(orth(cell).filter((j) => !used.has(j)), rng);
      if (!spots.length) continue;
      tents.push(cell);
      trees.push(spots[0]);
      used.add(cell);
      used.add(spots[0]);
    }
    if (tents.length < tentCount) continue;
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    for (const t of tents) { rows[Math.floor(t / n)]++; cols[t % n]++; }
    return { n, trees, rows, cols };
  }
}

/** Perfect matching tents ↔ adjacent trees, via augmenting paths. */
function tentsMatchTrees(n: number, tents: number[], trees: number[]): boolean {
  if (tents.length !== trees.length) return false;
  const treeIdx = new Map(trees.map((t, k) => [t, k]));
  const orth = (i: number): number[] => {
    const r = Math.floor(i / n), c = i % n;
    const out: number[] = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  };
  const adj = tents.map((t) =>
    orth(t).flatMap((j) => (treeIdx.has(j) ? [treeIdx.get(j)!] : []))
  );
  const matchTree: number[] = Array(trees.length).fill(-1);
  const tryMatch = (i: number, seen: boolean[]): boolean => {
    for (const k of adj[i]) {
      if (seen[k]) continue;
      seen[k] = true;
      if (matchTree[k] === -1 || tryMatch(matchTree[k], seen)) {
        matchTree[k] = i;
        return true;
      }
    }
    return false;
  };
  return tents.every((_, i) => tryMatch(i, Array(trees.length).fill(false)));
}

type Mark = 0 | 1 | 2; // empty | tent | grass

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Tents({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("tents", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(
    () => generateTents(`tents-${seed}`, n, TENTS[diff]),
    [seed, n, diff]
  );
  const treeSet = useMemo(() => new Set(puzzle.trees), [puzzle]);
  const paint = useRef<Mark | null>(null);

  const kings = (i: number): number[] => {
    const r = Math.floor(i / n), c = i % n;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
      }
    return out;
  };

  const tents = useMemo(
    () => saved.marks.flatMap((m, i) => (m === 1 ? [i] : [])),
    [saved.marks]
  );

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const t of tents)
      for (const j of kings(t))
        if (saved.marks[j] === 1) { bad.add(t); bad.add(j); }
    return bad;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tents, saved.marks, n]);

  useEffect(() => {
    if (saved.done || conflicts.size > 0) return;
    const rows = Array(n).fill(0), cols = Array(n).fill(0);
    for (const t of tents) { rows[Math.floor(t / n)]++; cols[t % n]++; }
    const countsOk =
      rows.every((v, r) => v === puzzle.rows[r]) &&
      cols.every((v, c) => v === puzzle.cols[c]);
    if (countsOk && tentsMatchTrees(n, tents, puzzle.trees)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("tents", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tents, conflicts, puzzle, saved, n]);

  function apply(i: number, v: Mark, undoable: boolean) {
    if (treeSet.has(i)) return;
    const marks = saved.marks.slice() as Mark[];
    marks[i] = v;
    commit({ ...saved, marks }, { undoable });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-tent-idx]");
    const v = el instanceof HTMLElement ? el.dataset.tentIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  const G = n + 1;

  return (
    <div className="game game-tents">
      <GameHeader title="Tents & Trees" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Pitch one tent beside every tree. Tap: tent → grass → clear.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="tents-grid drag-paint"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Tents board"
        onPointerDown={(e) => {
          if (saved.done) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i === null || treeSet.has(i)) return;
          const v = ((saved.marks[i] + 1) % 3) as Mark;
          paint.current = v;
          apply(i, v, true);
        }}
        onPointerMove={(e) => {
          if (paint.current === null) return;
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i !== null && !treeSet.has(i) && saved.marks[i] !== paint.current)
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
          const tree = treeSet.has(i);
          const m = saved.marks[i];
          return (
            <button
              key={k}
              data-tent-idx={i}
              role="gridcell"
              className={[
                "tents-cell",
                tree ? "tree" : "",
                m === 1 ? "tent" : m === 2 ? "grass" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
            >
              {tree ? "🌳" : m === 1 ? "⛺" : m === 2 ? "·" : ""}
            </button>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>⛺ {tents.length} / {puzzle.trees.length}</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="tents"
          won
          message="Camp pitched!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
