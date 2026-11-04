import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  const [drag, setDrag] = useState<number | null>(null);

  const filled = useMemo(() => saved.marks.map((m) => m === 1), [saved.marks]);

  const solved = useMemo(() => puzzle.solved(filled), [puzzle, filled]);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function setMark(i: number, value: number) {
    if (saved.done || puzzle.clue(i) !== null) return;
    if (saved.marks[i] === value) return;
    const marks = saved.marks.slice();
    marks[i] = value;
    commit({ ...saved, marks });
  }

  function cycle(i: number) {
    if (saved.done || puzzle.clue(i) !== null) return;
    setMark(i, (saved.marks[i] + 1) % 3);
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

  function startNew(d?: Diff) {
    newPuzzle(d);
    setDrag(null);
  }

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
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
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
              className={[
                "shade-cell",
                m === 1 ? "shade-on" : "",
                m === 2 ? "shade-off" : ""
              ].join(" ")}
              onPointerDown={() => {
                const next = (m + 1) % 3;
                setDrag(next);
                setMark(i, next);
              }}
              onPointerEnter={() => drag !== null && setMark(i, drag)}
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
