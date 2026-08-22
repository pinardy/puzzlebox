import { useEffect, useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 10, medium: 12, hard: 14 };
const COLORS: Record<Diff, number> = { easy: 5, medium: 6, hard: 6 };
const SLACK: Record<Diff, number> = { easy: 4, medium: 2, hard: 1 };
const HELP =
  "The patch in the top-left corner is yours. Pick a colour and the patch " +
  "repaints itself, swallowing any touching squares of that colour. Swallow " +
  "the whole board before the moves run out. The budget is set from a " +
  "greedy solve, so it can always be done — usually with room to spare.";

/** Cells reachable from the corner through one unbroken colour. */
function region(cells: number[], n: number): number[] {
  const color = cells[0];
  const seen = new Uint8Array(n * n);
  seen[0] = 1;
  const out = [0];
  const stack = [0];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n), c = i % n;
    for (const k of [
      r > 0 ? i - n : -1,
      r < n - 1 ? i + n : -1,
      c > 0 ? i - 1 : -1,
      c < n - 1 ? i + 1 : -1
    ])
      if (k !== -1 && !seen[k] && cells[k] === color) {
        seen[k] = 1;
        out.push(k);
        stack.push(k);
      }
  }
  return out;
}

function flood(cells: number[], n: number, color: number): number[] {
  const next = cells.slice();
  for (const i of region(cells, n)) next[i] = color;
  return next;
}

/** Always take the colour that swallows the most — a decent strategy, and
 *  the yardstick the move budget is set from. */
function greedyMoves(start: number[], n: number, colors: number): number {
  let cells = start.slice();
  let moves = 0;
  while (region(cells, n).length < n * n && moves < n * n * 2) {
    let best = -1;
    let bestGain = -1;
    for (let c = 0; c < colors; c++) {
      if (c === cells[0]) continue;
      const gain = region(flood(cells, n, c), n).length;
      if (gain > bestGain) {
        bestGain = gain;
        best = c;
      }
    }
    cells = flood(cells, n, best);
    moves++;
  }
  return moves;
}

interface SavedState {
  cells: number[];
  moves: number;
  budget: number;
  done: boolean;
  won: boolean;
}

function deal(seed: string, diff: Diff): SavedState {
  const n = SIZE[diff];
  const colors = COLORS[diff];
  const rng = makeRng(`flood-${seed}`);
  const cells = Array.from({ length: n * n }, () => Math.floor(rng() * colors));
  return {
    cells,
    moves: 0,
    budget: greedyMoves(cells, n, colors) + SLACK[diff],
    done: false,
    won: false
  };
}

export default function FloodIt({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("flood", (s, d) => deal(s, d));
  const n = SIZE[diff];
  const colors = COLORS[diff];

  const owned = useMemo(() => new Set(region(saved.cells, n)), [saved.cells, n]);

  useEffect(() => {
    if (saved.done) return;
    if (owned.size === n * n) {
      commit({ ...saved, done: true, won: true }, { undoable: false });
      recordResult("flood", true);
    } else if (saved.moves >= saved.budget) {
      commit({ ...saved, done: true, won: false }, { undoable: false });
      recordResult("flood", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned, saved]);

  function pick(color: number) {
    if (saved.done || color === saved.cells[0]) return;
    commit({
      ...saved,
      cells: flood(saved.cells, n, color),
      moves: saved.moves + 1
    });
  }

  const left = saved.budget - saved.moves;

  return (
    <div className="game game-flood">
      <GameHeader title="Flood It" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Repaint the corner patch until it swallows the board.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="fl-status">
        <span>
          {owned.size}/{n * n} squares
        </span>
        <span>
          <b>{left}</b> move{left === 1 ? "" : "s"} left
        </span>
      </div>

      <div
        className="fl-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Flood It board"
      >
        {saved.cells.map((c, i) => (
          <span
            key={i}
            className={`fl-cell fl-c${c}${owned.has(i) ? " owned" : ""}`}
          />
        ))}
      </div>

      <div className="fl-palette" role="group" aria-label="Colours">
        {Array.from({ length: colors }, (_, c) => (
          <button
            key={c}
            className={`fl-pick fl-c${c}${c === saved.cells[0] ? " current" : ""}`}
            onClick={() => pick(c)}
            disabled={saved.done || c === saved.cells[0]}
            aria-label={`Colour ${c + 1}`}
          />
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="flood"
          won={saved.won}
          message={
            saved.won
              ? `Whole board in ${saved.moves} moves!`
              : `Out of moves — ${n * n - owned.size} squares short`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
