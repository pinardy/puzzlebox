import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { useMarkPaint } from "../lib/drag";
import type { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

/** What a shading puzzle has to tell this board: how big it is, which
 *  cells carry clues and how to draw them, whether a shading wins, and
 *  the shading it was built from (for hints). */
export interface ShadePuzzle {
  n: number;
  /** The clue to draw in a cell, or null if the cell is the player's. */
  clue: (i: number) => ReactNode | null;
  solved: (filled: boolean[]) => boolean;
  solution: boolean[];
}

/** Shared board for Tapa, Kurodoko and Cave: tap a cell to cycle it
 *  between untouched, filled, and pencil-dotted as definitely empty.
 *  Because each puzzle judges a win against its own RULES rather than
 *  against the grid it was generated from, any legal answer is accepted. */
export function ShadeGame({
  title,
  hint,
  help,
  className,
  fillWord,
  build,
  onExit
}: {
  title: string;
  hint: string;
  help: string;
  className: string;
  /** What a filled cell is called, for the labels ("shaded", "rock"). */
  fillWord: string;
  build: (seed: string, diff: Diff) => ShadePuzzle;
  onExit: () => void;
}) {
  interface SavedState {
    /** 0 = untouched, 1 = filled, 2 = pencilled empty. */
    marks: number[];
    done: boolean;
  }

  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => ({
      marks: Array(build(s, d).n ** 2).fill(0),
      done: false
    }));
  const puzzle = useMemo(() => build(seed, diff), [seed, diff, build]);

  const filled = useMemo(() => saved.marks.map((m) => m === 1), [saved.marks]);

  const solved = useMemo(() => puzzle.solved(filled), [puzzle, filled]);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  // A press cycles untouched → filled → dotted; the drag paints that mark
  // over the cells that differ, and the whole stroke is one undo step.
  const drag = useMarkPaint<number>({
    marks: saved.marks,
    next: (i) => (saved.done ? null : (saved.marks[i] + 1) % 3),
    write: (marks, undoable) => commit({ ...saved, marks }, { undoable }),
    locked: (i) => puzzle.clue(i) !== null
  });

  /** Keyboard activation: the same cycle a tap does. */
  function cycle(i: number) {
    if (saved.done || puzzle.clue(i) !== null) return;
    const marks = saved.marks.slice();
    marks[i] = (marks[i] + 1) % 3;
    commit({ ...saved, marks });
  }

  /** Fill in one cell from the grid this puzzle was generated from. */
  function hintCell() {
    if (saved.done) return;
    const wrong: number[] = [];
    for (let i = 0; i < puzzle.solution.length; i++) {
      if (puzzle.clue(i) !== null) continue;
      const want = puzzle.solution[i] ? 1 : 2;
      if (saved.marks[i] !== want) wrong.push(i);
    }
    if (!wrong.length) return;
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    const marks = saved.marks.slice();
    marks[i] = puzzle.solution[i] ? 1 : 2;
    commitHint({ ...saved, marks });
  }

  const startNew = (d?: Diff) => newPuzzle(d);

  const n = puzzle.n;
  const fillCount = filled.filter(Boolean).length;

  return (
    <div className={`game ${className}`}>
      <GameHeader title={title} onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">{hint}</p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={help}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hintCell}
      />

      <div
        className="shade-grid drag-paint"
        role="grid"
        aria-label={`${title} board`}
        style={{ "--n": n } as CSSProperties}
        {...drag}
      >
        {saved.marks.map((m, i) => {
          const clue = puzzle.clue(i);
          if (clue !== null)
            return (
              <div key={i} className="shade-cell shade-clue" role="gridcell">
                {clue}
              </div>
            );
          return (
            <button
              key={i}
              role="gridcell"
              data-cell={i}
              className={[
                "shade-cell",
                m === 1 ? "shade-on" : "",
                m === 2 ? "shade-off" : ""
              ].join(" ")}
              onClick={(e) => {
                // Pointer events already handled it; keep keyboards working.
                if (e.detail === 0) cycle(i);
              }}
              aria-label={
                m === 1 ? fillWord : m === 2 ? "marked empty" : "untouched"
              }
            >
              {m === 2 ? "·" : ""}
            </button>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>
          {fillCount} {fillWord} · {n}×{n}
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Solved!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
