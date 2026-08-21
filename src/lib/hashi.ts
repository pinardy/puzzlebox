import { makeRng } from "./rng";

export interface HashiPuzzle {
  n: number;
  /** island cell index → required bridge count (degree) */
  islands: Map<number, number>;
}

export type Edges = Record<string, number>; // "a-b" (a < b) → 1 | 2

export const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}-${b}` : `${b}-${a}`;

/** Cells strictly between two aligned islands, or null if not aligned. */
export function corridor(a: number, b: number, n: number): number[] | null {
  const ra = Math.floor(a / n), ca = a % n;
  const rb = Math.floor(b / n), cb = b % n;
  if (ra !== rb && ca !== cb) return null;
  const step = ra === rb ? Math.sign(cb - ca) : Math.sign(rb - ra) * n;
  const out: number[] = [];
  for (let i = a + step; i !== b; i += step) out.push(i);
  return out.length ? out : null; // adjacent islands can't be bridged
}

/** Build a connected bridge layout by repeatedly extending from a random
 *  island (or linking two existing ones), then read the degrees off it.
 *  Bridges reserve their corridor cells, so the generated layout — and
 *  therefore at least one solution — has no crossings. */
export function generateHashi(seed: string, n: number, targetIslands: number): HashiPuzzle {
  const rng = makeRng(seed);
  const isIsland = Array(n * n).fill(false);
  const bridgeCell = Array(n * n).fill(false);
  const degree = new Map<number, number>();
  const linked = new Set<string>();

  const first = Math.floor(rng() * n * n);
  isIsland[first] = true;
  degree.set(first, 0);

  const DIRS = [1, -1, n, -n];
  for (let attempt = 0; attempt < 600 && degree.size < targetIslands; attempt++) {
    const islands = [...degree.keys()];
    const from = islands[Math.floor(rng() * islands.length)];
    const dir = DIRS[Math.floor(rng() * DIRS.length)];
    const dist = 2 + Math.floor(rng() * 3); // 2..4 cells away

    // Walk outward, stopping at the board edge or the first obstruction.
    const r0 = Math.floor(from / n), c0 = from % n;
    let to = from;
    let blocked = false;
    for (let step = 1; step <= dist; step++) {
      const next = from + dir * step;
      const r = Math.floor(next / n), c = next % n;
      const rowWalk = dir === 1 || dir === -1;
      if (r < 0 || r >= n || c < 0 || c >= n || (rowWalk && r !== r0) || (!rowWalk && c !== c0)) {
        blocked = true;
        break;
      }
      if (step < dist && (isIsland[next] || bridgeCell[next])) {
        // Hitting an island early is fine if we can link to it instead.
        if (isIsland[next]) { to = next; }
        blocked = !isIsland[next];
        break;
      }
      to = next;
      if (step === dist && bridgeCell[next]) blocked = true;
    }
    if (blocked || to === from) continue;

    const key = edgeKey(from, to);
    if (linked.has(key)) continue;
    const between = corridor(from, to, n);
    if (!between || between.some((i) => isIsland[i] || bridgeCell[i])) continue;

    const count = 1 + (rng() < 0.4 ? 1 : 0);
    if (!isIsland[to]) {
      isIsland[to] = true;
      degree.set(to, 0);
    }
    for (const i of between) bridgeCell[i] = true;
    linked.add(key);
    degree.set(from, (degree.get(from) ?? 0) + count);
    degree.set(to, (degree.get(to) ?? 0) + count);
  }

  return { n, islands: degree };
}

/** Do the player's bridges solve the puzzle? Crossings and blocked
 *  corridors are prevented at input time, so this checks degrees and
 *  connectivity. */
export function hashiSolved(p: HashiPuzzle, edges: Edges): boolean {
  const want = p.islands;
  const got = new Map<number, number>();
  const adj = new Map<number, number[]>();
  for (const [key, count] of Object.entries(edges)) {
    if (count <= 0) continue;
    const [a, b] = key.split("-").map(Number);
    got.set(a, (got.get(a) ?? 0) + count);
    got.set(b, (got.get(b) ?? 0) + count);
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  for (const [idx, deg] of want) if ((got.get(idx) ?? 0) !== deg) return false;

  // All islands in one component.
  const all = [...want.keys()];
  const seen = new Set<number>([all[0]]);
  const stack = [all[0]];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of adj.get(i) ?? [])
      if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return all.every((i) => seen.has(i));
}
