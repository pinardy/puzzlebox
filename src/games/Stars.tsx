import { useEffect, useMemo, type CSSProperties } from "react";
import { generateStars } from "../lib/stars";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 8, medium: 9, hard: 10 };
const HELP =
  "Place exactly two stars in every row, every column, and every colour " +
  "region. Stars never touch, not even diagonally. Use ✕ marks to rule " +
  "squares out.";

const REGION_COLORS = [
  "#f5c8c4", "#c6def5", "#cdeccf", "#f5e9b8", "#e0d2f2",
  "#f7d8b4", "#c6ecec", "#dbe6c3", "#e6ddd0", "#f3d4e6"
];

interface SavedState {
  marks: number[]; // 0 empty, 1 ✕, 2 star
  done: boolean;
}

export default function Stars({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("stars", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { regions } = useMemo(() => generateStars(`stars-${seed}`, n), [seed, n]);

  // A save from before sizes were difficulty-driven may not fit the board.
  useEffect(() => {
    if (saved.marks.length !== n * n)
      commit({ marks: Array(n * n).fill(0), done: false }, { undoable: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, saved.marks.length]);

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
      const r = Math.floor(s / n), c = s % n;
      rows.set(r, [...(rows.get(r) ?? []), s]);
      cols.set(c, [...(cols.get(c) ?? []), s]);
      regs.set(regions[s], [...(regs.get(regions[s]) ?? []), s]);
      for (const t of stars) {
        if (t <= s) continue;
        const rt = Math.floor(t / n), ct = t % n;
        if (Math.abs(r - rt) <= 1 && Math.abs(c - ct) <= 1) { bad.add(s); bad.add(t); }
      }
    }
    for (const group of [...rows.values(), ...cols.values(), ...regs.values()])
      if (group.length > 2) group.forEach((s) => bad.add(s));
    return bad;
  }, [stars, regions, n]);

  useEffect(() => {
    if (saved.done || conflicts.size > 0 || stars.length !== 2 * n) return;
    const rows = Array(n).fill(0), cols = Array(n).fill(0), regs = Array(n).fill(0);
    for (const s of stars) {
      rows[Math.floor(s / n)]++;
      cols[s % n]++;
      regs[regions[s]]++;
    }
    if ([...rows, ...cols, ...regs].every((v) => v === 2)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("stars", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars, conflicts, regions, n, saved]);

  function tap(idx: number) {
    if (saved.done) return;
    const marks = saved.marks.slice();
    marks[idx] = (marks[idx] + 1) % 3;
    commit({ ...saved, marks });
  }

  return (
    <div className="game game-stars">
      <GameHeader title="Star Battle" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Two stars in every row, column, and colour — never touching. Tap once
        for ✕, twice for a star.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="queens-grid stars-grid"
        style={{ "--n": n } as CSSProperties}
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

      <div className="lights-meta">
        <span>★ {stars.length} / {2 * n}</span>
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
          game="stars"
          won
          message="A perfect constellation!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
