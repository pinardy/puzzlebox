import { useEffect, useMemo, type CSSProperties } from "react";
import { useGridNav } from "../lib/gridnav";
import { makeRng } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./LightsOut.css";

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

/** The fewest presses that clear `cells`: solve press·A = cells over GF(2)
 *  by elimination, then try every mix of the null space (the 5×5 board
 *  has two free presses) and keep the lightest. */
function solvePresses(cells: boolean[]): number[] {
  const M = N * N;
  const rows = cells.map((on, j) => {
    let mask = 0;
    for (let i = 0; i < M; i++) if (press(Array(M).fill(false), i)[j]) mask |= 1 << i;
    return { mask, rhs: on ? 1 : 0 };
  });
  const pivotOf: number[] = [];
  let r = 0;
  for (let col = 0; col < M && r < M; col++) {
    const p = rows.findIndex((row, k) => k >= r && row.mask & (1 << col));
    if (p === -1) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let k = 0; k < M; k++)
      if (k !== r && rows[k].mask & (1 << col)) {
        rows[k] = { mask: rows[k].mask ^ rows[r].mask, rhs: rows[k].rhs ^ rows[r].rhs };
      }
    pivotOf[r] = col;
    r++;
  }
  const free = [...Array(M).keys()].filter((c) => !pivotOf.includes(c));
  let best: number[] | null = null;
  for (let pick = 0; pick < 1 << free.length; pick++) {
    const x = Array(M).fill(0);
    free.forEach((f, k) => (x[f] = (pick >> k) & 1));
    let ok = true;
    for (let k = 0; k < M; k++) {
      let v = rows[k].rhs;
      for (const f of free) if (rows[k].mask & (1 << f)) v ^= x[f];
      if (k < r) x[pivotOf[k]] = v;
      else if (v) ok = false; // inconsistent row: not solvable this way
    }
    if (!ok) continue;
    const presses = x.flatMap((v, i) => (v ? [i] : []));
    if (!best || presses.length < best.length) best = presses;
  }
  return best ?? [];
}

interface SavedState {
  cells: boolean[];
  moves: number;
  done: boolean;
}

export default function LightsOut({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => ({
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
    commit({ cells, moves: saved.moves + 1, done }, { outcome: done ? "won" : undefined });
  }

  const nav = useGridNav();

  /** Press one light from the shortest solution from here. */
  function hint() {
    if (saved.done) return;
    const presses = solvePresses(saved.cells);
    if (!presses.length) return;
    const idx = presses[Math.floor(Math.random() * presses.length)];
    commitHint({ cells: press(saved.cells, idx), moves: saved.moves + 1, done: false });
  }

  // A hint can switch off the last light; finish the way a tap would.
  const dark = saved.cells.every((c) => !c);
  useEffect(() => {
    if (dark) finish();
  }, [dark, finish]);

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
        onHint={saved.done ? undefined : hint}
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
        {...nav}
      >
        {saved.cells.map((on, i) => (
          <button
            key={i}
            role="gridcell"
            data-cell={i}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, ${on ? "on" : "off"}`}
            aria-pressed={on}
            className={`light${on ? " on" : ""}`}
            onClick={() => tap(i)}
          />
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={
            saved.moves <= scrambles
              ? `Perfect — ${saved.moves} moves!`
              : `Lights out in ${saved.moves} moves`
          }
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
