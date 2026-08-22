import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 8 };
const REVEAL: Record<Diff, number> = { easy: 0.55, medium: 0.48, hard: 0.42 };
const HELP =
  "Divide the grid into groups: every group of touching equal numbers " +
  "must contain exactly that many cells — three 3s together, a lone 1, " +
  "and so on. Two finished groups of the same size can never touch. Any " +
  "grid where every group's size matches its number wins.";

interface Puzzle {
  givens: number[]; // 0 = player cell
  solution: number[];
}

/** Sizes of every maximal orthogonally-connected same-value group. */
function groups(values: number[], n: number): { id: number[]; size: number[] } {
  const id = Array(n * n).fill(-1);
  const size: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (id[i] !== -1 || values[i] === 0) continue;
    const g = size.length;
    const stack = [i];
    id[i] = g;
    let count = 0;
    while (stack.length) {
      const j = stack.pop()!;
      count++;
      const r = Math.floor(j / n), c = j % n;
      for (const k of [
        r > 0 ? j - n : -1,
        r < n - 1 ? j + n : -1,
        c > 0 ? j - 1 : -1,
        c < n - 1 ? j + 1 : -1
      ])
        if (k !== -1 && id[k] === -1 && values[k] === values[j]) {
          id[k] = g;
          stack.push(k);
        }
    }
    size.push(count);
  }
  return { id, size };
}

/** Partition the grid into polyominoes of size 1–5, then merge any two
 *  touching regions that ended up the same size (their numbers would fuse
 *  into one oversized group). Restart when a merge grows past 9. */
function generateFillomino(seed: string, n: number, reveal: number): Puzzle {
  const rng = makeRng(seed);

  attempt: for (;;) {
    const regionOf = Array(n * n).fill(-1);
    const regions: number[][] = [];
    for (const start of shuffled([...Array(n * n).keys()], rng)) {
      if (regionOf[start] !== -1) continue;
      const id = regions.length;
      const cells = [start];
      regionOf[start] = id;
      const want = 1 + Math.floor(rng() * 5); // 1–5
      while (cells.length < want) {
        const frontier = cells.flatMap((i) => {
          const r = Math.floor(i / n), c = i % n;
          const out: number[] = [];
          if (r > 0 && regionOf[i - n] === -1) out.push(i - n);
          if (r < n - 1 && regionOf[i + n] === -1) out.push(i + n);
          if (c > 0 && regionOf[i - 1] === -1) out.push(i - 1);
          if (c < n - 1 && regionOf[i + 1] === -1) out.push(i + 1);
          return out;
        });
        if (!frontier.length) break;
        const pick = frontier[Math.floor(rng() * frontier.length)];
        regionOf[pick] = id;
        cells.push(pick);
      }
      regions.push(cells);
    }

    // Merge equal-sized neighbours until stable.
    for (;;) {
      let merged = false;
      outer: for (let i = 0; i < n * n; i++) {
        const r = Math.floor(i / n), c = i % n;
        for (const j of [r < n - 1 ? i + n : -1, c < n - 1 ? i + 1 : -1]) {
          if (j === -1) continue;
          const a = regionOf[i], b = regionOf[j];
          if (a === b || regions[a].length !== regions[b].length) continue;
          if (regions[a].length + regions[b].length > 9) continue attempt;
          for (const cell of regions[b]) regionOf[cell] = a;
          regions[a] = [...regions[a], ...regions[b]];
          regions[b] = [];
          merged = true;
          break outer;
        }
      }
      if (!merged) break;
    }

    const solution = regionOf.map((id) => regions[id].length);

    // Reveal at least one cell per region, then top up at random.
    const givens = Array(n * n).fill(0);
    for (const cells of regions) {
      if (!cells.length) continue;
      const pick = cells[Math.floor(rng() * cells.length)];
      givens[pick] = solution[pick];
    }
    let shown = givens.filter((v) => v !== 0).length;
    for (const i of shuffled([...Array(n * n).keys()], rng)) {
      if (shown >= Math.round(n * n * reveal)) break;
      if (givens[i] === 0) {
        givens[i] = solution[i];
        shown++;
      }
    }
    return { givens, solution };
  }
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Fillomino({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("fillomino", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { givens, solution } = useMemo(
    () => generateFillomino(`fillomino-${seed}`, n, REVEAL[diff]),
    [seed, n, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  /** A group is broken when it's already bigger than its number, or is
   *  sealed off (no empty neighbours) at the wrong size. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    const { id, size } = groups(board, n);
    const sealed = Array(size.length).fill(true);
    for (let i = 0; i < n * n; i++) {
      if (board[i] !== 0) continue;
      const r = Math.floor(i / n), c = i % n;
      for (const j of [
        r > 0 ? i - n : -1,
        r < n - 1 ? i + n : -1,
        c > 0 ? i - 1 : -1,
        c < n - 1 ? i + 1 : -1
      ])
        if (j !== -1 && board[j] !== 0) sealed[id[j]] = false;
    }
    for (let i = 0; i < n * n; i++) {
      if (board[i] === 0) continue;
      const g = id[i];
      if (size[g] > board[i] || (sealed[g] && size[g] !== board[i])) bad.add(i);
    }
    return bad;
  }, [board, n]);

  useEffect(() => {
    if (saved.done || board.some((v) => v === 0)) return;
    const { id, size } = groups(board, n);
    if (board.every((v, i) => size[id[i]] === v)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("fillomino", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
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
    entries[idx] = solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: n, rows: n, max: 9, selected, setSelected, setCell });

  return (
    <div className="game game-fillomino">
      <GameHeader title="Fillomino" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Every group of touching equal numbers must be exactly that many cells.
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
        className="kenken-grid fillo-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Fillomino board"
      >
        {board.map((v, i) => {
          const r = Math.floor(i / n), c = i % n;
          const given = givens[i] !== 0;
          // Draw borders between different filled numbers, so completed
          // regions read at a glance.
          const edgeT = r > 0 && v !== 0 && board[i - n] !== 0 && board[i - n] !== v;
          const edgeL = c > 0 && v !== 0 && board[i - 1] !== 0 && board[i - 1] !== v;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kenken-cell fillo-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : "",
                edgeT ? "cage-t" : "",
                edgeL ? "cage-l" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              <span className="kenken-val">{v || ""}</span>
            </button>
          );
        })}
      </div>

      <div className="numpad numpad-9">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            className="num-key"
            onClick={() => selected !== null && setCell(selected, d)}
          >
            {d}
          </button>
        ))}
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="fillomino"
          won
          message="Every group fits!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
