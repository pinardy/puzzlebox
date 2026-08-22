import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
const suit = (id: number) => id % 4;
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;
const HELP =
  "The foundations start on whatever rank the first card happens to be, " +
  "and both foundations and columns wrap around — after a king comes an " +
  "ace. Columns build DOWN in alternating colours; a gap is refilled from " +
  "the reserve. The deck turns three at a time, over and over.";

// One step up (foundations) or down (tableau), wrapping past king/ace.
const nextUp = (r: number) => (r === 13 ? 1 : r + 1);
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
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("canfield", (s) => deal(s));
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

  function finish(next: SavedState) {
    next.moves++;
    // A gap is refilled from the reserve while any card is left there.
    for (let p = 0; p < 4; p++)
      if (next.tableau[p].length === 0 && next.reserve.length)
        next.tableau[p] = [next.reserve.pop()!];
    if (!next.done && next.foundations.every((f) => f === nextDown(next.base))) {
      next.done = true;
      recordResult("canfield", true);
    }
    commit(next);
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
    const want = f === 0 ? saved.base : nextUp(f);
    if (rank(card) !== want) {
      setSel(null);
      return;
    }
    const next = clone();
    take(next);
    next.foundations[suit(card)] = rank(card);
    finish(next);
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
      finish(next);
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
    finish(next);
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
        <button
          className={`kl-card ${saved.stock.length ? "kl-back" : "kl-empty"}`}
          onClick={tapStock}
          aria-label="Stock"
        >
          {saved.stock.length || "↻"}
        </button>
        <button
          className={[
            "kl-card",
            wasteTop === null ? "kl-empty" : "",
            wasteTop !== null && isRed(wasteTop) ? "red" : "",
            sel?.from === "waste" ? "selected" : ""
          ].join(" ")}
          onClick={() => {
            if (!saved.waste.length) return;
            if (sel?.from === "waste") {
              setSel(null);
              toFoundation();
            } else setSel({ from: "waste" });
          }}
          aria-label="Waste"
        >
          {wasteTop !== null ? label(wasteTop) : ""}
        </button>
        <span className="kl-gap" />
        {saved.foundations.map((f, s) => (
          <button
            key={s}
            className={`kl-card kl-found${f === 0 ? " kl-empty" : ""}${
              f > 0 && (s === 1 || s === 2) ? " red" : ""
            }`}
            onClick={toFoundation}
            aria-label={`${SUITS[s]} foundation`}
          >
            {f === 0 ? SUITS[s] : `${RANKS[f - 1]}${SUITS[s]}`}
          </button>
        ))}
      </div>

      <div className="kl-top cf-reserve">
        <button
          className={[
            "kl-card",
            reserveTop === null ? "kl-empty" : "",
            reserveTop !== null && isRed(reserveTop) ? "red" : "",
            sel?.from === "reserve" ? "selected" : ""
          ].join(" ")}
          onClick={() => {
            if (!saved.reserve.length) return;
            if (sel?.from === "reserve") {
              setSel(null);
              toFoundation();
            } else setSel({ from: "reserve" });
          }}
          aria-label="Reserve"
        >
          {reserveTop !== null ? label(reserveTop) : ""}
        </button>
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
              <button
                key={card}
                className={[
                  "kl-card kl-stacked",
                  isRed(card) ? "red" : "",
                  sel?.from === "tableau" && sel.pile === p && i >= sel.index
                    ? "selected"
                    : ""
                ].join(" ")}
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapTableau(p, i)}
              >
                {label(card)}
              </button>
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
          game="canfield"
          won
          message={`Home in ${saved.moves} moves!`}
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
