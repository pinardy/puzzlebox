import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

// A full double-N set tiles a (N+1) × (N+2) grid exactly.
const MAX_PIP: Record<Diff, number> = { easy: 4, medium: 5, hard: 6 };
const HELP =
  "The grid is a scattered set of dominoes — every pair from 0-0 up to the " +
  "maximum appears exactly once, but the borders are hidden. Re-draw them: " +
  "tap two adjacent numbers to join them into a domino, tap a domino to " +
  "split it. The tray below tracks which pairs you've placed.";

interface Puzzle {
  rows: number;
  cols: number;
  values: number[];
  maxPip: number;
}

/** Tile the grid with dominoes by randomized backtracking, then deal the
 *  full pair set onto the tiles. Solvable by construction. */
function generateDominoes(seed: string, maxPip: number): Puzzle {
  const rows = maxPip + 1, cols = maxPip + 2;
  const rng = makeRng(seed);
  const total = rows * cols;

  const owner = Array(total).fill(-1);
  const tiles: [number, number][] = [];
  const fill = (): boolean => {
    const at = owner.indexOf(-1);
    if (at === -1) return true;
    const r = Math.floor(at / cols), c = at % cols;
    const options: number[] = [];
    if (c < cols - 1 && owner[at + 1] === -1) options.push(at + 1);
    if (r < rows - 1 && owner[at + cols] === -1) options.push(at + cols);
    for (const other of shuffled(options, rng)) {
      owner[at] = owner[other] = tiles.length;
      tiles.push([at, other]);
      if (fill()) return true;
      tiles.pop();
      owner[at] = owner[other] = -1;
    }
    return false;
  };
  fill();

  const pairs: [number, number][] = [];
  for (let a = 0; a <= maxPip; a++)
    for (let b = a; b <= maxPip; b++) pairs.push([a, b]);
  const dealt = shuffled(pairs, rng);
  const values = Array(total).fill(0);
  tiles.forEach(([a, b], k) => {
    const [x, y] = dealt[k];
    if (rng() < 0.5) { values[a] = x; values[b] = y; }
    else { values[a] = y; values[b] = x; }
  });
  return { rows, cols, values, maxPip };
}

type Placed = [number, number]; // two adjacent cell indices

interface SavedState {
  placed: Placed[];
  done: boolean;
}

export default function Dominoes({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("dominoes", () => ({ placed: [], done: false }));
  const maxPip = MAX_PIP[diff];
  const puzzle = useMemo(
    () => generateDominoes(`dominoes-${seed}`, maxPip),
    [seed, maxPip]
  );
  const { rows, cols, values } = puzzle;
  const [anchor, setAnchor] = useState<number | null>(null);

  /** cell → placed-domino index */
  const placedAt = useMemo(() => {
    const map = new Map<number, number>();
    saved.placed.forEach(([a, b], k) => { map.set(a, k); map.set(b, k); });
    return map;
  }, [saved.placed]);

  /** "lo-hi" → how many placed dominoes show that pair */
  const pairCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const [a, b] of saved.placed) {
      const key = [values[a], values[b]].sort((x, y) => x - y).join("-");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [saved.placed, values]);

  const allPairs = useMemo(() => {
    const out: string[] = [];
    for (let a = 0; a <= maxPip; a++)
      for (let b = a; b <= maxPip; b++) out.push(`${a}-${b}`);
    return out;
  }, [maxPip]);

  useEffect(() => {
    if (saved.done) return;
    const covered = placedAt.size === rows * cols;
    const exact = allPairs.every((k) => pairCounts.get(k) === 1);
    if (covered && exact) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("dominoes", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedAt, pairCounts, allPairs, saved, rows, cols]);

  function adjacent(a: number, b: number): boolean {
    const ra = Math.floor(a / cols), ca = a % cols;
    const rb = Math.floor(b / cols), cb = b % cols;
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
  }

  function tap(i: number) {
    if (saved.done) return;
    const at = placedAt.get(i);
    if (anchor === null) {
      if (at !== undefined) {
        commit({ ...saved, placed: saved.placed.filter((_, k) => k !== at) });
        return;
      }
      setAnchor(i);
      return;
    }
    if (anchor === i) { setAnchor(null); return; }
    setAnchor(null);
    if (at !== undefined || !adjacent(anchor, i)) return;
    commit({ ...saved, placed: [...saved.placed, [anchor, i]] });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setAnchor(null);
  }

  return (
    <div className="game game-dominoes">
      <GameHeader title="Dominoes" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap two adjacent numbers to pair them; each domino appears exactly
        once.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="dom-grid"
        style={{ "--cols": cols, "--rows": rows } as CSSProperties}
        role="grid"
        aria-label="Dominoes board"
      >
        {values.map((v, i) => {
          const k = placedAt.get(i);
          const mate =
            k !== undefined
              ? saved.placed[k][0] === i ? saved.placed[k][1] : saved.placed[k][0]
              : null;
          const key =
            k !== undefined
              ? [values[saved.placed[k][0]], values[saved.placed[k][1]]]
                  .sort((x, y) => x - y)
                  .join("-")
              : "";
          const dup = k !== undefined && (pairCounts.get(key) ?? 0) > 1;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "dom-cell",
                k !== undefined ? "paired" : "",
                dup ? "conflict" : "",
                anchor === i ? "anchor" : "",
                mate === i + 1 ? "join-r" : "",
                mate === i - 1 ? "join-l" : "",
                mate === i + cols ? "join-d" : "",
                mate === i - cols ? "join-u" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="ws-words dom-tray">
        {allPairs.map((k) => {
          const count = pairCounts.get(k) ?? 0;
          return (
            <span
              key={k}
              className={`ws-word${count === 1 ? " found" : ""}${count > 1 ? " dup" : ""}`}
            >
              {k}
            </span>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="dominoes"
          won
          message="A perfect set!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
