import { makeRng, shuffled } from "../lib/rng";
import { RANKS, isRed, label, rank } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";

// Foundation k counts up in steps of k+1, wrapping past the king: the ace
// pile is A,2,3…K, the two pile is 2,4,6…, and so on. Suit never matters.
const BASES = [0, 5, 10, 15]; // A♠, 2♥, 3♦, 4♣
const STEP_LABEL = ["+1", "+2", "+3", "+4"];

const HELP =
  "An ace, a two, a three and a four start the four foundations, and each " +
  "one counts up by its own step, wrapping past the king back round to the " +
  "ace: the ace pile wants 2,3,4…, the two pile wants 4,6,8…, the three " +
  "pile 6,9,Q… Suit never matters. Turn a card and either play it to a " +
  "foundation or park it on any one of the four waste heaps — but only a " +
  "heap's top card can be played later, so where you park is the whole " +
  "game. Get all forty-eight home.";

interface SavedState {
  /** Cards played per foundation, base included. */
  founds: number[];
  wastes: number[][];
  stock: number[];
  moves: number;
  done: boolean;
  won: boolean;
}

/** The rank foundation `k` wants next, given how many cards it holds. */
const wants = (k: number, count: number) => (((k + 1) * (count + 1) - 1) % 13) + 1;

function deal(seed: string): SavedState {
  const rest = shuffled(
    [...Array(52).keys()].filter((c) => !BASES.includes(c)),
    makeRng(`calculation-${seed}`)
  );
  return {
    founds: [1, 1, 1, 1],
    wastes: [[], [], [], []],
    stock: rest,
    moves: 0,
    done: false,
    won: false
  };
}

export default function Calculation({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle }= useGame<SavedState>((s) => deal(s)
  );

  const current = saved.stock.length ? saved.stock[saved.stock.length - 1] : null;

  function clone(): SavedState {
    return {
      ...saved,
      founds: saved.founds.slice(),
      wastes: saved.wastes.map((w) => w.slice()),
      stock: saved.stock.slice()
    };
  }

  function play(next: SavedState) {
    next.moves++;
    if (!next.done && next.founds.every((f) => f === 13)) {
      next.done = true;
      next.won = true;
      return commit(next, { outcome: "won" });
    } else if (!next.done && !next.stock.length) {
      // Out of deck: only playable waste tops can still move.
      const canMove = next.wastes.some((w) => {
        const top = w.length ? w[w.length - 1] : null;
        return top !== null && next.founds.some((f, k) => f < 13 && wants(k, f) === rank(top));
      });
      if (!canMove) {
        next.done = true;
        next.won = false;
        return commit(next, { outcome: "lost" });
      }
    }
    commit(next);
  }

  /** Play the turned card, or a waste heap's top card, to foundation k. */
  function toFoundation(k: number, from: "stock" | number) {
    if (saved.done || saved.founds[k] === 13) return;
    const card =
      from === "stock"
        ? current
        : saved.wastes[from].length
          ? saved.wastes[from][saved.wastes[from].length - 1]
          : null;
    if (card === null || wants(k, saved.founds[k]) !== rank(card)) return;
    const next = clone();
    if (from === "stock") next.stock.pop();
    else next.wastes[from].pop();
    next.founds[k]++;
    play(next);
  }

  /** Park the turned card on a waste heap. */
  function toWaste(w: number) {
    if (saved.done || current === null) return;
    const next = clone();
    next.stock.pop();
    next.wastes[w].push(current);
    play(next);
  }

  function startNew() {
    newPuzzle();
  }

  const home = saved.founds.reduce((a, f) => a + f, 0) - 4;

  return (
    <div className="game game-calculation">
      <GameHeader title="Calculation" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Tap a foundation to play the turned card, or a heap to park it.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="ca-founds" role="group" aria-label="Foundations">
        {saved.founds.map((f, k) => {
          const need = f === 13 ? null : wants(k, f);
          const fits = current !== null && need !== null && rank(current) === need;
          return (
            <button
              key={k}
              className={`kl-card ca-found${fits ? " bc-target" : ""}${
                f === 13 ? " cl-done" : ""
              }`}
              onClick={() => toFoundation(k, "stock")}
              aria-label={`Foundation ${STEP_LABEL[k]}, ${f} of 13${
                need ? `, wants ${RANKS[need - 1]}` : ", complete"
              }`}
            >
              <span className="ca-step">{STEP_LABEL[k]}</span>
              <span className="ca-need">{need === null ? "✓" : RANKS[need - 1]}</span>
              <span className="ca-count">{f}/13</span>
            </button>
          );
        })}
      </div>

      <div className="ca-deck">
        <span className="ca-deck-label">Turned</span>
        <span
          className={`kl-card${current === null ? " kl-empty" : ""}${
            current !== null && isRed(current) ? " red" : ""
          }`}
        >
          {current === null ? "·" : label(current)}
        </span>
        <span className="os-deck-note">deck {saved.stock.length}</span>
      </div>

      <div className="ca-wastes" role="group" aria-label="Waste heaps">
        {saved.wastes.map((w, i) => {
          const top = w.length ? w[w.length - 1] : null;
          const playable =
            top !== null &&
            saved.founds.some((f, k) => f < 13 && wants(k, f) === rank(top));
          return (
            <div key={i} className="ca-heap">
              <PlayingCard
                card={top}
                className={playable ? "bc-live" : undefined}
                onClick={() => {
                  if (current !== null) {
                    toWaste(i);
                    return;
                  }
                  // Deck spent: tapping a heap plays its top card home.
                  if (top === null) return;
                  const k = saved.founds.findIndex(
                    (f, j) => f < 13 && wants(j, f) === rank(top)
                  );
                  if (k >= 0) toFoundation(k, i);
                }}
                aria-label={
                  top === null
                    ? `Heap ${i + 1}, empty`
                    : `Heap ${i + 1}, ${label(top)}, ${w.length} cards`
                }
              >
                {top === null ? "·" : undefined}
              </PlayingCard>
              <span className="ca-heap-n">{w.length || ""}</span>
            </div>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>
          {home}/48 home · moves {saved.moves}
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? `All forty-eight calculated in ${saved.moves} moves!`
              : `Stuck with ${home} of 48 home.`
          }
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
