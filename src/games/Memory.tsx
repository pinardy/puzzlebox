import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SYMBOLS = ["🍎", "🌙", "⭐", "🐟", "🎈", "🍀", "🔔", "🦋", "🍄", "⚡"];
const PAIRS: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const COLS = 4;

interface SavedState {
  matched: boolean[];
  flips: number;
  done: boolean;
}

export default function Memory({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "memory",
    (_s, d) => ({ matched: Array(PAIRS[d] * 2).fill(false), flips: 0, done: false })
  );
  const pairs = PAIRS[diff];
  const cards = useMemo(() => {
    const set = SYMBOLS.slice(0, pairs);
    return shuffled([...set, ...set], makeRng(`memory-${seed}`));
  }, [seed, pairs]);

  const [open, setOpen] = useState<number[]>([]);
  const closeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    []
  );

  function tap(i: number) {
    if (saved.done || saved.matched[i] || open.includes(i)) return;

    // A mismatched pair is showing — close it early and open the new card.
    if (open.length === 2) {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      setOpen([i]);
      return;
    }
    if (open.length === 0) {
      setOpen([i]);
      return;
    }

    const first = open[0];
    const next: SavedState = { ...saved, flips: saved.flips + 1 };
    if (cards[first] === cards[i]) {
      next.matched = saved.matched.slice();
      next.matched[first] = next.matched[i] = true;
      next.done = next.matched.every(Boolean);
      setOpen([]);
      if (next.done) recordResult("memory", true);
    } else {
      setOpen([first, i]);
      closeTimer.current = window.setTimeout(() => setOpen([]), 800);
    }
    commit(next, { undoable: false }); // undo would reveal card positions
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setOpen([]);
  }

  const rows = (pairs * 2) / COLS;

  return (
    <div className="game game-memory">
      <GameHeader title="Pairs" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">Flip two cards at a time and find every pair.</p>
      <GameTools diff={diff} onDiff={startNew} />

      <div className="lights-meta">
        <span>Flips: {saved.flips}</span>
      </div>

      <div
        className="memory-grid"
        style={{ "--n": COLS, aspectRatio: `${COLS} / ${rows}` } as CSSProperties}
        role="grid"
        aria-label="Card grid"
      >
        {cards.map((sym, i) => {
          const up = saved.matched[i] || open.includes(i);
          return (
            <button
              key={i}
              role="gridcell"
              className={`memory-card${up ? " up" : ""}${saved.matched[i] ? " matched" : ""}`}
              onClick={() => tap(i)}
              aria-label={up ? sym : "Face-down card"}
            >
              {up ? sym : ""}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="memory"
          won
          message={`Matched everything in ${saved.flips} flips!`}
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
