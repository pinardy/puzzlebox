import { useMemo, type CSSProperties } from "react";
import { useCellDrag } from "../lib/drag";
import { generateZip, areAdjacent } from "../lib/zip";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const HELP =
  "Draw one continuous line that visits every square exactly once, passing " +
  "through the numbered checkpoints in order. Drag from the line's end to " +
  "extend it; touch an earlier square to rewind.";

interface SavedState {
  path: number[];
  done: boolean;
}

export default function Zip({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle } = useGame<SavedState>((s, d) => {
    const n = SIZE[d];
    const p = generateZip(`zip-${s}`, n, n + 1);
    return { path: [p.start], done: false };
  });
  const n = SIZE[diff];
  const { checkpoints, start, last } = useMemo(
    () => generateZip(`zip-${seed}`, n, n + 1),
    [seed, n]
  );

  const onPath = useMemo(() => new Set(saved.path), [saved.path]);
  const head = saved.path[saved.path.length - 1];

  const nextCheckpoint = useMemo(() => {
    let expect = 1;
    for (const cell of saved.path)
      if (checkpoints.get(cell) === expect) expect++;
    return expect;
  }, [saved.path, checkpoints]);

  function apply(path: number[]) {
    let expect = 1;
    for (const cell of path) if (checkpoints.get(cell) === expect) expect++;
    const done = path.length === n * n && expect > last;
    // Drawing has its own rewind, so moves aren't undoable.
    commit(
      { path, done },
      { undoable: false, outcome: done && !saved.done ? "won" : undefined }
    );
  }

  /** Try to move the path head onto `idx` (extend, backtrack, or rewind). */
  function step(idx: number) {
    if (saved.done) return;
    const path = saved.path;
    if (path.length > 1 && idx === path[path.length - 2]) {
      apply(path.slice(0, -1));
      return;
    }
    const at = path.indexOf(idx);
    if (at !== -1) {
      if (at < path.length - 1) apply(path.slice(0, at + 1));
      return;
    }
    if (!areAdjacent(head, idx, n)) return;
    const cp = checkpoints.get(idx);
    if (cp !== undefined && cp !== nextCheckpoint) return; // out of order
    apply([...path, idx]);
  }

  const drag = useCellDrag({
    onStart: step,
    onEnter(i) {
      if (i !== head) step(i);
    }
  });

  return (
    <div className="game game-zip">
      <GameHeader title="Zip" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Draw one line through every square, hitting the numbers in order.
      </p>
      <GameTools diff={diff} onDiff={newPuzzle} help={HELP} />

      <div
        className="zip-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Zip board"
        {...drag}
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const cp = checkpoints.get(i);
          return (
            <div
              key={i}
              role="gridcell"
              data-cell={i}
              className={[
                "zip-cell",
                onPath.has(i) ? "on" : "",
                i === head ? "head" : "",
                cp !== undefined ? "cp" : "",
                cp !== undefined && cp < nextCheckpoint ? "cp-done" : ""
              ].join(" ")}
            >
              <span className="cp-num">{cp ?? ""}</span>
            </div>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>{saved.path.length} / {n * n} squares · next: {nextCheckpoint > last ? "—" : nextCheckpoint}</span>
        <button className="mini-btn" onClick={() => apply([start])}>
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Zipped!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
