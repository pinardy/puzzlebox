import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  generateSlant,
  cornerDegrees,
  loopCells,
  slantSolved,
  EMPTY,
  FWD,
  BACK
} from "../lib/slant";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 7, hard: 9 };
const REVEAL: Record<Diff, number> = { easy: 0.62, medium: 0.45, hard: 0.32 };
const HELP =
  "Draw a diagonal in every square, either / or \\. The circled numbers sit " +
  "on the grid's corner points and count the diagonals that touch that " +
  "point exactly. The finished diagonals must never close a loop. Tap a " +
  "square to cycle blank → / → \\, and long-press (or right-click) to cycle " +
  "back. A circle fills in when its count is met and turns into a red " +
  "square when too many diagonals meet it.";

interface SavedState {
  cells: number[]; // 0 blank, 1 "/", 2 "\"
  done: boolean;
}

export default function Slant({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      cells: Array(SIZE[d] * SIZE[d]).fill(EMPTY),
      done: false
    }));
  const n = SIZE[diff];
  const { solution, clues } = useMemo(
    () => generateSlant(`slant-${seed}`, n, REVEAL[diff]),
    [seed, n, diff]
  );
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const degrees = useMemo(() => cornerDegrees(saved.cells, n), [saved.cells, n]);
  const loops = useMemo(() => loopCells(saved.cells, n), [saved.cells, n]);

  const solved = useMemo(
    () => slantSolved(saved.cells, clues, n),
    [saved.cells, clues, n]
  );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function cycle(i: number, back: boolean) {
    if (saved.done) return;
    const cells = saved.cells.slice();
    cells[i] = (cells[i] + (back ? 2 : 1)) % 3;
    commit({ ...saved, cells });
  }

  function hint() {
    const wrong = [...Array(n * n).keys()].filter(
      (i) => saved.cells[i] !== solution[i]
    );
    if (!wrong.length) return;
    const cells = saved.cells.slice();
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    cells[i] = solution[i];
    commitHint({ ...saved, cells });
  }

  const filled = saved.cells.filter((v) => v !== EMPTY).length;
  const shown = clues.filter((k) => k !== -1).length;
  const met = clues.filter((k, p) => k !== -1 && k === degrees[p]).length;

  return (
    <div className="game game-slant">
      <GameHeader title="Slant" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Fill every square with / or \ — match the corner counts, close no loops.
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
          {filled}/{n * n} drawn · {met}/{shown} corners done
          {loops.size > 0 && " · ⟲ loop!"}
        </span>
      </div>

      <div className="sl-wrap" style={{ "--n": n } as CSSProperties}>
        <div className="sl-grid" role="grid" aria-label="Slant board">
          {saved.cells.map((v, i) => {
            const r = Math.floor(i / n), c = i % n;
            const glyph =
              v === FWD ? "forward slash" : v === BACK ? "backslash" : "blank";
            return (
              <button
                key={i}
                role="gridcell"
                className={[
                  "sl-cell",
                  v === FWD ? "fwd" : v === BACK ? "back" : "",
                  loops.has(i) ? "loop" : ""
                ].join(" ")}
                aria-label={`Row ${r + 1} column ${c + 1}, ${glyph}`}
                onClick={() => {
                  if (!longPressed.current) cycle(i, false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  cycle(i, true);
                }}
                onPointerDown={() => {
                  longPressed.current = false;
                  pressTimer.current = window.setTimeout(() => {
                    longPressed.current = true;
                    cycle(i, true);
                  }, 420);
                }}
                onPointerUp={() => {
                  if (pressTimer.current !== null) clearTimeout(pressTimer.current);
                }}
                onPointerLeave={() => {
                  if (pressTimer.current !== null) clearTimeout(pressTimer.current);
                }}
              />
            );
          })}
        </div>
        {/* Clues sit on the lattice points, not in the cells, so they ride
            in an overlay inset by the grid's own border. */}
        <div className="sl-clues">
          {clues.map((k, p) => {
            if (k === -1) return null;
            const r = Math.floor(p / (n + 1)), c = p % (n + 1);
            const over = degrees[p] > k, done = degrees[p] === k;
            const note = over ? "too many" : done ? "done" : `${degrees[p]} so far`;
            return (
              <span
                key={p}
                role="img"
                className={`sl-clue ${over ? "over" : done ? "met" : ""}`}
                style={
                  {
                    left: `${(c / n) * 100}%`,
                    top: `${(r / n) * 100}%`
                  } as CSSProperties
                }
                aria-label={
                  `Corner row ${r + 1} column ${c + 1}: ` +
                  `${k} diagonals, ${note}`
                }
              >
                {k}
              </span>
            );
          })}
        </div>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every corner counted!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
