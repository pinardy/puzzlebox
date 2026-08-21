import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const SYMBOLS = ["🍎", "🌙", "⭐", "🐟", "🎈", "🍀", "🔔", "🦋"];
const N = SYMBOLS.length * 2; // 16 cards, 4×4

interface SavedState {
  matched: boolean[];
  flips: number;
  done: boolean;
}

function fresh(): SavedState {
  return { matched: Array(N).fill(false), flips: 0, done: false };
}

export default function Memory({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("memory")?.seed ?? newSeed()
  );
  const cards = useMemo(
    () => shuffled([...SYMBOLS, ...SYMBOLS], makeRng(`memory-${seed}`)),
    [seed]
  );
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("memory")?.state ?? fresh()
  );
  const [open, setOpen] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    []
  );

  function tap(i: number) {
    if (saved.done || saved.matched[i]) return;
    if (open.includes(i)) return;

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
      if (next.done) {
        recordResult("memory", true);
        setToast(`Matched everything in ${next.flips} flips!`);
      }
    } else {
      setOpen([first, i]);
      closeTimer.current = window.setTimeout(() => setOpen([]), 800);
    }
    setSaved(next);
    saveSlot("memory", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("memory", s, fresh());
    setOpen([]);
    setToast(null);
  }

  return (
    <div className="game game-memory">
      <GameHeader title="Pairs" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">Flip two cards at a time and find every pair.</p>

      <div className="lights-meta">
        <span>Flips: {saved.flips}</span>
      </div>

      <div
        className="memory-grid"
        style={{ "--n": 4 } as CSSProperties}
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
