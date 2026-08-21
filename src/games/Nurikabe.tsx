import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateNurikabe, nurikabeSolved } from "../lib/nurikabe";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 7;

type Mark = 0 | 1 | 2; // unknown | sea (filled) | island dot

interface SavedState {
  marks: Mark[];
  done: boolean;
}

function fresh(): SavedState {
  return { marks: Array(N * N).fill(0) as Mark[], done: false };
}

export default function Nurikabe({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("nurikabe")?.seed ?? newSeed()
  );
  const puzzle = useMemo(() => generateNurikabe(`nurikabe-${seed}`, N), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("nurikabe")?.state ?? fresh()
  );
  const [mode, setMode] = useState<1 | 2>(1); // fill | dot
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const filled = saved.marks.map((m) => m === 1);
    if (!saved.done && nurikabeSolved(puzzle, filled)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("nurikabe", seed, next);
      recordResult("nurikabe", true);
      setToast("The sea is whole!");
    }
  }, [saved, puzzle, seed]);

  function tap(idx: number) {
    if (saved.done || puzzle.clues.has(idx)) return;
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = marks[idx] === mode ? 0 : mode;
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("nurikabe", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("nurikabe", s, fresh());
    setToast(null);
  }

  return (
    <div className="game game-nurikabe">
      <GameHeader title="Nurikabe" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Fill the sea around numbered islands of exactly that size. The sea is
        one connected mass with no 2×2 pools; islands don't touch.
      </p>

      <div
        className="nuri-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Nurikabe board"
      >
        {saved.marks.map((m, i) => {
          const clue = puzzle.clues.get(i);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "nuri-cell",
                clue !== undefined ? "clue" : "",
                m === 1 ? "sea" : "",
                m === 2 ? "dot" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {clue ?? (m === 2 ? "·" : "")}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="picross-tools">
        <button
          className={`tool-btn nuri-fill${mode === 1 ? " active" : ""}`}
          onClick={() => setMode(1)}
          aria-pressed={mode === 1}
        >
          ■ Sea
        </button>
        <button
          className={`tool-btn${mode === 2 ? " active" : ""}`}
          onClick={() => setMode(2)}
          aria-pressed={mode === 2}
        >
          · Island
        </button>
      </div>
    </div>
  );
}
