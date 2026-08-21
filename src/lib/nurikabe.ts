import { makeRng, shuffled } from "./rng";
import { floodCount } from "./latin";

export interface NurikabePuzzle {
  n: number;
  /** clue cell index → island size */
  clues: Map<number, number>;
}

/** Generate a Nurikabe board by constraint repair: start with an all-sea
 *  board and whiten one cell of every remaining 2×2 sea block, either by
 *  growing an adjacent island or seeding a new one. The construction keeps
 *  islands orthogonally separated, so a valid solution always exists;
 *  attempts where the sea ends up disconnected are retried. */
export function generateNurikabe(seed: string, n: number): NurikabePuzzle {
  const rng = makeRng(seed);
  const MAX_ISLAND = 6;

  for (let attempt = 0; attempt < 400; attempt++) {
    // island id per cell, -1 = sea
    const isle: number[] = Array(n * n).fill(-1);
    const sizes: number[] = [];

    const neighbours = (i: number): number[] => {
      const r = Math.floor(i / n), c = i % n;
      const out: number[] = [];
      if (r > 0) out.push(i - n);
      if (r < n - 1) out.push(i + n);
      if (c > 0) out.push(i - 1);
      if (c < n - 1) out.push(i + 1);
      return out;
    };

    /** The single island id orthogonally adjacent to `i`, or -1 for none,
     *  or -2 when two different islands touch it (whitening would merge). */
    const adjacentIsland = (i: number): number => {
      let found = -1;
      for (const j of neighbours(i)) {
        if (isle[j] === -1) continue;
        if (found !== -1 && isle[j] !== found) return -2;
        found = isle[j];
      }
      return found;
    };

    const seaBlock = (): number[] | null => {
      for (let r = 0; r < n - 1; r++)
        for (let c = 0; c < n - 1; c++) {
          const i = r * n + c;
          if (isle[i] === -1 && isle[i + 1] === -1 && isle[i + n] === -1 && isle[i + n + 1] === -1)
            return [i, i + 1, i + n, i + n + 1];
        }
      return null;
    };

    let ok = true;
    for (;;) {
      const block = seaBlock();
      if (!block) break;
      // Prefer growing an existing island over seeding a 1-cell one, so
      // clues trend larger and the puzzle stays interesting.
      let whitened = false;
      const order = shuffled(block, rng);
      for (const grow of [true, false]) {
        for (const cell of order) {
          const adj = adjacentIsland(cell);
          if (adj === -2) continue; // would merge two islands
          if (grow !== adj >= 0) continue;
          if (adj >= 0 && sizes[adj] >= MAX_ISLAND) continue;
          if (adj >= 0) {
            isle[cell] = adj;
            sizes[adj]++;
          } else {
            isle[cell] = sizes.length;
            sizes.push(1);
          }
          whitened = true;
          break;
        }
        if (whitened) break;
      }
      if (!whitened) { ok = false; break; }
    }
    if (!ok) continue;

    // Sea must stay one connected mass.
    const sea = isle.map((v) => v === -1);
    const seaCells = sea.reduce((a: number, b) => a + (b ? 1 : 0), 0);
    const start = sea.indexOf(true);
    if (seaCells === 0 || floodCount(sea, n, start) !== seaCells) continue;
    if (sizes.length < 2) continue; // too trivial

    // One clue per island, on a random cell of it.
    const clues = new Map<number, number>();
    for (let id = 0; id < sizes.length; id++) {
      const members = isle.flatMap((v, i) => (v === id ? [i] : []));
      clues.set(members[Math.floor(rng() * members.length)], sizes[id]);
    }
    return { n, clues };
  }

  // Practically unreachable on a 7×7 board; a fixed fallback keeps the
  // return type honest.
  return { n, clues: new Map([[0, 1], [n * n - 1, 1]]) };
}

/** Does the filled (sea) set solve the puzzle? Unfilled cells are treated
 *  as island cells; any valid configuration is accepted. */
export function nurikabeSolved(p: NurikabePuzzle, filled: boolean[]): boolean {
  const { n, clues } = p;

  // Clue cells can never be sea (the UI also blocks this).
  for (const idx of clues.keys()) if (filled[idx]) return false;

  // Sea connected and non-empty.
  const seaCells = filled.reduce((a: number, b) => a + (b ? 1 : 0), 0);
  if (seaCells === 0) return false;
  if (floodCount(filled, n, filled.indexOf(true)) !== seaCells) return false;

  // No 2×2 all-sea block.
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n - 1; c++) {
      const i = r * n + c;
      if (filled[i] && filled[i + 1] && filled[i + n] && filled[i + n + 1]) return false;
    }

  // Every white region holds exactly one clue, matching its size.
  const seen = new Set<number>();
  for (let i = 0; i < n * n; i++) {
    if (filled[i] || seen.has(i)) continue;
    const stack = [i];
    const region: number[] = [];
    seen.add(i);
    while (stack.length) {
      const j = stack.pop()!;
      region.push(j);
      const r = Math.floor(j / n), c = j % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        const k = rr * n + cc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && !filled[k] && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
    const regionClues = region.filter((j) => clues.has(j));
    if (regionClues.length !== 1) return false;
    if (clues.get(regionClues[0]) !== region.length) return false;
  }
  return true;
}
