import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { isRed, label, rank, suit } from "../lib/cards";
import { recordResult, type GameId } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

/** Single-pack Spider: seven columns, four suits, four runs to clear.
 *  Spiderette and Will o' the Wisp differ only in the opening deal. */
export interface SpiderRules {
  seedTag: string;
  /** Column sizes for the opening deal; the rest becomes the stock. */
  cols: number[];
  /** Every card face-up from the start (Will o' the Wisp's easier face). */
  allUp?: boolean;
}

interface SavedState {
  cols: number[][];
  faceDown: number[];
  stock: number[];
  completed: number;
  moves: number;
  done: boolean;
}

const PILES = 7;

function deal(seed: string, rules: SpiderRules): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`${rules.seedTag}-${seed}`));
  const cols: number[][] = [];
  let at = 0;
  for (const size of rules.cols) {
    cols.push(deck.slice(at, at + size));
    at += size;
  }
  return {
    cols,
    faceDown: cols.map((c) => (rules.allUp ? 0 : Math.max(0, c.length - 1))),
    stock: deck.slice(at),
    completed: 0,
    moves: 0,
    done: false
  };
}

/** Lift any finished same-suit K→A run off the end of a column. */
function clearRuns(next: SavedState): void {
  for (let p = 0; p < PILES; p++) {
    const pile = next.cols[p];
    if (pile.length < 13) continue;
    const tail = pile.slice(-13);
    const isRun = tail.every((c, i) => rank(c) === 13 - i && suit(c) === suit(tail[0]));
    if (isRun && pile.length - 13 >= next.faceDown[p]) {
      pile.splice(-13);
      next.completed++;
      if (pile.length > 0 && pile.length === next.faceDown[p]) next.faceDown[p]--;
    }
  }
}

type Sel = { pile: number; index: number } | null;

export function SpiderGame({
  game,
  title,
  hint,
  help,
  rules,
  wonMessage,
  onExit
}: {
  game: GameId;
  title: string;
  hint: string;
  help: string;
  rules: SpiderRules;
  wonMessage: (moves: number) => string;
  onExit: () => void;
}) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } = useGame<SavedState>(
    game,
    (s) => deal(s, rules)
  );
  const [sel, setSel] = useState<Sel>(null);

  const selCards = useMemo(
    (): number[] => (sel ? saved.cols[sel.pile].slice(sel.index) : []),
    [sel, saved]
  );

  /** Only a same-suit descending run travels as one unit. */
  function validRun(cards: number[]): boolean {
    for (let i = 0; i + 1 < cards.length; i++)
      if (rank(cards[i]) !== rank(cards[i + 1]) + 1 || suit(cards[i]) !== suit(cards[i + 1]))
        return false;
    return true;
  }

  function clone(): SavedState {
    return {
      ...saved,
      cols: saved.cols.map((p) => p.slice()),
      faceDown: saved.faceDown.slice(),
      stock: saved.stock.slice()
    };
  }

  function finish(next: SavedState) {
    next.moves++;
    clearRuns(next);
    if (!next.done && next.completed === 4) {
      next.done = true;
      recordResult(game, true);
    }
    commit(next);
    setSel(null);
  }

  function tapPile(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.cols[pile];

    if (sel) {
      const run = selCards;
      if (!run.length) {
        setSel(null);
        return;
      }
      if (sel.pile === pile) {
        setSel(null);
        return;
      }
      const top = cards.length ? cards[cards.length - 1] : null;
      // Stacking ignores suit; an empty column takes any run.
      const fits = top === null || rank(run[0]) === rank(top) - 1;
      if (!fits) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = next.cols[sel.pile].splice(sel.index);
      next.cols[pile].push(...moved);
      const src = next.cols[sel.pile];
      if (src.length > 0 && src.length === next.faceDown[sel.pile])
        next.faceDown[sel.pile]--;
      finish(next);
      return;
    }

    if (index === null) return;
    if (index < saved.faceDown[pile]) return; // still face-down
    const run = cards.slice(index);
    if (validRun(run)) setSel({ pile, index });
  }

  /** One card onto every column — the stock's only use. */
  function dealRow() {
    if (saved.done || !saved.stock.length) return;
    const next = clone();
    for (let p = 0; p < PILES && next.stock.length; p++)
      next.cols[p].push(next.stock.shift()!);
    finish(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel?.pile === pile && index >= sel.index;

  return (
    <div className="game game-spider" style={{ "--cols": PILES } as CSSProperties}>
      <GameHeader title={title} onExit={onExit} onNew={startNew} />
      <p className="game-hint">{hint}</p>
      <GameTools
        help={help}
        onUndo={() => {
          undo();
          setSel(null);
        }}
        canUndo={canUndo && !saved.done}
      />

      <div className="kl-tableau">
        {saved.cols.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapPile(p, null);
            }}
          >
            {pile.length === 0 && (
              <button
                className="kl-card kl-empty kl-stacked"
                style={{ "--stack": 0 } as CSSProperties}
                onClick={() => tapPile(p, null)}
                aria-label={`Column ${p + 1}, empty`}
              >
                ·
              </button>
            )}
            {pile.map((card, i) => {
              const down = i < saved.faceDown[p];
              return (
                <button
                  key={card}
                  className={[
                    "kl-card kl-stacked",
                    down ? "kl-back" : "",
                    !down && isRed(card) ? "red" : "",
                    isSelected(p, i) ? "selected" : ""
                  ].join(" ")}
                  style={{ "--stack": i } as CSSProperties}
                  onClick={() => tapPile(p, i)}
                  aria-label={down ? "Face-down card" : label(card)}
                >
                  {down ? "" : label(card)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          {saved.completed}/4 runs · moves {saved.moves}
        </span>
        <button
          className="mini-btn"
          onClick={dealRow}
          disabled={!saved.stock.length}
        >
          Deal ({saved.stock.length})
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game={game}
          won
          message={wonMessage(saved.moves)}
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
