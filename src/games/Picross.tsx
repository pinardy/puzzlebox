import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMarkPaint } from "../lib/drag";
import { makeRng } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

type Mark = 0 | 1 | 2; // empty | filled | crossed

const SIZE: Record<Diff, number> = { easy: 8, medium: 10, hard: 12 };
const HELP =
  "Each number lists the runs of filled squares in that row or column, in " +
  "order, with at least one gap between runs. Satisfied clues dim. Drag to " +
  "fill several squares in one stroke.";

interface SavedState {
  marks: Mark[];
  done: boolean;
}

function runsOf(line: number[]): number[] {
  const runs: number[] = [];
  let n = 0;
  for (const v of line) {
    if (v === 1) n++;
    else if (n) { runs.push(n); n = 0; }
  }
  if (n) runs.push(n);
  return runs.length ? runs : [0];
}

function buildTarget(seed: string, size: number): number[] {
  // Reject boards that are too sparse or too dense to be interesting.
  const rng = makeRng(seed);
  for (;;) {
    const cells = Array.from({ length: size * size }, () =>
      rng() < 0.55 ? 1 : 0
    );
    const fill =
      cells.reduce((a: number, b) => a + b, 0) / cells.length;
    if (fill > 0.4 && fill < 0.68) return cells;
  }
}

export default function Picross({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      marks: Array(SIZE[d] * SIZE[d]).fill(0) as Mark[],
      done: false
    }));
  const size = SIZE[diff];
  const target = useMemo(() => buildTarget(`picross-${seed}`, size), [seed, size]);

  const rowClues = useMemo(
    () =>
      Array.from({ length: size }, (_, r) =>
        runsOf(target.slice(r * size, r * size + size))
      ),
    [target, size]
  );
  const colClues = useMemo(
    () =>
      Array.from({ length: size }, (_, c) =>
        runsOf(Array.from({ length: size }, (_, r) => target[r * size + c]))
      ),
    [target, size]
  );

  const [mode, setMode] = useState<1 | 2>(1); // fill | cross

  const playerRow = (r: number) =>
    saved.marks.slice(r * size, r * size + size).map((m) => (m === 1 ? 1 : 0));
  const playerCol = (c: number) =>
    Array.from({ length: size }, (_, r) => (saved.marks[r * size + c] === 1 ? 1 : 0));

  const rowDone = useMemo(
    () => rowClues.map(
      (clue, r) => JSON.stringify(runsOf(playerRow(r))) === JSON.stringify(clue)
    ),
    [saved.marks, rowClues] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const colDone = useMemo(
    () => colClues.map(
      (clue, c) => JSON.stringify(runsOf(playerCol(c))) === JSON.stringify(clue)
    ),
    [saved.marks, colClues] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const solved = rowDone.every(Boolean) && colDone.every(Boolean);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  // A press toggles the cell between the current tool's mark and blank;
  // the drag paints that over the cells that differ, as one undo step.
  const drag = useMarkPaint<Mark>({
    marks: saved.marks,
    next: (i) => (saved.done ? null : saved.marks[i] === mode ? 0 : mode),
    write: (marks, undoable) => commit({ ...saved, marks }, { undoable })
  });

  /** Correct one random cell that disagrees with the picture: fill it if
   *  it should be filled, cross it otherwise. Marks the puzzle assisted. */
  function hint() {
    const wrong = [...Array(size * size).keys()].filter(
      (i) => (saved.marks[i] === 1) !== (target[i] === 1)
    );
    if (!wrong.length) return;
    const idx = wrong[Math.floor(Math.random() * wrong.length)];
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = target[idx] === 1 ? 1 : 2;
    commitHint({ ...saved, marks });
  }

  return (
    <div className="game game-picross">
      <GameHeader title="Picross" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Numbers are runs of filled squares in that row or column, in order.
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
        className="picross-wrap"
        style={
          {
            "--n": size,
            "--rowclue": Math.max(...rowClues.map((c) => c.length)),
            "--colclue": Math.max(...colClues.map((c) => c.length))
          } as CSSProperties
        }
      >
        <div className="picross-corner" />
        <div className="picross-colclues">
          {colClues.map((clue, c) => (
            <div key={c} className={`colclue${colDone[c] ? " satisfied" : ""}`}>
              {clue.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="picross-rowclues">
          {rowClues.map((clue, r) => (
            <div key={r} className={`rowclue${rowDone[r] ? " satisfied" : ""}`}>
              {clue.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          ))}
        </div>
        <div
          className="picross-grid drag-paint"
          {...drag}
        >
          {saved.marks.map((m, i) => {
            const r = Math.floor(i / size);
            const c = i % size;
            return (
              <button
                key={i}
                data-cell={i}
                className={[
                  "pic-cell",
                  m === 1 ? "fill" : m === 2 ? "cross" : "",
                  c % 5 === 4 && c !== size - 1 ? "br" : "",
                  r % 5 === 4 && r !== size - 1 ? "bb" : ""
                ].join(" ")}
                aria-label={`Row ${r + 1} column ${c + 1}`}
              >
                {m === 2 ? "×" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="picross-tools">
        <button
          className={`tool-btn${mode === 1 ? " active" : ""}`}
          onClick={() => setMode(1)}
          aria-pressed={mode === 1}
        >
          ■ Fill
        </button>
        <button
          className={`tool-btn${mode === 2 ? " active" : ""}`}
          onClick={() => setMode(2)}
          aria-pressed={mode === 2}
        >
          × Mark empty
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Picture complete!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
