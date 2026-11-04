import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import type { Diff } from "../lib/storage";
import { nCards, rank } from "../lib/cards";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { PlayingCard } from "./cards";
import { GameTools, Result } from "./ui";
import "./Pyramid.css";

const HELP =
  "Clear the pyramid by removing pairs that add to 13 — J is 11, Q is 12, " +
  "and a K is 13 by itself. Only uncovered pyramid cards and the waste " +
  "card can be used. Flip the deck when stuck; when it runs dry you can " +
  "redeal it (Easy twice, Medium once, Hard never).";

const REDEALS: Record<Diff, number> = { easy: 2, medium: 1, hard: 0 };

/** The 28 pyramid spots: row r has r+1 cards; each is covered by the two
 *  below it. Spot index = r*(r+1)/2 + i. */
const ROW_OF: number[] = [];
const COL_OF: number[] = [];
for (let r = 0; r < 7; r++)
  for (let i = 0; i <= r; i++) {
    ROW_OF.push(r);
    COL_OF.push(i);
  }
const coverOf = (s: number): [number, number] | null => {
  const r = ROW_OF[s],
    i = COL_OF[s];
  if (r === 6) return null;
  const base = ((r + 1) * (r + 2)) / 2;
  return [base + i, base + i + 1];
};

interface SavedState {
  pyramid: number[]; // card per spot
  removed: boolean[];
  stock: number[]; // top = last
  waste: number[]; // top = last
  redeals: number;
  done: boolean;
  won: boolean;
}

function deal(seed: string, diff: Diff): SavedState {
  const deck = shuffled([...Array(52).keys()], makeRng(`pyramid-${seed}`));
  return {
    pyramid: deck.slice(0, 28),
    removed: Array(28).fill(false),
    stock: deck.slice(28),
    waste: [],
    redeals: REDEALS[diff],
    done: false,
    won: false
  };
}

const exposed = (removed: boolean[], s: number): boolean => {
  if (removed[s]) return false;
  const cov = coverOf(s);
  return cov === null || (removed[cov[0]] && removed[cov[1]]);
};

export default function Pyramid({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>(
    (s, d) => deal(s, d)
  );
  const [selected, setSelected] = useState<"waste" | number | null>(null);

  const wasteTop = saved.waste.length ? saved.waste[saved.waste.length - 1] : null;
  const left = useMemo(() => saved.removed.filter((r) => !r).length, [saved.removed]);

  const rankAt = (sel: "waste" | number): number | null =>
    sel === "waste"
      ? wasteTop !== null
        ? rank(wasteTop)
        : null
      : rank(saved.pyramid[sel]);

  /** Any play available? Pairs among exposed cards + waste top, a lone
   *  king, a flip, or a redeal. Marks `next` finished if not (or if it is
   *  won), returning the outcome for the commit that ends the game. */
  function judge(next: SavedState): "won" | "lost" | undefined {
    if (next.removed.every(Boolean)) {
      next.done = true;
      next.won = true;
      return "won";
    }
    if (next.stock.length > 0 || (next.redeals > 0 && next.waste.length > 1)) return;
    const open = next.pyramid
      .map((card, s) => ({ card, s }))
      .filter(({ s }) => exposed(next.removed, s))
      .map(({ card }) => rank(card));
    const top = next.waste.length ? rank(next.waste[next.waste.length - 1]) : null;
    const pool = top !== null ? [...open, top] : open;
    if (pool.includes(13)) return;
    for (let a = 0; a < pool.length; a++)
      for (let b = a + 1; b < pool.length; b++) if (pool[a] + pool[b] === 13) return;
    // Exposed pyramid pairs are checked above; the same-rank double-count
    // (a card pairing with itself) can't happen since a+b uses two entries.
    next.done = true;
    return "lost";
  }

  function removePair(a: "waste" | number, b: "waste" | number | null) {
    const next: SavedState = {
      ...saved,
      removed: saved.removed.slice(),
      waste: saved.waste.slice()
    };
    for (const sel of [a, b]) {
      if (sel === null) continue;
      if (sel === "waste") next.waste.pop();
      else next.removed[sel] = true;
    }
    commit(next, { outcome: judge(next) });
    setSelected(null);
  }

  function tap(sel: "waste" | number) {
    if (saved.done) return;
    if (sel !== "waste" && !exposed(saved.removed, sel)) return;
    if (sel === "waste" && wasteTop === null) return;
    const r = rankAt(sel);
    if (r === null) return;
    if (r === 13) {
      removePair(sel, null); // kings fly solo
      return;
    }
    if (selected === null) {
      setSelected(sel);
      return;
    }
    if (selected === sel) {
      setSelected(null);
      return;
    }
    const rs = rankAt(selected);
    if (rs !== null && rs + r === 13) removePair(selected, sel);
    else setSelected(sel);
  }

  function tapStock() {
    if (saved.done) return;
    if (saved.stock.length) {
      const stock = saved.stock.slice();
      const card = stock.pop()!;
      const next = { ...saved, stock, waste: [...saved.waste, card] };
      commit(next, { outcome: judge(next) });
      setSelected(null);
    } else if (saved.redeals > 0 && saved.waste.length) {
      const next = {
        ...saved,
        stock: saved.waste.slice().reverse(),
        waste: [],
        redeals: saved.redeals - 1
      };
      commit(next, { outcome: judge(next) });
      setSelected(null);
    }
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  return (
    <div className="game game-pyramid">
      <GameHeader title="Pyramid" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Pair cards adding to 13 — kings alone. Clear the whole pyramid.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="tp-board pyr-board" role="group" aria-label="Pyramid">
        {saved.pyramid.map((card, s) => {
          if (saved.removed[s]) return null;
          const open = exposed(saved.removed, s);
          return (
            <PlayingCard
              key={card}
              card={card}
              faceDown={!open}
              selected={selected === s}
              className="tp-card pyr-card"
              style={
                {
                  "--x": COL_OF[s] + (6 - ROW_OF[s]) / 2,
                  "--r": ROW_OF[s]
                } as CSSProperties
              }
              onClick={() => tap(s)}
              place={`Row ${ROW_OF[s] + 1}, card ${COL_OF[s] + 1}`}
            />
          );
        })}
      </div>

      <div className="kl-top tp-bottom" style={{ "--cols": 8 } as CSSProperties}>
        <PlayingCard
          card={null}
          faceDown={saved.stock.length > 0}
          onClick={tapStock}
          aria-label={
            saved.stock.length
              ? `Stock, ${nCards(saved.stock.length)}`
              : saved.redeals > 0
                ? "Stock, empty, turn the waste over"
                : "Stock, empty"
          }
        >
          {saved.stock.length || (saved.redeals > 0 ? "↺" : "—")}
        </PlayingCard>
        <PlayingCard
          card={wasteTop}
          selected={selected === "waste"}
          onClick={() => tap("waste")}
          place="Waste"
        />
        <span className="kl-gap" />
        <span className="tp-left">
          {left} left · {saved.redeals}↺
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won ? "Pyramid cleared!" : `Out of moves — ${left} cards remained`
          }
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
