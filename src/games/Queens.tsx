import { useEffect, useMemo, type CSSProperties } from "react";
import { generateQueens } from "../lib/queens";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 7, medium: 8, hard: 9 };
const HELP =
  "Place exactly one crown in every row, every column, and every colour " +
  "region — and no two crowns may touch, not even diagonally. Use ✕ marks " +
  "to rule squares out.";

const REGION_COLORS = [
  "#f5c8c4", "#c6def5", "#cdeccf", "#f5e9b8", "#e0d2f2",
  "#f7d8b4", "#c6ecec", "#e6ddd0", "#dbe6c3"
];

interface SavedState {
  marks: number[]; // 0 empty, 1 ✕, 2 crown
  done: boolean;
}

export default function Queens({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("queens", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { regions } = useMemo(() => generateQueens(`queens-${seed}`, n), [seed, n]);

  const crowns = useMemo(
    () => saved.marks.flatMap((m, i) => (m === 2 ? [i] : [])),
    [saved.marks]
  );

  /** Crown indices that break a rule right now. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (const a of crowns) {
      const ra = Math.floor(a / n), ca = a % n;
      for (const b of crowns) {
        if (a >= b) continue;
        const rb = Math.floor(b / n), cb = b % n;
        const touching =
          Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
        if (ra === rb || ca === cb || regions[a] === regions[b] || touching) {
          bad.add(a); bad.add(b);
        }
      }
    }
    return bad;
  }, [crowns, regions, n]);

  useEffect(() => {
    if (!saved.done && crowns.length === n && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("queens", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowns, conflicts, n, saved]);

  function tap(idx: number) {
    if (saved.done) return;
    const marks = saved.marks.slice();
    marks[idx] = (marks[idx] + 1) % 3; // empty → ✕ → crown → empty
    commit({ ...saved, marks });
  }

  return (
    <div className="game game-queens">
      <GameHeader title="Queens" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        One crown per row, column, and colour — none touching. Tap once for
        ✕, twice for a crown.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="queens-grid"
        style={{ "--n": n } as CSSProperties}
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

      <div className="lights-meta">
        <span>👑 {crowns.length} / {n}</span>
        <button
          className="mini-btn"
          onClick={() => commit({ marks: Array(n * n).fill(0), done: false })}
        >
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="queens"
          won
          message="All crowns placed!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
