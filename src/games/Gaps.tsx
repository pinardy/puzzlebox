import { useMemo, useState } from "react";
import {
  applyMove,
  cardsHome,
  COLS,
  deal,
  fillers,
  GOAL,
  isWon,
  legalMoves,
  rank,
  redeal,
  ROWS,
  runLength,
  suit,
  type Board
} from "../lib/gaps";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SUITS = ["♠", "♥", "♦", "♣"];
const NAMES = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const isRed = (id: number) => suit(id) === 1 || suit(id) === 2;
const name = (id: number) => `${RANKS[rank(id) - 1]} of ${NAMES[suit(id)]}`;
const REDEALS = 2;
const HELP =
  "The pack is dealt into four rows of thirteen and the four aces are " +
  "removed, leaving four gaps. A gap may be filled by the card one rank " +
  "higher in the same suit as the card on its left; a gap in the leftmost " +
  "column takes any 2, and a gap to the right of a king is dead. Sort every " +
  "row into a single suit running 2 to king. When you run dry you may " +
  "redeal twice: the finished runs stay put and everything else is shuffled " +
  "back into the places that are left.";

interface SavedState {
  board: Board; // 52 slots, row-major; null is a gap
  redeals: number;
  moves: number;
  done: boolean;
  won: boolean;
}

type Sel = { kind: "card"; card: number } | { kind: "gap"; at: number } | null;

export default function Gaps({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle }= useGame<SavedState>((s) => ({ board: deal(s), redeals: 0, moves: 0, done: false, won: false })
  );
  const [sel, setSel] = useState<Sel>(null);

  const moves = useMemo(() => legalMoves(saved.board), [saved.board]);
  const movable = useMemo(() => new Set(moves.map((m) => m.card)), [moves]);
  const runs = [0, 1, 2, 3].map((r) => runLength(saved.board, r));
  const home = cardsHome(saved.board);
  const spare = REDEALS - saved.redeals;

  // Almost every card has exactly one destination, so a tap is enough; the
  // ambiguous cases (a 2 with two leftmost gaps, or the reverse) select
  // first and let the second tap choose.
  const pickGaps =
    sel?.kind === "card"
      ? moves.filter((m) => m.card === sel.card).map((m) => m.gap)
      : [];
  const pickCards =
    sel?.kind === "gap" ? moves.filter((m) => m.gap === sel.at).map((m) => m.card) : [];

  function judge(next: SavedState) {
    if (isWon(next.board)) {
      next.done = true;
      next.won = true;
      recordResult("gaps", true);
      return;
    }
    if (next.redeals >= REDEALS && !legalMoves(next.board).length) {
      next.done = true;
      recordResult("gaps", false);
    }
  }

  function play(card: number, gap: number) {
    const next: SavedState = {
      board: applyMove(saved.board, { card, gap }),
      redeals: saved.redeals,
      moves: saved.moves + 1,
      done: false,
      won: false
    };
    judge(next);
    commit(next);
    setSel(null);
  }

  function doRedeal() {
    if (saved.done || spare <= 0) return;
    const next: SavedState = {
      board: redeal(saved.board, `gaps-${seed}-${saved.redeals}-${saved.moves}`),
      redeals: saved.redeals + 1,
      moves: saved.moves,
      done: false,
      won: false
    };
    judge(next);
    commit(next);
    setSel(null);
  }

  function tap(i: number) {
    if (saved.done) return;
    const card = saved.board[i];
    if (card === null) {
      if (sel?.kind === "card" && pickGaps.includes(i)) return play(sel.card, i);
      if (sel?.kind === "gap" && sel.at === i) return setSel(null);
      const cands = fillers(saved.board, i);
      if (cands.length === 1) return play(cands[0], i);
      setSel(cands.length ? { kind: "gap", at: i } : null);
      return;
    }
    if (sel?.kind === "gap" && pickCards.includes(card)) return play(card, sel.at);
    if (sel?.kind === "card" && sel.card === card) return setSel(null);
    const dests = moves.filter((m) => m.card === card).map((m) => m.gap);
    if (dests.length === 1) return play(card, dests[0]);
    setSel(dests.length ? { kind: "card", card } : null);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  return (
    <div className="game game-gaps">
      <GameHeader title="Gaps" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Tap a ringed card to slide it into its gap, or tap a gap to pull its card in.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="lights-meta">
        <span>
          {home}/{GOAL} home
        </span>
        {!saved.done && !moves.length && <span className="gp-stuck">No moves left</span>}
        <button className="mini-btn" onClick={doRedeal} disabled={saved.done || !spare}>
          Redeal · {spare} left
        </button>
      </div>

      <div className="gp-wrap">
        <div className="gp-board" role="grid" aria-label="Gaps board">
          {Array.from({ length: ROWS }, (_, r) => (
            <div className="gp-row" role="row" key={r}>
              {Array.from({ length: COLS }, (_, c) => {
                const i = r * COLS + c;
                const card = saved.board[i];
                const where = `Row ${r + 1} column ${c + 1}`;
                if (card === null) {
                  const want = fillers(saved.board, i);
                  const picked = sel?.kind === "card" && pickGaps.includes(i);
                  return (
                    <button
                      key={c}
                      role="gridcell"
                      className={[
                        "kl-card kl-empty gp-cell",
                        want.length ? "gp-target" : "",
                        picked || (sel?.kind === "gap" && sel.at === i) ? "selected" : ""
                      ].join(" ")}
                      aria-label={
                        want.length === 1
                          ? `${where}, gap for the ${name(want[0])}`
                          : want.length
                            ? `${where}, gap for any 2`
                            : `${where}, dead gap`
                      }
                      onClick={() => tap(i)}
                    >
                      {want.length === 1 ? (
                        <>
                          <span className="gp-r gp-ghost">
                            {RANKS[rank(want[0]) - 1]}
                          </span>
                          <span className="gp-s gp-ghost">{SUITS[suit(want[0])]}</span>
                        </>
                      ) : (
                        want.length > 0 && <span className="gp-r gp-ghost">2</span>
                      )}
                    </button>
                  );
                }
                const live = movable.has(card);
                const settled = c < runs[r];
                return (
                  <button
                    key={c}
                    role="gridcell"
                    className={[
                      "kl-card gp-cell",
                      isRed(card) ? "red" : "",
                      live ? "gp-live" : "",
                      settled ? "gp-home" : "",
                      (sel?.kind === "card" && sel.card === card) ||
                      (sel?.kind === "gap" && pickCards.includes(card))
                        ? "selected"
                        : ""
                    ].join(" ")}
                    aria-label={`${where}, ${name(card)}${
                      settled ? ", home" : live ? ", can move" : ""
                    }`}
                    onClick={() => tap(i)}
                  >
                    <span className="gp-r">{RANKS[rank(card) - 1]}</span>
                    <span className="gp-s">{SUITS[suit(card)]}</span>
                    {live && (
                      <small className="gp-mark" aria-hidden="true">
                        ▸
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? `Four clean suits in ${saved.moves} moves!`
              : `Out of moves with ${home} of ${GOAL} home`
          }
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
