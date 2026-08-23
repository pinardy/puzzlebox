import { WORDS } from "./dict";
import { makeRng, shuffled } from "./rng";

/** Codeword (Code Cracker): a filled crossword lattice where every letter
 *  has been replaced by a number, and the same number always means the
 *  same letter. There are no clues — the crossings and a couple of given
 *  letters are the whole way in.
 *
 *  The grid is a 7×7 lattice: three seven-letter words across rows 0, 3
 *  and 6, three more down columns 0, 3 and 6, nine crossings between them.
 *  Picking the three across words first fixes exactly three letters of each
 *  down word, so an index from those three letters to the words that carry
 *  them turns the fill into three lookups instead of a search. */

export const N = 7;
const LINES = [0, 3, 6];

const SEVENS = WORDS.filter((w) => w.length === N);

/** "abc" → every seven-letter word with a at 0, b at 3, c at 6. */
const BY_CROSSING = new Map<string, string[]>();
for (const w of SEVENS) {
  const key = `${w[0]}${w[3]}${w[6]}`;
  const bucket = BY_CROSSING.get(key);
  if (bucket) bucket.push(w);
  else BY_CROSSING.set(key, [w]);
}

export interface Codeword {
  /** Row-major letters; null where the grid is blocked. */
  cells: (string | null)[];
  /** Row-major cipher number (1-based) per lettered cell, else null. */
  nums: (number | null)[];
  /** key[n - 1] is the letter that number n stands for. */
  key: string[];
  /** Numbers handed to the player at the start. */
  given: number[];
  /** The six words in the grid, for the win check and the reveal. */
  words: string[];
}

const idx = (r: number, c: number) => r * N + c;
export const isBlock = (r: number, c: number) => !LINES.includes(r) && !LINES.includes(c);

export function makeCodeword(seed: string, givens: number): Codeword {
  const rng = makeRng(`codeword-${seed}`);
  const pool = shuffled(SEVENS, rng);

  for (let a = 0; a < pool.length; a++) {
    const across = [pool[a], pool[(a + 1) % pool.length], pool[(a + 2) % pool.length]];
    // Three across words fix three letters of each down word; if every
    // column has a candidate the grid is already consistent.
    const downs: string[] = [];
    for (const c of LINES) {
      const bucket = BY_CROSSING.get(`${across[0][c]}${across[1][c]}${across[2][c]}`);
      if (!bucket) break;
      // Don't reuse an across word as a down word — it reads oddly.
      const choice = shuffled(bucket, rng).find((w) => !across.includes(w) && !downs.includes(w));
      if (!choice) break;
      downs.push(choice);
    }
    if (downs.length !== LINES.length) continue;

    // Upper case throughout: the player's keyboard is upper case, and the
    // win check compares the two directly.
    const cells: (string | null)[] = Array(N * N).fill(null);
    LINES.forEach((r, i) => {
      for (let c = 0; c < N; c++) cells[idx(r, c)] = across[i][c].toUpperCase();
    });
    LINES.forEach((c, i) => {
      for (let r = 0; r < N; r++) cells[idx(r, c)] = downs[i][r].toUpperCase();
    });

    const used = [...new Set(cells.filter((ch): ch is string => ch !== null))];
    const key = shuffled(used, rng);
    const numOf = new Map(key.map((ch, i) => [ch, i + 1]));
    const nums = cells.map((ch) => (ch === null ? null : numOf.get(ch)!));

    // Give away the rarest letters: the common ones are the deduction.
    const freq = new Map<string, number>();
    for (const ch of cells) if (ch) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    const given = [...key]
      .map((ch, i) => ({ n: i + 1, f: freq.get(ch) ?? 0 }))
      .sort((x, y) => x.f - y.f || x.n - y.n)
      .slice(0, Math.min(givens, key.length))
      .map((g) => g.n);

    return { cells, nums, key, given, words: [...across, ...downs] };
  }

  // Unreachable with the bundled list, but keep the shape valid.
  const cells: (string | null)[] = Array(N * N).fill(null);
  return { cells, nums: cells.map(() => null), key: [], given: [], words: [] };
}
