import { useMemo, useState, type CSSProperties } from "react";
import {
  applyMove,
  canHome,
  cardsHome,
  dealPiles,
  exposed,
  fitsPile,
  isWon,
  legalMoves,
  redeal,
  sendHome,
  type PileRules,
  type PileState
} from "../lib/piles";
import { RANKS, isRed, label, rank, spoken, stackPlace, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Foundation, PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";
import "./PileGame.css";

// Beyond this depth a fan would run off a narrow phone, so deeper cards
// pile up at the same offset — only the exposed end must stay readable.
const FAN_MAX = 15;

/** Shared board for the solitaires where only a pile's exposed card moves.
 *  Streets & Alleys, Fortress, La Belle Lucie and Trefoil are this
 *  component plus a `PileRules` config. */
export function PileGame({
  title,
  hint,
  help,
  rules,
  grid,
  wonMessage,
  onExit
}: {
  title: string;
  hint: string;
  help: string;
  rules: PileRules;
  /** Many short fans read better as a grid than as one row each. */
  grid?: boolean;
  wonMessage: (moves: number) => string;
  onExit: () => void;
}) {
  const { seed, saved, commit, undo, canUndo, newPuzzle } = useGame<PileState>((s) =>
    dealPiles(s, rules)
  );
  const [sel, setSel] = useState<number | null>(null);

  const moves = useMemo(() => legalMoves(saved, rules), [saved, rules]);
  const selCard = sel === null ? null : exposed(saved.piles[sel]);
  const home = cardsHome(saved);

  /** Piles the held card may land on, for the destination highlight. */
  const targets = useMemo(() => {
    if (selCard === null || sel === null) return new Set<number>();
    const out = new Set<number>();
    for (let q = 0; q < saved.piles.length; q++)
      if (q !== sel && fitsPile(selCard, saved.piles[q], rules)) out.add(q);
    return out;
  }, [sel, selCard, saved.piles, rules]);

  const homeSuit = selCard !== null && canHome(saved, selCard) ? suit(selCard) : null;

  /** Piles whose end card has somewhere to go, hinted while nothing is held. */
  const live = useMemo(() => new Set(moves.map((m) => m.from)), [moves]);

  function play(next: PileState) {
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
      const next = applyMove(saved, { from: sel, to: p }, rules);
      if (next) play(next);
      else setSel(null);
      return;
    }
    setSel(saved.piles[p].length ? p : null);
  }

  function tapFoundation(s: number) {
    if (saved.done || sel === null || homeSuit !== s) return;
    const next = applyMove(saved, { from: sel, to: "home" }, rules);
    if (next) play(next);
    else setSel(null);
  }

  function sendUp() {
    const next = sendHome(saved, rules);
    if (next) play(next);
  }

  function reshuffle() {
    const next = redeal(saved, seed, rules);
    if (next) play(next);
  }

  function startNew() {
    newPuzzle();
    setSel(null);
  }

  const canSend = moves.some((m) => m.to === "home");
  const stuck = !saved.done && !moves.length;

  return (
    <div className={`game game-piles${grid ? " game-fans" : ""}`}>
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

      <div className="bc-founds" role="group" aria-label="Foundations">
        {saved.foundations.map((f, s) => (
          <Foundation
            key={s}
            suit={s}
            top={f}
            // Unlike the other games, an empty foundation here keeps its
            // suit's colour.
            className={[
              f === 0 && (s === 1 || s === 2) ? "red" : "",
              homeSuit === s ? "bc-target" : ""
            ].join(" ")}
            onClick={() => tapFoundation(s)}
          />
        ))}
      </div>

      <div
        className={grid ? "fan-tableau" : "bc-tableau"}
        role="group"
        aria-label="Tableau"
      >
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
                aria-label={`Pile ${p + 1}, empty`}
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
                      place={stackPlace(`Pile ${p + 1}`, i, pile.length)}
                    />
                  );
                // Buried cards show rank only where suit does not matter;
                // in-suit games need the pip, so they keep the full label.
                return (
                  <span
                    key={card}
                    className={`kl-card bc-card bc-buried${isRed(card) ? " red" : ""}`}
                    style={stack}
                    role="img"
                    aria-label={`${stackPlace(`Pile ${p + 1}`, i, pile.length)}, ${spoken(card)}`}
                  >
                    {rules.fit === "downAny" ? RANKS[rank(card) - 1] : label(card)}
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
          {(rules.redeals ?? 0) > 0 && <> · {saved.redeals} shuffles left</>}
        </span>
        {stuck && saved.redeals === 0 && <span className="bc-stuck">No moves left</span>}
        {!saved.done && saved.redeals > 0 && (
          <button className="mini-btn" onClick={reshuffle}>
            Shuffle ⟳
          </button>
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
          message={wonMessage(saved.moves)}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
