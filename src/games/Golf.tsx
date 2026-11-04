import { useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { rank } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";
import "./Golf.css";

const HELP =
  "Clear the seven columns onto the waste pile: only the bottom card of a " +
  "column can go, and it must be one rank above or below the waste card — " +
  "suits don't matter. Flip the deck when stuck. On Easy, ace and king " +
  "wrap around; on Hard nothing may be played onto a king.";

interface SavedState {
  columns: number[][]; // bottom of column = last
  stock: number[]; // top = last
  waste: number[]; // top = last
  done: boolean;
  won: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`golf-${seed}`));
  return {
    columns: Array.from({ length: 7 }, (_, c) => deck.slice(c * 5, c * 5 + 5)),
    stock: deck.slice(35, 51),
    waste: [deck[51]],
    done: false,
    won: false
  };
}

export default function Golf({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s) => deal(s));

  const wasteTop = saved.waste[saved.waste.length - 1];

  const playable = (card: number): boolean => {
    const a = rank(card), b = rank(wasteTop);
    if (diff === "hard" && b === 13) return false; // kings are dead ends
    const d = Math.abs(a - b);
    return d === 1 || (diff === "easy" && d === 12); // easy wraps A–K
  };

  const left = useMemo(
    () => saved.columns.reduce((a, col) => a + col.length, 0),
    [saved.columns]
  );

  /** Mark `next` finished if the course is clear or dead, returning the
   *  outcome for the commit that ends the game. */
  function judge(next: SavedState): "won" | "lost" | undefined {
    if (next.columns.every((col) => col.length === 0)) {
      next.done = true;
      next.won = true;
      return "won";
    }
    if (next.stock.length > 0) return;
    const top = rank(next.waste[next.waste.length - 1]);
    const anyPlay = next.columns.some((col) => {
      if (!col.length) return false;
      if (diff === "hard" && top === 13) return false;
      const d = Math.abs(rank(col[col.length - 1]) - top);
      return d === 1 || (diff === "easy" && d === 12);
    });
    if (!anyPlay) {
      next.done = true;
      return "lost";
    }
  }

  function tapColumn(c: number) {
    if (saved.done || !saved.columns[c].length) return;
    const card = saved.columns[c][saved.columns[c].length - 1];
    if (!playable(card)) return;
    const columns = saved.columns.map((col) => col.slice());
    columns[c].pop();
    const next: SavedState = { ...saved, columns, waste: [...saved.waste, card] };
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
    <div className="game game-golf">
      <GameHeader title="Golf" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Play bottom cards one rank up or down from the waste; clear the course.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="golf-board" role="group" aria-label="Golf columns">
        {saved.columns.map((col, c) => (
          <div key={c} className="golf-col">
            {col.map((card, i) => {
              const isBottom = i === col.length - 1;
              const hot = isBottom && !saved.done && playable(card);
              return (
                <PlayingCard
                  key={card}
                  card={card}
                  className={hot ? "golf-card tp-hot" : "golf-card"}
                  style={{ "--stack": i } as CSSProperties}
                  onClick={() => tapColumn(c)}
                  disabled={!isBottom}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="kl-top tp-bottom" style={{ "--cols": 8 } as CSSProperties}>
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label="Stock"
        >
          {saved.stock.length || "—"}
        </PlayingCard>
        <PlayingCard card={wasteTop} tabIndex={-1} />
        <span className="kl-gap" />
        <span className="tp-left">{left} cards left</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={saved.won ? "Course cleared!" : `Stuck — ${left} cards remained`}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
