import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const rank = (id: number) => Math.floor(id / 4) + 1;
const suit = (id: number) => id % 4;
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const label = (id: number) => `${RANKS[rank(id) - 1]}${SUITS[suit(id)]}`;
const HELP =
  "Fifty-two piles in a row, squeezing together like an accordion. A pile " +
  "may jump onto the pile immediately to its left, or the one three to " +
  "its left, if the two top cards share a suit or a rank. Squeeze the row " +
  "down to a single pile to win — getting under about five is already good " +
  "going.";

interface SavedState {
  piles: number[][]; // each pile holds its buried cards, top last
  moves: number;
  done: boolean;
  won: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`accordion-${seed}`));
  return { piles: deck.map((c) => [c]), moves: 0, done: false, won: false };
}

const top = (p: number[]) => p[p.length - 1];
const matches = (a: number[], b: number[]) =>
  suit(top(a)) === suit(top(b)) || rank(top(a)) === rank(top(b));

export default function Accordion({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("accordion", (s) => deal(s));
  const [sel, setSel] = useState<number | null>(null);

  /** A pile can move left one or left three, onto a matching top card. */
  const targetsOf = (i: number): number[] =>
    [i - 1, i - 3].filter(
      (j) => j >= 0 && matches(saved.piles[i], saved.piles[j])
    );

  const anyMove = useMemo(
    () => saved.piles.some((_, i) => targetsOf(i).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved.piles]
  );

  const targets = sel === null ? [] : targetsOf(sel);

  function move(from: number, to: number) {
    const piles = saved.piles.map((p) => p.slice());
    const moving = piles[from];
    piles[to] = [...piles[to], ...moving];
    piles.splice(from, 1);
    const next: SavedState = {
      piles,
      moves: saved.moves + 1,
      done: false,
      won: false
    };
    if (piles.length === 1) {
      next.done = true;
      next.won = true;
      recordResult("accordion", true);
    } else if (!piles.some((_, i) =>
      [i - 1, i - 3].some((j) => j >= 0 && matches(piles[i], piles[j]))
    )) {
      next.done = true;
      recordResult("accordion", false);
    }
    commit(next);
    setSel(null);
  }

  function tap(i: number) {
    if (saved.done) return;
    if (sel === null) {
      if (targetsOf(i).length) setSel(i);
      return;
    }
    if (i === sel) {
      setSel(null);
      return;
    }
    if (targets.includes(i)) {
      move(sel, i);
      return;
    }
    setSel(targetsOf(i).length ? i : null);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  return (
    <div className="game game-accordion">
      <GameHeader title="Accordion" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Move a pile one or three places left onto a matching suit or rank.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="lights-meta">
        <span>
          {saved.piles.length} pile{saved.piles.length === 1 ? "" : "s"} · moves{" "}
          {saved.moves}
        </span>
        {!saved.done && !anyMove && <span className="ac-stuck">No moves left</span>}
      </div>

      <div className="ac-row" role="group" aria-label="Accordion">
        {saved.piles.map((pile, i) => {
          const card = top(pile);
          return (
            <button
              key={`${i}-${card}`}
              className={[
                "kl-card ac-card",
                isRed(card) ? "red" : "",
                sel === i ? "selected" : "",
                targets.includes(i) ? "ac-target" : "",
                sel === null && targetsOf(i).length ? "ac-live" : ""
              ].join(" ")}
              style={{ "--cols": 9 } as CSSProperties}
              onClick={() => tap(i)}
            >
              {label(card)}
              {pile.length > 1 && <small className="ac-depth">{pile.length}</small>}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="accordion"
          won={saved.won}
          message={
            saved.won
              ? `Squeezed to one pile in ${saved.moves} moves!`
              : `Stuck at ${saved.piles.length} piles`
          }
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
