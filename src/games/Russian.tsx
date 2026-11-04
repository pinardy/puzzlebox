import { useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { downInSuit, rank, stackPlace, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, Pile, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

const HELP =
  "Yukon's cruel cousin. There is no deck — all fifty-two cards are dealt. " +
  "Move ANY face-up card together with every card sitting on it, in any " +
  "order, onto a card one rank higher OF THE SAME SUIT. Only kings may go " +
  "to an empty column. Build the foundations up by suit from ace to king. " +
  "Very few deals go all the way — that is the game.";

interface SavedState {
  tableau: number[][];
  faceDown: number[];
  foundations: number[]; // per suit: highest rank placed
  moves: number;
  done: boolean;
}

/** Col 1: one card up; cols 2–7: n−1 down plus five up. All 52 dealt. */
function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`russian-${seed}`));
  const tableau: number[][] = [];
  let at = 0;
  for (let p = 0; p < 7; p++) {
    const size = p === 0 ? 1 : p + 5;
    tableau.push(deck.slice(at, at + size));
    at += size;
  }
  return {
    tableau,
    faceDown: [0, 1, 2, 3, 4, 5, 6],
    foundations: [0, 0, 0, 0],
    moves: 0,
    done: false
  };
}

type Sel = { pile: number; index: number } | null;

export default function Russian({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>((s) =>
    deal(s)
  );
  const [sel, setSel] = useState<Sel>(null);

  function play(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      commit(next, { outcome: "won" });
    } else commit(next);
    setSel(null);
  }

  function clone(): SavedState {
    return {
      ...saved,
      tableau: saved.tableau.map((p) => p.slice()),
      faceDown: saved.faceDown.slice(),
      foundations: saved.foundations.slice()
    };
  }

  function takeSelection(next: SavedState): number[] {
    if (!sel) return [];
    const cards = next.tableau[sel.pile].splice(sel.index);
    const pile = next.tableau[sel.pile];
    if (pile.length > 0 && pile.length === next.faceDown[sel.pile])
      next.faceDown[sel.pile]--;
    return cards;
  }

  function tryFoundation() {
    if (!sel) return;
    const cards = saved.tableau[sel.pile].slice(sel.index);
    if (cards.length !== 1 || rank(cards[0]) !== saved.foundations[suit(cards[0])] + 1) {
      setSel(null);
      return;
    }
    const next = clone();
    const card = cards[0];
    takeSelection(next);
    next.foundations[suit(card)]++;
    play(next);
  }

  function tap(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.tableau[pile];

    if (sel) {
      if (sel.pile === pile) {
        const single = sel.index === saved.tableau[pile].length - 1;
        setSel(null);
        if (single) tryFoundation();
        return;
      }
      const moving = saved.tableau[sel.pile][sel.index];
      const top = cards.length ? cards[cards.length - 1] : null;
      // The one difference from Yukon: same suit, not opposite colour.
      const fits = top === null ? rank(moving) === 13 : downInSuit(moving, top);
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
    <div className="game game-yukon">
      <GameHeader title="Russian Solitaire" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        No deck — move any face-up card with everything on it, same suit only.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="kl-top">
        <span className="kl-gap" />
        {saved.foundations.map((f, s) => (
          <Foundation key={s} suit={s} top={f} onClick={tryFoundation} />
        ))}
      </div>

      <div className="kl-tableau">
        {saved.tableau.map((pile, p) => (
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
        <span>Moves: {saved.moves}</span>
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
