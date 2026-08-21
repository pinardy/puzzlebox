import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 8;

interface Rect {
  r0: number;
  c0: number;
  r1: number; // inclusive
  c1: number;
}

const cellsOf = (t: Rect): number[] => {
  const out: number[] = [];
  for (let r = t.r0; r <= t.r1; r++)
    for (let c = t.c0; c <= t.c1; c++) out.push(r * N + c);
  return out;
};
const area = (t: Rect) => (t.r1 - t.r0 + 1) * (t.c1 - t.c0 + 1);

/** Recursively split the board into rectangles, then put each rectangle's
 *  area clue on one of its cells. */
function generateShikaku(seed: string): Map<number, number> {
  const rng = makeRng(seed);
  const rects: Rect[] = [];
  const split = (t: Rect) => {
    const a = area(t);
    const h = t.r1 - t.r0 + 1, w = t.c1 - t.c0 + 1;
    if (a <= 2 || (a <= 6 && rng() < 0.45)) { rects.push(t); return; }
    if (w === 1 && h === 1) { rects.push(t); return; }
    const vertical = w > 1 && (h === 1 || rng() < w / (w + h));
    if (vertical) {
      const cut = t.c0 + 1 + Math.floor(rng() * (w - 1));
      split({ ...t, c1: cut - 1 });
      split({ ...t, c0: cut });
    } else {
      const cut = t.r0 + 1 + Math.floor(rng() * (h - 1));
      split({ ...t, r1: cut - 1 });
      split({ ...t, r0: cut });
    }
  };
  split({ r0: 0, c0: 0, r1: N - 1, c1: N - 1 });

  const clues = new Map<number, number>();
  for (const t of rects) {
    const cells = cellsOf(t);
    clues.set(cells[Math.floor(rng() * cells.length)], area(t));
  }
  return clues;
}

interface SavedState {
  rects: Rect[];
  done: boolean;
}

const FRESH: SavedState = { rects: [], done: false };

export default function Shikaku({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("shikaku")?.seed ?? newSeed()
  );
  const clues = useMemo(() => generateShikaku(`shikaku-${seed}`), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("shikaku")?.state ?? FRESH
  );
  const [anchor, setAnchor] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** cell → index of the player rect covering it */
  const rectAt = useMemo(() => {
    const map = new Map<number, number>();
    saved.rects.forEach((t, k) => cellsOf(t).forEach((i) => map.set(i, k)));
    return map;
  }, [saved.rects]);

  useEffect(() => {
    if (saved.done) return;
    if (rectAt.size !== N * N) return;
    const ok = saved.rects.every((t) => {
      const inside = cellsOf(t).filter((i) => clues.has(i));
      return inside.length === 1 && clues.get(inside[0]) === area(t);
    });
    if (ok) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("shikaku", seed, next);
      recordResult("shikaku", true);
      setToast("Perfectly boxed!");
    }
  }, [rectAt, saved, clues, seed]);

  function commit(rects: Rect[]) {
    const next = { ...saved, rects };
    setSaved(next);
    saveSlot("shikaku", seed, next);
  }

  function tap(idx: number) {
    if (saved.done) return;
    if (anchor === null) {
      // Tapping an existing box removes it; otherwise start a new one.
      const at = rectAt.get(idx);
      if (at !== undefined) {
        commit(saved.rects.filter((_, k) => k !== at));
        return;
      }
      setAnchor(idx);
      return;
    }
    const t: Rect = {
      r0: Math.min(Math.floor(anchor / N), Math.floor(idx / N)),
      r1: Math.max(Math.floor(anchor / N), Math.floor(idx / N)),
      c0: Math.min(anchor % N, idx % N),
      c1: Math.max(anchor % N, idx % N)
    };
    setAnchor(null);
    if (cellsOf(t).some((i) => rectAt.has(i))) return; // overlaps
    commit([...saved.rects, t]);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(FRESH);
    saveSlot("shikaku", s, FRESH);
    setAnchor(null);
    setToast(null);
  }

  return (
    <div className="game game-shikaku">
      <GameHeader title="Shikaku" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Divide the grid into boxes, each holding exactly one number equal to
        its area. Tap two opposite corners to draw a box; tap a box to remove
        it.
      </p>

      <div
        className="shikaku-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Shikaku board"
      >
        {Array.from({ length: N * N }).map((_, i) => {
          const k = rectAt.get(i);
          const t = k !== undefined ? saved.rects[k] : null;
          const r = Math.floor(i / N), c = i % N;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "shikaku-cell",
                k !== undefined ? `boxed hue-${k % 6}` : "",
                anchor === i ? "anchor" : "",
                t && r === t.r0 ? "et" : "",
                t && r === t.r1 ? "eb" : "",
                t && c === t.c0 ? "el" : "",
                t && c === t.c1 ? "er" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {clues.get(i) ?? ""}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>{rectAt.size} / {N * N} covered</span>
        <button
          className="mini-btn"
          onClick={() => { commit([]); setAnchor(null); }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
