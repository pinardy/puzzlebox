import { makeRng } from "./rng";

/** Heyawake: rectangular rooms, some numbered with how many of their
 *  cells are shaded. Shaded cells never touch; unshaded cells form one
 *  connected group; and no straight unshaded run crosses three rooms. */
export interface Room {
  r0: number;
  c0: number;
  h: number;
  w: number;
}

export interface HeyawakePuzzle {
  n: number;
  rooms: Room[];
  roomOf: number[];
  clue: (number | null)[]; // per room
  solution: boolean[]; // true = shaded
}

function makeRooms(n: number, rng: () => number): Room[] {
  const rooms: Room[] = [];
  const split = (r0: number, c0: number, h: number, w: number) => {
    const area = h * w;
    if (area <= 2 || (area <= 6 && rng() < 0.45)) {
      rooms.push({ r0, c0, h, w });
      return;
    }
    if (h >= w && h > 1) {
      const cut = 1 + Math.floor(rng() * (h - 1));
      split(r0, c0, cut, w);
      split(r0 + cut, c0, h - cut, w);
    } else if (w > 1) {
      const cut = 1 + Math.floor(rng() * (w - 1));
      split(r0, c0, h, cut);
      split(r0, c0 + cut, h, w - cut);
    } else rooms.push({ r0, c0, h, w });
  };
  split(0, 0, n, n);
  return rooms;
}

/** Randomised depth-first shading. Adjacency and the three-room rule
 *  prune as we go; connectivity can only be judged once the last cell is
 *  placed, so it gates the leaf rather than filtering afterwards. */
function shade(
  n: number,
  roomOf: number[],
  rng: () => number,
  bias: number
): boolean[] | null {
  const N = n * n;
  const cell = new Int8Array(N).fill(-1);
  let nodes = 0;

  const runSpansThree = (i: number, horiz: boolean): boolean => {
    const r = Math.floor(i / n), c = i % n;
    const rooms = new Set([roomOf[i]]);
    for (let k = 1; ; k++) {
      const rr = horiz ? r : r - k;
      const cc = horiz ? c - k : c;
      if (rr < 0 || cc < 0) break;
      const j = rr * n + cc;
      if (cell[j] !== 0) break;
      rooms.add(roomOf[j]);
      if (rooms.size >= 3) return true;
    }
    return false;
  };

  /** An unshaded cell whose every neighbour is shaded can never join the
   *  connected group, so the branch is already dead. */
  const sealed = (j: number): boolean => {
    const r = Math.floor(j / n), c = j % n;
    for (const k of [
      r > 0 ? j - n : -1,
      r < n - 1 ? j + n : -1,
      c > 0 ? j - 1 : -1,
      c < n - 1 ? j + 1 : -1
    ])
      if (k !== -1 && cell[k] !== 1) return false;
    return true;
  };

  const allConnected = (): boolean => {
    const start = [...cell].findIndex((v) => v === 0);
    if (start === -1) return false;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const j = stack.pop()!;
      const r = Math.floor(j / n), c = j % n;
      for (const k of [
        r > 0 ? j - n : -1,
        r < n - 1 ? j + n : -1,
        c > 0 ? j - 1 : -1,
        c < n - 1 ? j + 1 : -1
      ])
        if (k !== -1 && cell[k] === 0 && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
    }
    return seen.size === [...cell].filter((v) => v === 0).length;
  };

  const walk = (i: number): boolean => {
    if (++nodes > 60000) return false;
    if (i === N) return allConnected();
    const r = Math.floor(i / n), c = i % n;
    for (const v of rng() < bias ? [1, 0] : [0, 1]) {
      if (v === 1) {
        if (c > 0 && cell[i - 1] === 1) continue;
        if (r > 0 && cell[i - n] === 1) continue;
      }
      cell[i] = v;
      if (v === 0 && (runSpansThree(i, true) || runSpansThree(i, false))) {
        cell[i] = -1;
        continue;
      }
      if (r > 0 && cell[i - n] === 0 && sealed(i - n)) {
        cell[i] = -1;
        continue;
      }
      if (r === n - 1 && v === 0 && sealed(i)) {
        cell[i] = -1;
        continue;
      }
      if (walk(i + 1)) return true;
      cell[i] = -1;
    }
    return false;
  };

  return walk(0) ? Array.from(cell, (v) => v === 1) : null;
}

export function generateHeyawake(
  seed: string,
  n: number,
  clueRate: number
): HeyawakePuzzle {
  const rng = makeRng(seed);
  for (;;) {
    const rooms = makeRooms(n, rng);
    if (rooms.length < 5) continue;
    const roomOf = Array(n * n).fill(0);
    rooms.forEach((rm, id) => {
      for (let r = rm.r0; r < rm.r0 + rm.h; r++)
        for (let c = rm.c0; c < rm.c0 + rm.w; c++) roomOf[r * n + c] = id;
    });
    const solution = shade(n, roomOf, rng, 0.5);
    if (!solution) continue;
    if (solution.filter(Boolean).length < n) continue;

    const counts = rooms.map((rm) => {
      let k = 0;
      for (let r = rm.r0; r < rm.r0 + rm.h; r++)
        for (let c = rm.c0; c < rm.c0 + rm.w; c++)
          if (solution[r * n + c]) k++;
      return k;
    });
    // Always number the single-cell rooms — they read as givens — plus a
    // share of the rest.
    const clue = counts.map((k, id) =>
      rooms[id].h * rooms[id].w === 1 || rng() < clueRate ? k : null
    );
    if (clue.every((c) => c === null)) continue;
    return { n, rooms, roomOf, clue, solution };
  }
}
