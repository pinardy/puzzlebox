import { useMemo, useRef, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { hamiltonianPath, areAdjacent } from "../lib/zip";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const HELP =
  "Join each pair of matching dots with a pipe by dragging between them. " +
  "Pipes can't cross or share squares, and when everything is connected " +
  "every square must be covered.";
const COLORS = ["#e05252", "#3b6fe0", "#2e9e6b", "#e0a23b", "#7857c9", "#e06fb2", "#8a5a2b"];

interface Puzzle {
  ends: [number, number][];
}

/** Cut one Hamiltonian path into segments — the segment ends become the
 *  dot pairs, so a full-grid solution exists by construction. */
function generateFlow(seed: string, n: number, pipes: number): Puzzle {
  const rng = makeRng(seed);
  const path = hamiltonianPath(n, rng);
  const lens: number[] = [];
  let left = path.length;
  for (let k = pipes; k > 1; k--) {
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

export default function Flow({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "flow",
    () => ({ paths: {}, done: false })
  );
  const n = SIZE[diff];
  const pipes = SIZE[diff];
  const { ends } = useMemo(
    () => generateFlow(`flow-${seed}`, n, pipes),
    [seed, n, pipes]
  );
  const active = useRef<number | null>(null);
  const dragging = useRef(false);

  const endColor = useMemo(() => {
    const map = new Map<number, number>();
    ends.forEach(([a, b], c) => { map.set(a, c); map.set(b, c); });
    return map;
  }, [ends]);

  const pipeAt = useMemo(() => {
    const map = new Map<number, number>();
    for (const [c, cells] of Object.entries(saved.paths))
      for (const i of cells) map.set(i, Number(c));
    return map;
  }, [saved.paths]);

  function apply(paths: Paths) {
    const covered = new Set<number>();
    for (const cells of Object.values(paths)) cells.forEach((i) => covered.add(i));
    const complete = ends.every(([a, b], c) => {
      const p = paths[c];
      return p && p.length > 1 &&
        ((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a));
    });
    const done = complete && covered.size === n * n;
    commit({ paths, done }, { undoable: false }); // drawing has its own rewind
    if (done && !saved.done) recordResult("flow", true);
  }

  function startAt(idx: number) {
    const c = endColor.get(idx);
    if (c !== undefined) {
      active.current = c;
      apply({ ...saved.paths, [c]: [idx] });
      return;
    }
    const on = pipeAt.get(idx);
    if (on !== undefined) {
      const p = saved.paths[on];
      const at = p.indexOf(idx);
      active.current = on;
      apply({ ...saved.paths, [on]: p.slice(0, at + 1) });
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

    const at = p.indexOf(idx);
    if (at !== -1) {
      apply({ ...saved.paths, [c]: p.slice(0, at + 1) });
      return;
    }
    if (!areAdjacent(head, idx, n)) return;
    const owner = pipeAt.get(idx);
    if (owner !== undefined && owner !== c) return;
    const endOwner = endColor.get(idx);
    if (endOwner !== undefined && endOwner !== c) return;
    apply({ ...saved.paths, [c]: [...p, idx] });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-flow-idx]");
    const v = el instanceof HTMLElement ? el.dataset.flowIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    active.current = null;
  }

  const covered = pipeAt.size;

  return (
    <div className="game game-flow">
      <GameHeader title="Flow" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Drag to join each pair of dots with a pipe. Fill every square.
      </p>
      <GameTools diff={diff} onDiff={startNew} help={HELP} />

      <div
        className="flow-grid"
        style={{ "--n": n } as CSSProperties}
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
        {Array.from({ length: n * n }).map((_, i) => {
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

      <div className="lights-meta">
        <span>{covered} / {n * n} filled</span>
        <button
          className="mini-btn"
          onClick={() => { apply({}); active.current = null; }}
        >
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="flow"
          won
          message="Everything flows!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
