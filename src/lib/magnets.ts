import { makeRng, shuffled } from "./rng";

/** A cell holds nothing, a plus pole, or a minus pole. */
export type Sign = 0 | 1 | 2;

export interface MagnetsPuzzle {
  n: number;
  /** cell → id of the domino covering it */
  dominoOf: number[];
  /** domino id → its two edge-adjacent cells */
  dominoes: [number, number][];
  /** the generator's own legal board, used only for hints */
  solution: Sign[];
  /** clue lists; `null` marks a clue withheld for difficulty */
  rowPlus: (number | null)[];
  rowMinus: (number | null)[];
  colPlus: (number | null)[];
  colMinus: (number | null)[];
}

export const nbrsOf = (i: number, n: number): number[] => {
  const r = Math.floor(i / n),
    c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** Perfect matching of the grid graph by backtracking, always expanding the
 *  most constrained unmatched cell first — that ordering keeps the search
 *  linear in practice, so the step cap is only a guard against pathology. */
function tileGrid(n: number, rng: () => number): number[] | null {
  const partner = Array<number>(n * n).fill(-1);
  const order = shuffled([...Array(n * n).keys()], rng);
  let steps = 0;

  const rec = (): boolean => {
    if (++steps > 20000) return false;
    let pick = -1,
      fewest = 5;
    for (const i of order) {
      if (partner[i] !== -1) continue;
      const free = nbrsOf(i, n).filter((j) => partner[j] === -1).length;
      if (free === 0) return false;
      if (free < fewest) {
        fewest = free;
        pick = i;
      }
      if (fewest === 1) break;
    }
    if (pick === -1) return true;
    const free = nbrsOf(pick, n).filter((j) => partner[j] === -1);
    for (const j of shuffled(free, rng)) {
      partner[pick] = j;
      partner[j] = pick;
      if (rec()) return true;
      partner[pick] = -1;
      partner[j] = -1;
    }
    return false;
  };

  return rec() ? partner : null;
}

/** Brick tiling: every row of an even-width board splits into horizontal
 *  dominoes, so this is the guaranteed fallback if the search stalls. */
function brickTiling(n: number): number[] {
  const partner = Array<number>(n * n).fill(-1);
  for (let i = 0; i < n * n; i += 2) {
    partner[i] = i + 1;
    partner[i + 1] = i;
  }
  return partner;
}

/** Matching array → one ordered pair per domino, lower cell first. */
function pairsOf(partner: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < partner.length; i++) if (partner[i] > i) out.push([i, partner[i]]);
  return out;
}

const MAGNET_STATES: readonly [Sign, Sign][] = [
  [1, 2],
  [2, 1]
];

/** Choose blank / magnet-one-way / magnet-the-other for each domino so no two
 *  edge-adjacent cells share a sign. Blank never clashes, so the search only
 *  ever gives up on an orientation, never on a whole board; `target` biases it
 *  toward the wanted magnet density by trying blanks first once it is met. */
function assignSigns(
  dominoes: readonly [number, number][],
  n: number,
  rng: () => number,
  target: number
): Sign[] | null {
  const board = Array<Sign>(n * n).fill(0);
  const order = shuffled(
    dominoes.map((_, k) => k),
    rng
  );
  let magnets = 0;
  let steps = 0;

  const free = (i: number, s: Sign) =>
    s === 0 || nbrsOf(i, n).every((j) => board[j] !== s);

  const rec = (k: number): boolean => {
    if (k === order.length) return true;
    if (++steps > 40000) return false;
    const [a, b] = dominoes[order[k]];
    const mags = shuffled(MAGNET_STATES, rng);
    const opts: [Sign, Sign][] = magnets < target ? [...mags, [0, 0]] : [[0, 0], ...mags];
    for (const [sa, sb] of opts) {
      if (!free(a, sa)) continue;
      board[a] = sa;
      if (!free(b, sb)) {
        board[a] = 0;
        continue;
      }
      board[b] = sb;
      if (sa !== 0) magnets++;
      if (rec(k + 1)) return true;
      if (sa !== 0) magnets--;
      board[a] = 0;
      board[b] = 0;
    }
    return false;
  };

  return rec(0) ? board : null;
}

/** Chessboard fallback: colour the grid like a chessboard and put every
 *  magnet's plus on the light cell and its minus on the dark one. Adjacent
 *  cells always differ in colour, so that assignment can never clash. It is
 *  only a safety net — the backtracking result above is far more varied. */
function chessboardSigns(
  dominoes: readonly [number, number][],
  n: number,
  rng: () => number,
  target: number
): Sign[] {
  const board = Array<Sign>(n * n).fill(0);
  for (const k of shuffled(
    dominoes.map((_, i) => i),
    rng
  ).slice(0, target)) {
    const [a, b] = dominoes[k];
    const light = (Math.floor(a / n) + (a % n)) % 2 === 0;
    board[a] = light ? 1 : 2;
    board[b] = light ? 2 : 1;
  }
  return board;
}

/** Withheld clues are what makes a Magnets puzzle harder, so `hidden` blanks
 *  that many of the 4n clues — keeping at least one non-zero clue on show, or
 *  an untouched board would already satisfy everything. */
function hideClues(
  full: readonly number[][],
  hidden: number,
  rng: () => number
): (number | null)[][] {
  const clues: (number | null)[][] = full.map((list) => list.slice());
  const slots: [number, number][] = [];
  full.forEach((list, li) => list.forEach((_, i) => slots.push([li, i])));
  const chosen = shuffled(slots, rng).slice(0, hidden);
  for (const [li, i] of chosen) clues[li][i] = null;
  if (!clues.some((list) => list.some((v) => v !== null && v > 0)))
    for (const [li, i] of chosen) {
      if (full[li][i] > 0) {
        clues[li][i] = full[li][i];
        break;
      }
    }
  return clues;
}

/** Tile the board with dominoes, give each one a state, then read the four
 *  clue lists straight off the result. Retries with a fresh seed offset if
 *  either search stalls; falls back to a brick tiling plus the chessboard
 *  assignment, which is always legal. */
export function generateMagnets(seed: string, n: number, hidden = 0): MagnetsPuzzle {
  let partner: number[] | null = null;
  let solution: Sign[] | null = null;
  let rng = makeRng(seed);

  for (let attempt = 0; attempt < 10 && !solution; attempt++) {
    rng = makeRng(`${seed}#${attempt}`);
    partner = tileGrid(n, rng);
    if (!partner) continue;
    const cells = pairsOf(partner);
    const target = Math.round(cells.length * (0.65 + rng() * 0.1));
    solution = assignSigns(cells, n, rng, target);
  }
  if (!partner) partner = brickTiling(n);
  const dominoes = pairsOf(partner);
  if (!solution)
    solution = chessboardSigns(dominoes, n, rng, Math.round(dominoes.length * 0.7));

  const dominoOf = Array<number>(n * n).fill(-1);
  dominoes.forEach(([a, b], id) => {
    dominoOf[a] = id;
    dominoOf[b] = id;
  });

  const c = countSigns(solution, n);
  const clues = hideClues([c.rowPlus, c.rowMinus, c.colPlus, c.colMinus], hidden, rng);

  return {
    n,
    dominoOf,
    dominoes,
    solution,
    rowPlus: clues[0],
    rowMinus: clues[1],
    colPlus: clues[2],
    colMinus: clues[3]
  };
}

export interface SignCounts {
  rowPlus: number[];
  rowMinus: number[];
  colPlus: number[];
  colMinus: number[];
}

export function countSigns(board: readonly Sign[], n: number): SignCounts {
  const z = () => Array<number>(n).fill(0);
  const out: SignCounts = {
    rowPlus: z(),
    rowMinus: z(),
    colPlus: z(),
    colMinus: z()
  };
  board.forEach((s, i) => {
    const r = Math.floor(i / n),
      c = i % n;
    if (s === 1) {
      out.rowPlus[r]++;
      out.colPlus[c]++;
    } else if (s === 2) {
      out.rowMinus[r]++;
      out.colMinus[c]++;
    }
  });
  return out;
}

/** Cells sharing a sign with an edge-adjacent neighbour. */
export function clashingCells(board: readonly Sign[], n: number): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue;
    for (const j of nbrsOf(i, n))
      if (board[j] === board[i]) {
        bad.add(i);
        bad.add(j);
      }
  }
  return bad;
}

/** Dominoes the player has half-finished or filled illegally. A fully blank
 *  domino is fine, and so is one plus with one minus; anything else is wrong. */
export function brokenDominoes(p: MagnetsPuzzle, board: readonly Sign[]): Set<number> {
  const bad = new Set<number>();
  p.dominoes.forEach(([a, b], id) => {
    const x = board[a],
      y = board[b];
    if (x === 0 && y === 0) return;
    if ((x === 1 && y === 2) || (x === 2 && y === 1)) return;
    bad.add(id);
  });
  return bad;
}

/** Rule-based win: legal dominoes, no adjacent like signs, and every clue
 *  that is actually shown matched. The stored solution is never consulted. */
export function magnetsSolved(p: MagnetsPuzzle, board: readonly Sign[]): boolean {
  if (brokenDominoes(p, board).size > 0) return false;
  if (clashingCells(board, p.n).size > 0) return false;
  const got = countSigns(board, p.n);
  const lists: [(number | null)[], number[]][] = [
    [p.rowPlus, got.rowPlus],
    [p.rowMinus, got.rowMinus],
    [p.colPlus, got.colPlus],
    [p.colMinus, got.colMinus]
  ];
  return lists.every(([want, have]) => want.every((v, i) => v === null || v === have[i]));
}
