import { useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import type { Diff } from "../lib/storage";
import { nCards, rank } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

const WRAP: Record<Diff, boolean> = { easy: true, medium: false, hard: false };
const STOCK: Record<Diff, number> = { easy: 23, medium: 23, hard: 20 };
const HELP =
  "Clear all three peaks. You may take any uncovered card that is one rank " +
  "above or below the waste card — on Easy, aces and kings wrap around. " +
  "Stuck? Flip a new card from the deck; Hard deals a three-card-shorter " +
  "deck. The game ends when the deck runs dry with no plays left.";

/** The 28 tableau spots: row, x position (in card widths), and the two
 *  spots that must be cleared before this one is exposed. */
interface Spot {
  x: number;
  r: number;
  covers: [number, number] | null;
}

const SPOTS: Spot[] = (() => {
  const out: Spot[] = [];
  for (let p = 0; p < 3; p++)
    out.push({ x: 3 * p + 1.5, r: 0, covers: [3 + 2 * p, 4 + 2 * p] });
  for (let j = 0; j < 6; j++) {
    const p = Math.floor(j / 2),
      k = j % 2;
    out.push({ x: 3 * p + k + 1, r: 1, covers: [9 + 3 * p + k, 10 + 3 * p + k] });
  }
  for (let i = 0; i < 9; i++) out.push({ x: i + 0.5, r: 2, covers: [19 + i, 20 + i] });
  for (let i = 0; i < 10; i++) out.push({ x: i, r: 3, covers: null });
  return out;
})();

/** The first spot of each row, to name a card's place within its row. */
const ROW_START = [0, 3, 9, 18];

interface SavedState {
  tableau: number[]; // card per spot
  removed: boolean[];
  stock: number[];
  waste: number[]; // top = last
  done: boolean;
  won: boolean;
}

function deal(seed: string, diff: Diff): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`tripeaks-${seed}`));
  return {
    tableau: deck.slice(0, 28),
    removed: Array(28).fill(false),
    stock: deck.slice(28, 28 + STOCK[diff]),
    waste: [deck[51]],
    done: false,
    won: false
  };
}

const exposed = (removed: boolean[], i: number): boolean => {
  const covers = SPOTS[i].covers;
  return !removed[i] && (covers === null || (removed[covers[0]] && removed[covers[1]]));
};

const playable = (a: number, b: number, wrap: boolean): boolean => {
  const d = Math.abs(rank(a) - rank(b));
  return d === 1 || (wrap && d === 12);
};

export default function TriPeaks({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>(
    (s, d) => deal(s, d)
  );
  const wrap = WRAP[diff];

  const wasteTop = saved.waste[saved.waste.length - 1];
  const left = useMemo(() => saved.removed.filter((r) => !r).length, [saved.removed]);

  /** Mark `next` finished if the peaks are clear or dead, returning the
   *  outcome for the commit that ends the game. */
  function judge(next: SavedState): "won" | "lost" | undefined {
    const remaining = next.removed.filter((r) => !r).length;
    if (remaining === 0) {
      next.done = true;
      next.won = true;
      return "won";
    }
    const top = next.waste[next.waste.length - 1];
    const anyPlay = next.tableau.some(
      (card, i) => exposed(next.removed, i) && playable(card, top, wrap)
    );
    if (!anyPlay && next.stock.length === 0) {
      next.done = true;
      return "lost";
    }
  }

  function tapCard(i: number) {
    if (saved.done || !exposed(saved.removed, i)) return;
    if (!playable(saved.tableau[i], wasteTop, wrap)) return;
    const removed = saved.removed.slice();
    removed[i] = true;
    const next: SavedState = {
      ...saved,
      removed,
      waste: [...saved.waste, saved.tableau[i]]
    };
    commit(next, { outcome: judge(next) });
  }

  function tapStock() {
    if (saved.done || !saved.stock.length) return;
    const stock = saved.stock.slice();
    const card = stock.pop()!;
    const next: SavedState = { ...saved, stock, waste: [...saved.waste, card] };
    commit(next, { outcome: judge(next) });
  }

  return (
    <div className="game game-tripeaks">
      <GameHeader title="TriPeaks" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Take cards one rank up or down from the waste
        {wrap ? " — A and K wrap" : ""}; clear all three peaks.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="tp-board" role="group" aria-label="TriPeaks board">
        {saved.tableau.map((card, i) => {
          if (saved.removed[i]) return null;
          const open = exposed(saved.removed, i);
          const hot = open && playable(card, wasteTop, wrap);
          return (
            <PlayingCard
              key={card}
              card={card}
              faceDown={!open}
              className={hot ? "tp-card tp-hot" : "tp-card"}
              style={{ "--x": SPOTS[i].x, "--r": SPOTS[i].r } as CSSProperties}
              onClick={() => tapCard(i)}
              place={`Row ${SPOTS[i].r + 1}, card ${i - ROW_START[SPOTS[i].r] + 1}`}
            />
          );
        })}
      </div>

      <div className="kl-top tp-bottom" style={{ "--cols": 8 } as CSSProperties}>
        <PlayingCard
          card={null}
          faceDown
          onClick={tapStock}
          aria-label={
            saved.stock.length ? `Stock, ${nCards(saved.stock.length)}` : "Stock, empty"
          }
        >
          {saved.stock.length || "—"}
        </PlayingCard>
        <PlayingCard card={wasteTop} place="Waste" tabIndex={-1} />
        <span className="kl-gap" />
        <span className="tp-left">{left} cards left</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? "All three peaks cleared!"
              : `Out of moves — ${left} cards remained`
          }
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
