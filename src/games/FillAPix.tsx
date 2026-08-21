import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

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
      const r = Math.floor(i / n), c = i % n;
      let on = 0, all = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
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
      const r = Math.floor(i / n), c = i % n;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
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
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("fillapix", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const { clues, target } = useMemo(
    () => generateFillAPix(`fillapix-${seed}`, n, CLUE_RATE[diff]),
    [seed, n, diff]
  );
  const paint = useRef<Mark | null>(null);

  /** Per-clue state: satisfied (exact count, block fully marked), broken
   *  (too many fills, or block complete with too few), or open. */
  const clueState = useMemo(() => {
    return clues.map((clue, i) => {
      if (clue === null) return null;
      const r = Math.floor(i / n), c = i % n;
      let filled = 0, undecided = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
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

  useEffect(() => {
    const complete =
      saved.marks.every((m) => m !== 0) &&
      clueState.every((s) => s === null || s === "ok");
    if (!saved.done && complete) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("fillapix", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clueState, saved]);

  function apply(i: number, v: Mark, undoable: boolean) {
    const marks = saved.marks.slice() as Mark[];
    marks[i] = v;
    commit({ ...saved, marks }, { undoable });
  }

  /** Correct one cell that disagrees with the hidden picture. */
  function hint() {
    const wrong = [...Array(n * n).keys()].filter(
      (i) => (saved.marks[i] === 1) !== (target[i] === 1)
    );
    if (!wrong.length) return;
    const idx = wrong[Math.floor(Math.random() * wrong.length)];
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = target[idx] === 1 ? 1 : 2;
    commitHint({ ...saved, marks });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-fap-idx]");
    const v = el instanceof HTMLElement ? el.dataset.fapIdx : undefined;
    return v === undefined ? null : Number(v);
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
        onPointerDown={(e) => {
          if (saved.done) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i === null) return;
          // First tap cycles empty → fill → cross → empty; the stroke
          // then paints that same mark.
          const v = ((saved.marks[i] + 1) % 3) as Mark;
          paint.current = v;
          apply(i, v, true);
        }}
        onPointerMove={(e) => {
          if (paint.current === null) return;
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i !== null && saved.marks[i] !== paint.current)
            apply(i, paint.current, false); // whole stroke = one undo step
        }}
        onPointerUp={() => { paint.current = null; }}
        onPointerCancel={() => { paint.current = null; }}
      >
        {saved.marks.map((m, i) => {
          const state = clueState[i];
          return (
            <button
              key={i}
              data-fap-idx={i}
              className={[
                "fap-cell",
                m === 1 ? "fill" : m === 2 ? "cross" : "",
                state === "ok" ? "satisfied" : "",
                state === "broken" ? "broken" : ""
              ].join(" ")}
              aria-label={`Cell ${Math.floor(i / n) + 1},${(i % n) + 1}`}
            >
              {clues[i] !== null ? clues[i] : m === 2 ? "×" : ""}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="fillapix"
          won
          message="Mosaic complete!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
