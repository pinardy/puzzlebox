import { useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 4;

/** Scramble from the solved board with random legal blank moves (never
 *  undoing the previous one), so the position is always solvable. */
function scramble(seed: string): number[] {
  const rng = makeRng(seed);
  const cells = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N));
  let blank = N * N - 1;
  let prev = -1;
  for (let k = 0; k < 160; k++) {
    const r = Math.floor(blank / N), c = blank % N;
    const opts = [
      r > 0 ? blank - N : -1,
      r < N - 1 ? blank + N : -1,
      c > 0 ? blank - 1 : -1,
      c < N - 1 ? blank + 1 : -1
    ].filter((i) => i >= 0 && i !== prev);
    const pick = opts[Math.floor(rng() * opts.length)];
    cells[blank] = cells[pick];
    cells[pick] = 0;
    prev = blank;
    blank = pick;
  }
  return cells;
}

function isSolved(cells: number[]): boolean {
  return cells.every((v, i) => v === (i + 1) % (N * N));
}

interface SavedState {
  cells: number[];
  moves: number;
  done: boolean;
}

export default function Fifteen({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("fifteen")?.seed ?? newSeed()
  );
  const [saved, setSaved] = useState<SavedState>(
    () =>
      loadSlot<SavedState>("fifteen")?.state ?? {
        cells: scramble(`fifteen-${seed}`),
        moves: 0,
        done: false
      }
  );
  const [toast, setToast] = useState<string | null>(null);

  function tap(idx: number) {
    if (saved.done || saved.cells[idx] === 0) return;
    const blank = saved.cells.indexOf(0);
    const rI = Math.floor(idx / N), cI = idx % N;
    const rB = Math.floor(blank / N), cB = blank % N;
    if (rI !== rB && cI !== cB) return;

    // Slide the whole segment between the tapped tile and the blank.
    const cells = saved.cells.slice();
    const step = rI === rB ? Math.sign(idx - blank) : Math.sign(idx - blank) * N;
    for (let j = blank; j !== idx; j += step) cells[j] = cells[j + step];
    cells[idx] = 0;

    const done = isSolved(cells);
    const next = { cells, moves: saved.moves + 1, done };
    setSaved(next);
    saveSlot("fifteen", seed, next);
    if (done) {
      recordResult("fifteen", true);
      setToast(`Solved in ${next.moves} moves!`);
    }
  }

  function newPuzzle() {
    const s = newSeed();
    const next = { cells: scramble(`fifteen-${s}`), moves: 0, done: false };
    setSeed(s);
    setSaved(next);
    saveSlot("fifteen", s, next);
    setToast(null);
  }

  return (
    <div className="game game-fifteen">
      <GameHeader title="Fifteen" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Slide tiles into the gap until they read 1–15. Tapping any tile in the
        gap's row or column slides the whole run.
      </p>

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
      </div>

      <div
        className="fifteen-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Sliding puzzle"
      >
        {saved.cells.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={`fifteen-tile${v === 0 ? " blank" : ""}${
              v !== 0 && v === (i + 1) % (N * N) ? " home" : ""
            }`}
            onClick={() => tap(i)}
          >
            {v || ""}
          </button>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
