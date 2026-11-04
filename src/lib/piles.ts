import { makeRng, shuffled } from "./rng";
import { downAnySuit, downInSuit, rank, suit } from "./cards";

/** One engine for the "only the exposed card moves" solitaires: the castle
 *  family (Streets & Alleys, Fortress) and the fan family (La Belle Lucie,
 *  Trefoil). They differ only in the deal shape, what a card may land on,
 *  whether an empty space can be filled, and how many reshuffles you get —
 *  so all of that is configuration and the rules live here once. */

export type FitRule = "downAny" | "downSuit" | "upDownSuit";
export type EmptyRule = "any" | "none" | "king";

export interface PileRules {
  /** Cards per pile, in deal order; its sum is the pack minus any aces
   *  lifted straight to the foundations. */
  layout: number[];
  fit: FitRule;
  empty: EmptyRule;
  /** Aces start home (Trefoil) instead of being dealt into the fans. */
  acesHome?: boolean;
  /** Gathers and re-deals the tableau this many times (La Belle Lucie). */
  redeals?: number;
  seedTag: string;
}

export interface PileState {
  piles: number[][]; // exposed (movable) card last
  foundations: number[]; // per suit: highest rank placed, 0 = empty
  moves: number;
  /** Reshuffles still available. */
  redeals: number;
  done: boolean;
  won: boolean;
}

export interface PileMove {
  from: number;
  to: number | "home";
}

export const exposed = (pile: number[]): number | null =>
  pile.length ? pile[pile.length - 1] : null;

function dealInto(cards: number[], layout: number[]): number[][] {
  const piles: number[][] = [];
  let at = 0;
  for (const size of layout) {
    piles.push(cards.slice(at, at + size));
    at += size;
  }
  return piles;
}

export function dealPiles(seed: string, rules: PileRules): PileState {
  // Aces are ids 0–3, so they lift out without a search.
  const pack = [...Array(52).keys()].filter(
    (c) => !rules.acesHome || rank(c) !== 1
  );
  const piles = dealInto(
    shuffled(pack, makeRng(`${rules.seedTag}-${seed}`)),
    rules.layout
  );
  return {
    piles,
    foundations: rules.acesHome ? [1, 1, 1, 1] : [0, 0, 0, 0],
    moves: 0,
    redeals: rules.redeals ?? 0,
    done: false,
    won: false
  };
}

export const canHome = (st: PileState, card: number) =>
  st.foundations[suit(card)] === rank(card) - 1;

export function fitsPile(card: number, dest: number[], rules: PileRules): boolean {
  const top = exposed(dest);
  if (top === null) {
    if (rules.empty === "none") return false;
    return rules.empty === "any" || rank(card) === 13;
  }
  if (rules.fit === "downAny") return downAnySuit(card, top);
  if (rules.fit === "downSuit") return downInSuit(card, top);
  return suit(card) === suit(top) && Math.abs(rank(card) - rank(top)) === 1; // upDownSuit
}

export function legalMoves(st: PileState, rules: PileRules): PileMove[] {
  const out: PileMove[] = [];
  for (let p = 0; p < st.piles.length; p++) {
    const card = exposed(st.piles[p]);
    if (card === null) continue;
    if (canHome(st, card)) out.push({ from: p, to: "home" });
    for (let q = 0; q < st.piles.length; q++)
      if (q !== p && fitsPile(card, st.piles[q], rules)) out.push({ from: p, to: q });
  }
  return out;
}

export const isWon = (st: PileState) => st.foundations.every((f) => f === 13);

export const cardsHome = (st: PileState) =>
  st.foundations.reduce((a, f) => a + f, 0);

export const clonePiles = (st: PileState): PileState => ({
  ...st,
  piles: st.piles.map((p) => p.slice()),
  foundations: st.foundations.slice()
});

/** Apply one move to a copy, or null if it is not legal — the UI and the
 *  auto-play share this single legality gate. */
export function applyMove(
  st: PileState,
  mv: PileMove,
  rules: PileRules
): PileState | null {
  const card = exposed(st.piles[mv.from]);
  if (card === null) return null;
  if (mv.to === "home") {
    if (!canHome(st, card)) return null;
    const next = clonePiles(st);
    next.piles[mv.from].pop();
    next.foundations[suit(card)]++;
    next.moves++;
    return next;
  }
  if (mv.to === mv.from || !fitsPile(card, st.piles[mv.to], rules)) return null;
  const next = clonePiles(st);
  next.piles[mv.from].pop();
  next.piles[mv.to].push(card);
  next.moves++;
  return next;
}

/** Send every exposed card that fits a foundation, repeatedly. Counts as
 *  one move, so the tail of forced moves at the end is a single tap. */
export function sendHome(st: PileState, rules: PileRules): PileState | null {
  let cur = st;
  let sent = 0;
  for (;;) {
    const mv = legalMoves(cur, rules).find((m) => m.to === "home");
    if (!mv) break;
    cur = applyMove(cur, mv, rules)!;
    sent++;
  }
  if (!sent) return null;
  return { ...cur, moves: st.moves + 1 };
}

/** Gather every tableau card and re-deal it — the fan games' way out of a
 *  dead end. The seed folds in the redeal number so each shuffle differs
 *  but still replays identically from the save. */
export function redeal(st: PileState, seed: string, rules: PileRules): PileState | null {
  if (st.redeals <= 0) return null;
  const loose = st.piles.flat();
  if (!loose.length) return null;
  const rng = makeRng(`${rules.seedTag}-${seed}-redeal${st.redeals}`);
  // Short pack now — keep the fans of three and let the last one be a stub.
  const layout: number[] = [];
  for (let left = loose.length; left > 0; left -= 3) layout.push(Math.min(3, left));
  return {
    ...st,
    piles: dealInto(shuffled(loose, rng), layout),
    redeals: st.redeals - 1,
    moves: st.moves + 1
  };
}
