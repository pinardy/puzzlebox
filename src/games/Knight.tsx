import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 8 };
const HELP =
  "Move the knight — two squares one way and one the other — so it lands " +
  "on every square exactly once. Legal destinations are outlined; tap one " +
  "to hop. Undo freely: a knight's tour is mostly about not stranding " +
  "yourself in a corner.";

const JUMPS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2]
];

function movesFrom(i: number, n: number): number[] {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  for (const [dr, dc] of JUMPS) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
  }
  return out;
}

/** Finish the tour from here, trying the most constrained square first
 *  (Warnsdorff). Used both to pick a fair starting square and to power
 *  the hint. */
function completeTour(visited: boolean[], cur: number, left: number, n: number): number[] | null {
  let nodes = 0;
  const path: number[] = [];
  const walk = (at: number, remaining: number): boolean => {
    if (remaining === 0) return true;
    if (++nodes > 200000) return false;
    const opts = movesFrom(at, n)
      .filter((j) => !visited[j])
      .map((j) => ({
        j,
        deg: movesFrom(j, n).filter((k) => !visited[k]).length
      }))
      .sort((a, b) => a.deg - b.deg);
    for (const { j } of opts) {
      visited[j] = true;
      path.push(j);
      if (walk(j, remaining - 1)) return true;
      path.pop();
      visited[j] = false;
    }
    return false;
  };
  return walk(cur, left) ? path : null;
}

function startSquare(seed: string, n: number): number {
  const rng = makeRng(`knight-${seed}`);
  for (const s of shuffled([...Array(n * n).keys()], rng)) {
    const visited = Array(n * n).fill(false);
    visited[s] = true;
    if (completeTour(visited, s, n * n - 1, n)) return s;
  }
  return 0;
}

interface SavedState {
  path: number[];
  done: boolean;
}

export default function Knight({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("knight", (s, d) => ({
      path: [startSquare(s, SIZE[d])],
      done: false
    }));
  const n = SIZE[diff];
  const [suggested, setSuggested] = useState<number | null>(null);

  const visited = useMemo(() => {
    const v = Array(n * n).fill(false);
    for (const c of saved.path) v[c] = true;
    return v;
  }, [saved.path, n]);

  const cur = saved.path[saved.path.length - 1];
  const legal = useMemo(
    () => new Set(movesFrom(cur, n).filter((j) => !visited[j])),
    [cur, visited, n]
  );

  function hop(i: number) {
    if (saved.done || !legal.has(i)) return;
    const path = [...saved.path, i];
    const done = path.length === n * n;
    setSuggested(null);
    commit({ path, done });
    if (done) recordResult("knight", true);
  }

  /** Point at a square that still leaves the tour finishable — searched
   *  on demand, since completing a tour is far too costly per render. */
  function hint() {
    const rest = completeTour(visited.slice(), cur, n * n - saved.path.length, n);
    if (!rest || !rest.length) return;
    setSuggested(rest[0]);
    commitHint({ ...saved });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSuggested(null);
  }

  return (
    <div className="game game-knight">
      <GameHeader title="Knight's Tour" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        {saved.path.length}/{n * n} squares.
        {!saved.done && legal.size === 0 && " No moves left — undo to back up."}
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
        className="kt-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Knight's tour board"
      >
        {Array.from({ length: n * n }, (_, i) => {
          const order = saved.path.indexOf(i);
          const dark = (Math.floor(i / n) + (i % n)) % 2 === 1;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kt-cell",
                dark ? "dark" : "",
                order !== -1 ? "seen" : "",
                i === cur ? "here" : "",
                legal.has(i) ? "legal" : "",
                suggested === i ? "suggested" : ""
              ].join(" ")}
              onClick={() => hop(i)}
              aria-label={`Square ${Math.floor(i / n) + 1},${(i % n) + 1}`}
            >
              {i === cur ? "♞" : order !== -1 ? order + 1 : ""}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="knight"
          won
          message={`Every square in ${n * n} hops!`}
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
