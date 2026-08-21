import { type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 3, medium: 4, hard: 5 };
const HELP =
  "Slide tiles into the gap until they read left-to-right, top-to-bottom. " +
  "Tapping any tile in the gap's row or column slides the whole run at once.";

/** Scramble from the solved board with random legal blank moves (never
 *  undoing the previous one), so the position is always solvable. */
function scramble(seed: string, n: number): number[] {
  const rng = makeRng(seed);
  const cells = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
  let blank = n * n - 1;
  let prev = -1;
  for (let k = 0; k < n * n * 12; k++) {
    const r = Math.floor(blank / n), c = blank % n;
    const opts = [
      r > 0 ? blank - n : -1,
      r < n - 1 ? blank + n : -1,
      c > 0 ? blank - 1 : -1,
      c < n - 1 ? blank + 1 : -1
    ].filter((i) => i >= 0 && i !== prev);
    const pick = opts[Math.floor(rng() * opts.length)];
    cells[blank] = cells[pick];
    cells[pick] = 0;
    prev = blank;
    blank = pick;
  }
  return cells;
}

interface SavedState {
  cells: number[];
  moves: number;
  done: boolean;
}

export default function Fifteen({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("fifteen", (s, d) => ({
      cells: scramble(`fifteen-${s}`, SIZE[d]),
      moves: 0,
      done: false
    }));
  const n = SIZE[diff];

  function tap(idx: number) {
    if (saved.done || saved.cells[idx] === 0) return;
    const blank = saved.cells.indexOf(0);
    const rI = Math.floor(idx / n), cI = idx % n;
    const rB = Math.floor(blank / n), cB = blank % n;
    if (rI !== rB && cI !== cB) return;

    // Slide the whole segment between the tapped tile and the blank.
    const cells = saved.cells.slice();
    const step = rI === rB ? Math.sign(idx - blank) : Math.sign(idx - blank) * n;
    for (let j = blank; j !== idx; j += step) cells[j] = cells[j + step];
    cells[idx] = 0;

    const done = cells.every((v, i) => v === (i + 1) % (n * n));
    commit({ cells, moves: saved.moves + 1, done });
    if (done) recordResult("fifteen", true);
  }

  return (
    <div className="game game-fifteen">
      <GameHeader title="Fifteen" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Slide tiles into the gap until they read 1–{n * n - 1}.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
      </div>

      <div
        className="fifteen-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Sliding puzzle"
      >
        {saved.cells.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={`fifteen-tile${v === 0 ? " blank" : ""}${
              v !== 0 && v === (i + 1) % (n * n) ? " home" : ""
            }`}
            onClick={() => tap(i)}
          >
            {v || ""}
          </button>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="fifteen"
          won
          message={`Solved in ${saved.moves} moves!`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
