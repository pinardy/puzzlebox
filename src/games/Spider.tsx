import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import type { Diff } from "../lib/storage";
import { SUITS, cardId, stackPlace } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Pile, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

// 104 cards in 8 sets of 13. Card id 0–103, rank = id % 13 + 1 (A…K);
// the suit of each 13-card set cycles through the difficulty's suits.
// This is deliberately NOT the shared `lib/cards` encoding: saved games
// hold these ids, and the suit depends on the difficulty anyway. Cards are
// mapped onto the shared encoding only to be drawn (see `face`).
const SUIT_COUNT: Record<Diff, number> = { easy: 1, medium: 2, hard: 4 };
const rank = (id: number) => (id % 13) + 1;
const HELP =
  "Stack cards downward on any pile, K high to A low, regardless of suit — " +
  "but only a same-suit descending run moves as one unit, and only a " +
  "same-suit K-to-A run clears off the board. Clear all eight to win. Tap " +
  "the deck to deal one card onto every column; every column must have a " +
  "card first. Easy plays one suit, Medium two, Hard the full four.";

interface SavedState {
  cols: number[][];
  faceDown: number[];
  stock: number[];
  completed: number;
  moves: number;
  done: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(104).keys()], makeRng(`spider-${seed}`));
  const cols: number[][] = [];
  let at = 0;
  for (let p = 0; p < 10; p++) {
    const size = p < 4 ? 6 : 5;
    cols.push(deck.slice(at, at + size));
    at += size;
  }
  return {
    cols,
    faceDown: cols.map((c) => c.length - 1),
    stock: deck.slice(at), // 50 cards = 5 deals of 10
    completed: 0,
    moves: 0,
    done: false
  };
}

/** Remove a finished same-suit K→A run from the top of a column. */
function clearRuns(next: SavedState, suitOf: (id: number) => number): void {
  for (let p = 0; p < 10; p++) {
    const pile = next.cols[p];
    if (pile.length < 13) continue;
    const tail = pile.slice(-13);
    const isRun = tail.every(
      (c, i) => rank(c) === 13 - i && suitOf(c) === suitOf(tail[0])
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

export default function Spider({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>(
    (s) => deal(s)
  );
  const [sel, setSel] = useState<Sel>(null);
  const nSuits = SUIT_COUNT[diff];
  const suitOf = (id: number) => Math.floor(id / 13) % nSuits;
  /** The shared-encoding card this one shows as, for `PlayingCard`. */
  const face = (id: number) => cardId(rank(id), suitOf(id));

  const selCards = useMemo(
    (): number[] => (sel ? saved.cols[sel.pile].slice(sel.index) : []),
    [sel, saved]
  );

  function play(next: SavedState) {
    next.moves++;
    clearRuns(next, suitOf);
    if (!next.done && next.completed === 8) {
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
      stock: saved.stock.slice()
    };
  }

  function tapStock() {
    if (saved.done || !saved.stock.length) return;
    if (saved.cols.some((p) => p.length === 0)) return; // fill empties first
    const next = clone();
    for (let p = 0; p < 10; p++) next.cols[p].push(next.stock.pop()!);
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
      const run = selCards;
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits = top === null || rank(run[0]) === rank(top) - 1;
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

    if (index === null || index < saved.faceDown[pile]) return;
    // Grabbable run: same suit, strictly descending by one to the end.
    const run = cards.slice(index);
    const ok = run.every(
      (c, i) =>
        i === 0 || (rank(c) === rank(run[i - 1]) - 1 && suitOf(c) === suitOf(run[0]))
    );
    if (ok) setSel({ pile, index });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel !== null && sel.pile === pile && index >= sel.index;

  return (
    <div className="game game-spider" style={{ "--cols": 10 } as CSSProperties}>
      <GameHeader title="Spider" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        {nSuits === 1 ? "One suit" : nSuits === 2 ? "Two suits" : "Four suits"}. Build
        same-suit K→A runs to clear them; complete all eight.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="kl-top">
        <PlayingCard
          card={null}
          faceDown
          onClick={tapStock}
          aria-label={`Stock, ${saved.stock.length / 10} deal${
            saved.stock.length === 10 ? "" : "s"
          } left`}
        >
          {saved.stock.length / 10}
        </PlayingCard>
        <span className="kl-gap" />
        <span
          className="spider-done"
          role="img"
          aria-label={`${saved.completed} of 8 runs complete`}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={i < saved.completed ? "run-done" : "run-todo"}>
              {SUITS[i % nSuits]}
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
                  card={face(card)}
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
          Moves: {saved.moves} · runs {saved.completed}/8
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`All eight runs in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
