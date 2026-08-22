import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

// Two packs: id 0–103, suit = id % 4, rank = ⌊id/4⌋ mod 13 + 1.
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => (Math.floor(id / 4) % 13) + 1;
const suit = (id: number) => id % 4;
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;
const HELP =
  "Two packs, everything face up, and no second chances: the deck deals " +
  "one card at a time with no redeal. Columns build DOWN in the same suit " +
  "and only one card moves at a time; an empty column takes anything. " +
  "Fill all eight foundations from ace to king.";

interface SavedState {
  tableau: number[][];
  stock: number[];
  waste: number[];
  foundations: number[]; // 8 piles, suit = index % 4
  moves: number;
  done: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(104).keys()], makeRng(`forty-${seed}`));
  const tableau: number[][] = [];
  for (let p = 0; p < 10; p++) tableau.push(deck.slice(p * 4, p * 4 + 4));
  return {
    tableau,
    stock: deck.slice(40),
    waste: [],
    foundations: Array(8).fill(0),
    moves: 0,
    done: false
  };
}

type Sel = { from: "waste" } | { from: "tableau"; pile: number } | null;

export default function FortyThieves({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("forty", (s) => deal(s));
  const [sel, setSel] = useState<Sel>(null);

  const selCard = (): number | null => {
    if (!sel) return null;
    if (sel.from === "waste")
      return saved.waste.length ? saved.waste[saved.waste.length - 1] : null;
    const p = saved.tableau[sel.pile];
    return p.length ? p[p.length - 1] : null;
  };

  function clone(): SavedState {
    return {
      ...saved,
      tableau: saved.tableau.map((p) => p.slice()),
      stock: saved.stock.slice(),
      waste: saved.waste.slice(),
      foundations: saved.foundations.slice()
    };
  }

  function finish(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      recordResult("forty", true);
    }
    commit(next);
    setSel(null);
  }

  function take(next: SavedState): number {
    if (sel!.from === "waste") return next.waste.pop()!;
    return next.tableau[sel!.pile].pop()!;
  }

  function toFoundation() {
    const card = selCard();
    if (card === null) return;
    const f = saved.foundations.findIndex(
      (v, k) => k % 4 === suit(card) && v === rank(card) - 1
    );
    if (f === -1) {
      setSel(null);
      return;
    }
    const next = clone();
    take(next);
    next.foundations[f]++;
    finish(next);
  }

  function tapPile(pile: number) {
    if (saved.done) return;
    const cards = saved.tableau[pile];
    if (sel) {
      if (sel.from === "tableau" && sel.pile === pile) {
        setSel(null);
        toFoundation();
        return;
      }
      const card = selCard();
      if (card === null) {
        setSel(null);
        return;
      }
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null || (suit(card) === suit(top) && rank(card) === rank(top) - 1);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = take(next);
      next.tableau[pile].push(moved);
      finish(next);
      return;
    }
    if (cards.length) setSel({ from: "tableau", pile });
  }

  function tapWaste() {
    if (saved.done || !saved.waste.length) return;
    if (sel?.from === "waste") {
      setSel(null);
      toFoundation();
      return;
    }
    setSel({ from: "waste" });
  }

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

  const wasteTop = saved.waste.length ? saved.waste[saved.waste.length - 1] : null;

  return (
    <div className="game game-forty" style={{ "--cols": 10 } as CSSProperties}>
      <GameHeader title="Forty Thieves" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Build down in suit, one card at a time. Eight foundations to fill.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <button
          className={`kl-card ${saved.stock.length ? "kl-back" : "kl-empty"}`}
          onClick={tapStock}
          aria-label="Stock"
        >
          {saved.stock.length || "—"}
        </button>
        <button
          className={[
            "kl-card",
            wasteTop === null ? "kl-empty" : "",
            wasteTop !== null && isRed(wasteTop) ? "red" : "",
            sel?.from === "waste" ? "selected" : ""
          ].join(" ")}
          onClick={tapWaste}
          aria-label="Waste"
        >
          {wasteTop !== null ? label(wasteTop) : ""}
        </button>
        {saved.foundations.map((f, k) => (
          <button
            key={k}
            className={`kl-card kl-found${f === 0 ? " kl-empty" : ""}${
              f > 0 && (k % 4 === 1 || k % 4 === 2) ? " red" : ""
            }`}
            onClick={toFoundation}
            aria-label={`${SUITS[k % 4]} foundation`}
          >
            {f === 0 ? SUITS[k % 4] : `${RANKS[f - 1]}${SUITS[k % 4]}`}
          </button>
        ))}
      </div>

      <div className="kl-tableau">
        {saved.tableau.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapPile(p);
            }}
          >
            {pile.map((card, i) => (
              <button
                key={card}
                className={[
                  "kl-card kl-stacked",
                  isRed(card) ? "red" : "",
                  sel?.from === "tableau" && sel.pile === p && i === pile.length - 1
                    ? "selected"
                    : ""
                ].join(" ")}
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapPile(p)}
              >
                {label(card)}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>Moves: {saved.moves} · stock {saved.stock.length}</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="forty"
          won
          message={`All eight foundations in ${saved.moves} moves!`}
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
