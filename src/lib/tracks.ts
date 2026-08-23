import { makeRng, shuffled } from "./rng";

/** Train Tracks: one railway line crosses the grid from a fixed entrance on
 *  one edge to a fixed exit on another. A cell holds a piece, stored as the
 *  bitmask of the two directions its rails open into (0 = bare ground). */

export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;

/** Tap order: the two straights, then the four curves. */
export const PIECES = [
  EAST | WEST,
  NORTH | SOUTH,
  NORTH | EAST,
  NORTH | WEST,
  SOUTH | EAST,
  SOUTH | WEST
];

export const GLYPH: Record<number, string> = {
  [EAST | WEST]: "─",
  [NORTH | SOUTH]: "│",
  [NORTH | EAST]: "└",
  [NORTH | WEST]: "┘",
  [SOUTH | EAST]: "┌",
  [SOUTH | WEST]: "┐"
};

export const PIECE_NAME: Record<number, string> = {
  [EAST | WEST]: "west to east",
  [NORTH | SOUTH]: "north to south",
  [NORTH | EAST]: "north to east",
  [NORTH | WEST]: "north to west",
  [SOUTH | EAST]: "south to east",
  [SOUTH | WEST]: "south to west"
};

const DIRS = [NORTH, EAST, SOUTH, WEST];
const STEP: Record<number, [number, number]> = {
  [NORTH]: [-1, 0],
  [EAST]: [0, 1],
  [SOUTH]: [1, 0],
  [WEST]: [0, -1]
};
const OPPOSITE: Record<number, number> = {
  [NORTH]: SOUTH,
  [SOUTH]: NORTH,
  [EAST]: WEST,
  [WEST]: EAST
};

/** A rail end that leaves the board: the edge cell and the direction it
 *  points off the grid. */
export interface Endpoint {
  cell: number;
  out: number;
}

export interface TracksPuzzle {
  n: number;
  entry: Endpoint;
  exit: Endpoint;
  rowCounts: number[];
  colCounts: number[];
  givens: number[]; // masks, 0 = the player's to fill
  solution: number[]; // the generator's line, one mask per cell
}

const edgeEndpoints = (n: number): Endpoint[] => {
  const out: Endpoint[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (r === 0) out.push({ cell: i, out: NORTH });
      if (r === n - 1) out.push({ cell: i, out: SOUTH });
      if (c === 0) out.push({ cell: i, out: WEST });
      if (c === n - 1) out.push({ cell: i, out: EAST });
    }
  return out;
};

const dirBetween = (from: number, to: number, n: number): number => {
  const d = to - from;
  if (d === -n) return NORTH;
  if (d === n) return SOUTH;
  return d === 1 ? EAST : WEST;
};

/** Randomised self-avoiding walk from `from` to `to` of at least `minLen`
 *  cells, backtracking out of dead ends. Gives up once the expansion budget
 *  runs out so a hopeless endpoint pair can't hang the generator. */
function findPath(
  n: number,
  from: number,
  to: number,
  minLen: number,
  rng: () => number,
  budget: number
): number[] | null {
  const seen = new Uint8Array(n * n);
  const path: number[] = [];
  let left = budget;

  const walk = (i: number): boolean => {
    path.push(i);
    seen[i] = 1;
    if (i === to) {
      if (path.length >= minLen) return true;
    } else if (left-- > 0) {
      const r = Math.floor(i / n), c = i % n;
      for (const d of shuffled(DIRS, rng)) {
        const [dr, dc] = STEP[d];
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const j = rr * n + cc;
        if (seen[j]) continue;
        if (walk(j)) return true;
      }
    }
    path.pop();
    seen[i] = 0;
    return false;
  };

  return walk(from) ? path : null;
}

/** Each cell's piece is fixed by where the line comes in and where it goes
 *  out; the two end cells take their second opening from the board edge. */
const piecesAlong = (
  path: number[],
  entry: Endpoint,
  exit: Endpoint,
  n: number
): number[] => {
  const cells = Array(n * n).fill(0);
  path.forEach((cell, k) => {
    const back = k === 0 ? entry.out : dirBetween(cell, path[k - 1], n);
    const fwd = k === path.length - 1 ? exit.out : dirBetween(cell, path[k + 1], n);
    cells[cell] = back | fwd;
  });
  return cells;
};

/** A serpentine line, used only if every randomised attempt fails: it always
 *  exists, so the generator never returns without a solvable board. */
const serpentine = (n: number): { path: number[]; entry: Endpoint; exit: Endpoint } => {
  const path: number[] = [];
  for (let r = 0; r < n; r++)
    for (let k = 0; k < n; k++) {
      const c = r % 2 === 0 ? k : n - 1 - k;
      path.push(r * n + c);
    }
  const last = path[path.length - 1];
  return {
    path,
    entry: { cell: path[0], out: WEST },
    exit: { cell: last, out: SOUTH }
  };
};

export function generateTracks(seed: string, n: number): TracksPuzzle {
  const rng = makeRng(seed);
  const ends = edgeEndpoints(n);
  let path: number[] | null = null;
  let entry = ends[0];
  let exit = ends[1];

  for (let attempt = 0; attempt < 60 && !path; attempt++) {
    entry = ends[Math.floor(rng() * ends.length)];
    // A different side keeps the two ends visually distinct and the line long.
    const others = ends.filter((e) => e.out !== entry.out && e.cell !== entry.cell);
    exit = others[Math.floor(rng() * others.length)];
    path = findPath(n, entry.cell, exit.cell, 2 * n, rng, 4000);
  }
  if (!path) ({ path, entry, exit } = serpentine(n));

  const solution = piecesAlong(path, entry, exit, n);
  const rowCounts = Array(n).fill(0);
  const colCounts = Array(n).fill(0);
  for (let i = 0; i < n * n; i++)
    if (solution[i]) {
      rowCounts[Math.floor(i / n)]++;
      colCounts[i % n]++;
    }

  // The player must know where the line starts and ends, so both ends are
  // always given; a third piece somewhere along the line is a coin flip.
  const givens = Array(n * n).fill(0);
  givens[entry.cell] = solution[entry.cell];
  givens[exit.cell] = solution[exit.cell];
  if (rng() < 0.5) {
    const middle = shuffled(
      path.filter((i) => i !== entry.cell && i !== exit.cell),
      rng
    );
    if (middle.length) givens[middle[0]] = solution[middle[0]];
  }

  return { n, entry, exit, rowCounts, colCounts, givens, solution };
}

const bits = (mask: number): number[] => DIRS.filter((d) => mask & d);

/** Track cells whose rails demonstrably clash: an end running off the board
 *  anywhere but the entrance or exit, or an end butting into a piece that
 *  doesn't open back. Ends facing bare ground are just unfinished, not wrong. */
export function mismatched(board: number[], p: TracksPuzzle): Set<number> {
  const { n, entry, exit } = p;
  const bad = new Set<number>();
  for (let i = 0; i < n * n; i++) {
    if (!board[i]) continue;
    const r = Math.floor(i / n), c = i % n;
    for (const d of bits(board[i])) {
      const [dr, dc] = STEP[d];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) {
        const legal =
          (i === entry.cell && d === entry.out) || (i === exit.cell && d === exit.out);
        if (!legal) bad.add(i);
        continue;
      }
      const j = rr * n + cc;
      if (board[j] && !(board[j] & OPPOSITE[d])) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

/** A win is any layout that obeys the rules, not just the generator's line:
 *  the counts match, every rail end meets a rail end, and the track forms a
 *  single run with exactly two ends leaving the board. */
export function checkTracks(board: number[], p: TracksPuzzle): boolean {
  const { n, entry, exit, rowCounts, colCounts } = p;
  const rows = Array(n).fill(0);
  const cols = Array(n).fill(0);
  const cells: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (!board[i]) continue;
    if (!PIECES.includes(board[i])) return false;
    rows[Math.floor(i / n)]++;
    cols[i % n]++;
    cells.push(i);
  }
  if (!rows.every((v, r) => v === rowCounts[r])) return false;
  if (!cols.every((v, c) => v === colCounts[c])) return false;
  if (!cells.length) return false;

  let offBoard = 0;
  for (const i of cells) {
    const r = Math.floor(i / n), c = i % n;
    for (const d of bits(board[i])) {
      const [dr, dc] = STEP[d];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) {
        const legal =
          (i === entry.cell && d === entry.out) || (i === exit.cell && d === exit.out);
        if (!legal) return false;
        offBoard++;
        continue;
      }
      const j = rr * n + cc;
      if (!board[j] || !(board[j] & OPPOSITE[d])) return false;
    }
  }
  if (offBoard !== 2) return false;

  // Every piece has degree two, so one component with two loose ends can
  // only be a single unbroken run from the entrance to the exit.
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n), c = i % n;
    for (const d of bits(board[i])) {
      const [dr, dc] = STEP[d];
      const j = (r + dr) * n + (c + dc);
      if (r + dr < 0 || r + dr >= n || c + dc < 0 || c + dc >= n) continue;
      if (!seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}
