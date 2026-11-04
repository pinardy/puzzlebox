import { makeRng, shuffled } from "../lib/rng";
import { SUITS, isRed, label, rank, suit } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

const HELP =
  "Four reserve piles of four, and four foundation rows — one per suit. " +
  "The top row takes its suit's cards in ANY order. Every row below it is " +
  "stricter: a card may only join a row once a card of that same rank is " +
  "already showing in the row above. A row's suit is set by its first " +
  "card, and rows must be started from the top down. Play from a reserve " +
  "pile's top card or the turned deck card; the deck can be turned over " +
  "twice more when it runs out.";

interface SavedState {
  reserve: number[][];
  /** Four foundation rows, top row first; a row's suit is its first card's. */
  rows: number[][];
  stock: number[];
  waste: number[];
  redeals: number;
  moves: number;
  done: boolean;
  won: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`osmosis-${seed}`));
  const reserve: number[][] = [];
  for (let p = 0; p < 4; p++) reserve.push(deck.slice(p * 4, p * 4 + 4));
  const starter = deck[16];
  return {
    reserve,
    rows: [[starter], [], [], []],
    stock: deck.slice(17),
    waste: [],
    redeals: 2,
    moves: 0,
    done: false,
    won: false
  };
}

const rowSuit = (row: number[]): number | null =>
  row.length ? suit(row[0]) : null;

export default function Osmosis({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle }= useGame<SavedState>((s) => deal(s)
  );

  const wasteTop = saved.waste.length ? saved.waste[saved.waste.length - 1] : null;

  /** The rule that gives the game its name: cards seep down a row at a
   *  time, and only where the row above has already shown that rank. */
  function canPlay(card: number, r: number): boolean {
    const row = saved.rows[r];
    const mine = rowSuit(row);
    if (mine !== null && mine !== suit(card)) return false;
    if (mine === null) {
      // Starting a fresh row: the row above must exist, and this suit must
      // not already belong to another row.
      if (r === 0 || saved.rows[r - 1].length === 0) return false;
      if (saved.rows.some((o) => rowSuit(o) === suit(card))) return false;
    }
    if (row.includes(card)) return false;
    if (r === 0) return true;
    return saved.rows[r - 1].some((c) => rank(c) === rank(card));
  }

  function clone(): SavedState {
    return {
      ...saved,
      reserve: saved.reserve.map((p) => p.slice()),
      rows: saved.rows.map((p) => p.slice()),
      stock: saved.stock.slice(),
      waste: saved.waste.slice()
    };
  }

  function commitMove(next: SavedState) {
    next.moves++;
    if (!next.done && next.rows.every((r) => r.length === 13)) {
      next.done = true;
      next.won = true;
      commit(next, { outcome: "won" });
    } else commit(next);
  }

  /** Play a specific card from wherever it is showing. */
  function play(card: number, source: "waste" | number) {
    if (saved.done) return;
    const target = [0, 1, 2, 3].find((r) => canPlay(card, r));
    if (target === undefined) return;
    const next = clone();
    if (source === "waste") next.waste.pop();
    else next.reserve[source].pop();
    next.rows[target].push(card);
    commitMove(next);
  }

  /** Turn one card; when the deck is out, gather the waste and go again. */
  function tapStock() {
    if (saved.done) return;
    const next = clone();
    if (next.stock.length) {
      next.waste.push(next.stock.pop()!);
    } else if (next.redeals > 0 && next.waste.length) {
      next.stock = next.waste.reverse();
      next.waste = [];
      next.redeals--;
    } else {
      return;
    }
    commitMove(next);
  }

  function startNew() {
    newPuzzle();
  }

  const home = saved.rows.reduce((n, r) => n + r.length, 0);
  const playableWaste = wasteTop !== null && [0, 1, 2, 3].some((r) => canPlay(wasteTop, r));
  const stuck =
    !saved.done &&
    !playableWaste &&
    !saved.stock.length &&
    (saved.redeals === 0 || !saved.waste.length) &&
    !saved.reserve.some((p) => {
      const top = p.length ? p[p.length - 1] : null;
      return top !== null && [0, 1, 2, 3].some((r) => canPlay(top, r));
    });

  return (
    <div className="game game-osmosis">
      <GameHeader title="Osmosis" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Tap a playable card — it seeps into the first row that will take it.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="os-rows" role="group" aria-label="Foundation rows">
        {saved.rows.map((row, r) => (
          <div key={r} className="os-row">
            <span className="os-row-suit">
              {rowSuit(row) === null ? "—" : SUITS[rowSuit(row)!]}
            </span>
            <div className="os-row-cards">
              {row.length === 0 ? (
                <span className="kl-card kl-empty os-card">·</span>
              ) : (
                row.map((c) => (
                  <span
                    key={c}
                    className={`kl-card os-card${isRed(c) ? " red" : ""}`}
                  >
                    {label(c)}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="os-reserve" role="group" aria-label="Reserve piles">
        {saved.reserve.map((pile, p) => {
          const top = pile.length ? pile[pile.length - 1] : null;
          const live = top !== null && [0, 1, 2, 3].some((r) => canPlay(top, r));
          return (
            <PlayingCard
              key={p}
              card={top}
              className={live ? "bc-live" : undefined}
              onClick={() => top !== null && play(top, p)}
              aria-label={
                top === null
                  ? `Reserve ${p + 1}, empty`
                  : `Reserve ${p + 1}, ${label(top)}, ${pile.length} cards`
              }
            >
              {top === null ? "·" : undefined}
            </PlayingCard>
          );
        })}
      </div>

      <div className="os-deck">
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label={`Deck, ${saved.stock.length} left, ${saved.redeals} redeals`}
        >
          {saved.stock.length ? "" : saved.redeals > 0 ? "⟳" : "·"}
        </PlayingCard>
        <PlayingCard
          card={wasteTop}
          className={playableWaste ? "bc-live" : undefined}
          onClick={() => wasteTop !== null && play(wasteTop, "waste")}
          aria-label={wasteTop === null ? "Waste, empty" : `Waste, ${label(wasteTop)}`}
        >
          {wasteTop === null ? "·" : undefined}
        </PlayingCard>
        <span className="os-deck-note">
          deck {saved.stock.length} · {saved.redeals} redeals
        </span>
      </div>

      <div className="lights-meta">
        <span>
          {home}/52 home · moves {saved.moves}
        </span>
        {stuck && <span className="bc-stuck">No moves left</span>}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={`Osmosis complete in ${saved.moves} moves!`}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
