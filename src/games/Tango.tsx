import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateTango, tangoInvalid, T } from "../lib/tango";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const REMOVALS = 26;

interface SavedState {
  entries: number[]; // player cells: 0 empty, 1 sun, 2 moon
  done: boolean;
}

function fresh(): SavedState {
  return { entries: Array(T * T).fill(0), done: false };
}

export default function Tango({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("tango")?.seed ?? newSeed()
  );
  const { givens, solution } = useMemo(
    () => generateTango(`tango-${seed}`, REMOVALS),
    [seed]
  );

  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("tango")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  /** Filled cells that currently break a rule. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < T * T; i++) {
      if (board[i] === 0) continue;
      const rest = board.slice();
      rest[i] = 0;
      if (tangoInvalid(rest, i, board[i])) bad.add(i);
    }
    return bad;
  }, [board]);

  useEffect(() => {
    if (
      !saved.done &&
      board.every((v) => v !== 0) &&
      board.every((v, i) => v === solution[i])
    ) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("tango", seed, next);
      recordResult("tango", true);
      setToast("Perfectly balanced!");
    }
  }, [board, solution, saved, seed]);

  function tap(idx: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = (entries[idx] + 1) % 3; // empty → sun → moon → empty
    const next = { ...saved, entries };
    setSaved(next);
    saveSlot("tango", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("tango", s, fresh());
    setToast(null);
  }

  return (
    <div className="game game-tango">
      <GameHeader title="Suns & Moons" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Three of each per row and column, never three in a row. Tap to cycle
        ☀ → ☾ → empty.
      </p>

      <div
        className="tango-grid"
        style={{ "--n": T } as CSSProperties}
        role="grid"
        aria-label="Suns and moons board"
      >
        {board.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "tango-cell",
              givens[i] !== 0 ? "given" : "",
              v === 1 ? "sun" : v === 2 ? "moon" : "",
              conflicts.has(i) ? "conflict" : ""
            ].join(" ")}
            onClick={() => tap(i)}
          >
            {v === 1 ? "☀" : v === 2 ? "☾" : ""}
          </button>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
