import { useEffect, useMemo, useState } from "react";
import { newSeed } from "../lib/rng";
import { generateKakuro, KAKURO_G } from "../lib/kakuro";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const G = KAKURO_G;

interface SavedState {
  entries: number[]; // per board cell; 0 = empty (black cells unused)
  done: boolean;
}

function fresh(): SavedState {
  return { entries: Array(G * G).fill(0), done: false };
}

export default function Kakuro({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("kakuro")?.seed ?? newSeed()
  );
  const puzzle = useMemo(() => generateKakuro(`kakuro-${seed}`), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("kakuro")?.state ?? fresh()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const board = saved.entries;

  /** Cells breaking a rule: duplicates in a run, or a completed run whose
   *  sum is off. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const run of puzzle.runs) {
      const vals = run.cells.map((i) => board[i]);
      for (let a = 0; a < vals.length; a++)
        for (let b = a + 1; b < vals.length; b++)
          if (vals[a] !== 0 && vals[a] === vals[b]) {
            bad.add(run.cells[a]);
            bad.add(run.cells[b]);
          }
      if (vals.every((v) => v !== 0) && vals.reduce((x, y) => x + y, 0) !== run.sum)
        run.cells.forEach((i) => bad.add(i));
    }
    return bad;
  }, [board, puzzle]);

  useEffect(() => {
    const complete = puzzle.runs.every((run) =>
      run.cells.every((i) => board[i] !== 0)
    );
    if (!saved.done && complete && conflicts.size === 0) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("kakuro", seed, next);
      recordResult("kakuro", true);
      setToast("All sums add up!");
    }
  }, [board, conflicts, puzzle, saved, seed]);

  function setCell(idx: number, val: number) {
    if (saved.done || puzzle.black[idx]) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    const next = { ...saved, entries };
    setSaved(next);
    saveSlot("kakuro", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("kakuro", s, fresh());
    setSelected(null);
    setToast(null);
  }

  return (
    <div className="game game-kakuro">
      <GameHeader title="Kakuro" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Runs of digits 1–9, no repeats within a run, adding to the clue —
        across on the top-right, down on the bottom-left.
      </p>

      <div className="kakuro-grid" role="grid" aria-label="Kakuro board">
        {Array.from({ length: G * G }).map((_, i) => {
          if (puzzle.black[i]) {
            const a = puzzle.across.get(i);
            const d = puzzle.down.get(i);
            return (
              <span key={i} className={`kk-black${a !== undefined || d !== undefined ? " clued" : ""}`}>
                {a !== undefined && <i className="kk-across">{a}</i>}
                {d !== undefined && <i className="kk-down">{d}</i>}
              </span>
            );
          }
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kk-cell",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {board[i] || ""}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="numpad numpad-9">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((dgt) => (
          <button
            key={dgt}
            className="num-key"
            onClick={() => selected !== null && setCell(selected, dgt)}
          >
            {dgt}
          </button>
        ))}
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
