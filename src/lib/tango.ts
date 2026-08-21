import { makeRng, shuffled } from "./rng";

/** Tango-style balance puzzle on a 6×6 grid: fill every cell with a sun (1)
 *  or moon (2) so each row and column has exactly three of each, and no
 *  three identical symbols sit consecutively. Givens leave a unique fill. */

export const T = 6;
const HALF = T / 2;

export interface TangoPuzzle {
  givens: number[]; // 36 cells: 0 empty, 1 sun, 2 moon
  solution: number[];
}

/** Would placing `v` at `idx` break a rule, given partial grid? */
export function tangoInvalid(grid: number[], idx: number, v: number): boolean {
  if (v === 0) return false;
  const r = Math.floor(idx / T), c = idx % T;
  const at = (rr: number, cc: number) =>
    rr < 0 || rr >= T || cc < 0 || cc >= T ? 0 : (grid[rr * T + cc] || 0);

  // no three in a row (check every window of 3 containing idx)
  for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
    for (let off = -2; off <= 0; off++) {
      let same = 0;
      for (let k = 0; k < 3; k++) {
        const rr = r + dr * (off + k), cc = c + dc * (off + k);
        const val = rr === r && cc === c ? v : at(rr, cc);
        if (val === v) same++;
      }
      if (same === 3) return true;
    }
  }

  // per-row / per-column cap of three
  let rowN = 1, colN = 1;
  for (let k = 0; k < T; k++) {
    if (k !== c && grid[r * T + k] === v) rowN++;
    if (k !== r && grid[k * T + c] === v) colN++;
  }
  return rowN > HALF || colN > HALF;
}

function fill(grid: number[], rng: () => number): boolean {
  const idx = grid.indexOf(0);
  if (idx === -1) return true;
  for (const v of shuffled([1, 2], rng)) {
    if (tangoInvalid(grid, idx, v)) continue;
    grid[idx] = v;
    if (fill(grid, rng)) return true;
    grid[idx] = 0;
  }
  return false;
}

function countSolutions(grid: number[], limit = 2): number {
  const idx = grid.indexOf(0);
  if (idx === -1) return 1;
  let total = 0;
  for (const v of [1, 2]) {
    if (tangoInvalid(grid, idx, v)) continue;
    grid[idx] = v;
    total += countSolutions(grid, limit - total);
    grid[idx] = 0;
    if (total >= limit) break;
  }
  return total;
}

/** Generate a board; `removals` is the difficulty dial (max cells
 *  emptied while keeping the fill unique). */
export function generateTango(seed: string, removals: number): TangoPuzzle {
  const rng = makeRng(seed);
  const solution = Array(T * T).fill(0);
  fill(solution, rng);

  const givens = solution.slice();
  let removed = 0;
  for (const idx of shuffled([...Array(T * T).keys()], rng)) {
    if (removed >= removals) break;
    const keep = givens[idx];
    givens[idx] = 0;
    if (countSolutions(givens) !== 1) givens[idx] = keep;
    else removed++;
  }
  return { givens, solution };
}
