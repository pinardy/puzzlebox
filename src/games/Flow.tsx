import { useMemo, useRef, useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { hamiltonianPath, areAdjacent } from "../lib/zip";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 6;
const PIPES = 6;
const COLORS = ["#e05252", "#3b6fe0", "#2e9e6b", "#e0a23b", "#7857c9", "#e06fb2"];

interface Puzzle {
  /** endpoint pairs per colour */
  ends: [number, number][];
}

/** Cut one Hamiltonian path into segments — the segment ends become the
 *  dot pairs, so a full-grid solution exists by construction. */
function generateFlow(seed: string): Puzzle {
  const rng = makeRng(seed);
  const path = hamiltonianPath(N, rng);
  // Random segment lengths ≥ 3 summing to the path length.
  const lens: number[] = [];
  let left = path.length;
  for (let k = PIPES; k > 1; k--) {
    const max = left - 3 * (k - 1);
    const len = 3 + Math.floor(rng() * (max - 2));
    lens.push(len);
    left -= len;
  }
  lens.push(left);
  const ends: [number, number][] = [];
  let at = 0;
  for (const len of lens) {
    ends.push([path[at], path[at + len - 1]]);
    at += len;
  }
  return { ends };
}

type Paths = Record<number, number[]>; // colour → path of cells

interface SavedState {
  paths: Paths;
  done: boolean;
}

const FRESH: SavedState = { paths: {}, done: false };

export default function Flow({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("flow")?.seed ?? newSeed()
  );
  const { ends } = useMemo(() => generateFlow(`flow-${seed}`), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("flow")?.state ?? FRESH
  );
  const [toast, setToast] = useState<string | null>(null);
  const active = useRef<number | null>(null);
  const dragging = useRef(false);

  const endColor = useMemo(() => {
    const map = new Map<number, number>();
    ends.forEach(([a, b], c) => { map.set(a, c); map.set(b, c); });
    return map;
  }, [ends]);

  /** cell → colour of the pipe over it */
  const pipeAt = useMemo(() => {
    const map = new Map<number, number>();
    for (const [c, cells] of Object.entries(saved.paths))
      for (const i of cells) map.set(i, Number(c));
    return map;
  }, [saved.paths]);

  function commit(paths: Paths) {
    const covered = new Set<number>();
    for (const cells of Object.values(paths)) cells.forEach((i) => covered.add(i));
    const complete = ends.every(([a, b], c) => {
      const p = paths[c];
      return p && p.length > 1 &&
        ((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a));
    });
    const done = complete && covered.size === N * N;
    const next = { paths, done };
    setSaved(next);
    saveSlot("flow", seed, next);
    if (done && !saved.done) {
      recordResult("flow", true);
      setToast("Everything flows!");
    }
  }

  function startAt(idx: number) {
    const c = endColor.get(idx);
    if (c !== undefined) {
      active.current = c;
      commit({ ...saved.paths, [c]: [idx] });
      return;
    }
    const on = pipeAt.get(idx);
    if (on !== undefined) {
      const p = saved.paths[on];
      const at = p.indexOf(idx);
      active.current = on;
      commit({ ...saved.paths, [on]: p.slice(0, at + 1) });
    }
  }

  function extend(idx: number) {
    const c = active.current;
    if (c === null) return;
    const p = saved.paths[c] ?? [];
    if (!p.length) return;
    const head = p[p.length - 1];
    if (idx === head) return;
    const [a, b] = ends[c];
    const connectsBoth =
      p.length > 1 &&
      ((p[0] === a && head === b) || (p[0] === b && head === a));
    if (connectsBoth) return;

    // Rewind along own path
    const at = p.indexOf(idx);
    if (at !== -1) {
      commit({ ...saved.paths, [c]: p.slice(0, at + 1) });
      return;
    }
    if (!areAdjacent(head, idx, N)) return;
    const owner = pipeAt.get(idx);
    if (owner !== undefined && owner !== c) return; // occupied by another pipe
    const endOwner = endColor.get(idx);
    if (endOwner !== undefined && endOwner !== c) return; // someone else's dot
    commit({ ...saved.paths, [c]: [...p, idx] });
  }

  function cellFromPoint(x: number, y: number): number | null {
    // The dot/fill spans sit on top of the cell — climb to the cell itself.
    const el = document.elementFromPoint(x, y)?.closest("[data-flow-idx]");
    const v = el instanceof HTMLElement ? el.dataset.flowIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(FRESH);
    saveSlot("flow", s, FRESH);
    active.current = null;
    setToast(null);
  }

  const covered = pipeAt.size;

  return (
    <div className="game game-flow">
      <GameHeader title="Flow" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Drag to join each pair of dots with a pipe. Pipes can't cross, and
        every square must be filled.
      </p>

      <div
        className="flow-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Flow board"
        onPointerDown={(e) => {
          if (saved.done) return;
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const idx = cellFromPoint(e.clientX, e.clientY);
          if (idx !== null) startAt(idx);
        }}
        onPointerMove={(e) => {
          if (!dragging.current || saved.done) return;
          const idx = cellFromPoint(e.clientX, e.clientY);
          if (idx !== null) extend(idx);
        }}
        onPointerUp={() => { dragging.current = false; active.current = null; }}
        onPointerCancel={() => { dragging.current = false; active.current = null; }}
      >
        {Array.from({ length: N * N }).map((_, i) => {
          const dot = endColor.get(i);
          const pipe = pipeAt.get(i);
          return (
            <div
              key={i}
              role="gridcell"
              data-flow-idx={i}
              className="flow-cell"
              style={
                pipe !== undefined
                  ? ({ "--pipe": COLORS[pipe] } as CSSProperties)
                  : undefined
              }
            >
              {pipe !== undefined && <span className="flow-fill" />}
              {dot !== undefined && (
                <span className="flow-dot" style={{ background: COLORS[dot] }} />
              )}
            </div>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>{covered} / {N * N} filled</span>
        <button
          className="mini-btn"
          onClick={() => { commit({}); active.current = null; }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
