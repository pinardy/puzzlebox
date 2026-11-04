/** Waffle: a 5x5 lattice of six interlocking five-letter words — three
 *  across (rows 0, 2, 4) and three down (columns 0, 2, 4). The four cells
 *  at the corners of the middle band are holes, so 21 of 25 cells hold a
 *  letter. The player swaps letters back into place inside a budget. */

import { WORDS } from "./dict";
import { ANSWERS } from "./words";
import { makeRng } from "./rng";

export const HOLES: readonly number[] = [6, 8, 16, 18];

/** The 21 cells that hold a letter, in reading order. */
export const LETTER_CELLS: readonly number[] = [...Array(25).keys()].filter(
  (i) => !HOLES.includes(i)
);

/** Cell indices of the six words: rows 0/2/4 then columns 0/2/4. */
export const WORD_CELLS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4],
  [10, 11, 12, 13, 14],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [2, 7, 12, 17, 22],
  [4, 9, 14, 19, 24]
];

const CROSS_COLS = [0, 2, 4] as const;

const FIVE = WORDS.filter((w) => w.length === 5);
// Across words come from the hand-curated answer list so the three words a
// player reads first are the friendly ones; downs may use the wider dict.
const ACROSS_POOL = ANSWERS.filter((w) => w.length === 5);

/** Five-letter words grouped by the letter at each position, so building a
 *  down word filters one short candidate list instead of scanning all 827. */
const BY_POS: ReadonlyMap<string, readonly string[]>[] = [0, 1, 2, 3, 4].map((p) => {
  const m = new Map<string, string[]>();
  for (const w of FIVE) {
    const list = m.get(w[p]);
    if (list) list.push(w);
    else m.set(w[p], [w]);
  }
  return m;
});

const MAX_ATTEMPTS = 400;
// Every generator needs a floor: if 400 tries somehow all miss we still
// hand back a real waffle rather than loop forever or throw.
const FALLBACK = ["valet", "short", "there", "visit", "loose", "title"];

const pick = <T>(arr: readonly T[], rng: () => number): T =>
  arr[Math.floor(rng() * arr.length)];

export interface Waffle {
  /** 25 cells, null at the four holes. */
  solution: (string | null)[];
  /** The scrambled start position — a permutation of `solution`. */
  start: (string | null)[];
  /** The six words: rows 0/2/4 then columns 0/2/4. */
  words: string[];
}

/** Backtrack over the three across words; the three down words are then
 *  independent of one another, since they share no free cell. */
function buildWords(rng: () => number): string[] {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const a0 = pick(ACROSS_POOL, rng);
    const a1 = pick(ACROSS_POOL, rng);
    if (a1 === a0) continue;
    const partial = CROSS_COLS.map((c) =>
      (BY_POS[0].get(a0[c]) ?? []).filter((w) => w[2] === a1[c])
    );
    if (partial.some((l) => l.length === 0)) continue;
    // The bottom row is only playable where some down word can end there.
    const tails = partial.map((l) => new Set(l.map((w) => w[4])));
    const a2opts = ACROSS_POOL.filter(
      (w) => w !== a0 && w !== a1 && CROSS_COLS.every((c, k) => tails[k].has(w[c]))
    );
    if (!a2opts.length) continue;
    const a2 = pick(a2opts, rng);
    const used = new Set([a0, a1, a2]);
    const downs: string[] = [];
    for (let k = 0; k < 3; k++) {
      const opts = partial[k].filter((w) => w[4] === a2[CROSS_COLS[k]] && !used.has(w));
      if (!opts.length) break;
      const w = pick(opts, rng);
      used.add(w);
      downs.push(w);
    }
    if (downs.length === 3) return [a0, a1, a2, ...downs];
  }
  return FALLBACK.slice();
}

function layOut(words: readonly string[]): (string | null)[] {
  const grid: (string | null)[] = Array(25).fill(null);
  WORD_CELLS.forEach((cells, w) =>
    cells.forEach((cell, k) => (grid[cell] = words[w][k].toUpperCase()))
  );
  return grid;
}

/** Scramble by applying `depth` transpositions to the solved grid: the
 *  board is then provably solvable in at most `depth` swaps, which is what
 *  keeps every puzzle inside the budget. A free shuffle would not. */
function scramble(
  solution: (string | null)[],
  rng: () => number,
  depth: number
): (string | null)[] {
  const want = Math.min(LETTER_CELLS.length, depth + 4);
  let best: (string | null)[] = solution.slice();
  let bestOff = -1;
  for (let tries = 0; tries < 40; tries++) {
    const b = solution.slice();
    for (let s = 0; s < depth; s++) {
      const p = pick(LETTER_CELLS, rng);
      let q = p;
      while (q === p) q = pick(LETTER_CELLS, rng);
      [b[p], b[q]] = [b[q], b[p]];
    }
    const off = LETTER_CELLS.filter((i) => b[i] !== solution[i]).length;
    if (off >= want) return b;
    if (off > bestOff) {
      bestOff = off;
      best = b;
    }
  }
  return best;
}

export function generateWaffle(seed: string, depth: number): Waffle {
  const rng = makeRng(seed);
  const words = buildWords(rng);
  const solution = layOut(words);
  return { solution, start: scramble(solution, rng, depth), words };
}

export type Mark = "correct" | "misplaced" | "absent";

const RANK: Record<Mark, number> = { absent: 0, misplaced: 1, correct: 2 };

/** Wordle scoring for one five-letter word. The tally of letters the word
 *  still needs is what stops a duplicate from being flagged twice. */
export function scoreWord(letters: readonly string[], answer: readonly string[]): Mark[] {
  const out: Mark[] = letters.map((l, i) => (l === answer[i] ? "correct" : "absent"));
  const need = new Map<string, number>();
  for (let i = 0; i < answer.length; i++)
    if (out[i] !== "correct") need.set(answer[i], (need.get(answer[i]) ?? 0) + 1);
  for (let i = 0; i < letters.length; i++) {
    if (out[i] === "correct") continue;
    const left = need.get(letters[i]) ?? 0;
    if (left > 0) {
      out[i] = "misplaced";
      need.set(letters[i], left - 1);
    }
  }
  return out;
}

/** Colour the whole board: score each of the six words on its own, then
 *  keep the kindest verdict per cell, so a crossing letter counts as
 *  misplaced when either of its two words can still use it. */
export function colorBoard(
  board: readonly (string | null)[],
  solution: readonly (string | null)[]
): (Mark | null)[] {
  const out: (Mark | null)[] = Array(25).fill(null);
  for (const cells of WORD_CELLS) {
    const marks = scoreWord(
      cells.map((i) => board[i] ?? ""),
      cells.map((i) => solution[i] ?? "")
    );
    cells.forEach((cell, k) => {
      const cur = out[cell];
      if (cur === null || RANK[marks[k]] > RANK[cur]) out[cell] = marks[k];
    });
  }
  return out;
}

/** One swap that makes real progress, for the hint button: a pair that
 *  sends both letters home if one exists, otherwise any pair that seats at
 *  least one. Every hint fixes a cell, so repeated hints always finish. */
export function hintSwap(
  board: readonly (string | null)[],
  solution: readonly (string | null)[]
): [number, number] | null {
  const wrong = LETTER_CELLS.filter((i) => board[i] !== solution[i]);
  for (const i of wrong)
    for (const j of wrong)
      if (j !== i && board[j] === solution[i] && board[i] === solution[j]) return [i, j];
  for (const i of wrong)
    for (const j of wrong) if (j !== i && board[j] === solution[i]) return [i, j];
  return null;
}
