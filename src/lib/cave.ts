import { makeRng } from "./rng";

/** Cave (Corral, Bag): draw one closed cave. Every numbered cell lies
 *  inside it and counts the cells it can see along the four directions
 *  without leaving the cave, itself included. The cave is a single
 *  connected region, and every cell outside it must be able to reach the
 *  edge of the grid — no sealed-off pockets of rock.
 *
 *  The rock is eaten inwards from the border, which keeps the outside
 *  border-connected and the cave connected by construction. Wins are
 *  judged against the rules, so any legal cave counts. */

export interface Cave {
  n: number;
  /** Row-major clue for a numbered (always inside) cell, else null. */
  clues: (number | null)[];
  solution: boolean[]; // true = outside (rock)
}

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

const inside = (n: number, r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;

/** Cells visible from (r, c) without leaving the cave, itself included. */
export function sight(n: number, out: boolean[], r: number, c: number): number {
  let total = 1;
  for (const [dr, dc] of DIRS) {
    let rr = r + dr;
    let cc = c + dc;
    while (inside(n, rr, cc) && !out[rr * n + cc]) {
      total++;
      rr += dr;
      cc += dc;
    }
  }
  return total;
}

function components(n: number, cells: boolean[], want: boolean): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < n * n; i++) {
    if (cells[i] !== want || seen.has(i)) continue;
    const group: number[] = [];
    const queue = [i];
    seen.add(i);
    while (queue.length) {
      const j = queue.pop()!;
      group.push(j);
      const r = Math.floor(j / n);
      const c = j % n;
      for (const [dr, dc] of DIRS) {
        const rr = r + dr;
        const cc = c + dc;
        const k = rr * n + cc;
        if (inside(n, rr, cc) && cells[k] === want && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    out.push(group);
  }
  return out;
}

const onBorder = (n: number, i: number) => {
  const r = Math.floor(i / n);
  const c = i % n;
  return r === 0 || c === 0 || r === n - 1 || c === n - 1;
};

export function makeCave(seed: string, n: number, clueRatio: number): Cave {
  const rng = makeRng(`cave-${seed}`);
  const out = Array<boolean>(n * n).fill(false);
  const target = Math.round(n * n * 0.32);
  let eaten = 0;
  let guard = 0;

  // Eat rock inwards from the edge: a cell may only turn to rock if it
  // touches the border or existing rock, which keeps the rock
  // border-connected, and only if the cave stays in one piece.
  while (eaten < target && guard++ < n * n * 40) {
    const frontier: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (out[i]) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      const reachable =
        onBorder(n, i) ||
        DIRS.some(
          ([dr, dc]) => inside(n, r + dr, c + dc) && out[(r + dr) * n + (c + dc)]
        );
      if (reachable) frontier.push(i);
    }
    if (!frontier.length) break;
    const pick = frontier[Math.floor(rng() * frontier.length)];
    out[pick] = true;
    if (components(n, out, false).length !== 1) out[pick] = false;
    else eaten++;
  }

  const caveCells: number[] = [];
  for (let i = 0; i < n * n; i++) if (!out[i]) caveCells.push(i);
  const scored = caveCells
    .map((i) => {
      const v = sight(n, out, Math.floor(i / n), i % n);
      return { i, v, weight: rng() + v / (n * 4) };
    })
    .sort((a, b) => b.weight - a.weight);

  const clues: (number | null)[] = Array(n * n).fill(null);
  const wanted = Math.max(6, Math.round(caveCells.length * clueRatio));
  for (const s of scored.slice(0, wanted)) clues[s.i] = s.v;

  return { n, clues, solution: out };
}

/** Rule check: clues inside and matching, one cave, no sealed rock. */
export function caveSolved(p: Cave, out: boolean[]): boolean {
  const { n, clues } = p;
  for (let i = 0; i < n * n; i++) if (clues[i] !== null && out[i]) return false;
  if (components(n, out, false).length !== 1) return false;
  // Every pocket of rock has to reach the edge of the grid.
  for (const group of components(n, out, true))
    if (!group.some((i) => onBorder(n, i))) return false;
  for (let i = 0; i < n * n; i++) {
    const want = clues[i];
    if (want === null) continue;
    if (sight(n, out, Math.floor(i / n), i % n) !== want) return false;
  }
  return true;
}
