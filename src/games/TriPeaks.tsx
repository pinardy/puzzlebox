import { useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
const isRed = (id: number) => id % 4 === 1 || id % 4 === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[id % 4]}`;
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
    const p = Math.floor(j / 2), k = j % 2;
    out.push({ x: 3 * p + k + 1, r: 1, covers: [9 + 3 * p + k, 10 + 3 * p + k] });
  }
  for (let i = 0; i < 9; i++)
    out.push({ x: i + 0.5, r: 2, covers: [19 + i, 20 + i] });
  for (let i = 0; i < 10; i++) out.push({ x: i, r: 3, covers: null });
  return out;
})();

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
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("tripeaks", (s, d) => deal(s, d));
  const wrap = WRAP[diff];

  const wasteTop = saved.waste[saved.waste.length - 1];
  const left = useMemo(
    () => saved.removed.filter((r) => !r).length,
    [saved.removed]
  );

  function judge(next: SavedState) {
    const remaining = next.removed.filter((r) => !r).length;
    if (remaining === 0) {
      next.done = true;
      next.won = true;
      recordResult("tripeaks", true);
      return;
    }
    const top = next.waste[next.waste.length - 1];
    const anyPlay = next.tableau.some(
      (card, i) => exposed(next.removed, i) && playable(card, top, wrap)
    );
    if (!anyPlay && next.stock.length === 0) {
      next.done = true;
      recordResult("tripeaks", false);
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
    judge(next);
    commit(next);
  }

  function tapStock() {
    if (saved.done || !saved.stock.length) return;
    const stock = saved.stock.slice();
    const card = stock.pop()!;
    const next: SavedState = { ...saved, stock, waste: [...saved.waste, card] };
    judge(next);
    commit(next);
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
            <button
              key={card}
              className={[
                "kl-card tp-card",
                open ? "" : "kl-back",
                open && isRed(card) ? "red" : "",
                hot ? "tp-hot" : ""
              ].join(" ")}
              style={{ "--x": SPOTS[i].x, "--r": SPOTS[i].r } as CSSProperties}
              onClick={() => tapCard(i)}
            >
              {open ? label(card) : ""}
            </button>
          );
        })}
      </div>

      <div className="kl-top tp-bottom" style={{ "--cols": 8 } as CSSProperties}>
        <button className="kl-card kl-back" onClick={tapStock} aria-label="Stock">
          {saved.stock.length || "—"}
        </button>
        <button
          className={`kl-card${isRed(wasteTop) ? " red" : ""}`}
          aria-label="Waste"
          tabIndex={-1}
        >
          {label(wasteTop)}
        </button>
        <span className="kl-gap" />
        <span className="tp-left">{left} cards left</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="tripeaks"
          won={saved.won}
          message={
            saved.won
              ? "All three peaks cleared!"
              : `Out of moves — ${left} cards remained`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
