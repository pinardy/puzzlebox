import { DICT, WORDS } from "./dict";
import { makeRng, shuffled } from "./rng";

/** The dice exist because uniformly random letters make unplayable boards —
 *  all consonants in one corner, no vowel within reach. The physical game
 *  fixes the letter mix by distributing it over sixteen six-sided dice, so
 *  every roll is spellable. A "Q" face is the die printed "Qu": that cell
 *  spells both letters at once, which is the only way q is ever usable
 *  (no word in the dictionary has a q without a u after it). */
export const DICE_16: readonly string[] = [
  "AAEEGN",
  "ABBJOO",
  "ACHOPS",
  "AFFKPS",
  "AOOTTW",
  "CIMOTU",
  "DEILRX",
  "DELRVY",
  "DISTTY",
  "EEGHNW",
  "EEINSU",
  "EHRTVW",
  "EIOSST",
  "ELRTTY",
  "HIMNQU",
  "HLNNRZ"
];

/** Big Boggle's twenty-five dice, for the 5×5 board. */
export const DICE_25: readonly string[] = [
  "AAAFRS",
  "AAEEEE",
  "AAFIRS",
  "ADENNN",
  "AEEEEM",
  "AEEGMU",
  "AEGMNN",
  "AFIRSY",
  "BJKQXZ",
  "CCENST",
  "CEIILT",
  "CEILPT",
  "CEIPST",
  "DDHNOT",
  "DHHLOR",
  "DHHNOT",
  "DHLNOR",
  "EIIITT",
  "EMOTTT",
  "ENSSSU",
  "FIPRSY",
  "GORRVW",
  "HIPRRY",
  "NOOTUW",
  "OOOTTU"
];

const MIN_LEN = 3;
const MIN_WORDS = 30;
const MAX_ROLLS = 40;

export interface BoggleBoard {
  n: number;
  cells: string[]; // lowercase; a "Qu" cell holds two letters
  words: string[]; // every word findable on this board
  total: number; // score for finding all of them
  target: number; // score that wins
}

/** Standard Boggle scoring, by word length. */
export function scoreWord(word: string): number {
  const n = word.length;
  return n < 5 ? 1 : n === 5 ? 2 : n === 6 ? 3 : n === 7 ? 5 : 11;
}

/** What a cell shows: "qu" prints as "Qu". */
export const cellLabel = (cell: string): string => cell[0].toUpperCase() + cell.slice(1);

const neighbourCache = new Map<number, number[][]>();

/** Eight-way neighbours per cell, cached — every solve walks them. */
export function neighboursFor(n: number): number[][] {
  const hit = neighbourCache.get(n);
  if (hit) return hit;
  const nei: number[][] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const list: number[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) list.push(rr * n + cc);
        }
      nei.push(list);
    }
  neighbourCache.set(n, nei);
  return nei;
}

let prefixes: Set<string> | null = null;

/** Every prefix of every word, built once on first use. Without it the walk
 *  keeps extending dead strings and the exhaustive solve takes seconds. */
function prefixSet(): Set<string> {
  if (prefixes) return prefixes;
  const s = new Set<string>();
  for (const w of WORDS) for (let i = 1; i <= w.length; i++) s.add(w.slice(0, i));
  prefixes = s;
  return s;
}

/** Every dictionary word traceable on the board: depth-first from each cell,
 *  never reusing a cell, abandoning any path that stops being a prefix. */
export function solveBoard(cells: string[], n: number): string[] {
  const pre = prefixSet();
  const nei = neighboursFor(n);
  const used = cells.map(() => false);
  const found = new Set<string>();
  const walk = (i: number, sofar: string) => {
    const w = sofar + cells[i];
    if (!pre.has(w)) return;
    if (w.length >= MIN_LEN && DICT.has(w)) found.add(w);
    used[i] = true;
    for (const j of nei[i]) if (!used[j]) walk(j, w);
    used[i] = false;
  };
  for (let i = 0; i < cells.length; i++) walk(i, "");
  return [...found].sort();
}

/** A cell path spelling `word`, or null if the board can't spell it — used to
 *  resolve a typed guess into a trace, and to reject one that has no trace. */
export function findPath(cells: string[], n: number, word: string): number[] | null {
  const nei = neighboursFor(n);
  const w = word.toLowerCase();
  const used = cells.map(() => false);
  const path: number[] = [];
  const walk = (i: number, at: number): boolean => {
    if (!w.startsWith(cells[i], at)) return false;
    const next = at + cells[i].length;
    used[i] = true;
    path.push(i);
    if (next === w.length) return true;
    for (const j of nei[i]) if (!used[j] && walk(j, next)) return true;
    used[i] = false;
    path.pop();
    return false;
  };
  for (let i = 0; i < cells.length; i++) if (walk(i, 0)) return path;
  return null;
}

/** Roll the dice into shuffled positions, then solve exhaustively so the
 *  target can be a share of what the board actually holds. A board with
 *  too few words is re-rolled; after the cap, the richest roll seen wins,
 *  so generation always terminates. */
export function generateBoggle(seed: string, n: number, frac: number): BoggleBoard {
  const dice = n >= 5 ? DICE_25 : DICE_16;
  let cells: string[] = [];
  let words: string[] = [];
  for (let roll = 0; roll < MAX_ROLLS; roll++) {
    const rng = makeRng(`${seed}-${roll}`);
    const rolled = shuffled(dice, rng).map((die) => {
      const face = die[Math.floor(rng() * 6)];
      return face === "Q" ? "qu" : face.toLowerCase();
    });
    const found = solveBoard(rolled, n);
    if (found.length > words.length) {
      cells = rolled;
      words = found;
    }
    if (words.length >= MIN_WORDS) break;
  }
  const total = words.reduce((s, w) => s + scoreWord(w), 0);
  const target = Math.min(total, Math.max(3, Math.round(total * frac)));
  return { n, cells, words, total, target };
}
