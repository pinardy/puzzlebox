import { makeRng, shuffled } from "./rng";

export interface KakuroRun {
  cells: number[];
  sum: number;
}

export interface KakuroPuzzle {
  g: number; // board side incl. the clue border row/column
  black: boolean[]; // clue/blocked cells (row 0 and column 0 always are)
  across: Map<number, number>; // black cell → sum of the run to its right
  down: Map<number, number>; // black cell → sum of the run below it
  runs: KakuroRun[]; // every run, for checking
  solution: number[]; // the digits the sums were read from (0 on black cells)
}

/** Generate a Kakuro board: pick a black-cell pattern whose runs are all
 *  2–5 cells, fill the white cells with digits unique within each run,
 *  then read the sums off. Any digit assignment matching the sums and
 *  uniqueness rule wins. */
export function generateKakuro(seed: string, G: number): KakuroPuzzle {
  const rng = makeRng(seed);

  for (;;) {
    // Pattern: border is black, inner cells black with low probability.
    const black = Array(G * G).fill(false);
    for (let i = 0; i < G; i++) { black[i] = true; black[i * G] = true; }
    for (let r = 1; r < G; r++)
      for (let c = 1; c < G; c++)
        if (rng() < 0.26) black[r * G + c] = true;

    // Collect runs; reject patterns with 1-cell or 6+-cell runs.
    const runs: number[][] = [];
    let ok = true;
    const scan = (line: number[]) => {
      let run: number[] = [];
      for (const i of [...line, -1]) {
        if (i !== -1 && !black[i]) { run.push(i); continue; }
        if (run.length === 1 || run.length > 5) { ok = false; }
        if (run.length >= 2) runs.push(run);
        run = [];
      }
    };
    for (let r = 1; r < G && ok; r++)
      scan(Array.from({ length: G - 1 }, (_, k) => r * G + k + 1));
    for (let c = 1; c < G && ok; c++)
      scan(Array.from({ length: G - 1 }, (_, k) => (k + 1) * G + c));
    if (!ok) continue;
    const whiteCount = black.filter((b) => !b).length;
    if (whiteCount < Math.floor((G - 1) * (G - 1) * 0.45)) continue;

    // Runs through each white cell, for the uniqueness constraint.
    const runsOf = new Map<number, number[][]>();
    for (const run of runs)
      for (const i of run) runsOf.set(i, [...(runsOf.get(i) ?? []), run]);

    // Fill digits by randomized backtracking.
    const digits = Array(G * G).fill(0);
    const cells = [...runsOf.keys()];
    const fill = (k: number): boolean => {
      if (k === cells.length) return true;
      const i = cells[k];
      for (const d of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
        const clash = (runsOf.get(i) ?? []).some((run) =>
          run.some((j) => j !== i && digits[j] === d)
        );
        if (clash) continue;
        digits[i] = d;
        if (fill(k + 1)) return true;
        digits[i] = 0;
      }
      return false;
    };
    if (!fill(0)) continue;

    const across = new Map<number, number>();
    const down = new Map<number, number>();
    const outRuns: KakuroRun[] = [];
    for (const run of runs) {
      const sum = run.reduce((a, i) => a + digits[i], 0);
      outRuns.push({ cells: run, sum });
      const horizontal = run.length < 2 || run[1] === run[0] + 1;
      if (horizontal) across.set(run[0] - 1, sum);
      else down.set(run[0] - G, sum);
    }
    return { g: G, black, across, down, runs: outRuns, solution: digits };
  }
}
