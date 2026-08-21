import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

// Card id 0–51: suit = id % 4 (♠ ♥ ♦ ♣), rank = 1 (ace) … 13 (king).
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
const suit = (id: number) => id % 4;
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;

interface SavedState {
  tableau: number[][]; // bottom → top
  faceDown: number[]; // face-down count at the bottom of each pile
  stock: number[]; // top = last
  waste: number[]; // top = last
  foundations: number[]; // per suit: highest rank placed (0 = empty)
  moves: number;
  done: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`klondike-${seed}`));
  const tableau: number[][] = [];
  let at = 0;
  for (let p = 0; p < 7; p++) {
    tableau.push(deck.slice(at, at + p + 1));
    at += p + 1;
  }
  return {
    tableau,
    faceDown: [0, 1, 2, 3, 4, 5, 6],
    stock: deck.slice(at),
    waste: [],
    foundations: [0, 0, 0, 0],
    moves: 0,
    done: false
  };
}

type Sel =
  | { from: "waste" }
  | { from: "tableau"; pile: number; index: number }
  | null;

export default function Klondike({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("klondike")?.seed ?? newSeed()
  );
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("klondike")?.state ?? deal(seed)
  );
  const [sel, setSel] = useState<Sel>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selCards = useMemo((): number[] => {
    if (!sel) return [];
    if (sel.from === "waste")
      return saved.waste.length ? [saved.waste[saved.waste.length - 1]] : [];
    return saved.tableau[sel.pile].slice(sel.index);
  }, [sel, saved]);

  function commit(next: SavedState, moved: boolean) {
    if (moved) next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      recordResult("klondike", true);
      setToast(`Cleared in ${next.moves} moves!`);
    }
    setSaved(next);
    saveSlot("klondike", seed, next);
    setSel(null);
  }

  function clone(): SavedState {
    return {
      ...saved,
      tableau: saved.tableau.map((p) => p.slice()),
      faceDown: saved.faceDown.slice(),
      stock: saved.stock.slice(),
      waste: saved.waste.slice(),
      foundations: saved.foundations.slice()
    };
  }

  /** Remove the current selection from its source pile, flipping a newly
   *  exposed tableau card. */
  function takeSelection(next: SavedState): number[] {
    if (!sel) return [];
    if (sel.from === "waste") return [next.waste.pop()!];
    const cards = next.tableau[sel.pile].splice(sel.index);
    const pile = next.tableau[sel.pile];
    if (pile.length > 0 && pile.length === next.faceDown[sel.pile])
      next.faceDown[sel.pile]--;
    return cards;
  }

  function tapStock() {
    if (saved.done) return;
    const next = clone();
    if (next.stock.length) next.waste.push(next.stock.pop()!);
    else if (next.waste.length) {
      next.stock = next.waste.reverse();
      next.waste = [];
    } else return;
    commit(next, true);
  }

  function tryFoundation() {
    if (selCards.length !== 1) return;
    const card = selCards[0];
    if (rank(card) !== saved.foundations[suit(card)] + 1) {
      setSel(null);
      return;
    }
    const next = clone();
    takeSelection(next);
    next.foundations[suit(card)]++;
    commit(next, true);
  }

  function tapTableau(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.tableau[pile];

    if (sel) {
      // Attempt to drop the selection on this pile.
      const run = selCards;
      if (!run.length) { setSel(null); return; }
      const first = run[0];
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null
          ? rank(first) === 13
          : cards.length > saved.faceDown[pile] &&
            rank(first) === rank(top) - 1 &&
            isRed(first) !== isRed(top);
      const sameSpot =
        sel.from === "tableau" && sel.pile === pile;
      if (sameSpot) {
        // Tapping the selected card again sends a single card up if it fits.
        setSel(null);
        if (run.length === 1) tryFoundation();
        return;
      }
      if (!fits) { setSel(null); return; }
      const next = clone();
      const moved = takeSelection(next);
      next.tableau[pile].push(...moved);
      commit(next, true);
      return;
    }

    // Select a face-up card (and everything on top of it).
    if (index === null || index < saved.faceDown[pile]) return;
    setSel({ from: "tableau", pile, index });
  }

  function tapWaste() {
    if (saved.done || !saved.waste.length) return;
    if (sel && sel.from === "waste") {
      setSel(null);
      tryFoundation();
      return;
    }
    setSel({ from: "waste" });
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(deal(s));
    saveSlot("klondike", s, deal(s));
    setSel(null);
    setToast(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel?.from === "tableau" && sel.pile === pile && index >= sel.index;

  return (
    <div className="game game-klondike">
      <GameHeader title="Solitaire" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Tap a card, then where it goes. Build down in alternating colours;
        aces start the foundations — tap a selected card again to send it up.
      </p>

      <div className="kl-top">
        <button className="kl-card kl-back" onClick={tapStock} aria-label="Stock">
          {saved.stock.length ? saved.stock.length : "↻"}
        </button>
        <button
          className={`kl-card${saved.waste.length ? "" : " kl-empty"}${
            sel?.from === "waste" ? " selected" : ""
          }${saved.waste.length && isRed(saved.waste[saved.waste.length - 1]) ? " red" : ""}`}
          onClick={tapWaste}
          aria-label="Waste"
        >
          {saved.waste.length ? label(saved.waste[saved.waste.length - 1]) : ""}
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
              if (e.target === e.currentTarget) tapTableau(p, null);
            }}
          >
            {pile.map((card, i) => {
              const up = i >= saved.faceDown[p];
              return (
                <button
                  key={card}
                  className={[
                    "kl-card kl-stacked",
                    up ? "" : "kl-back",
                    up && isRed(card) ? "red" : "",
                    isSelected(p, i) ? "selected" : ""
                  ].join(" ")}
                  style={{ "--stack": i } as CSSProperties}
                  onClick={() => tapTableau(p, up ? i : null)}
                >
                  {up ? label(card) : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
      </div>
    </div>
  );
}
