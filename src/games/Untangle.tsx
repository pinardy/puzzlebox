import { useMemo, useRef, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const NODES: Record<Diff, number> = { easy: 8, medium: 12, hard: 16 };
const HELP =
  "Drag the dots until no two lines cross. Crossing lines glow red. The " +
  "tangle always comes from a flat drawing, so a crossing-free layout " +
  "always exists — usually many.";

interface Edge {
  a: number;
  b: number;
}

/** Greedy planar graph: scatter points, then accept edges shortest-first
 *  when they don't cross an accepted edge. The scatter is a valid
 *  solution, so the scrambled puzzle is always untangleable. */
function generateGraph(seed: string, n: number): { edges: Edge[]; start: number[] } {
  const rng = makeRng(seed);
  const px: number[] = [];
  const py: number[] = [];
  while (px.length < n) {
    const x = 0.1 + rng() * 0.8;
    const y = 0.1 + rng() * 0.8;
    if (px.every((qx, i) => (qx - x) ** 2 + (py[i] - y) ** 2 > 0.03)) {
      px.push(x);
      py.push(y);
    }
  }
  const pairs: { a: number; b: number; d: number }[] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      pairs.push({ a, b, d: (px[a] - px[b]) ** 2 + (py[a] - py[b]) ** 2 });
  pairs.sort((u, v) => u.d - v.d);

  const edges: Edge[] = [];
  for (const { a, b } of pairs) {
    const clash = edges.some(
      (e) =>
        e.a !== a && e.a !== b && e.b !== a && e.b !== b &&
        segsCross(px[a], py[a], px[b], py[b], px[e.a], py[e.a], px[e.b], py[e.b])
    );
    if (!clash) edges.push({ a, b });
  }

  // Scramble: vertices around a circle in random order — a classic messy
  // starting shape with plenty of crossings.
  const order = shuffled([...Array(n).keys()], rng);
  const start: number[] = Array(n * 2);
  order.forEach((v, k) => {
    const ang = (k / n) * Math.PI * 2;
    start[v * 2] = 0.5 + 0.4 * Math.cos(ang);
    start[v * 2 + 1] = 0.5 + 0.4 * Math.sin(ang);
  });
  return { edges, start };
}

/** Proper segment intersection (shared endpoints don't count). */
function segsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const cross = (ox: number, oy: number, ux: number, uy: number, vx: number, vy: number) =>
    (ux - ox) * (vy - oy) - (uy - oy) * (vx - ox);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function crossingEdges(pos: number[], edges: Edge[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i], f = edges[j];
      if (e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b) continue;
      if (
        segsCross(
          pos[e.a * 2], pos[e.a * 2 + 1], pos[e.b * 2], pos[e.b * 2 + 1],
          pos[f.a * 2], pos[f.a * 2 + 1], pos[f.b * 2], pos[f.b * 2 + 1]
        )
      ) {
        bad.add(i);
        bad.add(j);
      }
    }
  return bad;
}

interface SavedState {
  pos: number[]; // x,y pairs, normalized 0–1
  done: boolean;
}

export default function Untangle({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("untangle", (s, d) => ({
      pos: generateGraph(`untangle-${s}`, NODES[d]).start,
      done: false
    }));
  const { edges } = useMemo(
    () => generateGraph(`untangle-${seed}`, NODES[diff]),
    [seed, diff]
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  // Transient positions while a drag is live; committed on release.
  const [live, setLive] = useState<number[] | null>(null);

  const pos = live ?? saved.pos;
  const bad = useMemo(() => crossingEdges(pos, edges), [pos, edges]);

  function toLocal(e: React.PointerEvent): [number, number] {
    const r = svgRef.current!.getBoundingClientRect();
    return [
      Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)),
      Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height))
    ];
  }

  function onDown(e: React.PointerEvent, v: number) {
    if (saved.done) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragging.current = v;
    setLive(saved.pos.slice());
  }

  function onMove(e: React.PointerEvent) {
    if (dragging.current === null || !svgRef.current) return;
    const [x, y] = toLocal(e);
    setLive((prev) => {
      const next = (prev ?? saved.pos).slice();
      next[dragging.current! * 2] = x;
      next[dragging.current! * 2 + 1] = y;
      return next;
    });
  }

  function onUp() {
    if (dragging.current === null) return;
    dragging.current = null;
    if (!live) return;
    const solved = crossingEdges(live, edges).size === 0;
    const next: SavedState = { pos: live, done: solved };
    setLive(null);
    commit(next);
    if (solved) recordResult("untangle", true);
  }

  return (
    <div className="game game-untangle">
      <GameHeader title="Untangle" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Drag dots until no lines cross. {bad.size ? `${bad.size} crossing` : "Clear!"}
        {bad.size ? ` line${bad.size === 1 ? "" : "s"}` : ""}
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <svg
        ref={svgRef}
        className="ut-board drag-paint"
        viewBox="0 0 100 100"
        role="application"
        aria-label="Untangle board"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {edges.map((e, i) => (
          <line
            key={i}
            className={`ut-edge${bad.has(i) ? " bad" : ""}`}
            x1={pos[e.a * 2] * 100}
            y1={pos[e.a * 2 + 1] * 100}
            x2={pos[e.b * 2] * 100}
            y2={pos[e.b * 2 + 1] * 100}
          />
        ))}
        {Array.from({ length: pos.length / 2 }).map((_, v) => (
          <circle
            key={v}
            className="ut-node"
            cx={pos[v * 2] * 100}
            cy={pos[v * 2 + 1] * 100}
            r={3.4}
            onPointerDown={(e) => onDown(e, v)}
          />
        ))}
      </svg>

      {saved.done && (
        <Result
          key={seed}
          game="untangle"
          won
          message="Untangled!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
