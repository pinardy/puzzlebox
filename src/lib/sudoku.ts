import { makeRng, shuffled } from "./rng";

export type Grid = number[]; // 81 cells, 0 = empty

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Precomputed peer lists: for each cell, the 20 cells sharing its
 *  row, column, or box. Turns every constraint check from an O(81)
 *  scan into an O(20) lookup — used by generation and the UI alike. */
const PEERS: readonly number[][] = (() => {
  const peers: number[][] = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    const set = new Set<number>();
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k);
      set.add(k * 9 + c);
      set.add((br + Math.floor(k / 3)) * 9 + (bc + (k % 3)));
    }
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
})();

export function peersConflict(grid: Grid, idx: number, val: number): boolean {
  if (val === 0) return false;
  for (const p of PEERS[idx]) if (grid[p] === val) return true;
  return false;
}

function candidates(grid: Grid, idx: number): number[] {
  let mask = 0;
  for (const p of PEERS[idx]) if (grid[p]) mask |= 1 << grid[p];
  const out: number[] = [];
  for (const d of DIGITS) if (!(mask & (1 << d))) out.push(d);
  return out;
}

/** Fill a grid completely using randomized backtracking. */
function fill(grid: Grid, rng: () => number): boolean {
  const idx = grid.indexOf(0);
  if (idx === -1) return true;
  for (const d of shuffled(candidates(grid, idx), rng)) {
    grid[idx] = d;
    if (fill(grid, rng)) return true;
    grid[idx] = 0;
  }
  return false;
}

/** Count solutions, short-circuiting at `limit`. */
function countSolutions(grid: Grid, limit = 2): number {
  // Most-constrained-cell heuristic keeps the search tree tiny.
  let best = -1, bestCands: number[] | null = null;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const c = candidates(grid, i);
    if (c.length === 0) return 0;
    if (bestCands === null || c.length < bestCands.length) {
      best = i; bestCands = c;
      if (c.length === 1) break;
    }
  }
  if (best === -1) return 1; // solved
  let total = 0;
  for (const d of bestCands!) {
    grid[best] = d;
    total += countSolutions(grid, limit - total);
    grid[best] = 0;
    if (total >= limit) break;
  }
  return total;
}

export interface SudokuPuzzle {
  puzzle: Grid;
  solution: Grid;
  clues: number;
}

/** Generate a puzzle. `holes` ≈ difficulty (40 easy → 54 hard). */
export function generateSudoku(seed: string, holes: number): SudokuPuzzle {
  const rng = makeRng(seed);
  const solution: Grid = Array(81).fill(0);
  fill(solution, rng);

  const puzzle = solution.slice();
  let removed = 0;
  for (const idx of shuffled([...Array(81).keys()], rng)) {
    if (removed >= holes) break;
    const keep = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle) !== 1) {
      puzzle[idx] = keep; // removal broke uniqueness — put it back
    } else {
      removed++;
    }
  }
  return { puzzle, solution, clues: 81 - removed };
}

export function isSolved(grid: Grid, solution: Grid): boolean {
  return grid.every((v, i) => v === solution[i]);
}
