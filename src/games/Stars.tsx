import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateStars } from "../lib/stars";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 8;

const REGION_COLORS = [
  "#f5c8c4", "#c6def5", "#cdeccf", "#f5e9b8",
  "#e0d2f2", "#f7d8b4", "#c6ecec", "#dbe6c3"
];

interface SavedState {
  marks: number[]; // 0 empty, 1 ✕, 2 star
  done: boolean;
}

function fresh(): SavedState {
  return { marks: Array(N * N).fill(0), done: false };
}

export default function Stars({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("stars")?.seed ?? newSeed()
  );
  const { regions } = useMemo(() => generateStars(`stars-${seed}`, N), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("stars")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  const stars = useMemo(
    () => saved.marks.flatMap((m, i) => (m === 2 ? [i] : [])),
    [saved.marks]
  );

  /** Stars that break a rule right now: >2 in a row/column/region, or any
   *  two touching (including diagonally). */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    const rows = new Map<number, number[]>(), cols = new Map<number, number[]>(),
      regs = new Map<number, number[]>();
    for (const s of stars) {
      const r = Math.floor(s / N), c = s % N;
      rows.set(r, [...(rows.get(r) ?? []), s]);
      cols.set(c, [...(cols.get(c) ?? []), s]);
      regs.set(regions[s], [...(regs.get(regions[s]) ?? []), s]);
      for (const t of stars) {
        if (t <= s) continue;
        const rt = Math.floor(t / N), ct = t % N;
        if (Math.abs(r - rt) <= 1 && Math.abs(c - ct) <= 1) { bad.add(s); bad.add(t); }
      }
    }
    for (const group of [...rows.values(), ...cols.values(), ...regs.values()])
      if (group.length > 2) group.forEach((s) => bad.add(s));
    return bad;
  }, [stars, regions]);

  useEffect(() => {
    if (saved.done || conflicts.size > 0 || stars.length !== 2 * N) return;
    const rows = Array(N).fill(0), cols = Array(N).fill(0), regs = Array(N).fill(0);
    for (const s of stars) {
      rows[Math.floor(s / N)]++;
      cols[s % N]++;
      regs[regions[s]]++;
    }
    if ([...rows, ...cols, ...regs].every((v) => v === 2)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("stars", seed, next);
      recordResult("stars", true);
      setToast("A perfect constellation!");
    }
  }, [stars, conflicts, regions, saved, seed]);

  function tap(idx: number) {
    if (saved.done) return;
    const marks = saved.marks.slice();
    marks[idx] = (marks[idx] + 1) % 3;
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("stars", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("stars", s, fresh());
    setToast(null);
  }

  return (
    <div className="game game-stars">
      <GameHeader title="Star Battle" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Two stars in every row, column, and colour — and no two stars may
        touch, even diagonally. Tap once for ✕, twice for a star.
      </p>

      <div
        className="queens-grid stars-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Star Battle board"
      >
        {saved.marks.map((m, i) => (
          <button
            key={i}
            role="gridcell"
            className={`q-cell${conflicts.has(i) ? " conflict" : ""}`}
            style={{ background: REGION_COLORS[regions[i]] }}
            onClick={() => tap(i)}
          >
            {m === 2 ? "★" : m === 1 ? "✕" : ""}
          </button>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>★ {stars.length} / {2 * N}</span>
        <button
          className="mini-btn"
          onClick={() => {
            const next = fresh();
            setSaved(next);
            saveSlot("stars", seed, next);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
