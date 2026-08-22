import { makeRng, shuffled } from "./rng";

/** Jigsaw sudoku: 9×9 with nine irregular nine-cell regions instead of
 *  3×3 boxes. */
export interface JigsawPuzzle {
  regionOf: number[];
  puzzle: number[]; // 0 = player cell
  solution: number[];
}

const nbrs = (i: number): number[] => {
  const r = Math.floor(i / 9), c = i % 9;
  const out: number[] = [];
  if (r > 0) out.push(i - 9);
  if (r < 8) out.push(i + 9);
  if (c > 0) out.push(i - 1);
  if (c < 8) out.push(i + 1);
  return out;
};

function connected(regionOf: number[], id: number): boolean {
  const cells: number[] = [];
  for (let i = 0; i < 81; i++) if (regionOf[i] === id) cells.push(i);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length)
    for (const k of nbrs(stack.pop()!))
      if (regionOf[k] === id && !seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
  return seen.size === cells.length;
}

/** Start from the 3×3 boxes and swap cells between adjacent regions.
 *  A swap keeps both sizes at nine by construction; connectivity is
 *  checked, so the regions stay legal however far they wander. */
function makeRegions(rng: () => number, swaps: number): number[] {
  const regionOf = Array(81);
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    regionOf[i] = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  }
  let done = 0;
  for (let t = 0; t < swaps * 12 && done < swaps; t++) {
    const x = Math.floor(rng() * 81);
    const cand = nbrs(x).filter((y) => regionOf[y] !== regionOf[x]);
    if (!cand.length) continue;
    const y = cand[Math.floor(rng() * cand.length)];
    const a = regionOf[x], b = regionOf[y];
    regionOf[x] = b;
    regionOf[y] = a;
    if (connected(regionOf, a) && connected(regionOf, b)) done++;
    else {
      regionOf[x] = a;
      regionOf[y] = b;
    }
  }
  return regionOf;
}

export function jigsawPeers(regionOf: number[]): number[][] {
  const peers: number[][] = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const s = new Set<number>();
    for (let k = 0; k < 9; k++) {
      s.add(r * 9 + k);
      s.add(k * 9 + c);
    }
    for (let k = 0; k < 81; k++) if (regionOf[k] === regionOf[i]) s.add(k);
    s.delete(i);
    peers.push([...s]);
  }
  return peers;
}

function fill(grid: number[], peers: number[][], rng: () => number): boolean {
  const i = grid.indexOf(0);
  if (i === -1) return true;
  for (const d of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
    if (peers[i].some((p) => grid[p] === d)) continue;
    grid[i] = d;
    if (fill(grid, peers, rng)) return true;
    grid[i] = 0;
  }
  return false;
}

/** Count solutions up to `cap`, always branching on the most constrained
 *  cell so a wrong guess is found early. */
function countSolutions(grid: number[], peers: number[][], cap: number): number {
  let n = 0;
  const walk = () => {
    if (n >= cap) return;
    let best = -1;
    let bestOpts: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const opts: number[] = [];
      for (let d = 1; d <= 9; d++)
        if (!peers[i].some((p) => grid[p] === d)) opts.push(d);
      if (!opts.length) return;
      if (!bestOpts || opts.length < bestOpts.length) {
        best = i;
        bestOpts = opts;
      }
    }
    if (best === -1 || !bestOpts) {
      n++;
      return;
    }
    for (const d of bestOpts) {
      grid[best] = d;
      walk();
      grid[best] = 0;
      if (n >= cap) return;
    }
  };
  walk();
  return n;
}

export function generateJigsaw(seed: string, holes: number): JigsawPuzzle {
  const rng = makeRng(seed);
  for (;;) {
    const regionOf = makeRegions(rng, 120);
    const peers = jigsawPeers(regionOf);
    const solution = Array(81).fill(0);
    if (!fill(solution, peers, rng)) continue;
    const puzzle = solution.slice();
    let removed = 0;
    for (const idx of shuffled([...Array(81).keys()], rng)) {
      if (removed >= holes) break;
      const keep = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, peers, 2) !== 1) puzzle[idx] = keep;
      else removed++;
    }
    return { regionOf, puzzle, solution };
  }
}
