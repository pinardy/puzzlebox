import { makeRng, shuffled } from "./rng";

/** Cell contents. The diagonals of a cell join two of the (n+1)² lattice
 *  corner points, so a filled board is a graph on those corners. */
export const EMPTY = 0;
export const FWD = 1; // "/"
export const BACK = 2; // "\"

export interface SlantPuzzle {
  n: number;
  solution: number[]; // cell → FWD | BACK
  clues: number[]; // corner → count, or -1 for no clue
}

const MAX_TRIES = 40;

/** The two lattice corners a diagonal joins, indexed r * (n + 1) + c. */
export function endsOf(i: number, n: number, v: number): [number, number] {
  const r = Math.floor(i / n), c = i % n;
  const p = (rr: number, cc: number) => rr * (n + 1) + cc;
  return v === FWD ? [p(r, c + 1), p(r + 1, c)] : [p(r, c), p(r + 1, c + 1)];
}

/** Union-find whose `union` reports false when the two ends already share
 *  a component — joining them would close a loop. */
function makeDsu(size: number) {
  const parent = [...Array(size).keys()];
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  return (a: number, b: number): boolean => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
    return true;
  };
}

/** How many diagonals touch each lattice corner. */
export function cornerDegrees(cells: readonly number[], n: number): number[] {
  const deg = Array((n + 1) * (n + 1)).fill(0);
  for (let i = 0; i < n * n; i++) {
    if (cells[i] === EMPTY) continue;
    const [a, b] = endsOf(i, n, cells[i]);
    deg[a]++;
    deg[b]++;
  }
  return deg;
}

/** True when the placed diagonals contain a closed loop. */
export function hasLoop(cells: readonly number[], n: number): boolean {
  const union = makeDsu((n + 1) * (n + 1));
  for (let i = 0; i < n * n; i++) {
    if (cells[i] === EMPTY) continue;
    const [a, b] = endsOf(i, n, cells[i]);
    if (!union(a, b)) return true;
  }
  return false;
}

/** Cells whose diagonal lies on a closed loop, found by peeling leaves off
 *  the corner graph until only cycles are left. Used for live feedback. */
export function loopCells(cells: readonly number[], n: number): Set<number> {
  const pts = (n + 1) * (n + 1);
  const deg = Array(pts).fill(0);
  const inc: number[][] = Array.from({ length: pts }, () => []);
  const alive = cells.map((v) => v !== EMPTY);
  for (let i = 0; i < n * n; i++) {
    if (cells[i] === EMPTY) continue;
    const [a, b] = endsOf(i, n, cells[i]);
    inc[a].push(i);
    inc[b].push(i);
    deg[a]++;
    deg[b]++;
  }
  const stack = [...Array(pts).keys()].filter((p) => deg[p] === 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (deg[p] !== 1) continue;
    const e = inc[p].find((i) => alive[i]);
    if (e === undefined) {
      deg[p] = 0;
      continue;
    }
    alive[e] = false;
    const [a, b] = endsOf(e, n, cells[e]);
    deg[a]--;
    deg[b]--;
    if (deg[a] === 1) stack.push(a);
    if (deg[b] === 1) stack.push(b);
  }
  const out = new Set<number>();
  for (let i = 0; i < n * n; i++) if (cells[i] !== EMPTY && alive[i]) out.add(i);
  return out;
}

/** Win test: every cell drawn, every SHOWN clue exactly met, no loop. The
 *  generator's own board is only one of the boards that pass — a random
 *  clue subset rarely pins down a unique solution, so the rules decide. */
export function slantSolved(
  cells: readonly number[],
  clues: readonly number[],
  n: number
): boolean {
  for (let i = 0; i < n * n; i++) if (cells[i] === EMPTY) return false;
  const deg = cornerDegrees(cells, n);
  for (let p = 0; p < clues.length; p++)
    if (clues[p] >= 0 && clues[p] !== deg[p]) return false;
  return !hasLoop(cells, n);
}

/** Build a loop-free board by construction: walk the cells in a seeded
 *  random order and take a diagonal only if it joins two corners that
 *  aren't already connected. If a cell has no legal diagonal the walk has
 *  boxed itself in, so start over. Then publish a share of the corner
 *  degrees as clues. */
export function generateSlant(seed: string, n: number, reveal: number): SlantPuzzle {
  const rng = makeRng(seed);
  const order = [...Array(n * n).keys()];
  let solution: number[] | null = null;

  for (let attempt = 0; attempt < MAX_TRIES && !solution; attempt++) {
    const cells = Array(n * n).fill(EMPTY);
    const union = makeDsu((n + 1) * (n + 1));
    let ok = true;
    for (const i of shuffled(order, rng)) {
      const first = rng() < 0.5 ? FWD : BACK;
      for (const v of [first, first === FWD ? BACK : FWD]) {
        const [a, b] = endsOf(i, n, v);
        if (union(a, b)) {
          cells[i] = v;
          break;
        }
      }
      if (cells[i] === EMPTY) {
        ok = false;
        break;
      }
    }
    if (ok) solution = cells;
  }
  // All-"\" is a set of disjoint diagonal chains, so it is always loop-free
  // — a safe fallback if every randomised walk boxed itself in.
  const sol = solution ?? Array(n * n).fill(BACK);

  const deg = cornerDegrees(sol, n);
  const pts = (n + 1) * (n + 1);
  const clues: number[] = Array(pts).fill(-1);
  // Each of the four board corners touches a single cell, so its clue
  // settles that cell outright — cheap footholds, kept at every difficulty.
  const anchors = [0, n, n * (n + 1), pts - 1];
  for (const p of anchors) clues[p] = deg[p];
  const want = Math.max(anchors.length, Math.round(pts * reveal));
  const rest = shuffled(
    [...Array(pts).keys()].filter((p) => clues[p] === -1),
    rng
  );
  for (const p of rest.slice(0, want - anchors.length)) clues[p] = deg[p];

  return { n, solution: sol, clues };
}
