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
import { RANKS, isRed, rank, spoken, stackPlace, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";
import "./BeleagueredCastle.css";

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

  function play(next: SavedState) {
    if (!next.done && isWon(next)) {
      next.done = true;
      next.won = true;
      commit(next, { outcome: "won" });
    } else commit(next);
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
      if (next) play(next);
      else setSel(null);
      return;
    }
    setSel(saved.piles[p].length ? p : null);
  }

  function tapFoundation(s: number) {
    if (saved.done || sel === null || homeSuit !== s) return;
    const next = applyMove(saved, { from: sel, to: "home" });
    if (next) play(next);
    else setSel(null);
  }

  /** One tap for the long tail of forced moves at the end of a game. */
  function sendUp() {
    const next = sendHome(saved);
    if (next) play(next);
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
          <Foundation
            key={s}
            suit={s}
            top={f}
            className={homeSuit === s ? "bc-target" : undefined}
            onClick={() => tapFoundation(s)}
          />
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
              <PlayingCard
                card={null}
                className={targets.has(p) ? "bc-card bc-target" : "bc-card"}
                style={{ "--stack": 0 } as CSSProperties}
                onClick={() => tapPile(p)}
                aria-label={`Fan ${p + 1}, empty`}
              >
                ·
              </PlayingCard>
            ) : (
              pile.map((card, i) => {
                const stack = { "--stack": Math.min(i, FAN_MAX) } as CSSProperties;
                if (i === pile.length - 1)
                  return (
                    <PlayingCard
                      key={card}
                      card={card}
                      selected={sel === p}
                      className={[
                        "bc-card bc-open",
                        targets.has(p) ? "bc-target" : "",
                        sel === null && live.has(p) ? "bc-live" : ""
                      ].join(" ")}
                      style={stack}
                      onClick={() => tapPile(p)}
                      place={stackPlace(`Fan ${p + 1}`, i, pile.length)}
                    />
                  );
                // Buried cards show rank only: tableau building ignores suit,
                // so the rank is all the sliver of a covered card must carry.
                return (
                  <span
                    key={card}
                    className={`kl-card bc-card bc-buried${isRed(card) ? " red" : ""}`}
                    style={stack}
                    role="img"
                    aria-label={`${stackPlace(`Fan ${p + 1}`, i, pile.length)}, ${spoken(card)}`}
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
