import { makeRng, shuffled } from "./rng";

/** Hidato: fill the grid with every number from 1 to n² so that consecutive
 *  numbers touch — diagonals included, unlike Numbrix. The solution is a
 *  king-move Hamiltonian path numbered along its length, so every board is
 *  solvable; any chain obeying the rules counts as a win. */

export interface HidatoPuzzle {
  n: number;
  givens: number[]; // 0 = player cell
  solution: number[];
}

/** The eight cells a king can step to. */
export function kingNeighbours(idx: number, n: number): number[] {
  const r = Math.floor(idx / n),
    c = idx % n;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr,
        cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
  return out;
}

export function kingAdjacent(a: number, b: number, n: number): boolean {
  const dr = Math.abs(Math.floor(a / n) - Math.floor(b / n));
  const dc = Math.abs((a % n) - (b % n));
  return dr <= 1 && dc <= 1 && a !== b;
}

/** Row-by-row boustrophedon scan — a legal king path, used as the guaranteed
 *  fallback so generation can never hang. */
function serpentine(n: number): number[] {
  const path: number[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) path.push(r * n + (r % 2 === 0 ? c : n - 1 - c));
  return path;
}

const ATTEMPTS = 60;
const STEP_BUDGET = 1500;

/** Random king-move Hamiltonian path. Neighbours are tried in Warnsdorff
 *  order (fewest onward moves first), which finds a full path almost
 *  immediately; backtracking mops up the rare dead end. A doomed attempt is
 *  cheaper to abandon than to unpick, so the step budget is deliberately
 *  tight and a fresh start is tried instead — and the attempt cap plus the
 *  serpentine fallback mean generation always terminates. */
export function kingHamiltonianPath(n: number, rng: () => number): number[] {
  const total = n * n;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const visited = Array<boolean>(total).fill(false);
    const path: number[] = [];
    let steps = 0;

    const walk = (cur: number): boolean => {
      visited[cur] = true;
      path.push(cur);
      if (path.length === total) return true;
      const opts = shuffled(
        kingNeighbours(cur, n).filter((i) => !visited[i]),
        rng
      ).sort(
        (a, b) =>
          kingNeighbours(a, n).filter((i) => !visited[i]).length -
          kingNeighbours(b, n).filter((i) => !visited[i]).length
      );
      for (const next of opts) {
        if (++steps > STEP_BUDGET) break;
        if (walk(next)) return true;
      }
      visited[cur] = false;
      path.pop();
      return false;
    };

    if (walk(Math.floor(rng() * total))) return path;
  }
  return serpentine(n);
}

export function generateHidato(seed: string, n: number, reveal: number): HidatoPuzzle {
  const rng = makeRng(seed);
  const path = kingHamiltonianPath(n, rng);
  const solution = Array<number>(n * n).fill(0);
  path.forEach((cell, k) => (solution[cell] = k + 1));

  const givens = Array<number>(n * n).fill(0);
  // The two ends anchor the chain, so they are always shown.
  givens[path[0]] = 1;
  givens[path[path.length - 1]] = n * n;
  const rest = shuffled(
    [...Array(n * n).keys()].filter((i) => givens[i] === 0),
    rng
  );
  for (const i of rest.slice(0, Math.round(n * n * reveal))) givens[i] = solution[i];
  return { n, givens, solution };
}
