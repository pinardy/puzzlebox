import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  generateTracks,
  checkTracks,
  mismatched,
  GLYPH,
  PIECES,
  PIECE_NAME,
  NORTH,
  EAST,
  SOUTH,
  WEST
} from "../lib/tracks";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const STATES = [0, ...PIECES];
const SIDE: Record<number, string> = {
  [NORTH]: "n",
  [EAST]: "e",
  [SOUTH]: "s",
  [WEST]: "w"
};
const HELP =
  "One railway line crosses the grid, entering at one marked edge cell and " +
  "leaving at another. The number beside each row and above each column " +
  "says how many of its cells hold track. Lay pieces so the line runs " +
  "unbroken from the entrance to the exit and every count is exact. Tap a " +
  "cell to cycle through the six pieces; long-press (or right-click) to " +
  "cycle back. The pieces given at the start are fixed.";

interface SavedState {
  cells: number[];
  done: boolean;
}

export default function TrainTracks({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      cells: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateTracks(`tracks-${seed}`, n), [seed, n]);
  const { givens, solution, rowCounts, colCounts, entry, exit } = puzzle;
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const board = useMemo(
    () => givens.map((g, i) => (g ? g : saved.cells[i])),
    [givens, saved.cells]
  );

  const laid = useMemo(() => {
    const rows = Array(n).fill(0);
    const cols = Array(n).fill(0);
    board.forEach((m, i) => {
      if (!m) return;
      rows[Math.floor(i / n)]++;
      cols[i % n]++;
    });
    return { rows, cols };
  }, [board, n]);

  const bad = useMemo(() => mismatched(board, puzzle), [board, puzzle]);
  const total = useMemo(() => rowCounts.reduce((a, b) => a + b, 0), [rowCounts]);
  const placed = useMemo(() => board.filter(Boolean).length, [board]);

  useEffect(() => {
    if (!saved.done && checkTracks(board, puzzle)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("tracks", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, puzzle, saved]);

  /** Step a cell through blank → the six pieces → blank; `step` is -1 for the
   *  long-press, since seven states is a long way round the wrong way. */
  function cycle(i: number, step: number) {
    if (saved.done || givens[i]) return;
    const cur = STATES.indexOf(board[i]);
    const cells = saved.cells.slice();
    cells[i] = STATES[(cur + step + STATES.length) % STATES.length];
    commit({ ...saved, cells });
  }

  function hint() {
    const wrong = [...board.keys()].filter(
      (i) => !givens[i] && board[i] !== solution[i]
    );
    if (!wrong.length) return;
    const cells = saved.cells.slice();
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    cells[i] = solution[i];
    commitHint({ ...saved, cells });
  }

  const mark = (got: number, want: number) =>
    got === want ? "ok" : got > want ? "over" : "";

  return (
    <div className="game game-tracks">
      <GameHeader title="Train Tracks" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Join the two marked ends into one line, hitting every count exactly.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="lights-meta">
        <span>
          {placed} of {total} pieces
        </span>
        <span>{bad.size ? `${bad.size} clashing` : "no clashes"}</span>
      </div>

      <div
        className="tt-grid"
        style={{ "--n": n + 1 } as CSSProperties}
        role="grid"
        aria-label="Train Tracks board"
      >
        <span className="tt-corner" />
        {colCounts.map((want, c) => (
          <span
            key={`c${c}`}
            className={`tt-count ${mark(laid.cols[c], want)}`}
            aria-label={`Column ${c + 1}: ${want} track, ${laid.cols[c]} laid`}
          >
            {want}
            {laid.cols[c] > want && "!"}
          </span>
        ))}

        {rowCounts.map((want, r) => [
          <span
            key={`r${r}`}
            className={`tt-count ${mark(laid.rows[r], want)}`}
            aria-label={`Row ${r + 1}: ${want} track, ${laid.rows[r]} laid`}
          >
            {want}
            {laid.rows[r] > want && "!"}
          </span>,
          ...Array.from({ length: n }, (_, c) => {
            const i = r * n + c;
            const end = i === entry.cell ? entry : i === exit.cell ? exit : null;
            return (
              <button
                key={i}
                role="gridcell"
                className={[
                  "tt-cell",
                  givens[i] ? "given" : "",
                  bad.has(i) ? "clash" : "",
                  end ? `end edge-${SIDE[end.out]}` : ""
                ].join(" ")}
                onClick={() => !longPressed.current && cycle(i, 1)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (pressTimer.current !== null) clearTimeout(pressTimer.current);
                  cycle(i, -1);
                }}
                onPointerDown={() => {
                  longPressed.current = false;
                  pressTimer.current = window.setTimeout(() => {
                    longPressed.current = true;
                    cycle(i, -1);
                  }, 420);
                }}
                onPointerUp={() => {
                  if (pressTimer.current !== null) clearTimeout(pressTimer.current);
                }}
                onPointerLeave={() => {
                  if (pressTimer.current !== null) clearTimeout(pressTimer.current);
                }}
                aria-label={
                  `Row ${r + 1} column ${c + 1}, ` +
                  (board[i] ? PIECE_NAME[board[i]] : "empty") +
                  (givens[i] ? ", fixed" : "") +
                  (end ? (end === entry ? ", entrance" : ", exit") : "")
                }
              >
                {board[i] ? GLYPH[board[i]] : ""}
              </button>
            );
          })
        ])}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="The line runs through!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
