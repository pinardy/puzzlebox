import { makeRng, shuffled } from "./rng";

/** Ripple Effect: the board is cut into rooms of one to five cells, a room
 *  of k cells holds 1..k once each, and where a value v repeats in a row or
 *  a column the two copies must sit more than v cells apart. */
export const MAX_ROOM = 5;
const VALUES = [1, 2, 3, 4, 5];
const PROBE_NODES = 120000;
const MAX_LAYOUTS = 120;

export interface RipplePuzzle {
  n: number;
  roomOf: number[];
  rooms: number[][];
  roomSize: number[]; // per cell: the largest value that may go there
  givens: number[]; // 0 = player cell
  solution: number[];
}

interface Layout {
  roomOf: number[];
  rooms: number[][];
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

/** Scatter seeds with a couple of cells of clearance, grow them
 *  round-robin towards their target sizes, then give each cell left over
 *  to a neighbouring room that still has space — or a room of its own. */
function makeRooms(n: number, rng: () => number): Layout {
  const N = n * n;
  const roomOf = Array<number>(N).fill(-1);
  const rooms: number[][] = [];
  const want: number[] = [];

  const open = (i: number) => roomOf[i] === -1;
  const addRoom = (i: number) => {
    roomOf[i] = rooms.length;
    want.push(1 + Math.floor(rng() * MAX_ROOM));
    rooms.push([i]);
  };
  const crowded = (i: number) =>
    nbrsOf(i, n).some((j) => !open(j) || nbrsOf(j, n).some((k) => !open(k)));

  for (const i of shuffled([...Array(N).keys()], rng))
    if (open(i) && !crowded(i)) addRoom(i);

  for (;;) {
    let grew = false;
    for (const cells of shuffled(rooms, rng)) {
      const id = roomOf[cells[0]];
      if (cells.length >= want[id]) continue;
      const frontier = cells.flatMap((i) => nbrsOf(i, n).filter(open));
      if (!frontier.length) continue;
      const pick = frontier[Math.floor(rng() * frontier.length)];
      roomOf[pick] = id;
      cells.push(pick);
      grew = true;
    }
    if (grew) continue;
    const left = [...Array(N).keys()].filter(open);
    if (!left.length) return { roomOf, rooms };
    for (const i of left) {
      const host = shuffled(nbrsOf(i, n), rng).find(
        (j) => !open(j) && rooms[roomOf[j]].length < MAX_ROOM
      );
      if (host === undefined) addRoom(i);
      else {
        roomOf[i] = roomOf[host];
        rooms[roomOf[host]].push(i);
      }
    }
  }
}

/** The safety net: every row cut into runs of up to five cells, each row
 *  offset three columns from the one above so the cuts fall diagonally.
 *  The tests check this layout fills at every size we ship. */
function bandRooms(n: number): Layout {
  const roomOf = Array<number>(n * n).fill(-1);
  const rooms: number[][] = [];
  const seen = new Map<number, number>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const band = r * n + Math.floor((c + 3 * r) / MAX_ROOM);
      let id = seen.get(band);
      if (id === undefined) {
        id = rooms.length;
        seen.set(band, id);
        rooms.push([]);
      }
      roomOf[r * n + c] = id;
      rooms[id].push(r * n + c);
    }
  return { roomOf, rooms };
}

/** May v go in cell i: small enough for its room, no twin in that room,
 *  and no equal value within v cells along the row or the column. */
const fits = (
  n: number,
  roomOf: number[],
  rooms: number[][],
  cur: number[],
  i: number,
  v: number
): boolean => {
  if (v > rooms[roomOf[i]].length) return false;
  for (const j of rooms[roomOf[i]]) if (j !== i && cur[j] === v) return false;
  const r = Math.floor(i / n), c = i % n;
  for (let d = 1; d <= v; d++) {
    if (c - d >= 0 && cur[i - d] === v) return false;
    if (c + d < n && cur[i + d] === v) return false;
    if (r - d >= 0 && cur[i - d * n] === v) return false;
    if (r + d < n && cur[i + d * n] === v) return false;
  }
  return true;
};

export interface SolveOut {
  count: number;
  solution: number[] | null;
  capped: boolean; // ran out of nodes, so `count` is only a floor
}

/** Backtracking solver, stopping once `wanted` solutions are in hand. With
 *  an rng it walks the cells in index order and tries values in a fresh
 *  random order at each one, which is what varies the generated grid;
 *  without one it takes the most constrained cell first, which is far
 *  better at proving a puzzle has no second solution. */
export function solveRipple(
  n: number,
  roomOf: number[],
  rooms: number[][],
  start: readonly number[],
  wanted: number,
  rng?: () => number,
  maxNodes = PROBE_NODES
): SolveOut {
  const N = n * n;
  const cur = start.slice();
  let count = 0;
  let solution: number[] | null = null;
  let nodes = 0;
  let capped = false;

  const nextCell = (): number => {
    if (rng) return cur.indexOf(0);
    let best = -1, bestK = MAX_ROOM + 1;
    for (let i = 0; i < N; i++) {
      if (cur[i] !== 0) continue;
      let k = 0;
      for (const v of VALUES) if (fits(n, roomOf, rooms, cur, i, v)) k++;
      if (k < bestK) {
        bestK = k;
        best = i;
        if (k <= 1) break;
      }
    }
    return best;
  };

  const walk = (): boolean => {
    if (++nodes > maxNodes) {
      capped = true;
      return true;
    }
    const i = nextCell();
    if (i === -1) {
      count++;
      if (!solution) solution = cur.slice();
      return count >= wanted;
    }
    for (const v of rng ? shuffled(VALUES, rng) : VALUES) {
      if (!fits(n, roomOf, rooms, cur, i, v)) continue;
      cur[i] = v;
      const stop = walk();
      cur[i] = 0;
      if (stop) return true;
    }
    return false;
  };
  walk();
  return { count, solution, capped };
}

/** Cells breaking a rule right now: a value too big for its room, a repeat
 *  inside a room, or a pair of equal values too close in a line. */
export function rippleConflicts(
  n: number,
  roomOf: number[],
  rooms: number[][],
  board: readonly number[]
): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < n * n; i++) {
    const v = board[i];
    if (v === 0) continue;
    if (v > rooms[roomOf[i]].length) bad.add(i);
    for (const j of rooms[roomOf[i]])
      if (j !== i && board[j] === v) {
        bad.add(i);
        bad.add(j);
      }
    const r = Math.floor(i / n), c = i % n;
    for (let d = 1; d <= v; d++) {
      if (c + d < n && board[i + d] === v) {
        bad.add(i);
        bad.add(i + d);
      }
      if (r + d < n && board[i + d * n] === v) {
        bad.add(i);
        bad.add(i + d * n);
      }
    }
  }
  return bad;
}

/** The win test, read straight off the rules: every cell filled, every
 *  room a clean 1..k, and no ripple pair sitting too close. */
export function rippleSolved(
  n: number,
  roomOf: number[],
  rooms: number[][],
  board: readonly number[]
): boolean {
  if (board.some((v) => v === 0)) return false;
  for (const cells of rooms) {
    const vals = cells.map((i) => board[i]).sort((a, b) => a - b);
    if (vals.some((v, k) => v !== k + 1)) return false;
  }
  return rippleConflicts(n, roomOf, rooms, board).size === 0;
}

/** Strip givens in a seeded order, keeping each removal only while the
 *  puzzle still has exactly one solution. */
function carve(
  n: number,
  layout: Layout,
  solution: number[],
  target: number,
  rng: () => number
): RipplePuzzle {
  const { roomOf, rooms } = layout;
  const givens = solution.slice();
  let kept = n * n;
  for (const i of shuffled([...Array(n * n).keys()], rng)) {
    if (kept <= target) break;
    const v = givens[i];
    givens[i] = 0;
    const probe = solveRipple(n, roomOf, rooms, givens, 2);
    if (probe.capped || probe.count !== 1) givens[i] = v;
    else kept--;
  }
  return {
    n,
    roomOf,
    rooms,
    roomSize: roomOf.map((id) => rooms[id].length),
    givens,
    solution
  };
}

/** Draw a layout, fill it, carve it. Plenty of random layouts admit no
 *  fill at all (two touching one-cell rooms would both need a 1), so a
 *  failed fill just draws another; the node budget starts small to keep
 *  those retries cheap and opens up if the board is being stubborn. */
export function generateRipple(seed: string, n: number, givenRate: number): RipplePuzzle {
  const rng = makeRng(seed);
  const N = n * n;
  const blank = Array<number>(N).fill(0);
  const target = Math.max(2, Math.round(N * givenRate));

  for (let attempt = 0; attempt < MAX_LAYOUTS; attempt++) {
    const layout = makeRooms(n, rng);
    const budget = attempt < 100 ? 2500 : 25000;
    const filled = solveRipple(
      n,
      layout.roomOf,
      layout.rooms,
      blank,
      1,
      rng,
      budget
    );
    if (filled.solution) return carve(n, layout, filled.solution, target, rng);
  }
  // Every random layout came up empty — the band layout always fills.
  const band = bandRooms(n);
  const filled = solveRipple(n, band.roomOf, band.rooms, blank, 1);
  return carve(n, band, filled.solution!, target, rng);
}
