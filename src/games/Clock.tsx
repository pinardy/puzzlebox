import { makeRng, shuffled } from "../lib/rng";
import { RANKS, isRed, label, rank } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "The old fortune-telling patience, also called Travellers. Fifty-two " +
  "cards are dealt face-down into thirteen piles laid out as a clock face, " +
  "with the kings' pile in the middle. Turn the middle pile's top card, " +
  "lay it on the hour that matches its rank, then turn the top card of THAT " +
  "pile, and keep going. You win only if every pile is complete when the " +
  "last card turns — there are no decisions to make, which is the joke: " +
  "the deal has already decided.";

/** Clock positions: ace at one o'clock round to queen at twelve, kings in
 *  the middle. Index 0–11 are the hours, 12 is the centre. */
const POS = (r: number) => (r === 13 ? 12 : r - 1);

interface SavedState {
  down: number[][];
  up: number[][];
  /** The card in hand, waiting to be laid down. */
  hand: number | null;
  placed: number;
  done: boolean;
  won: boolean;
}

function deal(seed: string): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`clock-${seed}`));
  const down: number[][] = [];
  for (let p = 0; p < 13; p++) down.push(deck.slice(p * 4, p * 4 + 4));
  // The centre pile starts the chain.
  const hand = down[12].pop()!;
  return {
    down,
    up: Array.from({ length: 13 }, () => []),
    hand,
    placed: 0,
    done: false,
    won: false
  };
}

export default function Clock({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle }= useGame<SavedState>((s) => deal(s)
  );

  /** Lay the held card on its hour, then pick up that pile's next card. */
  function turn() {
    if (saved.done || saved.hand === null) return;
    const next: SavedState = {
      ...saved,
      down: saved.down.map((p) => p.slice()),
      up: saved.up.map((p) => p.slice())
    };
    const card = next.hand!;
    const at = POS(rank(card));
    next.up[at].push(card);
    next.placed++;
    next.hand = next.down[at].length ? next.down[at].pop()! : null;
    if (next.hand === null) {
      next.done = true;
      next.won = next.placed === 52;
    }
    commit(next, { outcome: next.done ? (next.won ? "won" : "lost") : undefined });
  }

  function startNew() {
    newPuzzle();
  }

  const hand = saved.hand;
  // Hours first, then the centre, so the ring reads clockwise from one.
  const ring = [...Array(12).keys()];

  return (
    <div className="game game-clock">
      <GameHeader title="Clock" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Turn a card, it goes to its hour — no choices, only fate.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="cl-face" role="group" aria-label="Clock face">
        {ring.map((h) => {
          const pile = saved.up[h];
          const top = pile.length ? pile[pile.length - 1] : null;
          const complete = pile.length === 4;
          return (
            <div
              key={h}
              className={`cl-slot cl-h${h}`}
              aria-label={`${RANKS[h]} pile, ${pile.length} of 4`}
            >
              <span className="cl-hour">{RANKS[h]}</span>
              <span
                className={[
                  "kl-card cl-card",
                  top === null ? "kl-empty" : "",
                  top !== null && isRed(top) ? "red" : "",
                  complete ? "cl-done" : ""
                ].join(" ")}
              >
                {top === null ? `${saved.down[h].length}` : label(top)}
              </span>
            </div>
          );
        })}
        <div className="cl-slot cl-centre" aria-label="Kings pile">
          <span className="cl-hour">K</span>
          <span
            className={[
              "kl-card cl-card",
              saved.up[12].length === 0 ? "kl-empty" : "",
              saved.up[12].length === 4 ? "cl-done" : ""
            ].join(" ")}
          >
            {saved.up[12].length
              ? label(saved.up[12][saved.up[12].length - 1])
              : `${saved.down[12].length}`}
          </span>
        </div>
      </div>

      <div className="cl-hand">
        <span className="cl-hand-label">In hand</span>
        <span
          className={`kl-card${hand === null ? " kl-empty" : ""}${
            hand !== null && isRed(hand) ? " red" : ""
          }`}
        >
          {hand === null ? "·" : label(hand)}
        </span>
        {!saved.done && (
          <button className="mini-btn" onClick={turn}>
            Turn →
          </button>
        )}
      </div>

      <div className="lights-meta">
        <span>{saved.placed}/52 laid down</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? "All thirteen hours complete!"
              : `Stuck at ${saved.placed} of 52 — the deal decided.`
          }
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
