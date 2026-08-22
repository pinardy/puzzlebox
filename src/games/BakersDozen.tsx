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
  "Thirteen columns, everything face up, no deck to fall back on. Build " +
  "DOWN by rank, suit ignored, one card at a time — and an emptied column " +
  "stays empty, so think before you clear one. Kings are buried at the " +
  "bottom of their column when the cards are dealt.";

interface SavedState {
  cols: number[][];
  foundations: number[];
  moves: number;
  done: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`bakers-${seed}`));
  const cols: number[][] = [];
  for (let p = 0; p < 13; p++) {
    const col = deck.slice(p * 4, p * 4 + 4);
    // Kings sink to the bottom, or they would block their column forever.
    const kings = col.filter((c) => rank(c) === 13);
    const rest = col.filter((c) => rank(c) !== 13);
    cols.push([...kings, ...rest]);
  }
  return { cols, foundations: [0, 0, 0, 0], moves: 0, done: false };
}

export default function BakersDozen({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("bakers", (s) => deal(s));
  const [sel, setSel] = useState<number | null>(null);

  function clone(): SavedState {
    return {
      ...saved,
      cols: saved.cols.map((p) => p.slice()),
      foundations: saved.foundations.slice()
    };
  }

  function finish(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      recordResult("bakers", true);
    }
    commit(next);
    setSel(null);
  }

  function toFoundation(pile: number) {
    const col = saved.cols[pile];
    if (!col.length) return;
    const card = col[col.length - 1];
    if (saved.foundations[suit(card)] !== rank(card) - 1) {
      setSel(null);
      return;
    }
    const next = clone();
    next.cols[pile].pop();
    next.foundations[suit(card)]++;
    finish(next);
  }

  function tapPile(pile: number) {
    if (saved.done) return;
    if (sel !== null) {
      if (sel === pile) {
        setSel(null);
        toFoundation(pile);
        return;
      }
      const from = saved.cols[sel];
      if (!from.length) {
        setSel(null);
        return;
      }
      const card = from[from.length - 1];
      const dest = saved.cols[pile];
      // Empty columns stay empty — nothing may be moved into one.
      if (!dest.length || rank(card) !== rank(dest[dest.length - 1]) - 1) {
        setSel(null);
        return;
      }
      const next = clone();
      next.cols[sel].pop();
      next.cols[pile].push(card);
      finish(next);
      return;
    }
    if (saved.cols[pile].length) setSel(pile);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const left = saved.cols.reduce((a, c) => a + c.length, 0);

  return (
    <div className="game game-bakers" style={{ "--cols": 13 } as CSSProperties}>
      <GameHeader title="Baker's Dozen" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Build down by rank, any suit. Empty columns stay empty.
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
            onClick={() => sel !== null && toFoundation(sel)}
            aria-label={`${SUITS[s]} foundation`}
          >
            {f === 0 ? SUITS[s] : `${RANKS[f - 1]}${SUITS[s]}`}
          </button>
        ))}
      </div>

      <div className="kl-tableau bd-tableau">
        {saved.cols.map((pile, p) => (
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
                  sel === p && i === pile.length - 1 ? "selected" : ""
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
        <span>Moves: {saved.moves} · {left} cards left</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="bakers"
          won
          message={`Cleared in ${saved.moves} moves!`}
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
