import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const HELP =
  "Split the whole grid into rectangles. Each rectangle must contain " +
  "exactly one number, and that number is its area. Tap two opposite " +
  "corners to draw a box; tap a finished box to remove it.";

interface Rect {
  r0: number;
  c0: number;
  r1: number; // inclusive
  c1: number;
}

const area = (t: Rect) => (t.r1 - t.r0 + 1) * (t.c1 - t.c0 + 1);

function cellsOf(t: Rect, n: number): number[] {
  const out: number[] = [];
  for (let r = t.r0; r <= t.r1; r++)
    for (let c = t.c0; c <= t.c1; c++) out.push(r * n + c);
  return out;
}

/** Recursively split the board into rectangles, then put each rectangle's
 *  area clue on one of its cells. */
function generateShikaku(seed: string, n: number): Map<number, number> {
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
  split({ r0: 0, c0: 0, r1: n - 1, c1: n - 1 });

  const clues = new Map<number, number>();
  for (const t of rects) {
    const cells = cellsOf(t, n);
    clues.set(cells[Math.floor(rng() * cells.length)], area(t));
  }
  return clues;
}

interface SavedState {
  rects: Rect[];
  done: boolean;
}

export default function Shikaku({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("shikaku", () => ({ rects: [], done: false }));
  const n = SIZE[diff];
  const clues = useMemo(() => generateShikaku(`shikaku-${seed}`, n), [seed, n]);
  const [anchor, setAnchor] = useState<number | null>(null);

  /** cell → index of the player rect covering it */
  const rectAt = useMemo(() => {
    const map = new Map<number, number>();
    saved.rects.forEach((t, k) => cellsOf(t, n).forEach((i) => map.set(i, k)));
    return map;
  }, [saved.rects, n]);

  useEffect(() => {
    if (saved.done || rectAt.size !== n * n) return;
    const ok = saved.rects.every((t) => {
      const inside = cellsOf(t, n).filter((i) => clues.has(i));
      return inside.length === 1 && clues.get(inside[0]) === area(t);
    });
    if (ok) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("shikaku", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectAt, saved, clues, n]);

  function tap(idx: number) {
    if (saved.done) return;
    if (anchor === null) {
      const at = rectAt.get(idx);
      if (at !== undefined) {
        commit({ ...saved, rects: saved.rects.filter((_, k) => k !== at) });
        return;
      }
      setAnchor(idx);
      return;
    }
    const t: Rect = {
      r0: Math.min(Math.floor(anchor / n), Math.floor(idx / n)),
      r1: Math.max(Math.floor(anchor / n), Math.floor(idx / n)),
      c0: Math.min(anchor % n, idx % n),
      c1: Math.max(anchor % n, idx % n)
    };
    setAnchor(null);
    if (cellsOf(t, n).some((i) => rectAt.has(i))) return; // overlaps
    commit({ ...saved, rects: [...saved.rects, t] });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setAnchor(null);
  }

  return (
    <div className="game game-shikaku">
      <GameHeader title="Shikaku" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Box every number: tap two opposite corners; each box's area must
        match its number.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="shikaku-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Shikaku board"
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const k = rectAt.get(i);
          const t = k !== undefined ? saved.rects[k] : null;
          const r = Math.floor(i / n), c = i % n;
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

      <div className="lights-meta">
        <span>{rectAt.size} / {n * n} covered</span>
        <button
          className="mini-btn"
          onClick={() => {
            commit({ ...saved, rects: [] });
            setAnchor(null);
          }}
        >
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="shikaku"
          won
          message="Perfectly boxed!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
