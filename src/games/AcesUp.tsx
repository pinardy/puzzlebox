import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
// Aces are the highest card here, which is why they are the survivors.
const value = (id: number) => (rank(id) === 1 ? 14 : rank(id));
const suit = (id: number) => id % 4;
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;
const HELP =
  "Deal four cards at a time, one to each pile. If two top cards share a " +
  "suit, the lower one is discarded — aces are high, so they never lose. " +
  "A top card may also move to an empty pile. Clear the deck and finish " +
  "with the four aces alone.";

interface SavedState {
  piles: number[][];
  stock: number[];
  discarded: number;
  done: boolean;
  won: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`acesup-${seed}`));
  return {
    piles: [[deck[0]], [deck[1]], [deck[2]], [deck[3]]],
    stock: deck.slice(4),
    discarded: 0,
    done: false,
    won: false
  };
}

const top = (p: number[]) => (p.length ? p[p.length - 1] : null);

export default function AcesUp({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("acesup", (s) => deal(s));
  const [sel, setSel] = useState<number | null>(null);

  /** A top card dies if another pile shows a higher card of its suit. */
  const doomed = useMemo(() => {
    const tops = saved.piles.map(top);
    return tops.map((c, i) =>
      c === null
        ? false
        : tops.some(
            (o, j) => j !== i && o !== null && suit(o) === suit(c) && value(o) > value(c)
          )
    );
  }, [saved.piles]);

  function judge(next: SavedState) {
    const cards = next.piles.reduce((a, p) => a + p.length, 0);
    if (!next.stock.length && cards === 4 && next.piles.every((p) => p.length === 1)) {
      next.done = true;
      next.won = true;
      recordResult("acesup", true);
      return;
    }
    if (next.stock.length) return;
    // Out of deck: stuck once nothing can be discarded or relocated.
    const tops = next.piles.map(top);
    const canKill = tops.some(
      (c, i) =>
        c !== null &&
        tops.some(
          (o, j) => j !== i && o !== null && suit(o) === suit(c) && value(o) > value(c)
        )
    );
    const canMove =
      next.piles.some((p) => p.length === 0) &&
      next.piles.some((p) => p.length > 1);
    if (!canKill && !canMove) {
      next.done = true;
      recordResult("acesup", false);
    }
  }

  function clone(): SavedState {
    return { ...saved, piles: saved.piles.map((p) => p.slice()), stock: saved.stock.slice() };
  }

  function tapPile(i: number) {
    if (saved.done) return;
    const card = top(saved.piles[i]);

    if (sel !== null && sel !== i && saved.piles[i].length === 0) {
      const next = clone();
      const moved = next.piles[sel].pop();
      if (moved !== undefined) next.piles[i].push(moved);
      judge(next);
      commit(next);
      setSel(null);
      return;
    }
    if (card === null) {
      setSel(null);
      return;
    }
    if (doomed[i]) {
      const next = clone();
      next.piles[i].pop();
      next.discarded++;
      judge(next);
      commit(next);
      setSel(null);
      return;
    }
    setSel(sel === i ? null : i);
  }

  function tapStock() {
    if (saved.done || !saved.stock.length) return;
    const next = clone();
    for (let i = 0; i < 4; i++) {
      const c = next.stock.pop();
      if (c !== undefined) next.piles[i].push(c);
    }
    judge(next);
    commit(next);
    setSel(null);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  return (
    <div className="game game-acesup" style={{ "--cols": 6 } as CSSProperties}>
      <GameHeader title="Aces Up" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Tap a doomed card to discard it; leave only the four aces.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <button
          className={`kl-card ${saved.stock.length ? "kl-back" : "kl-empty"}`}
          onClick={tapStock}
          aria-label="Deal four"
        >
          {saved.stock.length || "—"}
        </button>
        <span className="kl-gap" />
        <span className="tp-left">{saved.discarded} discarded</span>
      </div>

      <div className="au-row">
        {saved.piles.map((pile, i) => (
          <div
            key={i}
            className="kl-pile au-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapPile(i);
            }}
          >
            {pile.length === 0 ? (
              <button
                className="kl-card kl-empty au-slot"
                onClick={() => tapPile(i)}
                aria-label="Empty pile"
              />
            ) : (
              pile.map((card, k) => (
                <button
                  key={card}
                  className={[
                    "kl-card kl-stacked",
                    isRed(card) ? "red" : "",
                    k === pile.length - 1 && doomed[i] ? "tp-hot" : "",
                    sel === i && k === pile.length - 1 ? "selected" : ""
                  ].join(" ")}
                  style={{ "--stack": k } as CSSProperties}
                  onClick={() => tapPile(i)}
                >
                  {label(card)}
                </button>
              ))
            )}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="acesup"
          won={saved.won}
          message={
            saved.won
              ? "Four aces left standing!"
              : `Stuck — ${saved.piles.reduce((a, p) => a + p.length, 0)} cards remain`
          }
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
