import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { RANKS, SUITS, isRed, label, rank, suit } from "../lib/cards";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "Klondike with the blindfold off: every tableau card is face-up from the " +
  "start. Build down in the SAME COLOUR — red on red, black on black — and " +
  "an empty column takes any card, not just a king. A group of cards moves " +
  "together only if it is a descending run of ONE SUIT. The deck turns one " +
  "card at a time and there is a single pass through it, so plan the order.";

interface SavedState {
  tableau: number[][];
  foundations: number[]; // per suit: highest rank placed
  stock: number[];
  waste: number[];
  moves: number;
  done: boolean;
}

/** Klondike's 1–7 staircase, but nothing is hidden. */
function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`whitehead-${seed}`));
  const tableau: number[][] = [];
  let at = 0;
  for (let p = 0; p < 7; p++) {
    tableau.push(deck.slice(at, at + p + 1));
    at += p + 1;
  }
  return {
    tableau,
    foundations: [0, 0, 0, 0],
    stock: deck.slice(at),
    waste: [],
    moves: 0,
    done: false
  };
}

type Sel = { from: "col"; pile: number; index: number } | { from: "waste" } | null;

export default function Whitehead({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle }= useGame<SavedState>((s) => deal(s)
  );
  const [sel, setSel] = useState<Sel>(null);

  const wasteTop = saved.waste.length ? saved.waste[saved.waste.length - 1] : null;

  const selCards = (): number[] => {
    if (!sel) return [];
    if (sel.from === "waste") return wasteTop === null ? [] : [wasteTop];
    return saved.tableau[sel.pile].slice(sel.index);
  };

  /** Groups travel only as a same-suit descending run. */
  function validRun(cards: number[]): boolean {
    for (let i = 0; i + 1 < cards.length; i++)
      if (rank(cards[i]) !== rank(cards[i + 1]) + 1 || suit(cards[i]) !== suit(cards[i + 1]))
        return false;
    return true;
  }

  function clone(): SavedState {
    return {
      ...saved,
      tableau: saved.tableau.map((p) => p.slice()),
      foundations: saved.foundations.slice(),
      stock: saved.stock.slice(),
      waste: saved.waste.slice()
    };
  }

  function finish(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      recordResult("whitehead", true);
    }
    commit(next);
    setSel(null);
  }

  function takeSelection(next: SavedState): number[] {
    if (!sel) return [];
    if (sel.from === "waste") return [next.waste.pop()!];
    return next.tableau[sel.pile].splice(sel.index);
  }

  function tryFoundation() {
    const cards = selCards();
    if (cards.length !== 1) {
      setSel(null);
      return;
    }
    const card = cards[0];
    if (rank(card) !== saved.foundations[suit(card)] + 1) {
      setSel(null);
      return;
    }
    const next = clone();
    takeSelection(next);
    next.foundations[suit(card)]++;
    finish(next);
  }

  function tapCol(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.tableau[pile];

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
          ? true // any card opens an empty column
          : rank(run[0]) === rank(top) - 1 && isRed(run[0]) === isRed(top);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = takeSelection(next);
      next.tableau[pile].push(...moved);
      finish(next);
      return;
    }

    if (index === null) return;
    const run = cards.slice(index);
    if (validRun(run)) setSel({ from: "col", pile, index });
  }

  function tapWaste() {
    if (saved.done || wasteTop === null) return;
    if (sel?.from === "waste") {
      setSel(null);
      tryFoundation();
      return;
    }
    setSel({ from: "waste" });
  }

  /** One card off the deck. No redeal — the pass is one-way. */
  function tapStock() {
    if (saved.done || !saved.stock.length) return;
    const next = clone();
    next.waste.push(next.stock.pop()!);
    finish(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel?.from === "col" && sel.pile === pile && index >= sel.index;

  return (
    <div className="game game-klondike">
      <GameHeader title="Whitehead" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        All face-up. Build down in one colour; runs move in one suit.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <button
          className={`kl-card${saved.stock.length ? " kl-back" : " kl-empty"}`}
          onClick={tapStock}
          aria-label={`Stock, ${saved.stock.length} left`}
        >
          {saved.stock.length ? "" : "·"}
        </button>
        <button
          className={`kl-card${wasteTop === null ? " kl-empty" : ""}${
            wasteTop !== null && isRed(wasteTop) ? " red" : ""
          }${sel?.from === "waste" ? " selected" : ""}`}
          onClick={tapWaste}
          aria-label={wasteTop === null ? "Waste, empty" : `Waste, ${label(wasteTop)}`}
        >
          {wasteTop === null ? "·" : label(wasteTop)}
        </button>
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
            {f === 0 ? SUITS[s] : `${RANKS[f - 1]}${SUITS[s]}`}
          </button>
        ))}
      </div>

      <div className="kl-tableau">
        {saved.tableau.map((pile, p) => (
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
        <span>
          Moves: {saved.moves} · deck {saved.stock.length}
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Cleared in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
