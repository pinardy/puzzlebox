import { makeRng, shuffled } from "./rng";

/** Kurodoko (Kuromasu): blacken cells so that no two blacks touch edge to
 *  edge, every white cell stays connected to every other, and each
 *  numbered cell counts exactly how many white cells it can see — itself
 *  plus the unbroken white runs in all four directions.
 *
 *  Blacks are placed one at a time, each kept only if the whites stay
 *  connected, so the puzzle always has at least the solution it was built
 *  from. Wins are judged against the rules, so any legal answer counts. */

export interface Kurodoko {
  n: number;
  /** Row-major clue for a numbered (always white) cell, else null. */
  clues: (number | null)[];
  solution: boolean[]; // true = black
}

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

const inside = (n: number, r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;

/** White cells visible from (r, c), counting itself, stopping at blacks. */
export function seenFrom(n: number, black: boolean[], r: number, c: number): number {
  let total = 1;
  for (const [dr, dc] of DIRS) {
    let rr = r + dr;
    let cc = c + dc;
    while (inside(n, rr, cc) && !black[rr * n + cc]) {
      total++;
      rr += dr;
      cc += dc;
    }
  }
  return total;
}

/** Are all white cells one orthogonally connected region? */
export function whitesConnected(n: number, black: boolean[]): boolean {
  const whites = black.reduce((a, b) => a + (b ? 0 : 1), 0);
  const first = black.indexOf(false);
  if (first < 0) return false;
  const seen = new Set([first]);
  const queue = [first];
  while (queue.length) {
    const i = queue.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      const j = rr * n + cc;
      if (inside(n, rr, cc) && !black[j] && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === whites;
}

const touchesBlack = (n: number, black: boolean[], r: number, c: number) =>
  DIRS.some(([dr, dc]) => inside(n, r + dr, c + dc) && black[(r + dr) * n + (c + dc)]);

export function makeKurodoko(seed: string, n: number, clueRatio: number): Kurodoko {
  const rng = makeRng(`kurodoko-${seed}`);
  const black = Array<boolean>(n * n).fill(false);
  const target = Math.round(n * n * 0.2);
  let placed = 0;

  for (const i of shuffled([...Array(n * n).keys()], rng)) {
    if (placed >= target) break;
    const r = Math.floor(i / n);
    const c = i % n;
    if (touchesBlack(n, black, r, c)) continue;
    black[i] = true;
    if (!whitesConnected(n, black)) black[i] = false;
    else placed++;
  }

  // Number a spread of white cells. Bigger sight-lines carry more
  // information, so weight towards them a little.
  const whites: number[] = [];
  for (let i = 0; i < n * n; i++) if (!black[i]) whites.push(i);
  const scored = whites
    .map((i) => {
      const v = seenFrom(n, black, Math.floor(i / n), i % n);
      return { i, v, weight: rng() + v / (n * 4) };
    })
    .sort((a, b) => b.weight - a.weight);

  const clues: (number | null)[] = Array(n * n).fill(null);
  const wanted = Math.max(6, Math.round(whites.length * clueRatio));
  for (const s of scored.slice(0, wanted)) clues[s.i] = s.v;

  return { n, clues, solution: black };
}

/** Rule check: clues white and matching, no two blacks adjacent, whites
 *  all connected. */
export function kurodokoSolved(p: Kurodoko, black: boolean[]): boolean {
  const { n, clues } = p;
  for (let i = 0; i < n * n; i++) {
    if (clues[i] !== null && black[i]) return false;
    if (!black[i]) continue;
    const r = Math.floor(i / n);
    const c = i % n;
    if (touchesBlackExcept(n, black, r, c)) return false;
  }
  for (let i = 0; i < n * n; i++) {
    const want = clues[i];
    if (want === null) continue;
    if (seenFrom(n, black, Math.floor(i / n), i % n) !== want) return false;
  }
  return whitesConnected(n, black);
}

/** Adjacency test for a cell that is itself black. */
const touchesBlackExcept = (n: number, black: boolean[], r: number, c: number) =>
  DIRS.some(([dr, dc]) => inside(n, r + dr, c + dc) && black[(r + dr) * n + (c + dc)]);
