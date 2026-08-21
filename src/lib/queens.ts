import { makeRng, shuffled } from "./rng";

/** Queens (one crown per row, column, and colour region; no two crowns
 *  may touch, even diagonally). Generated with a unique solution. */

export interface QueensPuzzle {
  n: number;
  regions: number[]; // region id per cell, 0..n-1
  solution: number[]; // column of the crown for each row
}

/** One crown per row/col; consecutive rows can't have adjacent columns. */
function placeQueens(n: number, rng: () => number): number[] | null {
  const cols: number[] = [];
  const used = new Set<number>();
  function go(row: number): boolean {
    if (row === n) return true;
    for (const c of shuffled([...Array(n).keys()], rng)) {
      if (used.has(c)) continue;
      if (row > 0 && Math.abs(c - cols[row - 1]) <= 1) continue;
      cols.push(c); used.add(c);
      if (go(row + 1)) return true;
      cols.pop(); used.delete(c);
    }
    return false;
  }
  return go(0) ? cols : null;
}

/** Grow n regions from the crown cells until every cell is claimed.
 *  Growth is weighted heavily unevenly: a few tiny regions constrain the
 *  puzzle hard, which is what makes a unique solution likely at all. */
function growRegions(n: number, queenCols: number[], rng: () => number): number[] {
  const regions = Array(n * n).fill(-1);
  const frontier: number[][] = [];
  const weight: number[] = [];
  for (let r = 0; r < n; r++) {
    const idx = r * n + queenCols[r];
    regions[idx] = r;
    frontier.push([idx]);
    weight.push(0.02 + Math.pow(rng(), 3) * 3); // most weight on few regions
  }
  let remaining = n * n - n;
  while (remaining > 0) {
    // weighted pick among regions that still have a live frontier
    let totalW = 0;
    for (let g = 0; g < n; g++) if (frontier[g].length) totalW += weight[g];
    let pickW = rng() * totalW;
    let g = 0;
    for (; g < n; g++) {
      if (!frontier[g].length) continue;
      pickW -= weight[g];
      if (pickW <= 0) break;
    }
    if (g >= n) g = frontier.findIndex((f) => f.length > 0);
    const cells = frontier[g];
    const pick = Math.floor(rng() * cells.length);
    const cell = cells[pick];
    const r = Math.floor(cell / n), c = cell % n;
    const opts: number[] = [];
    if (r > 0 && regions[cell - n] === -1) opts.push(cell - n);
    if (r < n - 1 && regions[cell + n] === -1) opts.push(cell + n);
    if (c > 0 && regions[cell - 1] === -1) opts.push(cell - 1);
    if (c < n - 1 && regions[cell + 1] === -1) opts.push(cell + 1);
    if (opts.length === 0) {
      cells.splice(pick, 1); // exhausted cell — drop from frontier
      continue;
    }
    const next = opts[Math.floor(rng() * opts.length)];
    regions[next] = g;
    cells.push(next);
    remaining--;
  }
  return regions;
}

/** Count valid crown placements (row by row), stopping at `limit`. */
export function countQueensSolutions(
  n: number,
  regions: number[],
  limit = 2
): number {
  let count = 0;
  const usedCols = Array(n).fill(false);
  const usedRegions = Array(n).fill(false);
  function go(row: number, prevCol: number) {
    if (count >= limit) return;
    if (row === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (usedCols[c]) continue;
      if (prevCol !== -1 && Math.abs(c - prevCol) <= 1) continue;
      const reg = regions[row * n + c];
      if (usedRegions[reg]) continue;
      usedCols[c] = true; usedRegions[reg] = true;
      go(row + 1, c);
      usedCols[c] = false; usedRegions[reg] = false;
    }
  }
  go(0, -1);
  return count;
}

export function generateQueens(seed: string, n: number): QueensPuzzle {
  for (let attempt = 0; ; attempt++) {
    const rng = makeRng(`${seed}-${attempt}`);
    const solution = placeQueens(n, rng);
    if (!solution) continue;
    const regions = growRegions(n, solution, rng);
    if (countQueensSolutions(n, regions) === 1) return { n, regions, solution };
  }
}
