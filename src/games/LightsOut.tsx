import { useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const N = 5;
const SCRAMBLES: Record<Diff, number> = { easy: 6, medium: 8, hard: 12 };
const HELP =
  "Tapping a light flips it and its four neighbours. Turn every light off. " +
  "The board is scrambled from all-off, so a solution always exists.";

function press(cells: boolean[], idx: number): boolean[] {
  const out = cells.slice();
  const r = Math.floor(idx / N), c = idx % N;
  const flip = (rr: number, cc: number) => {
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) out[rr * N + cc] = !out[rr * N + cc];
  };
  flip(r, c); flip(r - 1, c); flip(r + 1, c); flip(r, c - 1); flip(r, c + 1);
  return out;
}

/** Scramble from the solved (all-off) board, so a solution always exists —
 *  and the minimum solve is at most `scrambles` presses. */
function buildBoard(seed: string, scrambles: number): boolean[] {
  const rng = makeRng(seed);
  let cells: boolean[] = Array(N * N).fill(false);
  const used = new Set<number>();
  while (used.size < scrambles) {
    const idx = Math.floor(rng() * N * N);
    if (used.has(idx)) continue; // pressing twice cancels out — skip repeats
    used.add(idx);
    cells = press(cells, idx);
  }
  return cells;
}

interface SavedState {
  cells: boolean[];
  moves: number;
  done: boolean;
}

export default function LightsOut({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("lights", (s, d) => ({
      cells: buildBoard(`lights-${s}`, SCRAMBLES[d]),
      moves: 0,
      done: false
    }));
  const scrambles = SCRAMBLES[diff];
  const initial = useMemo(() => buildBoard(`lights-${seed}`, scrambles), [seed, scrambles]);

  function tap(idx: number) {
    if (saved.done) return;
    const cells = press(saved.cells, idx);
    const done = cells.every((c) => !c);
    commit({ cells, moves: saved.moves + 1, done });
    if (done) recordResult("lights", true);
  }

  return (
    <div className="game game-lights">
      <GameHeader title="Lights Out" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Turn them all off — a perfect solve is {scrambles} moves.
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
        <button
          className="mini-btn"
          onClick={() => commit({ cells: initial, moves: 0, done: false })}
        >
          Restart
        </button>
      </div>

      <div
        className="lights-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Lights grid"
      >
        {saved.cells.map((on, i) => (
          <button
            key={i}
            role="gridcell"
            aria-pressed={on}
            className={`light${on ? " on" : ""}`}
            onClick={() => tap(i)}
          />
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="lights"
          won
          message={
            saved.moves <= scrambles
              ? `Perfect — ${saved.moves} moves!`
              : `Lights out in ${saved.moves} moves`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
