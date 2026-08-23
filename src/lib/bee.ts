/** Spelling Bee: seven letters, one of them compulsory in every word.
 *  Generation starts from a dictionary word made of exactly seven distinct
 *  letters, so the set is guaranteed to hold at least one pangram. */

import { PANGRAMS, bitCount, maskOf, wordsFrom } from "./dict";
import { makeRng, shuffled } from "./rng";

export interface BeePuzzle {
  centre: string;
  outer: string[]; // the six ring letters, in display order
  letters: string[]; // all seven, sorted
  pangram: string; // the word the set was built from
  answers: string[]; // every findable word, alphabetical
  total: number; // score for finding all of them
}

export interface Rank {
  readonly name: string;
  readonly pct: number;
}

/** The newspaper ladder, as percentages of the total available score. */
export const RANKS: readonly Rank[] = [
  { name: "Beginner", pct: 0 },
  { name: "Good Start", pct: 2 },
  { name: "Moving Up", pct: 5 },
  { name: "Good", pct: 8 },
  { name: "Solid", pct: 15 },
  { name: "Nice", pct: 25 },
  { name: "Great", pct: 40 },
  { name: "Amazing", pct: 50 },
  { name: "Genius", pct: 70 }
];

const CANDIDATES = 80;

/** True when a word uses all seven letters. Answers are already known to
 *  stay inside the set, so seven distinct letters means every one of them. */
export const isPangram = (word: string): boolean => bitCount(maskOf(word)) === 7;

/** A four is worth one point, anything longer its own length, and a
 *  pangram seven more on top. */
export function scoreWord(word: string): number {
  return (word.length === 4 ? 1 : word.length) + (isPangram(word) ? 7 : 0);
}

export const rankScore = (total: number, pct: number): number =>
  Math.ceil((total * pct) / 100);

export const geniusScore = (total: number): number => rankScore(total, 70);

/** The rung reached, plus the next one up so the bar has something to aim at. */
export function rankFor(score: number, total: number) {
  let at = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (score >= rankScore(total, RANKS[i].pct)) at = i;
  }
  const next = RANKS[at + 1];
  return {
    name: RANKS[at].name,
    at,
    nextName: next?.name,
    nextScore: next ? rankScore(total, next.pct) : undefined
  };
}

const build = (
  pangram: string,
  centre: string,
  letters: string[],
  answers: string[],
  rng: () => number
): BeePuzzle => ({
  centre,
  outer: shuffled(
    letters.filter((l) => l !== centre),
    rng
  ),
  letters,
  pangram,
  answers,
  total: answers.reduce((s, w) => s + scoreWord(w), 0)
});

/** Draw pangram words until one of their seven letters, used as the centre,
 *  yields an answer list inside [minWords, maxWords]. Nearly every set hits
 *  the band on the first or second draw; the closest miss is kept so an
 *  unlucky run still returns a real puzzle instead of spinning. */
export function generateBee(
  seed: string,
  minWords: number,
  maxWords: number
): BeePuzzle {
  const rng = makeRng(seed);
  let best: BeePuzzle | null = null;
  let bestMiss = Infinity;
  for (let t = 0; t < CANDIDATES; t++) {
    const pangram = PANGRAMS[Math.floor(rng() * PANGRAMS.length)];
    const mask = maskOf(pangram);
    const letters = [...new Set(pangram)].sort();
    for (const centre of shuffled(letters, rng)) {
      const answers = wordsFrom(mask, centre, 4);
      const miss = Math.max(minWords - answers.length, answers.length - maxWords, 0);
      if (miss >= bestMiss) continue;
      best = build(pangram, centre, letters, answers, rng);
      bestMiss = miss;
      if (miss === 0) return best;
    }
  }
  return best!;
}
