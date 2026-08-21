import { makeRng, shuffled } from "./rng";

/** Zip-style path puzzle: draw one continuous line that visits every cell
 *  once, hitting the numbered checkpoints in order (1 → last). The
 *  board is built from a random Hamiltonian path, so it is always solvable;
 *  any valid covering path counts as a win. */

export interface ZipPuzzle {
  n: number;
  checkpoints: Map<number, number>; // cell index → checkpoint number (1-based)
  start: number; // cell of checkpoint 1
  last: number; // highest checkpoint number
}

function neighbours(idx: number, n: number): number[] {
  const r = Math.floor(idx / n), c = idx % n;
  const out: number[] = [];
  if (r > 0) out.push(idx - n);
  if (r < n - 1) out.push(idx + n);
  if (c > 0) out.push(idx - 1);
  if (c < n - 1) out.push(idx + 1);
  return out;
}

/** Random Hamiltonian path via Warnsdorff's heuristic (fewest onward
 *  moves first, seeded tie-breaks). Retries with a fresh start if stuck. */
function hamiltonianPath(n: number, rng: () => number): number[] {
  for (;;) {
    const visited = Array(n * n).fill(false);
    const path: number[] = [];
    let cur = Math.floor(rng() * n * n);
    visited[cur] = true;
    path.push(cur);
    while (path.length < n * n) {
      const opts = shuffled(
        neighbours(cur, n).filter((i) => !visited[i]),
        rng
      ).sort(
        (a, b) =>
          neighbours(a, n).filter((i) => !visited[i]).length -
          neighbours(b, n).filter((i) => !visited[i]).length
      );
      if (opts.length === 0) break;
      cur = opts[0];
      visited[cur] = true;
      path.push(cur);
    }
    if (path.length === n * n) return path;
  }
}

export function generateZip(seed: string, n: number, checkpointCount: number): ZipPuzzle {
  const rng = makeRng(seed);
  const path = hamiltonianPath(n, rng);
  const checkpoints = new Map<number, number>();
  // Evenly spaced along the path, always including both ends.
  for (let k = 0; k < checkpointCount; k++) {
    const pos = Math.round((k * (path.length - 1)) / (checkpointCount - 1));
    checkpoints.set(path[pos], k + 1);
  }
  return { n, checkpoints, start: path[0], last: checkpointCount };
}

export function areAdjacent(a: number, b: number, n: number): boolean {
  const ra = Math.floor(a / n), ca = a % n;
  const rb = Math.floor(b / n), cb = b % n;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}
