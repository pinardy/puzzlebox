import { useMemo } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { isRed, label, rank, spoken, suit } from "../lib/cards";
import { useGridNav } from "../lib/gridnav";
import type { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";
import "./PokerSolitaire.css";

const SIZE = 5;
const CELLS = SIZE * SIZE;
/** English scoring — kinder to flushes than the American table. */
const TARGET: Record<Diff, number> = { easy: 60, medium: 75, hard: 90 };
const HELP =
  "Twenty-five cards are turned one at a time, and each one must be placed " +
  "somewhere in the square — there is no discarding. When the grid is full " +
  "the ten lines (five rows, five columns) each score as a poker hand: " +
  "straight flush 30, straight 12, four of a kind 16, full house 10, three " +
  "of a kind 6, flush 5, two pair 3, one pair 1. Beat the target to win.";

interface SavedState {
  grid: (number | null)[];
  /** Cards still to come, last one turned first. */
  queue: number[];
  done: boolean;
  won: boolean;
  score: number;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`poker-${seed}`));
  return {
    grid: Array(CELLS).fill(null),
    queue: deck.slice(0, CELLS).reverse(),
    done: false,
    won: false,
    score: 0
  };
}

/** Score one five-card line on the English table. */
function scoreHand(cards: number[]): number {
  if (cards.length !== 5) return 0;
  const ranks = cards.map(rank).sort((a, b) => a - b);
  const flush = cards.every((c) => suit(c) === suit(cards[0]));
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const distinct = [...counts.keys()].sort((a, b) => a - b);
  // Ace counts high or low, so both A-2-3-4-5 and 10-J-Q-K-A are straights.
  const run =
    distinct.length === 5 &&
    (distinct[4] - distinct[0] === 4 ||
      (distinct[0] === 1 && distinct[1] === 10 && distinct[4] === 13));

  if (run && flush) return 30;
  if (groups[0] === 4) return 16;
  if (groups[0] === 3 && groups[1] === 2) return 10;
  if (run) return 12;
  if (flush) return 5;
  if (groups[0] === 3) return 6;
  if (groups[0] === 2 && groups[1] === 2) return 3;
  if (groups[0] === 2) return 1;
  return 0;
}

const rowOf = (i: number) => [0, 1, 2, 3, 4].map((c) => i * SIZE + c);
const colOf = (i: number) => [0, 1, 2, 3, 4].map((r) => r * SIZE + i);

export default function PokerSolitaire({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>(
    (s) => deal(s)
  );

  const current = saved.queue.length ? saved.queue[saved.queue.length - 1] : null;
  const nav = useGridNav();

  /** Per-line scores, shown live so the board teaches the hand values. */
  const lines = useMemo(() => {
    const read = (idx: number[]) =>
      idx.map((i) => saved.grid[i]).filter((c): c is number => c !== null);
    const rows = [0, 1, 2, 3, 4].map((r) => {
      const cards = read(rowOf(r));
      return { full: cards.length === 5, score: scoreHand(cards) };
    });
    const cols = [0, 1, 2, 3, 4].map((c) => {
      const cards = read(colOf(c));
      return { full: cards.length === 5, score: scoreHand(cards) };
    });
    return { rows, cols, total: [...rows, ...cols].reduce((a, l) => a + l.score, 0) };
  }, [saved.grid]);

  function place(i: number) {
    if (saved.done || current === null || saved.grid[i] !== null) return;
    const next: SavedState = {
      ...saved,
      grid: saved.grid.slice(),
      queue: saved.queue.slice()
    };
    next.grid[i] = next.queue.pop()!;
    if (!next.queue.length) {
      const read = (idx: number[]) => idx.map((j) => next.grid[j]!) as number[];
      next.score =
        [0, 1, 2, 3, 4].reduce((a, r) => a + scoreHand(read(rowOf(r))), 0) +
        [0, 1, 2, 3, 4].reduce((a, c) => a + scoreHand(read(colOf(c))), 0);
      next.done = true;
      next.won = next.score >= TARGET[diff];
    }
    commit(next, { outcome: next.done ? (next.won ? "won" : "lost") : undefined });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
  }

  return (
    <div className="game game-poker">
      <GameHeader title="Poker Solitaire" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Place every card — target {TARGET[diff]} points from ten poker lines.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="pk-wrap">
        <div className="pk-grid" role="grid" aria-label="Poker square" {...nav}>
          {saved.grid.map((card, i) => (
            <PlayingCard
              key={i}
              data-cell={i}
              card={card}
              role="gridcell"
              className={
                card === null && current !== null ? "pk-cell pk-open" : "pk-cell"
              }
              onClick={() => place(i)}
              place={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`}
            />
          ))}
        </div>
        <div className="pk-cols" role="group" aria-label="Column scores">
          {lines.cols.map((l, i) => (
            <span
              key={i}
              className={`pk-score${l.full ? " pk-full" : ""}`}
              role="img"
              aria-label={`Column ${i + 1}, ${l.score} points${l.full ? "" : " so far"}`}
            >
              {l.score || "·"}
            </span>
          ))}
        </div>
        <div className="pk-rows" role="group" aria-label="Row scores">
          {lines.rows.map((l, i) => (
            <span
              key={i}
              className={`pk-score${l.full ? " pk-full" : ""}`}
              role="img"
              aria-label={`Row ${i + 1}, ${l.score} points${l.full ? "" : " so far"}`}
            >
              {l.score || "·"}
            </span>
          ))}
        </div>
      </div>

      <div className="pk-deal" aria-live="polite">
        <span className="ca-deck-label" aria-hidden="true">
          Place
        </span>
        <span
          key={current ?? "none"}
          role="img"
          aria-label={
            current === null ? "No card to place" : `Card to place, ${spoken(current)}`
          }
          className={`kl-card${current === null ? " kl-empty" : ""}${
            current !== null && isRed(current) ? " red" : ""
          }`}
        >
          {current === null ? "·" : label(current)}
        </span>
        <span className="os-deck-note">{saved.queue.length} to come</span>
      </div>

      <div className="lights-meta">
        <span>
          Score {lines.total} · target {TARGET[diff]}
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? `${saved.score} points — target beaten!`
              : `${saved.score} points — ${TARGET[diff]} needed.`
          }
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
