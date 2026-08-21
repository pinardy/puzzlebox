import { makeRng, shuffled } from "./rng";

/** Random n×n Latin square (values 1..n) via seeded randomized backtracking.
 *  Shared by Futoshiki, Skyscrapers, and Hitori. */
export function generateLatin(seed: string, n: number): number[] {
  const rng = makeRng(seed);
  const grid: number[] = Array(n * n).fill(0);
  const values = Array.from({ length: n }, (_, i) => i + 1);

  const fill = (idx: number): boolean => {
    if (idx === n * n) return true;
    const r = Math.floor(idx / n), c = idx % n;
    for (const v of shuffled(values, rng)) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        if (grid[r * n + i] === v || grid[i * n + c] === v) { ok = false; break; }
      }
      if (ok) {
        grid[idx] = v;
        if (fill(idx + 1)) return true;
        grid[idx] = 0;
      }
    }
    return false;
  };

  fill(0);
  return grid;
}

/** Indices of cells reachable from `start` walking orthogonally over cells
 *  where `open` is true. Used for connectivity checks. */
export function floodCount(open: boolean[], n: number, start: number): number {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      const j = rr * n + cc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && open[j] && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size;
}
