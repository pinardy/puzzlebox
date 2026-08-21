import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 8;
const TENTS = 10;

const orth = (i: number): number[] => {
  const r = Math.floor(i / N), c = i % N;
  const out: number[] = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
};

const kings = (i: number): number[] => {
  const r = Math.floor(i / N), c = i % N;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
  return out;
};

interface Puzzle {
  trees: number[];
  rows: number[];
  cols: number[];
}

/** Place tents (never touching, even diagonally), then a tree beside each,
 *  then read off the row/column tent counts. Solvable by construction. */
function generateTents(seed: string): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const used = new Set<number>();
    const tents: number[] = [];
    const trees: number[] = [];
    for (const cell of shuffled([...Array(N * N).keys()], rng)) {
      if (tents.length >= TENTS) break;
      if (used.has(cell)) continue;
      if (kings(cell).some((j) => tents.includes(j))) continue;
      const spots = shuffled(orth(cell).filter((j) => !used.has(j)), rng);
      if (!spots.length) continue;
      tents.push(cell);
      trees.push(spots[0]);
      used.add(cell);
      used.add(spots[0]);
    }
    if (tents.length < TENTS) continue;
    const rows = Array(N).fill(0), cols = Array(N).fill(0);
    for (const t of tents) { rows[Math.floor(t / N)]++; cols[t % N]++; }
    return { trees, rows, cols };
  }
}

/** Perfect matching tents ↔ adjacent trees, via augmenting paths. */
function tentsMatchTrees(tents: number[], trees: number[]): boolean {
  if (tents.length !== trees.length) return false;
  const treeIdx = new Map(trees.map((t, k) => [t, k]));
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

function fresh(): SavedState {
  return { marks: Array(N * N).fill(0) as Mark[], done: false };
}

export default function Tents({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("tents")?.seed ?? newSeed()
  );
  const puzzle = useMemo(() => generateTents(`tents-${seed}`), [seed]);
  const treeSet = useMemo(() => new Set(puzzle.trees), [puzzle]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("tents")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  const tents = useMemo(
    () => saved.marks.flatMap((m, i) => (m === 1 ? [i] : [])),
    [saved.marks]
  );

  /** Player-visible mistakes: touching tents only. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const t of tents)
      for (const j of kings(t))
        if (saved.marks[j] === 1) { bad.add(t); bad.add(j); }
    return bad;
  }, [tents, saved.marks]);

  useEffect(() => {
    if (saved.done || conflicts.size > 0) return;
    const rows = Array(N).fill(0), cols = Array(N).fill(0);
    for (const t of tents) { rows[Math.floor(t / N)]++; cols[t % N]++; }
    const countsOk =
      rows.every((v, r) => v === puzzle.rows[r]) &&
      cols.every((v, c) => v === puzzle.cols[c]);
    if (countsOk && tentsMatchTrees(tents, puzzle.trees)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("tents", seed, next);
      recordResult("tents", true);
      setToast("Camp pitched!");
    }
  }, [tents, conflicts, puzzle, saved, seed]);

  function tap(idx: number) {
    if (saved.done || treeSet.has(idx)) return;
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = ((marks[idx] + 1) % 3) as Mark;
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("tents", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("tents", s, fresh());
    setToast(null);
  }

  const G = N + 1;

  return (
    <div className="game game-tents">
      <GameHeader title="Tents & Trees" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Pitch one tent beside every tree — orthogonally. Tents never touch,
        even diagonally; edge numbers count tents per row and column.
      </p>

      <div
        className="tents-grid"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Tents board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr === 0 && gc === 0) return <span key={k} />;
          if (gr === 0)
            return <span key={k} className="edge-count">{puzzle.cols[gc - 1]}</span>;
          if (gc === 0)
            return <span key={k} className="edge-count">{puzzle.rows[gr - 1]}</span>;
          const i = (gr - 1) * N + (gc - 1);
          const tree = treeSet.has(i);
          const m = saved.marks[i];
          return (
            <button
              key={k}
              role="gridcell"
              className={[
                "tents-cell",
                tree ? "tree" : "",
                m === 1 ? "tent" : m === 2 ? "grass" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {tree ? "🌳" : m === 1 ? "⛺" : m === 2 ? "·" : ""}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>⛺ {tents.length} / {puzzle.trees.length}</span>
      </div>
    </div>
  );
}
