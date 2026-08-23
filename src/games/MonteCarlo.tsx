import { useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { isRed, label, rank } from "../lib/cards";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE = 5;
const CELLS = SIZE * SIZE;
const HELP =
  "Twenty-five cards are laid out in a square. Tap two cards of the SAME " +
  "RANK that touch — sideways, up and down, or diagonally — to discard the " +
  "pair. After every discard the remaining cards close up towards the " +
  "top-left and the gaps are refilled from the deck, which is what brings " +
  "new neighbours into reach. Discard all fifty-two to win.";

interface SavedState {
  grid: (number | null)[];
  stock: number[];
  removed: number;
  done: boolean;
  won: boolean;
}

/** Cards slide up-left into reading order, then the deck tops the square
 *  back up — the shuffle-free way this game keeps producing new pairs. */
function consolidate(grid: (number | null)[], stock: number[]): void {
  const left = grid.filter((c): c is number => c !== null);
  for (let i = 0; i < CELLS; i++) {
    if (i < left.length) grid[i] = left[i];
    else grid[i] = stock.length ? stock.shift()! : null;
  }
}

function deal(seed: string): SavedState {
  const stock = shuffled([...Array(52).keys()], makeRng(`montecarlo-${seed}`));
  const grid: (number | null)[] = Array(CELLS).fill(null);
  consolidate(grid, stock);
  return { grid, stock, removed: 0, done: false, won: false };
}

const adjacent = (a: number, b: number) => {
  const dr = Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE));
  const dc = Math.abs((a % SIZE) - (b % SIZE));
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
};

/** Any touching same-rank pair left on the board? */
function hasPair(grid: (number | null)[]): boolean {
  for (let i = 0; i < CELLS; i++) {
    const a = grid[i];
    if (a === null) continue;
    for (let j = i + 1; j < CELLS; j++) {
      const b = grid[j];
      if (b !== null && adjacent(i, j) && rank(a) === rank(b)) return true;
    }
  }
  return false;
}

export default function MonteCarlo({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } = useGame<SavedState>(
    "montecarlo",
    (s) => deal(s)
  );
  const [sel, setSel] = useState<number | null>(null);

  /** Cells the held card can pair with, for the target highlight. */
  const targets = useMemo(() => {
    const out = new Set<number>();
    if (sel === null) return out;
    const a = saved.grid[sel];
    if (a === null) return out;
    for (let j = 0; j < CELLS; j++) {
      const b = saved.grid[j];
      if (b !== null && j !== sel && adjacent(sel, j) && rank(a) === rank(b)) out.add(j);
    }
    return out;
  }, [sel, saved.grid]);

  function tap(i: number) {
    if (saved.done || saved.grid[i] === null) return;
    if (sel === i) {
      setSel(null);
      return;
    }
    if (sel !== null && targets.has(i)) {
      const next: SavedState = { ...saved, grid: saved.grid.slice(), stock: saved.stock.slice() };
      next.grid[sel] = null;
      next.grid[i] = null;
      next.removed += 2;
      consolidate(next.grid, next.stock);
      const left = next.grid.some((c) => c !== null);
      if (!left && !next.stock.length) {
        next.done = true;
        next.won = true;
        recordResult("montecarlo", true);
      } else if (!hasPair(next.grid)) {
        next.done = true;
        next.won = false;
        recordResult("montecarlo", false);
      }
      commit(next);
      setSel(null);
      return;
    }
    setSel(i);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  return (
    <div className="game game-montecarlo">
      <GameHeader title="Monte Carlo" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Tap two touching cards of the same rank — any direction, diagonals too.
      </p>
      <GameTools
        help={HELP}
        onUndo={() => {
          undo();
          setSel(null);
        }}
        canUndo={canUndo && !saved.done}
      />

      <div className="mc-grid" role="grid" aria-label="Monte Carlo layout">
        {saved.grid.map((card, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "kl-card mc-cell",
              card === null ? "kl-empty" : "",
              card !== null && isRed(card) ? "red" : "",
              sel === i ? "selected" : "",
              targets.has(i) ? "bc-target" : ""
            ].join(" ")}
            onClick={() => tap(i)}
            aria-label={card === null ? "Empty" : label(card)}
          >
            {card === null ? "" : label(card)}
          </button>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          {saved.removed}/52 discarded · deck {saved.stock.length}
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="montecarlo"
          won={saved.won}
          message={
            saved.won
              ? "Every pair found — cleared!"
              : `No touching pairs left — ${saved.removed} of 52 discarded.`
          }
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
