import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { SUITS, downInSuit, nCards, rank, stackPlace, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Pile, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

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
    const isRun = tail.every((c, i) => rank(c) === 13 - i && suit(c) === suit(tail[0]));
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
  const { seed, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>((s) =>
    deal(s)
  );
  const [sel, setSel] = useState<Sel>(null);

  function play(next: SavedState) {
    next.moves++;
    clearRuns(next);
    if (!next.done && next.completed === 4) {
      next.done = true;
      commit(next, { outcome: "won" });
    } else commit(next);
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
    play(next);
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
      const fits = top === null ? rank(moving) === 13 : downInSuit(moving, top);
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
      play(next);
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
        <PlayingCard
          card={null}
          faceDown={saved.reserve.length > 0}
          onClick={tapReserve}
          aria-label={
            saved.reserve.length
              ? `Reserve, ${nCards(saved.reserve.length)}, deal onto the first columns`
              : "Reserve, empty"
          }
        >
          {saved.reserve.length || "—"}
        </PlayingCard>
        <span className="kl-gap" />
        <span
          className="spider-done"
          role="img"
          aria-label={`${saved.completed} of 4 runs complete`}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={i < saved.completed ? "run-done" : "run-todo"}>
              {SUITS[i]}
            </span>
          ))}
        </span>
      </div>

      <div className="kl-tableau">
        {saved.cols.map((pile, p) => (
          <Pile
            key={p}
            name={`Column ${p + 1}`}
            empty={!pile.length}
            onTap={() => tap(p, null)}
          >
            {pile.map((card, i) => {
              const up = i >= saved.faceDown[p];
              return (
                <PlayingCard
                  key={card}
                  card={card}
                  faceDown={!up}
                  selected={isSelected(p, i)}
                  className="kl-stacked"
                  style={{ "--stack": i } as CSSProperties}
                  place={stackPlace(`Column ${p + 1}`, i, pile.length)}
                  onClick={() => tap(p, up ? i : null)}
                />
              );
            })}
          </Pile>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          Moves: {saved.moves} · runs {saved.completed}/4
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`All four suits in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
