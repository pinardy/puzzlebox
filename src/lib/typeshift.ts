import { WORDS, DICT } from "./dict";
import { makeRng, shuffled } from "./rng";

/** Typeshift: every column is a little strip of letters you slide up and
 *  down, and the middle row spells whatever the strips happen to line up.
 *  The columns are built from a handful of hidden words, so the puzzle is
 *  always solvable — and the goal is to use every letter in every strip,
 *  which those hidden words are guaranteed to do between them. */

export const LEN = 5;

export interface Shift {
  /** Letters available in each of the LEN columns, top to bottom. */
  cols: string[][];
  /** The words the columns were cut from — the guaranteed-complete set. */
  source: string[];
}

const FIVES = WORDS.filter((w) => w.length === LEN);

/** Pick `count` five-letter words whose letters, column by column, give
 *  strips of at least two choices — a strip with one letter is a freebie. */
export function makeShift(seed: string, count: number): Shift {
  const rng = makeRng(`typeshift-${seed}`);
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked: string[] = [];
    const pool = shuffled(FIVES, rng);
    for (const w of pool) {
      if (picked.length >= count) break;
      // Avoid two words sharing a whole column position everywhere, which
      // would collapse the strips into a single-choice puzzle.
      if (picked.some((p) => sameCount(p, w) > LEN - 2)) continue;
      picked.push(w);
    }
    if (picked.length < count) continue;

    const cols: string[][] = [];
    for (let i = 0; i < LEN; i++) {
      const letters = [...new Set(picked.map((w) => w[i]))];
      cols.push(shuffled(letters, rng));
    }
    // At least one strip has to offer a real choice, or there is no puzzle.
    if (cols.some((c) => c.length > 1)) return { cols, source: picked };
  }
  // Fall back to the first `count` words; the strips are still consistent.
  const picked = FIVES.slice(0, count);
  return {
    cols: Array.from({ length: LEN }, (_, i) => [
      ...new Set(picked.map((w) => w[i]))
    ]),
    source: picked
  };
}

const sameCount = (a: string, b: string) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) n++;
  return n;
};

export const isShiftWord = (w: string) => w.length === LEN && DICT.has(w);
