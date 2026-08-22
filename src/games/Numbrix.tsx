import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { hamiltonianPath } from "../lib/zip";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const REVEAL: Record<Diff, number> = { easy: 0.45, medium: 0.34, hard: 0.26 };
const HELP =
  "Fill the grid with every number from 1 to the last one so that " +
  "consecutive numbers always sit side by side — up, down, left or " +
  "right, never diagonally. Tap a square, then a number from the tray; " +
  "tap a number you placed to take it back.";

interface Puzzle {
  givens: number[]; // 0 = player cell
  solution: number[];
}

/** The solution is a snake through every square — exactly what the Zip
 *  generator already builds — numbered along its length. */
function generateNumbrix(seed: string, n: number, reveal: number): Puzzle {
  const rng = makeRng(seed);
  const path = hamiltonianPath(n, rng);
  const solution = Array(n * n).fill(0);
  path.forEach((cell, k) => (solution[cell] = k + 1));

  const givens = Array(n * n).fill(0);
  // The two ends anchor the snake, so they are always shown.
  givens[path[0]] = 1;
  givens[path[path.length - 1]] = n * n;
  const rest = shuffled(
    [...Array(n * n).keys()].filter((i) => givens[i] === 0),
    rng
  );
  for (const i of rest.slice(0, Math.round(n * n * reveal))) givens[i] = solution[i];
  return { givens, solution };
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Numbrix({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("numbrix", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { givens, solution } = useMemo(
    () => generateNumbrix(`numbrix-${seed}`, n, REVEAL[diff]),
    [seed, n, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  const placed = useMemo(() => new Set(board.filter((v) => v !== 0)), [board]);
  const cellOf = useMemo(() => {
    const m = new Map<number, number>();
    board.forEach((v, i) => {
      if (v !== 0) m.set(v, i);
    });
    return m;
  }, [board]);

  /** A number is wrong when it sits twice on the board, or when its
   *  neighbour in the sequence is placed somewhere non-adjacent. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    const seen = new Map<number, number>();
    board.forEach((v, i) => {
      if (v === 0) return;
      if (seen.has(v)) {
        bad.add(i);
        bad.add(seen.get(v)!);
      } else seen.set(v, i);
    });
    for (const [v, i] of cellOf) {
      const j = cellOf.get(v + 1);
      if (j === undefined) continue;
      const dr = Math.abs(Math.floor(i / n) - Math.floor(j / n));
      const dc = Math.abs((i % n) - (j % n));
      if (dr + dc !== 1) {
        bad.add(i);
        bad.add(j);
      }
    }
    return bad;
  }, [board, cellOf, n]);

  useEffect(() => {
    if (!saved.done && board.every((v) => v !== 0) && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("numbrix", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, saved]);

  function place(value: number) {
    if (saved.done || selected === null || givens[selected] !== 0) return;
    const entries = saved.entries.slice();
    // Each number appears once, so placing it lifts it from anywhere else.
    for (let i = 0; i < n * n; i++) if (entries[i] === value) entries[i] = 0;
    entries[selected] = value;
    commit({ ...saved, entries });
  }

  function clear(i: number) {
    if (saved.done || givens[i] !== 0 || saved.entries[i] === 0) return;
    const entries = saved.entries.slice();
    entries[i] = 0;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) => givens[i] === 0 && board[i] !== solution[i];
    const cands = [...Array(n * n).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    for (let i = 0; i < n * n; i++)
      if (entries[i] === solution[idx]) entries[i] = 0;
    entries[idx] = solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  const tray = [...Array(n * n).keys()]
    .map((k) => k + 1)
    .filter((v) => !placed.has(v));

  return (
    <div className="game game-numbrix">
      <GameHeader title="Numbrix" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Lay 1 to {n * n} in one unbroken chain — neighbours touch edge to edge.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="nx-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Numbrix board"
      >
        {board.map((v, i) => {
          const given = givens[i] !== 0;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "nx-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : ""
              ].join(" ")}
              onClick={() => {
                if (!given && saved.entries[i] !== 0 && selected === i) clear(i);
                else setSelected(i);
              }}
            >
              {v || ""}
            </button>
          );
        })}
      </div>

      <div className="nx-tray" role="group" aria-label="Numbers left to place">
        {tray.length === 0 ? (
          <span className="nx-empty">Every number is on the board.</span>
        ) : (
          tray.map((v) => (
            <button
              key={v}
              className="nx-chip"
              disabled={selected === null || givens[selected] !== 0}
              onClick={() => place(v)}
            >
              {v}
            </button>
          ))
        )}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="numbrix"
          won
          message="One unbroken chain!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
