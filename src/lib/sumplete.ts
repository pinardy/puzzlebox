import { makeRng } from "./rng";

export interface SumpletePuzzle {
  n: number;
  values: number[];
  /** true = the cell is still standing in the generator's own solution */
  solution: boolean[];
  rowTargets: number[];
  colTargets: number[];
}

/** Kept-cell totals for every row and column, in grid order. */
export function lineSums(
  values: readonly number[],
  kept: readonly boolean[],
  n: number
): { rows: number[]; cols: number[] } {
  const rows = Array(n).fill(0);
  const cols = Array(n).fill(0);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!kept[r * n + c]) continue;
      rows[r] += values[r * n + c];
      cols[c] += values[r * n + c];
    }
  return { rows, cols };
}

/** A line that is all-kept or all-deleted gives the solver nothing to
 *  chew on (and an all-deleted line has a target of 0), so those boards
 *  are thrown away and redrawn. */
const usable = (solution: readonly boolean[], n: number): boolean => {
  for (let k = 0; k < n; k++) {
    let rowKept = 0, colKept = 0;
    for (let j = 0; j < n; j++) {
      if (solution[k * n + j]) rowKept++;
      if (solution[j * n + k]) colKept++;
    }
    if (rowKept === 0 || rowKept === n) return false;
    if (colKept === 0 || colKept === n) return false;
  }
  return true;
};

/** Random 1–9 digits with an independent keep/delete mark per cell; the
 *  targets are read off the kept cells, so that marking is a valid
 *  solution by construction. Sumplete boards are not unique and are not
 *  meant to be — the win test is the rules, not this solution. */
export function generateSumplete(seed: string, n: number): SumpletePuzzle {
  const rng = makeRng(seed);
  const build = (deleteRate: number): boolean[] =>
    Array.from({ length: n * n }, () => rng() >= deleteRate);

  const values = Array.from({ length: n * n }, () => 1 + Math.floor(rng() * 9));
  let solution = build(0.45 + rng() * 0.1);
  for (let attempt = 0; attempt < 200 && !usable(solution, n); attempt++)
    solution = build(0.45 + rng() * 0.1);
  // Fallback for the (never yet observed) run of unusable draws: a
  // checkerboard is non-degenerate for every n ≥ 2.
  if (!usable(solution, n))
    solution = Array.from(
      { length: n * n },
      (_, i) => (Math.floor(i / n) + (i % n)) % 2 === 0
    );

  const { rows, cols } = lineSums(values, solution, n);
  return { n, values, solution, rowTargets: rows, colTargets: cols };
}
