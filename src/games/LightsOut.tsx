import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 5;
const SCRAMBLES = 8;

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
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("lights")?.seed ?? newSeed()
  );
  const initial = useMemo(() => buildBoard(seed, SCRAMBLES), [seed]);

  const [saved, setSaved] = useState<SavedState>(
    () =>
      loadSlot<SavedState>("lights")?.state ?? {
        cells: initial,
        moves: 0,
        done: false
      }
  );
  const [toast, setToast] = useState<string | null>(null);

  function tap(idx: number) {
    if (saved.done) return;
    const cells = press(saved.cells, idx);
    const done = cells.every((c) => !c);
    const next = { cells, moves: saved.moves + 1, done };
    setSaved(next);
    saveSlot("lights", seed, next);
    if (done) {
      recordResult("lights", true);
      setToast(
        next.moves <= SCRAMBLES
          ? `Perfect — ${next.moves} moves!`
          : `Lights out in ${next.moves} moves`
      );
    }
  }

  function reset() {
    const next = { cells: initial, moves: 0, done: false };
    setSaved(next);
    saveSlot("lights", seed, next);
    setToast(null);
  }

  function newPuzzle() {
    const s = newSeed();
    const next = { cells: buildBoard(s, SCRAMBLES), moves: 0, done: false };
    setSeed(s);
    setSaved(next);
    saveSlot("lights", s, next);
    setToast(null);
  }

  return (
    <div className="game game-lights">
      <GameHeader title="Lights Out" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Tapping a light flips it and its neighbours. Turn them all off — a
        perfect solve is {SCRAMBLES} moves.
      </p>

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
        <button className="mini-btn" onClick={reset}>Restart</button>
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
