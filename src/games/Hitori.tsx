import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { generateLatin, floodCount } from "../lib/latin";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 6;
const SHADED = 8;

const orth = (i: number): number[] => {
  const r = Math.floor(i / N), c = i % N;
  const out: number[] = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
};

/** Start from a Latin square (no duplicates anywhere), pick a valid shading
 *  (non-adjacent, leaves the rest connected), then overwrite each shaded
 *  cell with a duplicate of an unshaded row/column mate. Shading those
 *  cells again is therefore always a solution; any valid one is accepted. */
function generateHitori(seed: string): number[] {
  const grid = generateLatin(`hitori-${seed}`, N);
  const rng = makeRng(`hitori-shade-${seed}`);

  const shaded = new Set<number>();
  for (const i of shuffled([...Array(N * N).keys()], rng)) {
    if (shaded.size >= SHADED) break;
    if (orth(i).some((j) => shaded.has(j))) continue;
    const open = Array(N * N).fill(true);
    for (const s of shaded) open[s] = false;
    open[i] = false;
    const start = open.indexOf(true);
    if (floodCount(open, N, start) !== N * N - shaded.size - 1) continue;
    shaded.add(i);
  }

  for (const i of shaded) {
    const r = Math.floor(i / N), c = i % N;
    const mates: number[] = [];
    for (let k = 0; k < N; k++) {
      const row = r * N + k, col = k * N + c;
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

function fresh(): SavedState {
  return { marks: Array(N * N).fill(0) as Mark[], done: false };
}

export default function Hitori({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("hitori")?.seed ?? newSeed()
  );
  const grid = useMemo(() => generateHitori(seed), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("hitori")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  /** Only rule breaks the player caused: two shaded cells touching.
   *  Remaining duplicates are the puzzle itself, not an error state. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < N * N; i++) {
      if (saved.marks[i] !== 1) continue;
      for (const j of orth(i)) if (saved.marks[j] === 1) { bad.add(i); bad.add(j); }
    }
    return bad;
  }, [saved.marks]);

  const solved = useMemo(() => {
    if (conflicts.size > 0) return false;
    const shadedCount = saved.marks.filter((m) => m === 1).length;
    if (shadedCount === 0) return false;
    for (let i = 0; i < N * N; i++) {
      if (saved.marks[i] === 1) continue;
      const r = Math.floor(i / N), c = i % N;
      for (let k = 0; k < N; k++) {
        const row = r * N + k, col = k * N + c;
        if (row !== i && saved.marks[row] !== 1 && grid[row] === grid[i]) return false;
        if (col !== i && saved.marks[col] !== 1 && grid[col] === grid[i]) return false;
      }
    }
    const open = saved.marks.map((m) => m !== 1);
    const start = open.indexOf(true);
    return floodCount(open, N, start) === N * N - shadedCount;
  }, [saved.marks, conflicts, grid]);

  useEffect(() => {
    if (!saved.done && solved) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("hitori", seed, next);
      recordResult("hitori", true);
      setToast("All duplicates shaded away!");
    }
  }, [solved, saved, seed]);

  function tap(idx: number) {
    if (saved.done) return;
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = ((marks[idx] + 1) % 3) as Mark;
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("hitori", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("hitori", s, fresh());
    setToast(null);
  }

  return (
    <div className="game game-hitori">
      <GameHeader title="Hitori" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Shade cells so no number repeats in a row or column. Shaded cells may
        not touch, and the rest must stay connected. Tap: shade → circle →
        clear.
      </p>

      <div
        className="hitori-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Hitori board"
      >
        {grid.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "hitori-cell",
              saved.marks[i] === 1 ? "shaded" : "",
              saved.marks[i] === 2 ? "circled" : "",
              conflicts.has(i) ? "conflict" : ""
            ].join(" ")}
            onClick={() => tap(i)}
          >
            {v}
          </button>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>▩ {saved.marks.filter((m) => m === 1).length} shaded</span>
        <button
          className="mini-btn"
          onClick={() => {
            const next = fresh();
            setSaved(next);
            saveSlot("hitori", seed, next);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
