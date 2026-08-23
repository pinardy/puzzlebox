import { makeRng, shuffled } from "./rng";

/** Beleaguered Castle: eight tableau piles either side of four ace
 *  foundations. Only the exposed end card of a pile ever moves, so the
 *  whole game state is the piles plus the highest rank on each suit. */
export interface CastleState {
  piles: number[][]; // exposed (movable) card last
  foundations: number[]; // per suit: highest rank placed, aces start at 1
  moves: number;
  done: boolean;
  won: boolean;
}

/** A tableau destination, or "home" for the moving card's own foundation. */
export interface CastleMove {
  from: number;
  to: number | "home";
}

export const PILES = 8;
export const PILE_SIZE = 6;

const rank = (id: number) => Math.floor(id / 4) + 1;
const suit = (id: number) => id % 4;

/** The aces are ids 0–3, so they lift out of the deck without a search. */
export function dealCastle(seed: string): CastleState {
  const rest = shuffled(
    [...Array(52).keys()].filter((c) => rank(c) !== 1),
    makeRng(`castle-${seed}`)
  );
  const piles: number[][] = [];
  for (let p = 0; p < PILES; p++)
    piles.push(rest.slice(p * PILE_SIZE, p * PILE_SIZE + PILE_SIZE));
  return { piles, foundations: [1, 1, 1, 1], moves: 0, done: false, won: false };
}

export const exposed = (pile: number[]): number | null =>
  pile.length ? pile[pile.length - 1] : null;

export const canHome = (st: CastleState, card: number) =>
  st.foundations[suit(card)] === rank(card) - 1;

/** Tableau builds down by rank, suit ignored; an empty pile takes anything. */
export const fitsPile = (card: number, dest: number[]) => {
  const top = exposed(dest);
  return top === null || rank(card) === rank(top) - 1;
};

export function legalMoves(st: CastleState): CastleMove[] {
  const out: CastleMove[] = [];
  for (let p = 0; p < st.piles.length; p++) {
    const card = exposed(st.piles[p]);
    if (card === null) continue;
    if (canHome(st, card)) out.push({ from: p, to: "home" });
    for (let q = 0; q < st.piles.length; q++)
      if (q !== p && fitsPile(card, st.piles[q])) out.push({ from: p, to: q });
  }
  return out;
}

export const isWon = (st: CastleState) => st.foundations.every((f) => f === 13);

export const cardsHome = (st: CastleState) =>
  st.foundations.reduce((a, f) => a + f, 0);

export const cloneCastle = (st: CastleState): CastleState => ({
  ...st,
  piles: st.piles.map((p) => p.slice()),
  foundations: st.foundations.slice()
});

/** Apply one move to a copy. Returns null if the move is not legal, so the
 *  UI and the auto-play share a single legality gate. */
export function applyMove(st: CastleState, mv: CastleMove): CastleState | null {
  const card = exposed(st.piles[mv.from]);
  if (card === null) return null;
  if (mv.to === "home") {
    if (!canHome(st, card)) return null;
    const next = cloneCastle(st);
    next.piles[mv.from].pop();
    next.foundations[suit(card)]++;
    next.moves++;
    return next;
  }
  if (mv.to === mv.from || !fitsPile(card, st.piles[mv.to])) return null;
  const next = cloneCastle(st);
  next.piles[mv.from].pop();
  next.piles[mv.to].push(card);
  next.moves++;
  return next;
}

/** Send every exposed card that fits a foundation, repeating until none do.
 *  Counts as a single move so the tail of forced moves is one tap. */
export function sendHome(st: CastleState): CastleState | null {
  let cur = st;
  let sent = 0;
  for (;;) {
    const mv = legalMoves(cur).find((m) => m.to === "home");
    if (!mv) break;
    cur = applyMove(cur, mv)!;
    sent++;
  }
  if (!sent) return null;
  return { ...cur, moves: st.moves + 1 };
}
