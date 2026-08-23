/** Nim: the deal plus a perfect Sprague–Grundy opponent. Pure logic, no
 *  React, so the opponent can be simulated against itself in a test. */

import { makeRng } from "./rng";

export interface NimMove {
  heap: number; // index of the heap played
  take: number; // counters removed from it
}

/** XOR of the heap sizes. Zero means the player about to move loses. */
export const nimSum = (heaps: readonly number[]): number =>
  heaps.reduce((a, h) => a ^ h, 0);

/** Deal `count` heaps of 1..max, retried until the nim-sum is non-zero so
 *  that the human moving first can always win. A balanced deal would be
 *  lost from the first move however well it is played, which is no game. */
export function dealNim(seed: string, count: number, max: number): number[] {
  const rng = makeRng(`nim-${seed}`);
  for (let tries = 0; tries < 40; tries++) {
    const heaps = Array.from({ length: count }, () => 1 + Math.floor(rng() * max));
    if (nimSum(heaps) !== 0) return heaps;
  }
  // Never reached in practice — a fixed unbalanced deal beats looping.
  const heaps = Array(count).fill(1);
  heaps[0] = 2;
  return heaps;
}

/** The move that leaves a nim-sum of zero, or null when the position is
 *  already balanced and so lost for whoever has to move. */
export function winningMove(heaps: readonly number[]): NimMove | null {
  const s = nimSum(heaps);
  if (s === 0) return null;
  for (let i = 0; i < heaps.length; i++) {
    const rest = heaps[i] ^ s;
    if (rest < heaps[i]) return { heap: i, take: heaps[i] - rest };
  }
  return null; // unreachable: a non-zero nim-sum always has such a heap
}

/** The opponent's turn: balance the position when it can, otherwise shave
 *  one counter off the largest heap and wait for the player to slip. */
export function machineMove(heaps: readonly number[]): NimMove | null {
  const win = winningMove(heaps);
  if (win) return win;
  let big = -1;
  for (let i = 0; i < heaps.length; i++)
    if (heaps[i] > 0 && (big < 0 || heaps[i] > heaps[big])) big = i;
  return big < 0 ? null : { heap: big, take: 1 };
}
