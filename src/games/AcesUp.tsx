import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { rank, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

// Aces are the highest card here, which is why they are the survivors.
const value = (id: number) => (rank(id) === 1 ? 14 : rank(id));
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
  const { seed, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s) => deal(s));
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

  /** Mark `next` finished if it is won or stuck, returning the outcome for
   *  the commit that ends the game. */
  function judge(next: SavedState): "won" | "lost" | undefined {
    const cards = next.piles.reduce((a, p) => a + p.length, 0);
    if (!next.stock.length && cards === 4 && next.piles.every((p) => p.length === 1)) {
      next.done = true;
      next.won = true;
      return "won";
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
      return "lost";
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
      commit(next, { outcome: judge(next) });
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
      commit(next, { outcome: judge(next) });
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
    commit(next, { outcome: judge(next) });
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
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label="Deal four"
        >
          {saved.stock.length || "—"}
        </PlayingCard>
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
              <PlayingCard
                card={null}
                className="au-slot"
                onClick={() => tapPile(i)}
                aria-label="Empty pile"
              />
            ) : (
              pile.map((card, k) => (
                <PlayingCard
                  key={card}
                  card={card}
                  selected={sel === i && k === pile.length - 1}
                  className={
                    k === pile.length - 1 && doomed[i] ? "kl-stacked tp-hot" : "kl-stacked"
                  }
                  style={{ "--stack": k } as CSSProperties}
                  onClick={() => tapPile(i)}
                />
              ))
            )}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? "Four aces left standing!"
              : `Stuck — ${saved.piles.reduce((a, p) => a + p.length, 0)} cards remain`
          }
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
