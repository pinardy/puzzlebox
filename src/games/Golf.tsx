import { useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
const isRed = (id: number) => id % 4 === 1 || id % 4 === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[id % 4]}`;
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
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("golf", (s) => deal(s));

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

  function judge(next: SavedState) {
    if (next.columns.every((col) => col.length === 0)) {
      next.done = true;
      next.won = true;
      recordResult("golf", true);
      return;
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
      recordResult("golf", false);
    }
  }

  function tapColumn(c: number) {
    if (saved.done || !saved.columns[c].length) return;
    const card = saved.columns[c][saved.columns[c].length - 1];
    if (!playable(card)) return;
    const columns = saved.columns.map((col) => col.slice());
    columns[c].pop();
    const next: SavedState = { ...saved, columns, waste: [...saved.waste, card] };
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
                <button
                  key={card}
                  className={[
                    "kl-card golf-card",
                    isRed(card) ? "red" : "",
                    hot ? "tp-hot" : ""
                  ].join(" ")}
                  style={{ "--stack": i } as CSSProperties}
                  onClick={() => tapColumn(c)}
                  disabled={!isBottom}
                >
                  {label(card)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="kl-top tp-bottom" style={{ "--cols": 8 } as CSSProperties}>
        <button
          className={`kl-card ${saved.stock.length ? "kl-back" : "kl-empty"}`}
          onClick={tapStock}
          aria-label="Stock"
        >
          {saved.stock.length || "—"}
        </button>
        <button className={`kl-card${isRed(wasteTop) ? " red" : ""}`} tabIndex={-1}>
          {label(wasteTop)}
        </button>
        <span className="kl-gap" />
        <span className="tp-left">{left} cards left</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="golf"
          won={saved.won}
          message={saved.won ? "Course cleared!" : `Stuck — ${left} cards remained`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
