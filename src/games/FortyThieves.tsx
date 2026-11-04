import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { SUITS, downInSuit, rank, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

// Two packs: id 0–103, the second pack being ids 52–103 (see lib/cards).
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
  const { seed, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s) => deal(s));
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

  function play(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      commit(next, { outcome: "won" });
    } else commit(next);
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
    play(next);
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
        top === null || downInSuit(card, top);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = take(next);
      next.tableau[pile].push(moved);
      play(next);
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
    play(next);
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
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label="Stock"
        >
          {saved.stock.length || "—"}
        </PlayingCard>
        <PlayingCard
          card={wasteTop}
          selected={sel?.from === "waste"}
          onClick={tapWaste}
          aria-label="Waste"
        />
        {saved.foundations.map((f, k) => (
          <Foundation
            key={k}
            suit={k % 4}
            top={f}
            onClick={toFoundation}
            aria-label={`${SUITS[k % 4]} foundation`}
          />
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
              <PlayingCard
                key={card}
                card={card}
                selected={
                  sel?.from === "tableau" && sel.pile === p && i === pile.length - 1
                }
                className="kl-stacked"
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapPile(p)}
              />
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
          won
          message={`All eight foundations in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
