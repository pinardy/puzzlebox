import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import type { Diff } from "../lib/storage";
import { SUITS, downAltColour, rank, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

const CELLS: Record<Diff, number> = { easy: 4, medium: 3, hard: 2 };
const HELP =
  "Everything is face-up. Build the foundations up by suit from ace to " +
  "king. Cascades stack down in alternating colours; each free cell holds " +
  "one card — four on Easy, three on Medium, two on Hard. You can move a " +
  "run only if enough free cells and empty cascades exist to move it card " +
  "by card.";

interface SavedState {
  cascades: number[][];
  free: (number | null)[];
  foundations: number[]; // per suit: highest rank placed
  moves: number;
  done: boolean;
}

function deal(seed: string, diff: Diff): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`freecell-${seed}`));
  const cascades: number[][] = [];
  let at = 0;
  for (let p = 0; p < 8; p++) {
    const size = p < 4 ? 7 : 6;
    cascades.push(deck.slice(at, at + size));
    at += size;
  }
  return {
    cascades,
    free: Array(CELLS[diff]).fill(null),
    foundations: [0, 0, 0, 0],
    moves: 0,
    done: false
  };
}

type Sel =
  | { from: "cascade"; pile: number; index: number }
  | { from: "free"; slot: number }
  | null;

export default function FreeCell({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => deal(s, d));
  const [sel, setSel] = useState<Sel>(null);

  const selCards = useMemo((): number[] => {
    if (!sel) return [];
    if (sel.from === "free") {
      const c = saved.free[sel.slot];
      return c === null ? [] : [c];
    }
    return saved.cascades[sel.pile].slice(sel.index);
  }, [sel, saved]);

  /** A grabbable run descends in alternating colours. */
  function validRun(cards: number[]): boolean {
    for (let i = 0; i + 1 < cards.length; i++)
      if (!downAltColour(cards[i + 1], cards[i])) return false;
    return true;
  }

  function moveCapacity(targetEmpty: boolean): number {
    const freeSlots = saved.free.filter((c) => c === null).length;
    const emptyCascades = saved.cascades.filter((p) => p.length === 0).length;
    const usable = targetEmpty ? Math.max(0, emptyCascades - 1) : emptyCascades;
    return (freeSlots + 1) * 2 ** usable;
  }

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
      cascades: saved.cascades.map((p) => p.slice()),
      free: saved.free.slice(),
      foundations: saved.foundations.slice()
    };
  }

  function takeSelection(next: SavedState): number[] {
    if (!sel) return [];
    if (sel.from === "free") {
      const c = next.free[sel.slot]!;
      next.free[sel.slot] = null;
      return [c];
    }
    return next.cascades[sel.pile].splice(sel.index);
  }

  function tryFoundation() {
    if (selCards.length !== 1) {
      setSel(null);
      return;
    }
    const card = selCards[0];
    if (rank(card) !== saved.foundations[suit(card)] + 1) {
      setSel(null);
      return;
    }
    const next = clone();
    takeSelection(next);
    next.foundations[suit(card)]++;
    play(next);
  }

  function tapCascade(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.cascades[pile];

    if (sel) {
      const run = selCards;
      if (!run.length) { setSel(null); return; }
      if (sel.from === "cascade" && sel.pile === pile) {
        setSel(null);
        if (run.length === 1) tryFoundation();
        return;
      }
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null
          ? true
          : downAltColour(run[0], top);
      if (!fits || run.length > moveCapacity(top === null)) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = takeSelection(next);
      next.cascades[pile].push(...moved);
      play(next);
      return;
    }

    if (index === null) return;
    const run = cards.slice(index);
    if (validRun(run)) setSel({ from: "cascade", pile, index });
  }

  function tapFree(slot: number) {
    if (saved.done) return;
    const inSlot = saved.free[slot];
    if (sel) {
      if (sel.from === "free" && sel.slot === slot) {
        setSel(null);
        tryFoundation();
        return;
      }
      if (inSlot === null && selCards.length === 1) {
        const next = clone();
        const [card] = takeSelection(next);
        next.free[slot] = card;
        play(next);
        return;
      }
      setSel(null);
      return;
    }
    if (inSlot !== null) setSel({ from: "free", slot });
  }

  /** Send every card that currently fits a foundation, repeatedly. */
  function sendUp() {
    const next = clone();
    let moved = true;
    let count = 0;
    while (moved) {
      moved = false;
      for (let s = 0; s < next.free.length; s++) {
        const c = next.free[s];
        if (c !== null && rank(c) === next.foundations[suit(c)] + 1) {
          next.free[s] = null;
          next.foundations[suit(c)]++;
          moved = true;
          count++;
        }
      }
      for (const pile of next.cascades) {
        if (!pile.length) continue;
        const top = pile[pile.length - 1];
        if (rank(top) === next.foundations[suit(top)] + 1) {
          pile.pop();
          next.foundations[suit(top)]++;
          moved = true;
          count++;
        }
      }
    }
    if (count > 0) play(next);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel?.from === "cascade" && sel.pile === pile && index >= sel.index;

  return (
    <div className="game game-freecell" style={{ "--cols": 8 } as CSSProperties}>
      <GameHeader title="FreeCell" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap a run, then where it goes; tap a selected card again to send it
        up.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="kl-top">
        {saved.free.map((c, s) => (
          <PlayingCard
            key={s}
            card={c}
            selected={sel?.from === "free" && sel.slot === s}
            onClick={() => tapFree(s)}
            aria-label={`Free cell ${s + 1}`}
          >
            {c === null ? "·" : undefined}
          </PlayingCard>
        ))}
        {saved.foundations.map((f, s) => (
          <Foundation
            key={s}
            suit={s}
            top={f}
            onClick={tryFoundation}
            aria-label={`${SUITS[s]} foundation`}
          />
        ))}
      </div>

      <div className="kl-tableau">
        {saved.cascades.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapCascade(p, null);
            }}
          >
            {pile.map((card, i) => (
              <PlayingCard
                key={card}
                card={card}
                selected={isSelected(p, i)}
                className="kl-stacked"
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapCascade(p, i)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
        <button className="mini-btn" onClick={sendUp}>
          Send up ↑
        </button>
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
