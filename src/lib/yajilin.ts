import { makeRng, shuffled } from "./rng";
import type { EdgeState } from "./slither";

/** Arrow directions, in the order the UI shows them. */
export type Dir = 0 | 1 | 2 | 3;
export const DIR_ARROW: Record<Dir, string> = { 0: "↑", 1: "↓", 2: "←", 3: "→" };
export const DIR_NAME: Record<Dir, string> = {
  0: "up",
  1: "down",
  2: "left",
  3: "right"
};
const STEP: Record<Dir, [number, number]> = {
  0: [-1, 0],
  1: [1, 0],
  2: [0, -1],
  3: [0, 1]
};

export interface YajilinClue {
  dir: Dir;
  count: number;
}

export interface YajilinPuzzle {
  n: number; // cells per side; the loop runs through cell centres
  clues: (YajilinClue | null)[]; // per cell, null when the cell is playable
  solution: { edges: EdgeState; shaded: boolean[] };
}

/** Edge indexing, shared with Masyu: h[r*(n-1)+c] joins (r,c)-(r,c+1),
 *  v[r*n+c] joins (r,c)-(r+1,c). */
export const freshEdges = (n: number): EdgeState => ({
  h: Array(n * (n - 1)).fill(0),
  v: Array((n - 1) * n).fill(0)
});

const nbrs = (i: number, n: number): number[] => {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** How many loop segments meet at this cell. */
export function cellDegree(n: number, edges: EdgeState, i: number): number {
  const r = Math.floor(i / n), c = i % n;
  let d = 0;
  if (c > 0 && edges.h[r * (n - 1) + c - 1] === 1) d++;
  if (c < n - 1 && edges.h[r * (n - 1) + c] === 1) d++;
  if (r > 0 && edges.v[(r - 1) * n + c] === 1) d++;
  if (r < n - 1 && edges.v[r * n + c] === 1) d++;
  return d;
}

/** Shaded cells from a cell to the edge of the board in one direction. */
export function rayCount(
  n: number,
  i: number,
  dir: Dir,
  shaded: readonly boolean[]
): number {
  const [dr, dc] = STEP[dir];
  let r = Math.floor(i / n) + dr, c = (i % n) + dc, k = 0;
  while (r >= 0 && r < n && c >= 0 && c < n) {
    if (shaded[r * n + c]) k++;
    r += dr;
    c += dc;
  }
  return k;
}

interface Loop {
  h: number[];
  v: number[];
  cells: Set<number>;
}

/** Start from a 2×2 loop and repeatedly "bump" one segment sideways into
 *  two unused cells, replacing it with a three-segment detour. Substituting
 *  a path for an edge keeps the figure a single closed loop, so the result
 *  is always one cycle — it just gets longer. */
function growLoop(n: number, rng: () => number): Loop {
  const r0 = Math.floor(rng() * (n - 1)), c0 = Math.floor(rng() * (n - 1));
  const h = Array(n * (n - 1)).fill(0);
  const v = Array((n - 1) * n).fill(0);
  h[r0 * (n - 1) + c0] = 1;
  h[(r0 + 1) * (n - 1) + c0] = 1;
  v[r0 * n + c0] = 1;
  v[r0 * n + c0 + 1] = 1;
  const cells = new Set([
    r0 * n + c0,
    r0 * n + c0 + 1,
    (r0 + 1) * n + c0,
    (r0 + 1) * n + c0 + 1
  ]);

  const target = Math.floor(n * n * (0.7 + rng() * 0.08));
  while (cells.size < target) {
    const opts: { kind: "h" | "v"; r: number; c: number; d: number }[] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n - 1; c++)
        if (h[r * (n - 1) + c] === 1) for (const d of [-1, 1]) opts.push({ kind: "h", r, c, d });
    for (let r = 0; r < n - 1; r++)
      for (let c = 0; c < n; c++)
        if (v[r * n + c] === 1) for (const d of [-1, 1]) opts.push({ kind: "v", r, c, d });

    let bumped = false;
    for (const o of shuffled(opts, rng)) {
      if (o.kind === "h") {
        const rr = o.r + o.d;
        if (rr < 0 || rr >= n) continue;
        const x = rr * n + o.c, y = rr * n + o.c + 1;
        if (cells.has(x) || cells.has(y)) continue;
        const vr = Math.min(o.r, rr);
        h[o.r * (n - 1) + o.c] = 0;
        h[rr * (n - 1) + o.c] = 1;
        v[vr * n + o.c] = 1;
        v[vr * n + o.c + 1] = 1;
        cells.add(x);
        cells.add(y);
      } else {
        const cc = o.c + o.d;
        if (cc < 0 || cc >= n) continue;
        const x = o.r * n + cc, y = (o.r + 1) * n + cc;
        if (cells.has(x) || cells.has(y)) continue;
        const hc = Math.min(o.c, cc);
        v[o.r * n + o.c] = 0;
        v[o.r * n + cc] = 1;
        h[o.r * (n - 1) + hc] = 1;
        h[(o.r + 1) * (n - 1) + hc] = 1;
        cells.add(x);
        cells.add(y);
      }
      bumped = true;
      break;
    }
    if (!bumped) break; // every segment is boxed in; this loop is as big as it gets
  }
  return { h, v, cells };
}

const rayLength = (n: number, i: number, dir: Dir): number => {
  const r = Math.floor(i / n), c = i % n;
  return dir === 0 ? r : dir === 1 ? n - 1 - r : dir === 2 ? c : n - 1 - c;
};

/** A clue constrains as much as its ray is long, so favour the long views —
 *  and among those, ones that actually see shaded cells. A zero over a long
 *  ray is still an excellent clue, so it stays in the running. */
function pickClue(
  n: number,
  i: number,
  shaded: readonly boolean[],
  rng: () => number
): YajilinClue {
  const dirs = shuffled([0, 1, 2, 3] as Dir[], rng).sort(
    (a, b) => rayLength(n, i, b) - rayLength(n, i, a)
  );
  const counts = dirs.map((d) => rayCount(n, i, d, shaded));
  const k = counts.findIndex((c) => c > 0);
  const j = k >= 0 && rng() < 0.75 ? k : 0;
  return { dir: dirs[j], count: counts[j] };
}

const puzzleFrom = (n: number, loop: Loop, shaded: boolean[], rng: () => number) => {
  const clues: (YajilinClue | null)[] = Array(n * n).fill(null);
  for (let i = 0; i < n * n; i++)
    if (!loop.cells.has(i) && !shaded[i]) clues[i] = pickClue(n, i, shaded, rng);
  return { n, clues, solution: { edges: { h: loop.h, v: loop.v }, shaded } };
};

/** Build the answer first: a loop, then a non-adjacent shading of some
 *  off-loop cells, then read each remaining off-loop cell's clue off that
 *  shading. Every rule holds by construction, so the board is solvable. */
export function generateYajilin(seed: string, n: number): YajilinPuzzle {
  const rng = makeRng(seed);

  for (let attempt = 0; attempt < 80; attempt++) {
    const loop = growLoop(n, rng);
    const off = [...Array(n * n).keys()].filter((i) => !loop.cells.has(i));
    if (off.length < 7) continue;

    const shaded: boolean[] = Array(n * n).fill(false);
    const picked: number[] = [];
    for (const i of shuffled(off, rng)) {
      if (nbrs(i, n).some((j) => shaded[j])) continue;
      shaded[i] = true;
      picked.push(i);
    }
    // Clues are the only information the solver gets, so tilt the off-loop
    // cells towards clues and trim the shading back to fit.
    const keep = Math.min(
      picked.length,
      off.length - 4,
      Math.max(3, Math.round(off.length * 0.42))
    );
    if (keep < 3) continue;
    for (const i of shuffled(picked, rng).slice(keep)) shaded[i] = false;

    return puzzleFrom(n, loop, shaded, rng);
  }
  return fallback(n);
}

/** Guaranteed-valid board for the (unobserved) case where every attempt
 *  above lands too few clues: a serpentine cycle over all but the last two
 *  columns, which then hold the shading and the clues. Needs n even. */
function fallback(n: number): YajilinPuzzle {
  const m = n - 2;
  const path: number[] = [];
  for (let c = 0; c < m; c++) path.push(c);
  for (let r = 1; r < n; r++) {
    if (r % 2 === 1) for (let c = m - 1; c >= 1; c--) path.push(r * n + c);
    else for (let c = 1; c < m; c++) path.push(r * n + c);
  }
  for (let r = n - 1; r >= 1; r--) path.push(r * n);

  const { h, v } = freshEdges(n);
  for (let k = 0; k < path.length; k++) {
    const a = path[k], b = path[(k + 1) % path.length];
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const r = Math.floor(lo / n), c = lo % n;
    if (hi - lo === 1) h[r * (n - 1) + c] = 1;
    else v[r * n + c] = 1;
  }

  const shaded: boolean[] = Array(n * n).fill(false);
  for (let r = 0; r < n; r++) shaded[r * n + (r % 2 === 0 ? n - 2 : n - 1)] = true;
  const loop: Loop = { h, v, cells: new Set(path) };
  return puzzleFrom(n, loop, shaded, makeRng("yajilin-fallback"));
}

/** Rule check on the player's own board: non-touching shading, a clean
 *  single closed loop through every cell that is neither shaded nor clued,
 *  and every arrow counting its ray correctly. */
export function yajilinSolved(
  p: YajilinPuzzle,
  edges: EdgeState,
  shaded: readonly boolean[]
): boolean {
  const { n, clues } = p;
  const blocked = (i: number) => shaded[i] || clues[i] !== null;

  for (let i = 0; i < n * n; i++) {
    if (!shaded[i]) continue;
    if (clues[i] !== null) return false;
    if (nbrs(i, n).some((j) => shaded[j])) return false;
  }

  const lines: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n - 1; c++)
      if (edges.h[r * (n - 1) + c] === 1) lines.push([r * n + c, r * n + c + 1]);
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n; c++)
      if (edges.v[r * n + c] === 1) lines.push([r * n + c, (r + 1) * n + c]);
  if (!lines.length) return false;

  const deg = Array(n * n).fill(0);
  const adj: number[][] = Array.from({ length: n * n }, () => []);
  for (const [a, b] of lines) {
    if (blocked(a) || blocked(b)) return false;
    deg[a]++;
    deg[b]++;
    adj[a].push(b);
    adj[b].push(a);
  }

  let live = 0;
  for (let i = 0; i < n * n; i++) {
    if (blocked(i)) continue;
    if (deg[i] !== 2) return false;
    live++;
  }
  if (!live) return false;

  // Every vertex has degree 2, so one component means one closed cycle.
  const seen = new Set([lines[0][0]]);
  const stack = [lines[0][0]];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of adj[i]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  if (seen.size !== live) return false;

  for (let i = 0; i < n * n; i++) {
    const cl = clues[i];
    if (cl && rayCount(n, i, cl.dir, shaded) !== cl.count) return false;
  }
  return true;
}
