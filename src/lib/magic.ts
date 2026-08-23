import { makeRng, shuffled } from "./rng";

export interface MagicPuzzle {
  n: number;
  total: number;
  givens: number[]; // 0 = a cell the player fills
  solution: number[];
}

/** Every row, column and diagonal of an n×n magic square adds to this. */
export const magicTotal = (n: number): number => (n * (n * n + 1)) / 2;

// Generation must always terminate, so the search carries a node budget.
// A capped search proves nothing, so the caller keeps the given instead of
// removing it — cheap insurance that also keeps the worst case snappy.
const NODE_CAP = 20000;

interface Search {
  sols: number[][];
  capped: boolean; // budget ran out, so `sols` may be short of the truth
}

/** The one solver: depth-first fill in row-major order, taking candidates
 *  for each cell from `orders`, stopping once `limit` solutions are in
 *  hand. The pruning is what makes 4×4 cheap — the last cell of a row,
 *  column or diagonal is computed rather than guessed, and any partial
 *  line that already overshoots the total is dead, since every remaining
 *  cell must still add at least one. */
function solve(
  n: number,
  givens: number[],
  orders: number[][],
  limit: number
): Search {
  const total = magicTotal(n);
  const max = n * n;
  const grid = Array(max).fill(0);
  const used = Array(max + 1).fill(false);
  const rowSum = Array(n).fill(0);
  const colSum = Array(n).fill(0);
  let diagSum = 0;
  let antiSum = 0;
  const sols: number[][] = [];
  let nodes = 0;
  let capped = false;

  // k cells still to come on a line hold k distinct values from 1..max,
  // so their sum is boxed in; a partial line outside that box is dead.
  const lo = Array.from({ length: n }, (_, k) => (k * (k + 1)) / 2);
  const hi = Array.from({ length: n }, (_, k) => k * max - (k * (k - 1)) / 2);
  const singles = Array.from({ length: max }, () => [0]);

  /** Can value `v` still go in cell `j`? */
  const spare = (v: number, j: number): boolean =>
    v >= 1 && v <= max && !used[v] && (givens[j] === 0 || givens[j] === v);

  const go = (i: number): void => {
    if (i === max) {
      sols.push(grid.slice());
      return;
    }
    if (++nodes > NODE_CAP) {
      capped = true;
      return;
    }
    const r = (i / n) | 0, c = i % n;
    const rowEnd = c === n - 1, colEnd = r === n - 1;
    const onDiag = r === c, onAnti = r + c === n - 1;

    // A line with only this cell left over fixes the value outright; two
    // such lines crossing here must agree or the branch is dead.
    let forced = 0;
    const need = (v: number) => {
      if (forced === 0) forced = v;
      else if (forced !== v) forced = -1;
    };
    if (rowEnd) need(total - rowSum[r]);
    if (colEnd) need(total - colSum[c]);
    if (onDiag && rowEnd && colEnd) need(total - diagSum);
    if (onAnti && colEnd && c === 0) need(total - antiSum);
    if (forced === -1) return;

    const given = givens[i];
    // `singles` is scratch, one slot per depth, so a pinned cell costs no
    // allocation on a hot path walked millions of times.
    let cands = orders[i];
    if (forced > 0 || given !== 0) {
      singles[i][0] = forced > 0 ? forced : given;
      cands = singles[i];
    }
    for (const v of cands) {
      if (v < 1 || v > max || used[v]) continue;
      if (given !== 0 && v !== given) continue;
      const rest = n - 1 - r, restRow = n - 1 - c;
      if (rowSum[r] + v + lo[restRow] > total) continue;
      if (rowSum[r] + v + hi[restRow] < total) continue;
      if (colSum[c] + v + lo[rest] > total) continue;
      if (colSum[c] + v + hi[rest] < total) continue;
      if (onDiag && (diagSum + v + lo[rest] > total || diagSum + v + hi[rest] < total))
        continue;
      if (onAnti && (antiSum + v + lo[rest] > total || antiSum + v + hi[rest] < total))
        continue;

      grid[i] = v;
      used[v] = true;
      rowSum[r] += v;
      colSum[c] += v;
      if (onDiag) diagSum += v;
      if (onAnti) antiSum += v;
      // One short of the end of a line, that line already names the value
      // that must close it — reject a dead neighbour now rather than after
      // descending through the rest of the row.
      if (
        (r !== n - 2 || spare(total - colSum[c], i + n)) &&
        (c !== n - 2 || spare(total - rowSum[r], i + 1))
      )
        go(i + 1);
      grid[i] = 0;
      used[v] = false;
      rowSum[r] -= v;
      colSum[c] -= v;
      if (onDiag) diagSum -= v;
      if (onAnti) antiSum -= v;
      if (sols.length >= limit || capped) return;
    }
  };

  go(0);
  return { sols, capped };
}

const plainOrder = (n: number): number[][] => {
  const vals = [...Array(n * n).keys()].map((k) => k + 1);
  return Array.from({ length: n * n }, () => vals);
};

/** Solutions consistent with `givens`, counted with an early exit. */
export function countMagicSolutions(n: number, givens: number[], limit = 2): number {
  return solve(n, givens, plainOrder(n), limit).sols.length;
}

/** Find one magic square by search, then peel givens away in a seeded
 *  order, keeping a removal only when the solver still reports exactly
 *  one solution. That leaves a uniquely-solvable board with about as many
 *  holes as this removal order allows. */
export function generateMagic(seed: string, n: number, target: number): MagicPuzzle {
  const rng = makeRng(seed);
  const max = n * n;
  const vals = [...Array(max).keys()].map((k) => k + 1);
  // A per-cell candidate order is what makes the found square random. An
  // unlucky order can wander past the node budget, so reshuffle and try
  // again a few times before settling for the textbook square.
  let orders: number[][] = [];
  let found: number[] | undefined;
  for (let tries = 0; tries < 5 && !found; tries++) {
    orders = Array.from({ length: max }, () => shuffled(vals, rng));
    found = solve(n, Array(max).fill(0), orders, 1).sols[0];
  }
  const solution = found ?? construct(n);

  const givens = solution.slice();
  let kept = max;
  for (const i of shuffled([...Array(max).keys()], rng)) {
    if (kept <= target) break;
    const trial = givens.slice();
    trial[i] = 0;
    const { sols, capped } = solve(n, trial, orders, 2);
    if (capped || sols.length !== 1) continue;
    givens[i] = 0;
    kept--;
  }
  return { n, total: magicTotal(n), givens, solution };
}

/** Safety net if the search ever exhausts its budget: the textbook
 *  constructions — Siamese for odd n, complement-the-diagonals for n
 *  divisible by four. Both sizes in play here are covered. */
function construct(n: number): number[] {
  const grid = Array(n * n).fill(0);
  if (n % 2 === 1) {
    let r = 0, c = (n - 1) >> 1;
    for (let v = 1; v <= n * n; v++) {
      grid[r * n + c] = v;
      const nr = (r - 1 + n) % n, nc = (c + 1) % n;
      if (grid[nr * n + nc] === 0) { r = nr; c = nc; } else r = (r + 1) % n;
    }
    return grid;
  }
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = r * n + c + 1;
      const onDiag = r % 4 === c % 4 || (r % 4) + (c % 4) === 3;
      grid[r * n + c] = onDiag ? n * n + 1 - v : v;
    }
  return grid;
}
