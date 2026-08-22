import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

// Card id 0–51: suit = id % 4 (♠ ♥ ♦ ♣), rank = 1 (ace) … 13 (king).
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
const suit = (id: number) => id % 4;
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;
const HELP =
  "Spider with teeth: cards go only on the next-higher card of the SAME " +
  "suit, but you may pick up ANY face-up card with everything on top of " +
  "it, in any order. Kings alone move to empty columns. A finished " +
  "same-suit K-to-A run clears; clear all four. The three reserve cards " +
  "deal onto the first columns when you're stuck.";

interface SavedState {
  cols: number[][];
  faceDown: number[];
  reserve: number[];
  completed: number;
  moves: number;
  done: boolean;
}

/** Seven columns of seven; the first four start with three face-down.
 *  Three cards wait in reserve. */
function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`scorpion-${seed}`));
  const cols: number[][] = [];
  for (let p = 0; p < 7; p++) cols.push(deck.slice(p * 7, p * 7 + 7));
  return {
    cols,
    faceDown: [3, 3, 3, 3, 0, 0, 0],
    reserve: deck.slice(49),
    completed: 0,
    moves: 0,
    done: false
  };
}

/** Remove a finished same-suit K→A run from the top of a column. */
function clearRuns(next: SavedState): void {
  for (let p = 0; p < 7; p++) {
    const pile = next.cols[p];
    if (pile.length < 13) continue;
    const tail = pile.slice(-13);
    const isRun = tail.every(
      (c, i) => rank(c) === 13 - i && suit(c) === suit(tail[0])
    );
    const allUp = pile.length - 13 >= next.faceDown[p];
    if (isRun && allUp) {
      pile.splice(-13);
      next.completed++;
      if (pile.length > 0 && pile.length === next.faceDown[p]) next.faceDown[p]--;
    }
  }
}

type Sel = { pile: number; index: number } | null;

export default function Scorpion({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("scorpion", (s) => deal(s));
  const [sel, setSel] = useState<Sel>(null);

  function finish(next: SavedState) {
    next.moves++;
    clearRuns(next);
    if (!next.done && next.completed === 4) {
      next.done = true;
      recordResult("scorpion", true);
    }
    commit(next);
    setSel(null);
  }

  function clone(): SavedState {
    return {
      ...saved,
      cols: saved.cols.map((p) => p.slice()),
      faceDown: saved.faceDown.slice(),
      reserve: saved.reserve.slice()
    };
  }

  function tapReserve() {
    if (saved.done || !saved.reserve.length) return;
    const next = clone();
    next.reserve.forEach((card, i) => next.cols[i].push(card));
    next.reserve = [];
    finish(next);
  }

  function tap(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.cols[pile];

    if (sel) {
      if (sel.pile === pile) {
        setSel(null);
        return;
      }
      const moving = saved.cols[sel.pile][sel.index];
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null
          ? rank(moving) === 13
          : rank(moving) === rank(top) - 1 && suit(moving) === suit(top);
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = next.cols[sel.pile].splice(sel.index);
      const src = next.cols[sel.pile];
      if (src.length > 0 && src.length === next.faceDown[sel.pile])
        next.faceDown[sel.pile]--;
      next.cols[pile].push(...moved);
      finish(next);
      return;
    }

    // Any face-up card grabs, with everything above it.
    if (index === null || index < saved.faceDown[pile]) return;
    setSel({ pile, index });
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel !== null && sel.pile === pile && index >= sel.index;

  return (
    <div className="game game-scorpion">
      <GameHeader title="Scorpion" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Build down by suit; grab any face-up card. Clear four K→A runs.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <button
          className={`kl-card ${saved.reserve.length ? "kl-back" : "kl-empty"}`}
          onClick={tapReserve}
          aria-label="Reserve"
        >
          {saved.reserve.length || "—"}
        </button>
        <span className="kl-gap" />
        <span className="spider-done">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={i < saved.completed ? "run-done" : "run-todo"}>
              {SUITS[i]}
            </span>
          ))}
        </span>
      </div>

      <div className="kl-tableau">
        {saved.cols.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tap(p, null);
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
                  onClick={() => tap(p, up ? i : null)}
                >
                  {up ? label(card) : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>Moves: {saved.moves} · runs {saved.completed}/4</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="scorpion"
          won
          message={`All four suits in ${saved.moves} moves!`}
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
