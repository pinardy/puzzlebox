/** Gaps (Montana): the whole deck goes face up into four rows of thirteen
 *  and the four aces are pulled out, leaving four gaps. Cards use the same
 *  0..51 ids as the other solitaires (see `lib/cards`: rank = ⌊id/4⌋+1,
 *  suit = id%4), which makes "one rank up, same suit" simply id + 4. */

import { makeRng, shuffled } from "./rng";
import { rank } from "./cards";

export const ROWS = 4;
export const COLS = 13;
/** 2 through king in each row; the thirteenth slot of a finished row is the gap. */
export const GOAL = ROWS * (COLS - 1);

export type Board = (number | null)[];
export interface Move {
  card: number;
  gap: number;
}

/** Deal all 52, then lift the aces out where they fell. */
export function deal(seed: string): Board {
  const deck = shuffled([...Array(52).keys()], makeRng(`gaps-${seed}`));
  return deck.map((c) => (rank(c) === 1 ? null : c));
}

/** How many cards of row `r` are home: a 2 in column 0, then its successor
 *  in column 1, and so on. Run cards sit at id + 4 * column. */
export function runLength(board: Board, r: number): number {
  const first = board[r * COLS];
  if (first === null || rank(first) !== 2) return 0;
  let n = 1;
  while (n < COLS - 1 && board[r * COLS + n] === first + 4 * n) n++;
  return n;
}

export const cardsHome = (board: Board): number =>
  [0, 1, 2, 3].reduce((a, r) => a + runLength(board, r), 0);

export const isWon = (board: Board): boolean => cardsHome(board) === GOAL;

/** Cards that may legally fill the gap at `at`. A leftmost gap takes any 2
 *  except one already home at the left edge: such a 2 could only trade rows
 *  with another leftmost gap, and that gap always has a better filler, so
 *  holding it still never costs a position. */
export function fillers(board: Board, at: number): number[] {
  if (board[at] !== null) return [];
  if (at % COLS === 0)
    return [4, 5, 6, 7].filter((two) => board.indexOf(two) % COLS !== 0);
  const left = board[at - 1];
  if (left === null || rank(left) === 13) return [];
  return [left + 4];
}

export function legalMoves(board: Board): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < board.length; i++)
    for (const card of fillers(board, i)) out.push({ card, gap: i });
  return out;
}

export function applyMove(board: Board, m: Move): Board {
  const next = board.slice();
  next[next.indexOf(m.card)] = null;
  next[m.gap] = m.card;
  return next;
}

/** Redeal: every row keeps its finished run, a gap reappears immediately
 *  after it, and everything else is shuffled back into the slots that are
 *  left — which always comes out even, since a row of length L gives up
 *  12 − L cards and offers 12 − L places. */
export function redeal(board: Board, seed: string): Board {
  const runs = [0, 1, 2, 3].map((r) => runLength(board, r));
  const loose: number[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = runs[r]; c < COLS; c++) {
      const card = board[r * COLS + c];
      if (card !== null) loose.push(card);
    }
  const bag = shuffled(loose, makeRng(seed));
  const next = board.slice();
  let k = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = runs[r]; c < COLS; c++)
      next[r * COLS + c] = c === runs[r] ? null : bag[k++];
  return next;
}
