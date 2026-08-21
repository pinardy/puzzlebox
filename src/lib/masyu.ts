import { makeRng } from "./rng";
import { growBlob } from "./slither";
import type { EdgeState } from "./slither";

export interface MasyuPuzzle {
  n: number; // cells per side; the loop passes through cell centres
  pearls: Map<number, "black" | "white">;
}

/** Edge helpers for a loop drawn between cell centres:
 *  h[r*(n-1)+c] joins (r,c)-(r,c+1); v[r*n+c] joins (r,c)-(r+1,c). */
function edgesOfCell(n: number, edges: EdgeState, i: number): number[] {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (c > 0 && edges.h[r * (n - 1) + c - 1] === 1) out.push(i - 1);
  if (c < n - 1 && edges.h[r * (n - 1) + c] === 1) out.push(i + 1);
  if (r > 0 && edges.v[(r - 1) * n + c] === 1) out.push(i - n);
  if (r < n - 1 && edges.v[r * n + c] === 1) out.push(i + n);
  return out;
}

const isStraight = (i: number, nbs: number[]): boolean =>
  nbs.length === 2 && (nbs[0] + nbs[1]) / 2 === i;

/** Generate a Masyu board: grow a blob on the (n-1)² block grid — its
 *  boundary is a loop through the n² cell centres — then place pearls
 *  where the loop's shape earns them. Solvable by construction; any loop
 *  satisfying every pearl wins. */
export function generateMasyu(seed: string, n: number): MasyuPuzzle {
  const rng = makeRng(seed);
  const m = n - 1;

  for (let attempt = 0; attempt < 60; attempt++) {
    const blob = growBlob(rng, m);
    const inBlob = (r: number, c: number) =>
      r >= 0 && r < m && c >= 0 && c < m && blob.has(r * m + c);

    // Solution edges: a lattice edge lies on the boundary when the blocks
    // on its two sides disagree about being in the blob.
    const h = Array(n * (n - 1)).fill(0);
    const v = Array((n - 1) * n).fill(0);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n - 1; c++)
        if (inBlob(r - 1, c) !== inBlob(r, c)) h[r * (n - 1) + c] = 1;
    for (let r = 0; r < n - 1; r++)
      for (let c = 0; c < n; c++)
        if (inBlob(r, c - 1) !== inBlob(r, c)) v[r * n + c] = 1;
    const edges: EdgeState = { h, v };

    const pearls = new Map<number, "black" | "white">();
    for (let i = 0; i < n * n; i++) {
      const nbs = edgesOfCell(n, edges, i);
      if (nbs.length !== 2) continue;
      const straight = isStraight(i, nbs);
      const nbStraight = nbs.map((j) => isStraight(j, edgesOfCell(n, edges, j)));
      if (!straight && nbStraight[0] && nbStraight[1]) {
        if (rng() < 0.85) pearls.set(i, "black");
      } else if (straight && (!nbStraight[0] || !nbStraight[1])) {
        if (rng() < 0.5) pearls.set(i, "white");
      }
    }
    if (pearls.size >= Math.max(4, Math.floor(n * 0.8))) return { n, pearls };
  }
  return { n, pearls: new Map() }; // effectively unreachable
}

/** Does the player's loop satisfy every pearl? One closed loop; black
 *  pearls turn with straight cells either side; white pearls go straight
 *  with a turn on at least one side. */
export function masyuSolved(p: MasyuPuzzle, edges: EdgeState): boolean {
  const { n, pearls } = p;

  // Degrees: every cell has 0 or 2 loop edges.
  const lines: [number, number][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n - 1; c++)
      if (edges.h[r * (n - 1) + c] === 1) lines.push([r * n + c, r * n + c + 1]);
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n; c++)
      if (edges.v[r * n + c] === 1) lines.push([r * n + c, (r + 1) * n + c]);
  if (!lines.length) return false;

  const degree = new Map<number, number>();
  const adj = new Map<number, number[]>();
  for (const [a, b] of lines) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  for (const d of degree.values()) if (d !== 2) return false;

  // Single connected loop.
  const start = lines[0][0];
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of adj.get(i) ?? [])
      if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  if (seen.size !== degree.size) return false;

  for (const [cell, kind] of pearls) {
    const nbs = edgesOfCell(n, edges, cell);
    if (nbs.length !== 2) return false; // pearl must be on the loop
    const straight = isStraight(cell, nbs);
    const nbStraight = nbs.map((j) => isStraight(j, edgesOfCell(n, edges, j)));
    if (kind === "black") {
      if (straight || !nbStraight[0] || !nbStraight[1]) return false;
    } else {
      if (!straight || (nbStraight[0] && nbStraight[1])) return false;
    }
  }
  return true;
}
