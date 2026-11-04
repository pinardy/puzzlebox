import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { RANKS, SUITS, isRed, nextRank, rank, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";
import "./Canfield.css";

const HELP =
  "The foundations start on whatever rank the first card happens to be, " +
  "and both foundations and columns wrap around — after a king comes an " +
  "ace. Columns build DOWN in alternating colours; a gap is refilled from " +
  "the reserve. The deck turns three at a time, over and over.";

// One step down (tableau), wrapping past the ace; `nextRank` goes up.
const nextDown = (r: number) => (r === 1 ? 13 : r - 1);

interface SavedState {
  base: number; // the rank every foundation starts from
  foundations: number[]; // top rank per suit, 0 = empty
  tableau: number[][];
  reserve: number[];
  stock: number[];
  waste: number[];
  moves: number;
  done: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`canfield-${seed}`));
  const reserve = deck.slice(0, 13);
  const first = deck[13];
  const foundations = [0, 0, 0, 0];
  foundations[suit(first)] = rank(first);
  const tableau = [deck[14], deck[15], deck[16], deck[17]].map((c) => [c]);
  return {
    base: rank(first),
    foundations,
    tableau,
    reserve,
    stock: deck.slice(18),
    waste: [],
    moves: 0,
    done: false
  };
}

type Sel =
  | { from: "waste" }
  | { from: "reserve" }
  | { from: "tableau"; pile: number; index: number }
  | null;

export default function Canfield({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s) => deal(s));
  const [sel, setSel] = useState<Sel>(null);

  const selCards = (): number[] => {
    if (!sel) return [];
    if (sel.from === "waste")
      return saved.waste.length ? [saved.waste[saved.waste.length - 1]] : [];
    if (sel.from === "reserve")
      return saved.reserve.length ? [saved.reserve[saved.reserve.length - 1]] : [];
    return saved.tableau[sel.pile].slice(sel.index);
  };

  function clone(): SavedState {
    return {
      ...saved,
      foundations: saved.foundations.slice(),
      tableau: saved.tableau.map((p) => p.slice()),
      reserve: saved.reserve.slice(),
      stock: saved.stock.slice(),
      waste: saved.waste.slice()
    };
  }

  function take(next: SavedState): number[] {
    if (!sel) return [];
    if (sel.from === "waste") return [next.waste.pop()!];
    if (sel.from === "reserve") return [next.reserve.pop()!];
    return next.tableau[sel.pile].splice(sel.index);
  }

  function play(next: SavedState) {
    next.moves++;
    // A gap is refilled from the reserve while any card is left there.
    for (let p = 0; p < 4; p++)
      if (next.tableau[p].length === 0 && next.reserve.length)
        next.tableau[p] = [next.reserve.pop()!];
    if (!next.done && next.foundations.every((f) => f === nextDown(next.base))) {
      next.done = true;
      commit(next, { outcome: "won" });
    } else commit(next);
    setSel(null);
  }

  function toFoundation() {
    const cards = selCards();
    if (cards.length !== 1) {
      setSel(null);
      return;
    }
    const card = cards[0];
    const f = saved.foundations[suit(card)];
    const want = f === 0 ? saved.base : nextRank(f);
    if (rank(card) !== want) {
      setSel(null);
      return;
    }
    const next = clone();
    take(next);
    next.foundations[suit(card)] = rank(card);
    play(next);
  }

  function tapTableau(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.tableau[pile];
    if (sel) {
      if (sel.from === "tableau" && sel.pile === pile) {
        setSel(null);
        if (selCards().length === 1) toFoundation();
        return;
      }
      const run = selCards();
      if (!run.length) {
        setSel(null);
        return;
      }
      const head = run[0];
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null
          ? true
          : rank(head) === nextDown(rank(top)) && isRed(head) !== isRed(top);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = take(next);
      next.tableau[pile].push(...moved);
      play(next);
      return;
    }
    if (index !== null) setSel({ from: "tableau", pile, index });
  }

  function tapStock() {
    if (saved.done) return;
    const next = clone();
    if (next.stock.length) {
      for (let k = 0; k < 3 && next.stock.length; k++)
        next.waste.push(next.stock.pop()!);
    } else if (next.waste.length) {
      next.stock = next.waste.reverse();
      next.waste = [];
    } else return;
    play(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const wasteTop = saved.waste.length ? saved.waste[saved.waste.length - 1] : null;
  const reserveTop = saved.reserve.length
    ? saved.reserve[saved.reserve.length - 1]
    : null;

  return (
    <div className="game game-canfield" style={{ "--cols": 7 } as CSSProperties}>
      <GameHeader title="Canfield" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Foundations start at {RANKS[saved.base - 1]} and wrap; columns build
        down in alternating colours.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label="Stock"
        >
          {saved.stock.length || "↻"}
        </PlayingCard>
        <PlayingCard
          card={wasteTop}
          selected={sel?.from === "waste"}
          onClick={() => {
            if (!saved.waste.length) return;
            if (sel?.from === "waste") {
              setSel(null);
              toFoundation();
            } else setSel({ from: "waste" });
          }}
          aria-label="Waste"
        />
        <span className="kl-gap" />
        {saved.foundations.map((f, s) => (
          <Foundation
            key={s}
            suit={s}
            top={f}
            onClick={toFoundation}
            aria-label={`${SUITS[s]} foundation`}
          />
        ))}
      </div>

      <div className="kl-top cf-reserve">
        <PlayingCard
          card={reserveTop}
          selected={sel?.from === "reserve"}
          onClick={() => {
            if (!saved.reserve.length) return;
            if (sel?.from === "reserve") {
              setSel(null);
              toFoundation();
            } else setSel({ from: "reserve" });
          }}
          aria-label="Reserve"
        />
        <span className="tp-left">reserve {saved.reserve.length}</span>
      </div>

      <div className="kl-tableau">
        {saved.tableau.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapTableau(p, null);
            }}
          >
            {pile.map((card, i) => (
              <PlayingCard
                key={card}
                card={card}
                selected={sel?.from === "tableau" && sel.pile === p && i >= sel.index}
                className="kl-stacked"
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapTableau(p, i)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Home in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
