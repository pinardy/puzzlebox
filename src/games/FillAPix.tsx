import { useEffect, useMemo, type CSSProperties } from "react";
import { useMarkPaint } from "../lib/drag";
import { makeRng } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./FillAPix.css";

type Mark = 0 | 1 | 2; // empty | filled | crossed

const SIZE: Record<Diff, number> = { easy: 8, medium: 10, hard: 12 };
const CLUE_RATE: Record<Diff, number> = { easy: 0.6, medium: 0.5, hard: 0.42 };
const HELP =
  "Every clue counts the painted squares in its own 3×3 block — itself and " +
  "its neighbours. A 9 means paint the whole block; a 0 means cross it all " +
  "out. Satisfied clues dim. The picture is done when every clue is met " +
  "and every square is painted or crossed. Drag to mark several squares " +
  "in one stroke.";

interface Puzzle {
  clues: (number | null)[];
  target: number[]; // 1 = painted in the hidden picture
}

/** A blobby random picture plus 3×3-count clues on a random subset of
 *  cells. Any complete marking that satisfies every clue wins. */
function generateFillAPix(seed: string, n: number, rate: number): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const target = Array.from({ length: n * n }, () => (rng() < 0.52 ? 1 : 0));
    // Smooth once toward neighbours so the picture clumps like a mosaic.
    const smoothed = target.map((_, i) => {
      const r = Math.floor(i / n),
        c = i % n;
      let on = 0,
        all = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr,
            cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          all++;
          on += target[rr * n + cc];
        }
      return on * 2 > all ? 1 : 0;
    });
    const fill = smoothed.reduce((a: number, b) => a + b, 0) / (n * n);
    if (fill < 0.35 || fill > 0.65) continue;

    const clues = smoothed.map((_, i) => {
      if (rng() >= rate) return null;
      const r = Math.floor(i / n),
        c = i % n;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr,
            cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) count += smoothed[rr * n + cc];
        }
      return count;
    });
    if (clues.every((c) => c === null)) continue;
    return { clues, target: smoothed };
  }
}

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function FillAPix({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const { clues, target } = useMemo(
    () => generateFillAPix(`fillapix-${seed}`, n, CLUE_RATE[diff]),
    [seed, n, diff]
  );

  /** Per-clue state: satisfied (exact count, block fully marked), broken
   *  (too many fills, or block complete with too few), or open. */
  const clueState = useMemo(() => {
    return clues.map((clue, i) => {
      if (clue === null) return null;
      const r = Math.floor(i / n),
        c = i % n;
      let filled = 0,
        undecided = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr,
            cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          const m = saved.marks[rr * n + cc];
          if (m === 1) filled++;
          else if (m === 0) undecided++;
        }
      if (filled > clue || filled + undecided < clue) return "broken";
      if (undecided === 0 && filled === clue) return "ok";
      return "open";
    });
  }, [clues, saved.marks, n]);

  const complete =
    saved.marks.every((m) => m !== 0) && clueState.every((s) => s === null || s === "ok");
  useEffect(() => {
    if (complete) finish();
  }, [complete, finish]);

  // First tap cycles empty → fill → cross → empty; the stroke then paints
  // that same mark over the cells that differ, as one undo step.
  const drag = useMarkPaint<Mark>({
    marks: saved.marks,
    next: (i) => (saved.done ? null : (((saved.marks[i] + 1) % 3) as Mark)),
    write: (marks, undoable) => commit({ ...saved, marks }, { undoable })
  });

  /** Correct one cell that disagrees with the hidden picture — including
   *  a blank one that should be crossed, since a win needs every square
   *  marked. */
  function hint() {
    const wrong = [...Array(n * n).keys()].filter(
      (i) => saved.marks[i] !== (target[i] === 1 ? 1 : 2)
    );
    if (!wrong.length) return;
    const idx = wrong[Math.floor(Math.random() * wrong.length)];
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = target[idx] === 1 ? 1 : 2;
    commitHint({ ...saved, marks });
  }

  return (
    <div className="game game-fillapix">
      <GameHeader title="Fill-a-Pix" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Each number counts painted squares in its 3×3 block, itself included.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="fap-grid drag-paint"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Fill-a-Pix board"
        {...drag}
      >
        {saved.marks.map((m, i) => {
          const state = clueState[i];
          return (
            <button
              key={i}
              data-cell={i}
              role="gridcell"
              className={[
                "fap-cell",
                m === 1 ? "fill" : m === 2 ? "cross" : "",
                state === "ok" ? "satisfied" : "",
                state === "broken" ? "broken" : ""
              ].join(" ")}
              aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${
                m === 1 ? "painted" : m === 2 ? "crossed" : "empty"
              }${clues[i] !== null ? `, clue ${clues[i]}` : ""}${
                state === "ok" ? ", satisfied" : state === "broken" ? ", broken" : ""
              }`}
            >
              {clues[i] !== null ? clues[i] : m === 2 ? "×" : ""}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Mosaic complete!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
