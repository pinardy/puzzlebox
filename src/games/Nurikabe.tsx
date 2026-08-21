import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { generateNurikabe, nurikabeSolved } from "../lib/nurikabe";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 9 };
const HELP =
  "Every number sits on a white island of exactly that many cells; islands " +
  "only touch diagonally. Everything else is sea: one connected mass with " +
  "no 2×2 pool anywhere. Fill the sea; dot cells you know are island. Drag " +
  "to paint several cells.";

type Mark = 0 | 1 | 2; // unknown | sea (filled) | island dot

interface SavedState {
  marks: Mark[];
  done: boolean;
}

export default function Nurikabe({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("nurikabe", (_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateNurikabe(`nurikabe-${seed}`, n), [seed, n]);
  const [mode, setMode] = useState<1 | 2>(1); // fill | dot
  const paint = useRef<Mark | null>(null);

  useEffect(() => {
    const filled = saved.marks.map((m) => m === 1);
    if (!saved.done && nurikabeSolved(puzzle, filled)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("nurikabe", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, puzzle]);

  function apply(i: number, v: Mark, undoable: boolean) {
    if (puzzle.clues.has(i)) return;
    const marks = saved.marks.slice() as Mark[];
    marks[i] = v;
    commit({ ...saved, marks }, { undoable });
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-nuri-idx]");
    const v = el instanceof HTMLElement ? el.dataset.nuriIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  return (
    <div className="game game-nurikabe">
      <GameHeader title="Nurikabe" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Fill the sea around numbered islands of exactly that size.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="nuri-grid drag-paint"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Nurikabe board"
        onPointerDown={(e) => {
          if (saved.done) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i === null || puzzle.clues.has(i)) return;
          const v = (saved.marks[i] === mode ? 0 : mode) as Mark;
          paint.current = v;
          apply(i, v, true);
        }}
        onPointerMove={(e) => {
          if (paint.current === null) return;
          const i = cellFromPoint(e.clientX, e.clientY);
          if (i !== null && !puzzle.clues.has(i) && saved.marks[i] !== paint.current)
            apply(i, paint.current, false); // whole stroke = one undo step
        }}
        onPointerUp={() => { paint.current = null; }}
        onPointerCancel={() => { paint.current = null; }}
      >
        {saved.marks.map((m, i) => {
          const clue = puzzle.clues.get(i);
          return (
            <button
              key={i}
              data-nuri-idx={i}
              role="gridcell"
              className={[
                "nuri-cell",
                clue !== undefined ? "clue" : "",
                m === 1 ? "sea" : "",
                m === 2 ? "dot" : ""
              ].join(" ")}
            >
              {clue ?? (m === 2 ? "·" : "")}
            </button>
          );
        })}
      </div>

      <div className="picross-tools">
        <button
          className={`tool-btn nuri-fill${mode === 1 ? " active" : ""}`}
          onClick={() => setMode(1)}
          aria-pressed={mode === 1}
        >
          ■ Sea
        </button>
        <button
          className={`tool-btn${mode === 2 ? " active" : ""}`}
          onClick={() => setMode(2)}
          aria-pressed={mode === 2}
        >
          · Island
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="nurikabe"
          won
          message="The sea is whole!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
