import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { SUITS, isRed, label, rank, rankName, stepsAbove, suit } from "../lib/cards";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "Seven columns, everything face-up, and the card dealt after them sets " +
  "the rank all four foundations start from — they build up in suit and " +
  "wrap past the king round to the ace. The tableau builds down in the " +
  "SAME COLOUR, and an empty column takes any card. There is no waste " +
  "pile: the deck deals seven cards at a time onto the seven reserve " +
  "slots, and only a slot's top card can be played.";

interface SavedState {
  cols: number[][];
  reserve: number[][];
  /** Cards home per suit, counted up from `base` with a king → ace wrap. */
  foundations: number[];
  base: number;
  stock: number[];
  moves: number;
  done: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`agnes-${seed}`));
  const cols: number[][] = [];
  let at = 0;
  for (let p = 0; p < 7; p++) {
    cols.push(deck.slice(at, at + p + 1));
    at += p + 1;
  }
  // The next card off the deck names the foundation rank and goes home.
  const starter = deck[at++];
  const foundations = [0, 0, 0, 0];
  foundations[suit(starter)] = 1;
  return {
    cols,
    reserve: Array.from({ length: 7 }, () => []),
    foundations,
    base: rank(starter),
    stock: deck.slice(at),
    moves: 0,
    done: false
  };
}

type Sel =
  | { from: "col"; pile: number; index: number }
  | { from: "res"; slot: number }
  | null;

export default function Agnes({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle }= useGame<SavedState>((s) => deal(s)
  );
  const [sel, setSel] = useState<Sel>(null);

  const resTop = (slot: number): number | null => {
    const p = saved.reserve[slot];
    return p.length ? p[p.length - 1] : null;
  };

  const selCards = (): number[] => {
    if (!sel) return [];
    if (sel.from === "res") {
      const c = resTop(sel.slot);
      return c === null ? [] : [c];
    }
    return saved.cols[sel.pile].slice(sel.index);
  };

  const canHome = (card: number) =>
    saved.foundations[suit(card)] === stepsAbove(rank(card), saved.base);

  /** Runs move as a unit when they descend in one colour. */
  function validRun(cards: number[]): boolean {
    for (let i = 0; i + 1 < cards.length; i++)
      if (rank(cards[i]) !== rank(cards[i + 1]) + 1 || isRed(cards[i]) !== isRed(cards[i + 1]))
        return false;
    return true;
  }

  function clone(): SavedState {
    return {
      ...saved,
      cols: saved.cols.map((p) => p.slice()),
      reserve: saved.reserve.map((p) => p.slice()),
      foundations: saved.foundations.slice(),
      stock: saved.stock.slice()
    };
  }

  function finish(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      recordResult("agnes", true);
    }
    commit(next);
    setSel(null);
  }

  function takeSelection(next: SavedState): number[] {
    if (!sel) return [];
    if (sel.from === "res") return [next.reserve[sel.slot].pop()!];
    return next.cols[sel.pile].splice(sel.index);
  }

  function tryFoundation() {
    const cards = selCards();
    if (cards.length !== 1 || !canHome(cards[0])) {
      setSel(null);
      return;
    }
    const next = clone();
    const [card] = takeSelection(next);
    next.foundations[suit(card)]++;
    finish(next);
  }

  function tapCol(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.cols[pile];

    if (sel) {
      const run = selCards();
      if (!run.length) {
        setSel(null);
        return;
      }
      if (sel.from === "col" && sel.pile === pile) {
        const single = sel.index === cards.length - 1;
        setSel(null);
        if (single) tryFoundation();
        return;
      }
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null
          ? true
          : rank(run[0]) === rank(top) - 1 && isRed(run[0]) === isRed(top);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = takeSelection(next);
      next.cols[pile].push(...moved);
      finish(next);
      return;
    }

    if (index === null) return;
    const run = cards.slice(index);
    if (validRun(run)) setSel({ from: "col", pile, index });
  }

  function tapReserve(slot: number) {
    if (saved.done) return;
    if (sel?.from === "res" && sel.slot === slot) {
      setSel(null);
      tryFoundation();
      return;
    }
    if (resTop(slot) !== null) setSel({ from: "res", slot });
  }

  /** Seven cards, one onto each reserve slot. */
  function dealRow() {
    if (saved.done || !saved.stock.length) return;
    const next = clone();
    for (let s = 0; s < 7 && next.stock.length; s++)
      next.reserve[s].push(next.stock.pop()!);
    finish(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel?.from === "col" && sel.pile === pile && index >= sel.index;

  const foundationLabel = (s: number, count: number) =>
    count === 0
      ? SUITS[s]
      : `${rankName(((saved.base - 1 + count - 1) % 13) + 1)}${SUITS[s]}`;

  return (
    <div className="game game-agnes" style={{ "--cols": 7 } as CSSProperties}>
      <GameHeader title="Agnes" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Down in the same colour. Foundations start at {rankName(saved.base)} and wrap.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <span className="kl-gap" />
        {saved.foundations.map((f, s) => (
          <button
            key={s}
            className={`kl-card kl-found${f === 0 ? " kl-empty" : ""}${
              f > 0 && (s === 1 || s === 2) ? " red" : ""
            }`}
            onClick={tryFoundation}
            aria-label={`${SUITS[s]} foundation`}
          >
            {foundationLabel(s, f)}
          </button>
        ))}
      </div>

      <div className="ag-reserve" role="group" aria-label="Reserve">
        {saved.reserve.map((slot, s) => {
          const top = slot.length ? slot[slot.length - 1] : null;
          return (
            <button
              key={s}
              className={`kl-card${top === null ? " kl-empty" : ""}${
                top !== null && isRed(top) ? " red" : ""
              }${sel?.from === "res" && sel.slot === s ? " selected" : ""}`}
              onClick={() => tapReserve(s)}
              aria-label={
                top === null
                  ? `Reserve ${s + 1}, empty`
                  : `Reserve ${s + 1}, ${label(top)}, ${slot.length} deep`
              }
            >
              {top === null ? "·" : label(top)}
            </button>
          );
        })}
      </div>

      <div className="kl-tableau">
        {saved.cols.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapCol(p, null);
            }}
          >
            {pile.length === 0 && (
              <button
                className="kl-card kl-empty kl-stacked"
                style={{ "--stack": 0 } as CSSProperties}
                onClick={() => tapCol(p, null)}
                aria-label={`Column ${p + 1}, empty`}
              >
                ·
              </button>
            )}
            {pile.map((card, i) => (
              <button
                key={card}
                className={[
                  "kl-card kl-stacked",
                  isRed(card) ? "red" : "",
                  isSelected(p, i) ? "selected" : ""
                ].join(" ")}
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapCol(p, i)}
              >
                {label(card)}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
        <button className="mini-btn" onClick={dealRow} disabled={!saved.stock.length}>
          Deal ({saved.stock.length})
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Agnes home in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
