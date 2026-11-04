import { useMemo, useState, type CSSProperties } from "react";
import {
  applyMove,
  canHome,
  cardsHome,
  dealCastle,
  exposed,
  fitsPile,
  isWon,
  legalMoves,
  sendHome,
  type CastleState
} from "../lib/castle";
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
// Beyond this depth the fan would run off a narrow phone, so deeper cards
// pile up at the same offset — only the exposed end has to stay readable.
const FAN_MAX = 15;
const HELP =
  "The four aces start as foundations and the rest of the pack is dealt " +
  "into eight fans of six. Only the exposed card at the right-hand end of " +
  "a fan may be moved: onto another fan's end card if it is exactly one " +
  "rank lower — suit and colour do not matter — or onto its own suit's " +
  "foundation as the next rank up. An empty fan takes any single card. " +
  "Build all four foundations from ace to king.";

type SavedState = CastleState;

export default function BeleagueredCastle({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s) => dealCastle(s));
  const [sel, setSel] = useState<number | null>(null);

  const moves = useMemo(() => legalMoves(saved), [saved]);
  const selCard = sel === null ? null : exposed(saved.piles[sel]);
  const home = cardsHome(saved);

  /** Piles the selected card may land on, for the destination highlight. */
  const targets = useMemo(() => {
    if (selCard === null || sel === null) return new Set<number>();
    const out = new Set<number>();
    for (let q = 0; q < saved.piles.length; q++)
      if (q !== sel && fitsPile(selCard, saved.piles[q])) out.add(q);
    return out;
  }, [sel, selCard, saved.piles]);

  const homeSuit =
    selCard !== null && canHome(saved, selCard) ? suit(selCard) : null;

  /** Fans whose end card has somewhere to go, hinted while nothing is held. */
  const live = useMemo(() => new Set(moves.map((m) => m.from)), [moves]);

  function finish(next: SavedState) {
    if (!next.done && isWon(next)) {
      next.done = true;
      next.won = true;
      recordResult("castle", true);
    }
    commit(next);
    setSel(null);
  }

  function tapPile(p: number) {
    if (saved.done) return;
    if (sel === p) {
      setSel(null);
      return;
    }
    if (sel !== null && targets.has(p)) {
      const next = applyMove(saved, { from: sel, to: p });
      if (next) finish(next);
      else setSel(null);
      return;
    }
    setSel(saved.piles[p].length ? p : null);
  }

  function tapFoundation(s: number) {
    if (saved.done || sel === null || homeSuit !== s) return;
    const next = applyMove(saved, { from: sel, to: "home" });
    if (next) finish(next);
    else setSel(null);
  }

  /** One tap for the long tail of forced moves at the end of a game. */
  function sendUp() {
    const next = sendHome(saved);
    if (next) finish(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const canSend = moves.some((m) => m.to === "home");

  return (
    <div className="game game-castle">
      <GameHeader title="Beleaguered Castle" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Tap the end card of a fan, then a green target. Build down by rank.
      </p>
      <GameTools
        help={HELP}
        onUndo={() => {
          undo();
          setSel(null);
        }}
        canUndo={canUndo && !saved.done}
      />

      <div className="bc-founds" role="group" aria-label="Foundations">
        {saved.foundations.map((f, s) => (
          <button
            key={s}
            className={[
              "kl-card kl-found",
              s === 1 || s === 2 ? "red" : "",
              homeSuit === s ? "bc-target" : ""
            ].join(" ")}
            onClick={() => tapFoundation(s)}
            aria-label={`${SUITS[s]} foundation, up to ${RANKS[f - 1]}`}
          >
            {`${RANKS[f - 1]}${SUITS[s]}`}
          </button>
        ))}
      </div>

      <div className="bc-tableau" role="group" aria-label="Eight fans">
        {saved.piles.map((pile, p) => (
          <div
            key={p}
            className={`bc-pile${targets.has(p) ? " bc-drop" : ""}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) tapPile(p);
            }}
          >
            {pile.length === 0 ? (
              <button
                className={`kl-card bc-card kl-empty${
                  targets.has(p) ? " bc-target" : ""
                }`}
                style={{ "--stack": 0 } as CSSProperties}
                onClick={() => tapPile(p)}
                aria-label={`Fan ${p + 1}, empty`}
              >
                ·
              </button>
            ) : (
              pile.map((card, i) => {
                const open = i === pile.length - 1;
                const cls = [
                  "kl-card bc-card",
                  isRed(card) ? "red" : "",
                  open ? "bc-open" : "bc-buried",
                  open && sel === p ? "selected" : "",
                  open && targets.has(p) ? "bc-target" : "",
                  open && sel === null && live.has(p) ? "bc-live" : ""
                ].join(" ");
                // Buried cards show rank only: tableau building ignores suit,
                // so the rank is all the sliver of a covered card must carry.
                return open ? (
                  <button
                    key={card}
                    className={cls}
                    style={{ "--stack": Math.min(i, FAN_MAX) } as CSSProperties}
                    onClick={() => tapPile(p)}
                    aria-label={`${label(card)}, end of fan ${p + 1}`}
                  >
                    {label(card)}
                  </button>
                ) : (
                  <span
                    key={card}
                    className={cls}
                    style={{ "--stack": Math.min(i, FAN_MAX) } as CSSProperties}
                  >
                    {RANKS[rank(card) - 1]}
                  </span>
                );
              })
            )}
          </div>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          {home}/52 home · moves {saved.moves}
        </span>
        {!saved.done && !moves.length && (
          <span className="bc-stuck">No moves left</span>
        )}
        {!saved.done && canSend && (
          <button className="mini-btn" onClick={sendUp}>
            Send home ↑
          </button>
        )}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={`Castle taken in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
