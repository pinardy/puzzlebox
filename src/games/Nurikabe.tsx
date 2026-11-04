import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMarkPaint } from "../lib/drag";
import { generateNurikabe, nurikabeSolved } from "../lib/nurikabe";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Nurikabe.css";

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
  const { seed, diff, saved, commit, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateNurikabe(`nurikabe-${seed}`, n), [seed, n]);
  const [mode, setMode] = useState<1 | 2>(1); // fill | dot

  const solved = useMemo(
    () => nurikabeSolved(puzzle, saved.marks.map((m) => m === 1)),
    [puzzle, saved.marks]
  );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  // A press toggles the cell between the current tool's mark and blank;
  // the drag paints that over the cells that differ (clues excepted), and
  // the whole stroke is one undo step.
  const drag = useMarkPaint<Mark>({
    marks: saved.marks,
    next: (i) => (saved.done ? null : saved.marks[i] === mode ? 0 : mode),
    write: (marks, undoable) => commit({ ...saved, marks }, { undoable }),
    locked: (i) => puzzle.clues.has(i)
  });

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
        {...drag}
      >
        {saved.marks.map((m, i) => {
          const clue = puzzle.clues.get(i);
          return (
            <button
              key={i}
              data-cell={i}
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
          won
          message="The sea is whole!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
