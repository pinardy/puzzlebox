import { makeRng, shuffled } from "./rng";
import { NO_DOUBLES, bitCount, isWord, maskOf } from "./dict";
import { Diff } from "./storage";

export const SIDE_NAMES = ["top", "right", "bottom", "left"] as const;

export interface BoxedPuzzle {
  /** Four sides of three uppercase letters, in SIDE_NAMES order. */
  sides: string[];
  /** The generator's own solution — two words that use all twelve. */
  chain: string[];
  /** How many two-word solutions the finished box admits. The honest
   *  difficulty lever: a box with one route is a much harder box. */
  routes: number;
}

/** Chain word lengths per difficulty. Two words sharing a pivot letter need
 *  thirteen letters between them to show twelve distinct ones, so nothing
 *  here can be short — the band only decides how long the longer word runs. */
const LEN: Record<Diff, [number, number]> = {
  easy: [4, 7],
  medium: [4, 8],
  hard: [5, 9]
};

/** Wanted number of two-word routes through the finished box. Easy boxes
 *  forgive a wrong turn; a hard one has exactly one pair that works. */
const ROUTES: Record<Diff, [number, number]> = {
  easy: [8, 1e9],
  medium: [2, 5],
  hard: [1, 1]
};

// A chain word must have no doubled letter — consecutive letters come from
// different sides, and a letter sits on exactly one side — and can't on its
// own need more than the box holds.
const CANDS: readonly string[] = NO_DOUBLES.filter(
  (w) => w.length >= 4 && w.length <= 9 && bitCount(maskOf(w)) <= 12
);
const CAND_MASK: readonly number[] = CANDS.map(maskOf);
/** Candidate indices grouped by first letter, so chaining is a join. */
const BY_FIRST: readonly number[][] = (() => {
  const buckets: number[][] = Array.from({ length: 26 }, () => []);
  CANDS.forEach((w, i) => buckets[w.charCodeAt(0) - 97].push(i));
  return buckets;
})();

const letterList = (mask: number): string[] => {
  const out: string[] = [];
  for (let b = 0; b < 26; b++) if (mask & (1 << b)) out.push(String.fromCharCode(65 + b));
  return out;
};

/** Adjacent letter pairs inside a word — the pairs that must not share a
 *  side. Word boundaries add nothing: the pivot is a single letter. */
function adjacency(words: readonly string[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const w of words)
    for (let i = 1; i < w.length; i++) {
      link(w[i - 1], w[i]);
      link(w[i], w[i - 1]);
    }
  return adj;
}

/** Four colours, three letters each, adjacent letters never sharing one:
 *  a balanced graph colouring, solved by backtracking. Letters go in
 *  most-constrained first, and a colour only opens after the one before
 *  it, which kills the 4! symmetric copies of every solution. */
function colourSides(letters: string[], adj: Map<string, Set<string>>): number[] | null {
  const order = letters
    .map((c, i) => ({ i, deg: adj.get(c)?.size ?? 0 }))
    .sort((a, b) => b.deg - a.deg)
    .map((o) => o.i);
  const colour = new Array<number>(letters.length).fill(-1);
  const counts = [0, 0, 0, 0];
  const index = new Map(letters.map((c, i) => [c, i]));

  const place = (k: number, opened: number): boolean => {
    if (k === order.length) return true;
    const i = order[k];
    const nbrs = adj.get(letters[i]);
    for (let c = 0; c <= Math.min(opened, 3); c++) {
      if (counts[c] === 3) continue;
      let clash = false;
      if (nbrs)
        for (const n of nbrs) {
          const j = index.get(n);
          if (j !== undefined && colour[j] === c) {
            clash = true;
            break;
          }
        }
      if (clash) continue;
      colour[i] = c;
      counts[c]++;
      if (place(k + 1, Math.max(opened, c + 1))) return true;
      counts[c]--;
      colour[i] = -1;
    }
    return false;
  };
  return place(0, 0) ? colour : null;
}

/** Which side each letter sits on, indexed by letter code; -1 = not in the
 *  box. One flat array is all the validator ever needs. */
export function sideTable(sides: readonly string[]): number[] {
  const table = new Array<number>(26).fill(-1);
  sides.forEach((s, k) => {
    for (const c of s) table[c.charCodeAt(0) - 65] = k;
  });
  return table;
}

/** Every dictionary word this box can actually spell. */
export function legalWords(sides: readonly string[]): string[] {
  const table = sideTable(sides);
  const out: string[] = [];
  for (const w of NO_DOUBLES) {
    if (w.length < 3) continue;
    let prev = -1;
    let ok = true;
    for (let i = 0; i < w.length; i++) {
      const s = table[w.charCodeAt(i) - 97];
      if (s < 0 || s === prev) {
        ok = false;
        break;
      }
      prev = s;
    }
    if (ok) out.push(w.toUpperCase());
  }
  return out;
}

/** Letters of an UPPERCASE word as a 26-bit mask, `a` at bit 0 — the same
 *  encoding `maskOf` uses for lowercase, so the two can be mixed. */
const upMask = (w: string): number => {
  let m = 0;
  for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - 65);
  return m;
};

/** Which of the twelve the player has spent so far, as a mask. */
export const usedMask = (words: readonly string[]): number =>
  words.reduce((m, w) => m | upMask(w), 0);

const firstLetterIndex = (words: readonly string[]): number[][] => {
  const buckets: number[][] = Array.from({ length: 26 }, () => []);
  words.forEach((w, i) => buckets[w.charCodeAt(0) - 65].push(i));
  return buckets;
};

/** How many ordered pairs of legal words chain up and cover all twelve. */
function countRoutes(words: readonly string[]): number {
  const buckets = firstLetterIndex(words);
  const masks = words.map(upMask);
  let n = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (const j of buckets[w.charCodeAt(w.length - 1) - 65])
      if (j !== i && bitCount(masks[i] | masks[j]) === 12) n++;
  }
  return n;
}

/** One word worth playing next: first choice a word that finishes the box
 *  outright, then one that leaves a single word to go, and failing both
 *  the word that spends the most letters the player still owes. */
export function hintWord(
  words: readonly string[],
  sides: readonly string[],
  used: number,
  prevLast: string | null
): string | null {
  const all = upMask(sides.join(""));
  const buckets = firstLetterIndex(words);
  const shorter = (a: string | null, b: string) => !a || b.length < a.length;
  let finish: string | null = null;
  let setup: string | null = null;
  let greedy: string | null = null;
  let greedyGain = -1;
  for (const w of words) {
    if (prevLast && w[0] !== prevLast) continue;
    const after = used | upMask(w);
    if (after === all) {
      if (shorter(finish, w)) finish = w;
      continue;
    }
    if (
      shorter(setup, w) &&
      buckets[w.charCodeAt(w.length - 1) - 65].some(
        (j) => (after | upMask(words[j])) === all
      )
    )
      setup = w;
    const gain = bitCount(upMask(w) & ~used);
    if (gain > greedyGain) {
      greedyGain = gain;
      greedy = w;
    }
  }
  return finish ?? setup ?? greedy;
}

/** Reason `word` can't be played, or null when it's good. Order matters:
 *  the most concrete complaint wins, so a player learns the rule that
 *  actually tripped them rather than a generic "no". */
export function checkWord(
  word: string,
  sides: readonly string[],
  prevLast: string | null
): string | null {
  if (word.length < 3) return "Too short";
  const table = sideTable(sides);
  for (const c of word)
    if (table[c.charCodeAt(0) - 65] < 0) return "Use only the twelve letters";
  if (prevLast && word[0] !== prevLast) return `Must start with ${prevLast}`;
  for (let i = 1; i < word.length; i++) {
    const s = table[word.charCodeAt(i) - 65];
    if (s !== table[word.charCodeAt(i - 1) - 65]) continue;
    // A doubled letter is the same-side rule at its bluntest, and worth
    // saying plainly — a player rarely sees it as a "sides" problem.
    if (word[i] === word[i - 1]) return `${word[i]} can't follow itself`;
    return `${word[i - 1]} and ${word[i]} are both on the ${SIDE_NAMES[s]} side`;
  }
  if (!isWord(word)) return "Not in the word list";
  return null;
}

/** Build a box in two stages. First chain two dictionary words that between
 *  them use exactly twelve distinct letters; then colour those twelve into
 *  four sides of three so no two letters adjacent in either word land
 *  together. Either stage can fail, so the search keeps drawing fresh
 *  chains — capped both on chains tried and on boxes scored, since scoring
 *  a box means sweeping the dictionary for its routes. */
export function generateBoxed(seed: string, diff: Diff): BoxedPuzzle {
  const rng = makeRng(seed);
  const [lo, hi] = LEN[diff];
  const [minR, maxR] = ROUTES[diff];
  let best: BoxedPuzzle | null = null;
  let bestMiss = Infinity;
  let scored = 0;

  for (let attempt = 0; attempt < 800 && bestMiss > 0 && scored < 20; attempt++) {
    const i = Math.floor(rng() * CANDS.length);
    const w1 = CANDS[i];
    if (w1.length < lo || w1.length > hi) continue;
    const bucket = BY_FIRST[w1.charCodeAt(w1.length - 1) - 97];
    if (!bucket.length) continue;

    // Walk the bucket from a random offset: the first fit is as good as a
    // uniform pick and costs one pass instead of shuffling thousands.
    const start = Math.floor(rng() * bucket.length);
    let pair = -1;
    for (let k = 0; k < bucket.length; k++) {
      const j = bucket[(start + k) % bucket.length];
      const w2 = CANDS[j];
      if (j === i || w2.length < lo || w2.length > hi) continue;
      if (bitCount(CAND_MASK[i] | CAND_MASK[j]) !== 12) continue;
      pair = j;
      break;
    }
    if (pair < 0) continue;

    const chain = [w1.toUpperCase(), CANDS[pair].toUpperCase()];
    const all = letterList(CAND_MASK[i] | CAND_MASK[pair]);
    const colour = colourSides(all, adjacency(chain));
    if (!colour) continue;
    scored++;

    // Colours are interchangeable, so scatter them for visual variety.
    const perm = shuffled([0, 1, 2, 3], rng);
    const sides = [0, 1, 2, 3].map((k) =>
      shuffled(
        all.filter((_, idx) => perm[colour[idx]] === k),
        rng
      ).join("")
    );
    const puzzle: BoxedPuzzle = { sides, chain, routes: countRoutes(legalWords(sides)) };
    const miss =
      puzzle.routes < minR
        ? minR - puzzle.routes
        : puzzle.routes > maxR
          ? puzzle.routes - maxR
          : 0;
    if (miss < bestMiss) {
      best = puzzle;
      bestMiss = miss;
    }
  }
  // Every scored box is solvable in two by construction, so a near-miss on
  // the difficulty band is still a fine puzzle to hand over.
  if (!best) throw new Error("boxed: no puzzle found");
  return best;
}
