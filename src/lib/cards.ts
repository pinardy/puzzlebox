/** Shared single-pack card primitives. Card id 0–51:
 *  suit = id % 4 (♠ ♥ ♦ ♣), rank = 1 (ace) … 13 (king) — the same encoding
 *  the older card games each declared for themselves. */

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const rank = (id: number) => Math.floor(id / 4) + 1;
export const suit = (id: number) => id % 4;
export const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
export const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;
export const rankName = (r: number) => RANKS[r - 1];

/** Rank one above `r`, wrapping king → ace. Used by the games whose
 *  foundations start on a dealt card instead of an ace. */
export const nextRank = (r: number) => (r % 13) + 1;

/** How far `r` sits above `base`, counting with a king → ace wrap, so a
 *  foundation's progress is one number however it started. */
export const stepsAbove = (r: number, base: number) => (r - base + 13) % 13;

/** Tableau building rules shared by the variants. */
export const downAnySuit = (card: number, onto: number) =>
  rank(card) === rank(onto) - 1;
export const downInSuit = (card: number, onto: number) =>
  rank(card) === rank(onto) - 1 && suit(card) === suit(onto);
export const downAltColour = (card: number, onto: number) =>
  rank(card) === rank(onto) - 1 && isRed(card) !== isRed(onto);
export const downSameColour = (card: number, onto: number) =>
  rank(card) === rank(onto) - 1 && isRed(card) === isRed(onto);
