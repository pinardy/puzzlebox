import { makeRng } from "./rng";

/** Tapa: shade cells so the shaded cells form ONE connected wall with no
 *  2×2 block anywhere solid. A clue cell is never shaded, and its numbers
 *  are the lengths of the runs of shaded cells among its eight neighbours,
 *  read round the cell in any rotation.
 *
 *  The solution is grown first — a connected, 2×2-free blob — so a valid
 *  answer always exists. Wins are judged against the rules rather than
 *  against that blob, so any shading that satisfies every clue counts. */

/** The eight neighbours in cyclic order, so runs can be read round a cell. */
const RING = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1]
];

export interface Tapa {
  n: number;
  /** Row-major: the clue numbers for a clue cell, else null. */
  clues: (number[] | null)[];
  solution: boolean[];
}

const inside = (n: number, r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;

/** The clue a cell would carry, given a shading: run lengths round the
 *  ring, longest first. No shaded neighbours reads as a single 0. */
export function clueAt(n: number, shaded: boolean[], r: number, c: number): number[] {
  const ring = RING.map(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return inside(n, rr, cc) && shaded[rr * n + cc];
  });
  if (ring.every((v) => !v)) return [0];
  if (ring.every((v) => v)) return [8];
  // Start counting just after a gap so no run is split across the seam.
  const start = ring.findIndex((v) => !v);
  const runs: number[] = [];
  let run = 0;
  for (let k = 1; k <= 8; k++) {
    const v = ring[(start + k) % 8];
    if (v) run++;
    else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs.sort((a, b) => b - a);
}

const makes2x2 = (n: number, shaded: boolean[], r: number, c: number): boolean => {
  for (const [r0, c0] of [
    [r - 1, c - 1],
    [r - 1, c],
    [r, c - 1],
    [r, c]
  ]) {
    if (r0 < 0 || c0 < 0 || r0 + 1 >= n || c0 + 1 >= n) continue;
    if (
      shaded[r0 * n + c0] &&
      shaded[r0 * n + c0 + 1] &&
      shaded[(r0 + 1) * n + c0] &&
      shaded[(r0 + 1) * n + c0 + 1]
    )
      return true;
  }
  return false;
};

/** One connected group? Counts the shaded cells reachable from the first. */
export function connectedShading(n: number, shaded: boolean[]): boolean {
  const first = shaded.indexOf(true);
  if (first < 0) return false;
  const seen = new Set<number>([first]);
  const queue = [first];
  while (queue.length) {
    const i = queue.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]) {
      const rr = r + dr;
      const cc = c + dc;
      const j = rr * n + cc;
      if (inside(n, rr, cc) && shaded[j] && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === shaded.filter(Boolean).length;
}

export function makeTapa(seed: string, n: number, clueRatio: number): Tapa {
  const rng = makeRng(`tapa-${seed}`);
  const shaded = Array<boolean>(n * n).fill(false);
  const target = Math.round(n * n * 0.38);

  // Grow a connected wall, never closing a 2×2.
  const start = Math.floor(rng() * n * n);
  shaded[start] = true;
  let count = 1;
  let guard = 0;
  while (count < target && guard++ < n * n * 60) {
    const frontier: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (shaded[i]) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      const touches = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ].some(([dr, dc]) => inside(n, r + dr, c + dc) && shaded[(r + dr) * n + (c + dc)]);
      if (touches) frontier.push(i);
    }
    if (!frontier.length) break;
    const pick = frontier[Math.floor(rng() * frontier.length)];
    shaded[pick] = true;
    if (makes2x2(n, shaded, Math.floor(pick / n), pick % n)) shaded[pick] = false;
    else count++;
  }

  // Clue the unshaded cells, favouring ones that touch the wall — a clue
  // with nothing around it says less.
  const open: number[] = [];
  for (let i = 0; i < n * n; i++) if (!shaded[i]) open.push(i);
  const scored = open
    .map((i) => {
      const clue = clueAt(n, shaded, Math.floor(i / n), i % n);
      return { i, clue, weight: rng() + (clue[0] > 0 ? 0.6 : 0) };
    })
    .sort((a, b) => b.weight - a.weight);

  const clues: (number[] | null)[] = Array(n * n).fill(null);
  const wanted = Math.max(6, Math.round(open.length * clueRatio));
  for (const s of scored.slice(0, wanted)) clues[s.i] = s.clue;

  return { n, clues, solution: shaded };
}

/** Rule check: every clue matched, clue cells clear, one wall, no 2×2. */
export function tapaSolved(p: Tapa, shaded: boolean[]): boolean {
  const { n, clues } = p;
  for (let i = 0; i < n * n; i++) if (clues[i] && shaded[i]) return false;
  for (let r = 0; r + 1 < n; r++)
    for (let c = 0; c + 1 < n; c++)
      if (
        shaded[r * n + c] &&
        shaded[r * n + c + 1] &&
        shaded[(r + 1) * n + c] &&
        shaded[(r + 1) * n + c + 1]
      )
        return false;
  for (let i = 0; i < n * n; i++) {
    const want = clues[i];
    if (!want) continue;
    const got = clueAt(n, shaded, Math.floor(i / n), i % n);
    if (got.length !== want.length || got.some((v, k) => v !== want[k])) return false;
  }
  return connectedShading(n, shaded);
}
