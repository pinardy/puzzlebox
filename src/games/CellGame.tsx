import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import {
  RANKS,
  SUITS,
  isRed,
  label,
  rank,
  rankName,
  stepsAbove,
  suit
} from "../lib/cards";
import { recordResult, type GameId } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

/** The FreeCell relatives: everything face-up, a few reserve cells, and a
 *  tableau that builds down IN SUIT rather than by alternating colour.
 *  Eight Off, Seahaven Towers and Penguin are this component plus a config. */
export interface CellRules {
  seedTag: string;
  /** Column sizes, in deal order. */
  cols: number[];
  cells: number;
  /** Cells dealt face-up at the start (the leftovers of an uneven pack). */
  cellsFilled: number;
  /** What an emptied column will accept. */
  empty: "king" | "base-1" | "any";
  /** Penguin: the first card dealt sets the foundation rank, and its three
   *  siblings start home. */
  beak?: boolean;
}

interface SavedState {
  cols: number[][];
  cells: (number | null)[];
  /** Cards home per suit, counted up from `base` with a king → ace wrap. */
  foundations: number[];
  base: number;
  moves: number;
  done: boolean;
}

function deal(seed: string, rules: CellRules): SavedState {
  let deck = shuffled([...Array(52).keys()], makeRng(`${rules.seedTag}-${seed}`));
  const foundations = [0, 0, 0, 0];
  let base = 1;

  if (rules.beak) {
    base = rank(deck[0]);
    // The beak's three siblings go straight home; the beak itself stays at
    // the head of the tableau for you to release.
    const siblings = deck.filter((c, i) => i > 0 && rank(c) === base);
    for (const c of siblings) foundations[suit(c)] = 1;
    deck = deck.filter((c) => !siblings.includes(c));
  }

  const cols: number[][] = [];
  let at = 0;
  for (const size of rules.cols) {
    cols.push(deck.slice(at, at + size));
    at += size;
  }
  const cells: (number | null)[] = Array(rules.cells).fill(null);
  for (let i = 0; i < rules.cellsFilled; i++) cells[i] = deck[at++];

  return { cols, cells, foundations, base, moves: 0, done: false };
}

type Sel =
  | { from: "col"; pile: number; index: number }
  | { from: "cell"; slot: number }
  | null;

export function CellGame({
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
  rules: CellRules;
  wonMessage: (moves: number) => string;
  onExit: () => void;
}) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } = useGame<SavedState>(
    game,
    (s) => deal(s, rules)
  );
  const [sel, setSel] = useState<Sel>(null);

  const selCards = useMemo((): number[] => {
    if (!sel) return [];
    if (sel.from === "cell") {
      const c = saved.cells[sel.slot];
      return c === null ? [] : [c];
    }
    return saved.cols[sel.pile].slice(sel.index);
  }, [sel, saved]);

  /** Home when the suit's pile has reached exactly this card's step. */
  const canHome = (card: number) =>
    saved.foundations[suit(card)] === stepsAbove(rank(card), saved.base);

  /** A grabbable run descends in suit. */
  function validRun(cards: number[]): boolean {
    for (let i = 0; i + 1 < cards.length; i++)
      if (rank(cards[i]) !== rank(cards[i + 1]) + 1 || suit(cards[i]) !== suit(cards[i + 1]))
        return false;
    return true;
  }

  function acceptsEmpty(card: number): boolean {
    if (rules.empty === "any") return true;
    if (rules.empty === "king") return rank(card) === 13;
    return rank(card) === ((saved.base + 11) % 13) + 1; // base − 1, wrapping
  }

  function moveCapacity(targetEmpty: boolean): number {
    const free = saved.cells.filter((c) => c === null).length;
    const emptyCols = saved.cols.filter((p) => p.length === 0).length;
    const usable = targetEmpty ? Math.max(0, emptyCols - 1) : emptyCols;
    return (free + 1) * 2 ** usable;
  }

  function clone(): SavedState {
    return {
      ...saved,
      cols: saved.cols.map((p) => p.slice()),
      cells: saved.cells.slice(),
      foundations: saved.foundations.slice()
    };
  }

  function finish(next: SavedState) {
    next.moves++;
    if (!next.done && next.foundations.every((f) => f === 13)) {
      next.done = true;
      recordResult(game, true);
    }
    commit(next);
    setSel(null);
  }

  function takeSelection(next: SavedState): number[] {
    if (!sel) return [];
    if (sel.from === "cell") {
      const c = next.cells[sel.slot]!;
      next.cells[sel.slot] = null;
      return [c];
    }
    return next.cols[sel.pile].splice(sel.index);
  }

  function tryFoundation() {
    if (selCards.length !== 1 || !canHome(selCards[0])) {
      setSel(null);
      return;
    }
    const next = clone();
    const [card] = takeSelection(next);
    next.foundations[suit(card)]++;
    finish(next);
  }

  function tapCol(pile: number, index: number | null) {
    if (saved.done) return;
    const cards = saved.cols[pile];

    if (sel) {
      const run = selCards;
      if (!run.length) {
        setSel(null);
        return;
      }
      if (sel.from === "col" && sel.pile === pile) {
        setSel(null);
        if (run.length === 1) tryFoundation();
        return;
      }
      const top = cards.length ? cards[cards.length - 1] : null;
      const fits =
        top === null
          ? acceptsEmpty(run[0])
          : rank(run[0]) === rank(top) - 1 && suit(run[0]) === suit(top);
      if (!fits || run.length > moveCapacity(top === null)) {
        setSel(null);
        return;
      }
      const next = clone();
      const moved = takeSelection(next);
      next.cols[pile].push(...moved);
      finish(next);
      return;
    }

    if (index === null) return;
    const run = cards.slice(index);
    if (validRun(run)) setSel({ from: "col", pile, index });
  }

  function tapCell(slot: number) {
    if (saved.done) return;
    const inSlot = saved.cells[slot];
    if (sel) {
      if (sel.from === "cell" && sel.slot === slot) {
        setSel(null);
        tryFoundation();
        return;
      }
      if (inSlot === null && selCards.length === 1) {
        const next = clone();
        const [card] = takeSelection(next);
        next.cells[slot] = card;
        finish(next);
        return;
      }
      setSel(null);
      return;
    }
    if (inSlot !== null) setSel({ from: "cell", slot });
  }

  /** Send every card that currently fits a foundation, repeatedly. */
  function sendUp() {
    const next = clone();
    const home = (c: number) =>
      next.foundations[suit(c)] === stepsAbove(rank(c), next.base);
    let moved = true;
    let count = 0;
    while (moved) {
      moved = false;
      for (let s = 0; s < next.cells.length; s++) {
        const c = next.cells[s];
        if (c !== null && home(c)) {
          next.cells[s] = null;
          next.foundations[suit(c)]++;
          moved = true;
          count++;
        }
      }
      for (const pile of next.cols) {
        if (!pile.length) continue;
        const top = pile[pile.length - 1];
        if (home(top)) {
          pile.pop();
          next.foundations[suit(top)]++;
          moved = true;
          count++;
        }
      }
    }
    if (count > 0) finish(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const isSelected = (pile: number, index: number) =>
    sel?.from === "col" && sel.pile === pile && index >= sel.index;

  /** The top card of a suit's foundation, for its label. */
  const foundationLabel = (s: number, count: number) =>
    count === 0 ? SUITS[s] : `${rankName(((saved.base - 1 + count - 1) % 13) + 1)}${SUITS[s]}`;

  return (
    <div
      className="game game-cells"
      style={{ "--cols": Math.max(rules.cols.length, rules.cells + 4) } as CSSProperties}
    >
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

      <div className="kl-top">
        {saved.cells.map((c, s) => (
          <button
            key={s}
            className={`kl-card${c === null ? " kl-empty" : ""}${
              sel?.from === "cell" && sel.slot === s ? " selected" : ""
            }${c !== null && isRed(c) ? " red" : ""}`}
            onClick={() => tapCell(s)}
            aria-label={c === null ? `Cell ${s + 1}, empty` : `Cell ${s + 1}, ${label(c)}`}
          >
            {c === null ? "·" : label(c)}
          </button>
        ))}
        {saved.foundations.map((f, s) => (
          <button
            key={s}
            className={`kl-card kl-found${f === 0 ? " kl-empty" : ""}${
              f > 0 && (s === 1 || s === 2) ? " red" : ""
            }`}
            onClick={tryFoundation}
            aria-label={`${SUITS[s]} foundation`}
          >
            {foundationLabel(s, f)}
          </button>
        ))}
      </div>

      <div className="kl-tableau">
        {saved.cols.map((pile, p) => (
          <div
            key={p}
            className="kl-pile"
            onClick={(e) => {
              if (e.target === e.currentTarget) tapCol(p, null);
            }}
          >
            {pile.map((card, i) => (
              <button
                key={card}
                className={[
                  "kl-card kl-stacked",
                  isRed(card) ? "red" : "",
                  isSelected(p, i) ? "selected" : ""
                ].join(" ")}
                style={{ "--stack": i } as CSSProperties}
                onClick={() => tapCol(p, i)}
              >
                {label(card)}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          Moves: {saved.moves}
          {rules.beak && <> · foundations from {RANKS[saved.base - 1]}</>}
        </span>
        <button className="mini-btn" onClick={sendUp}>
          Send up ↑
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
