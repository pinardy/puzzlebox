import { makeRng, shuffled } from "./rng";

/** The four interior intersections of a 3x3 grid, each touching a 2x2 block. */
export const SUKO_CIRCLES: readonly number[][] = [
  [0, 1, 3, 4],
  [1, 2, 4, 5],
  [3, 4, 6, 7],
  [4, 5, 7, 8]
];

const NEIGHBOURS: readonly number[][] = [...Array(9).keys()].map((i) => {
  const r = Math.floor(i / 3), c = i % 3;
  const out: number[] = [];
  if (r > 0) out.push(i - 3);
  if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  return out;
});

export interface SukoPuzzle {
  circles: number[]; // sum around each intersection, in SUKO_CIRCLES order
  groupOf: number[]; // cell → colour group index
  groupSums: number[]; // total of each colour group
  groups: number[][]; // group index → its cells
  solution: number[]; // the unique arrangement of 1..9
  unique: boolean; // false only if the retry cap was hit
}

interface Con {
  cells: number[];
  target: number;
  last: number; // largest cell index in the constraint
  penult: number; // second largest, or -1 for a single-cell constraint
}

const mkCon = (cells: number[], target: number): Con => {
  const sorted = cells.slice().sort((a, b) => a - b);
  return {
    cells: sorted,
    target,
    last: sorted[sorted.length - 1],
    penult: sorted.length > 1 ? sorted[sorted.length - 2] : -1
  };
};

/** Count arrangements of 1..9 satisfying every constraint, stopping at
 *  `limit`. Cells are filled in index order, so each constraint is tested
 *  the moment its last cell lands, and once only one cell is left the
 *  missing digit is forced — those two checks prune 9! down to a few
 *  thousand nodes, which is why brute force is affordable here. */
function countSukoSolutions(cons: Con[], limit: number): number {
  const completeAt: Con[][] = [...Array(9)].map(() => []);
  const forcedAt: Con[][] = [...Array(9)].map(() => []);
  for (const c of cons) {
    completeAt[c.last].push(c);
    if (c.penult >= 0) forcedAt[c.penult].push(c);
  }
  const val = new Int8Array(9);
  const used = new Uint8Array(10);
  let count = 0;

  const rec = (i: number): boolean => {
    if (i === 9) return ++count >= limit;
    for (let d = 1; d <= 9; d++) {
      if (used[d]) continue;
      val[i] = d;
      let ok = true;
      for (const c of completeAt[i]) {
        let s = 0;
        for (const k of c.cells) s += val[k];
        if (s !== c.target) {
          ok = false;
          break;
        }
      }
      if (ok)
        for (const c of forcedAt[i]) {
          let s = 0;
          for (const k of c.cells) if (k <= i) s += val[k];
          const need = c.target - s;
          if (need < 1 || need > 9 || need === d || used[need]) {
            ok = false;
            break;
          }
        }
      if (ok) {
        used[d] = 1;
        const stop = rec(i + 1);
        used[d] = 0;
        if (stop) return true;
      }
    }
    return false;
  };

  rec(0);
  return count;
}

/** Grow `sizes.length` connected blobs from random seeds until each hits
 *  its target size. Returns null when the growth paints itself into a
 *  corner (a blob with no free neighbour left), which the caller retries. */
function growGroups(sizes: number[], rng: () => number): number[][] | null {
  const owner = Array(9).fill(-1);
  const groups: number[][] = sizes.map(() => []);
  const seeds = shuffled([...Array(9).keys()], rng).slice(0, sizes.length);
  seeds.forEach((cell, g) => {
    owner[cell] = g;
    groups[g].push(cell);
  });
  for (let placed = sizes.length; placed < 9; placed++) {
    const hungry = groups
      .map((_, g) => g)
      .filter((g) => groups[g].length < sizes[g]);
    const opts: [number, number][] = [];
    for (const g of hungry)
      for (const cell of groups[g])
        for (const nb of NEIGHBOURS[cell]) if (owner[nb] === -1) opts.push([g, nb]);
    if (!opts.length) return null;
    const [g, cell] = opts[Math.floor(rng() * opts.length)];
    owner[cell] = g;
    groups[g].push(cell);
  }
  return groups;
}

/** Group-size shapes per difficulty. Easy may hand over a single cell
 *  (its total names the digit outright); medium keeps every group at two
 *  or more; hard gives only two groups, so barely more than the circles. */
const SHAPES: Record<string, number[][]> = {
  easy: [
    [3, 3, 3],
    [2, 3, 4],
    [1, 4, 4],
    [1, 3, 5]
  ],
  medium: [
    [3, 3, 3],
    [2, 3, 4],
    [2, 2, 5]
  ],
  hard: [
    [4, 5],
    [3, 6]
  ]
};

const MAX_TRIES = 600;

/** Draw a random arrangement of 1..9, read off the four block sums, then
 *  keep re-rolling the colour partition (and periodically the arrangement)
 *  until brute force finds exactly one solution. */
export function generateSuko(seed: string, diff: string): SukoPuzzle {
  const rng = makeRng(seed);
  const shapes = SHAPES[diff] ?? SHAPES.medium;
  let last: SukoPuzzle | null = null;

  for (let tries = 0; tries < MAX_TRIES; tries++) {
    // A fresh arrangement every few tries: some block-sum sets are simply
    // too loose to pin down with this few colour groups.
    const solution: number[] =
      tries % 4 === 0 || !last ? shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng) : last.solution;
    const circles = SUKO_CIRCLES.map((cells) =>
      cells.reduce((s, k) => s + solution[k], 0)
    );
    const sizes = shuffled(shapes[Math.floor(rng() * shapes.length)], rng);
    const groups = growGroups(sizes, rng);
    if (!groups) continue;
    const groupSums = groups.map((cells) => cells.reduce((s, k) => s + solution[k], 0));
    const groupOf = Array(9).fill(0);
    groups.forEach((cells, g) => cells.forEach((k) => (groupOf[k] = g)));

    const cons = [
      ...SUKO_CIRCLES.map((cells, i) => mkCon(cells.slice(), circles[i])),
      ...groups.map((cells, g) => mkCon(cells, groupSums[g]))
    ];
    last = { circles, groupOf, groupSums, groups, solution, unique: false };
    if (countSukoSolutions(cons, 2) === 1) return { ...last, unique: true };
  }
  // Never seen in testing; the board is still legal, and the win check
  // reads the rules rather than this solution, so play is unaffected.
  return last!;
}

/** True when every cell holds a digit and all circle and group totals match. */
export function sukoSolved(board: number[], p: SukoPuzzle): boolean {
  if (board.some((v) => v < 1 || v > 9)) return false;
  if (new Set(board).size !== 9) return false;
  for (let i = 0; i < 4; i++)
    if (SUKO_CIRCLES[i].reduce((s, k) => s + board[k], 0) !== p.circles[i]) return false;
  for (let g = 0; g < p.groups.length; g++)
    if (p.groups[g].reduce((s, k) => s + board[k], 0) !== p.groupSums[g]) return false;
  return true;
}
