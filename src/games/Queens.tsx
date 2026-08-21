import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateQueens } from "../lib/queens";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 8;

const REGION_COLORS = [
  "#f5c8c4", "#c6def5", "#cdeccf", "#f5e9b8", "#e0d2f2",
  "#f7d8b4", "#c6ecec", "#e6ddd0", "#dbe6c3"
];

interface SavedState {
  marks: number[]; // 0 empty, 1 ✕, 2 crown
  done: boolean;
}

function fresh(): SavedState {
  return { marks: Array(N * N).fill(0), done: false };
}

export default function Queens({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("queens")?.seed ?? newSeed()
  );
  const { regions } = useMemo(() => generateQueens(`queens-${seed}`, N), [seed]);

  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("queens")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  const crowns = useMemo(
    () => saved.marks.flatMap((m, i) => (m === 2 ? [i] : [])),
    [saved.marks]
  );

  /** Crown indices that break a rule right now. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const a of crowns) {
      const ra = Math.floor(a / N), ca = a % N;
      for (const b of crowns) {
        if (a >= b) continue;
        const rb = Math.floor(b / N), cb = b % N;
        const touching =
          Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
        if (ra === rb || ca === cb || regions[a] === regions[b] || touching) {
          bad.add(a); bad.add(b);
        }
      }
    }
    return bad;
  }, [crowns, regions]);

  useEffect(() => {
    if (!saved.done && crowns.length === N && conflicts.size === 0) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("queens", seed, next);
      recordResult("queens", true);
      setToast("All crowns placed!");
    }
  }, [crowns, conflicts, saved, seed]);

  function tap(idx: number) {
    if (saved.done) return;
    const marks = saved.marks.slice();
    marks[idx] = (marks[idx] + 1) % 3; // empty → ✕ → crown → empty
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("queens", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("queens", s, fresh());
    setToast(null);
  }

  return (
    <div className="game game-queens">
      <GameHeader title="Queens" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        One crown per row, column, and colour — and no two crowns may touch.
        Tap once for ✕, twice for a crown.
      </p>

      <div
        className="queens-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Queens board"
      >
        {saved.marks.map((m, i) => (
          <button
            key={i}
            role="gridcell"
            className={`q-cell${conflicts.has(i) ? " conflict" : ""}`}
            style={{ background: REGION_COLORS[regions[i]] }}
            onClick={() => tap(i)}
          >
            {m === 2 ? "♛" : m === 1 ? "✕" : ""}
          </button>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>👑 {crowns.length} / {N}</span>
        <button
          className="mini-btn"
          onClick={() => {
            const next = fresh();
            setSaved(next);
            saveSlot("queens", seed, next);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
