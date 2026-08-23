import { makeRng, shuffled } from "./rng";

/** LITS (Nuruomino): every outlined region holds exactly four shaded cells
 *  forming an L, I, T or S tetromino — never the square O. All shading is
 *  one orthogonally connected group, no 2x2 block is fully shaded, and two
 *  tetrominoes of the same letter never touch along an edge. */
export type Letter = "L" | "I" | "T" | "S";

export interface Piece {
  cells: number[];
  letter: Letter;
}

export interface LitsPuzzle {
  n: number;
  regionOf: number[];
  regions: number[][];
  /** Index-aligned with `regions`: the tetromino each region was seeded
   *  with, i.e. one shading that satisfies every rule. */
  pieces: Piece[];
  /** How many placement attempts the generator burned (diagnostics). */
  attempts: number;
}

type Cell = [number, number];

const BASES: Record<Letter, Cell[]> = {
  L: [[0, 0], [1, 0], [2, 0], [2, 1]],
  I: [[0, 0], [0, 1], [0, 2], [0, 3]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1]],
  S: [[0, 1], [0, 2], [1, 0], [1, 1]]
};

// Four rotations times a mirror: reflections count as the same letter, so L
// yields 8 orientations, I 2, T 4 and S 4 — the 18 non-square tetrominoes.
const TURNS: ((r: number, c: number) => Cell)[] = [
  (r, c) => [r, c],
  (r, c) => [c, -r],
  (r, c) => [-r, -c],
  (r, c) => [-c, r],
  (r, c) => [r, -c],
  (r, c) => [-c, -r],
  (r, c) => [-r, c],
  (r, c) => [c, r]
];

const normal = (cs: Cell[]): Cell[] => {
  const mr = Math.min(...cs.map((p) => p[0]));
  const mc = Math.min(...cs.map((p) => p[1]));
  return cs
    .map(([r, c]) => [r - mr, c - mc] as Cell)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};

const keyOf = (cs: Cell[]): string => cs.map((p) => `${p[0]},${p[1]}`).join(";");

interface Orientation {
  letter: Letter;
  cells: Cell[];
  h: number;
  w: number;
}

const ORIENTS: Orientation[] = [];
const LETTER_OF = new Map<string, Letter>();
for (const letter of ["L", "I", "T", "S"] as Letter[]) {
  for (const turn of TURNS) {
    const cells = normal(BASES[letter].map(([r, c]) => turn(r, c)));
    const k = keyOf(cells);
    if (LETTER_OF.has(k)) continue;
    LETTER_OF.set(k, letter);
    ORIENTS.push({
      letter,
      cells,
      h: Math.max(...cells.map((p) => p[0])) + 1,
      w: Math.max(...cells.map((p) => p[1])) + 1
    });
  }
}

const nbrsOf = (i: number, n: number): number[] => {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** The letter four cells spell, or null if they are disjoint, a square, or
 *  anything else that is not an L/I/T/S tetromino. */
export function classify(cells: number[], n: number): Letter | null {
  if (cells.length !== 4) return null;
  const cs = cells.map((i) => [Math.floor(i / n), i % n] as Cell);
  return LETTER_OF.get(keyOf(normal(cs))) ?? null;
}

const linked = (cells: number[], n: number): boolean => {
  if (!cells.length) return false;
  const want = new Set(cells);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop() as number;
    for (const j of nbrsOf(i, n))
      if (want.has(j) && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
  }
  return seen.size === want.size;
};

const allPlacements = (n: number): Piece[] => {
  const out: Piece[] = [];
  for (const o of ORIENTS)
    for (let r = 0; r + o.h <= n; r++)
      for (let c = 0; c + o.w <= n; c++)
        out.push({
          letter: o.letter,
          cells: o.cells.map(([dr, dc]) => (r + dr) * n + (c + dc))
        });
  return out;
};

/** Can `p` join the board? Rejects a same-letter edge contact, a 2x2 that
 *  would end up fully shaded, and — once something is down — any placement
 *  that floats free, which is what keeps the union connected. */
function fits(
  p: Piece,
  letterAt: (Letter | null)[],
  n: number,
  needTouch: boolean
): boolean {
  const own = new Set(p.cells);
  let touch = false;
  for (const i of p.cells)
    for (const j of nbrsOf(i, n)) {
      const l = letterAt[j];
      if (!l) continue;
      if (l === p.letter) return false;
      touch = true;
    }
  if (needTouch && !touch) return false;
  for (const i of p.cells) {
    const r = Math.floor(i / n), c = i % n;
    for (const [r0, c0] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]]) {
      if (r0 < 0 || c0 < 0 || r0 + 1 >= n || c0 + 1 >= n) continue;
      const q = [r0 * n + c0, r0 * n + c0 + 1, (r0 + 1) * n + c0, (r0 + 1) * n + c0 + 1];
      if (q.every((k) => own.has(k) || letterAt[k])) return false;
    }
  }
  return true;
}

/** Greedily pack tetrominoes, each hugging the ones already down. */
function placePieces(n: number, rng: () => number): Piece[] {
  const letterAt: (Letter | null)[] = Array(n * n).fill(null);
  let live = shuffled(allPlacements(n), rng);
  const pieces: Piece[] = [];
  for (;;) {
    const keep: Piece[] = [];
    let put: Piece | null = null;
    for (const p of live) {
      if (put) {
        keep.push(p);
        continue;
      }
      if (p.cells.some((i) => letterAt[i])) continue; // overlaps: dead forever
      if (fits(p, letterAt, n, pieces.length > 0)) put = p;
      else keep.push(p);
    }
    live = keep;
    if (!put) return pieces;
    for (const i of put.cells) letterAt[i] = put.letter;
    pieces.push(put);
  }
}

/** Round-robin flood from each seed piece until every cell has a region. */
function growRegions(n: number, pieces: Piece[], rng: () => number) {
  const regionOf: number[] = Array(n * n).fill(-1);
  const regions = pieces.map((p, id) => {
    for (const i of p.cells) regionOf[i] = id;
    return p.cells.slice();
  });
  const ids = [...regions.keys()];
  let free = [...Array(n * n).keys()].filter((i) => regionOf[i] === -1);
  let guard = n * n * 4;
  while (free.length && guard-- > 0) {
    for (const id of shuffled(ids, rng)) {
      const frontier = regions[id].flatMap((i) =>
        nbrsOf(i, n).filter((j) => regionOf[j] === -1)
      );
      if (!frontier.length) continue;
      const pick = frontier[Math.floor(rng() * frontier.length)];
      regionOf[pick] = id;
      regions[id].push(pick);
    }
    free = [...Array(n * n).keys()].filter((i) => regionOf[i] === -1);
  }
  return { regionOf, regions };
}

const MAX_TRIES = 8;

/** Seed the board with legal, mutually compatible tetrominoes, then grow a
 *  region around each one. Every region therefore contains its own
 *  tetromino, so the puzzle is solvable by construction. Retries only chase
 *  a healthy region count, and are capped. */
export function generateLits(seed: string, n: number): LitsPuzzle {
  const rng = makeRng(seed);
  const want = Math.max(4, Math.floor((n * n) / 6));
  let best: Piece[] = [];
  let attempts = 0;
  for (let t = 0; t < MAX_TRIES; t++) {
    attempts++;
    const pieces = placePieces(n, rng);
    if (!linked(pieces.flatMap((p) => p.cells), n)) continue;
    if (pieces.length > best.length) best = pieces;
    if (best.length >= want) break;
  }
  const { regionOf, regions } = growRegions(n, best, rng);
  return { n, regionOf, regions, pieces: best, attempts };
}

export interface LitsAnalysis {
  /** Per region: the letter it spells, or null while it is not a tetromino. */
  letters: (Letter | null)[];
  /** Per region: too many shaded cells, or four that spell nothing legal. */
  badRegion: boolean[];
  /** Cells sitting in a fully shaded 2x2. */
  square: Set<number>;
  /** Cells of two same-letter tetrominoes that touch along an edge. */
  clash: Set<number>;
  linked: boolean;
  shaded: number;
  solved: boolean;
}

/** One pass over the board producing everything the UI marks up, and the
 *  win test: rule-based, since a region larger than four cells generally
 *  admits more than one tetromino. */
export function analyseLits(p: LitsPuzzle, shaded: boolean[]): LitsAnalysis {
  const { n, regions } = p;
  const on = regions.map((cells) => cells.filter((i) => shaded[i]));
  const letters = on.map((cells) => (cells.length === 4 ? classify(cells, n) : null));
  const badRegion = on.map((cells, id) => cells.length > 4 || (cells.length === 4 && !letters[id]));

  const square = new Set<number>();
  for (let r = 0; r + 1 < n; r++)
    for (let c = 0; c + 1 < n; c++) {
      const q = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
      if (q.every((i) => shaded[i])) for (const i of q) square.add(i);
    }

  const clash = new Set<number>();
  for (let a = 0; a < regions.length; a++) {
    if (!letters[a]) continue;
    for (let b = a + 1; b < regions.length; b++) {
      if (letters[b] !== letters[a]) continue;
      const other = new Set(on[b]);
      if (!on[a].some((i) => nbrsOf(i, n).some((j) => other.has(j)))) continue;
      for (const i of on[a]) clash.add(i);
      for (const i of on[b]) clash.add(i);
    }
  }

  const all = [...Array(n * n).keys()].filter((i) => shaded[i]);
  const whole = linked(all, n);
  return {
    letters,
    badRegion,
    square,
    clash,
    linked: whole,
    shaded: all.length,
    solved:
      letters.every((l) => l !== null) &&
      square.size === 0 &&
      clash.size === 0 &&
      whole
  };
}
