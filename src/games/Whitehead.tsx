import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { downInSuit, downSameColour, nCards, rank, stackPlace, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, Pile, PlayingCard } from "./cards";
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
      if (!downInSuit(cards[i + 1], cards[i])) return false;
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

  function play(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      commit(next, { outcome: "won" });
    } else commit(next);
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
    play(next);
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
          : downSameColour(run[0], top);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = takeSelection(next);
      next.tableau[pile].push(...moved);
      play(next);
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
    play(next);
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
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label={saved.stock.length ? `Stock, ${nCards(saved.stock.length)}` : "Stock, empty"}
        >
          {saved.stock.length ? "" : "·"}
        </PlayingCard>
        <PlayingCard
          card={wasteTop}
          selected={sel?.from === "waste"}
          onClick={tapWaste}
          place="Waste"
        >
          {wasteTop === null ? "·" : undefined}
        </PlayingCard>
        <span className="kl-gap" />
        {saved.foundations.map((f, s) => (
          <Foundation
            key={s}
            suit={s}
            top={f}
            onClick={tryFoundation}
          />
        ))}
      </div>

      <div className="kl-tableau">
        {saved.tableau.map((pile, p) => (
          <Pile
            key={p}
            name={`Column ${p + 1}`}
            onTap={() => tapCol(p, null)}
          >
            {pile.length === 0 && (
              <PlayingCard
                card={null}
                className="kl-stacked"
                style={{ "--stack": 0 } as CSSProperties}
                onClick={() => tapCol(p, null)}
                aria-label={`Column ${p + 1}, empty`}
              >
                ·
              </PlayingCard>
            )}
            {pile.map((card, i) => (
              <PlayingCard
                key={card}
                card={card}
                selected={isSelected(p, i)}
                className="kl-stacked"
                style={{ "--stack": i } as CSSProperties}
                place={stackPlace(`Column ${p + 1}`, i, pile.length)}
                onClick={() => tapCol(p, i)}
              />
            ))}
          </Pile>
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
