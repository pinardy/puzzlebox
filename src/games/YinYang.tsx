import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const REVEAL: Record<Diff, number> = { easy: 0.4, medium: 0.32, hard: 0.26 };
const HELP =
  "Fill every cell with a white or black circle. Each colour must form " +
  "one connected group (sides touching), and no 2×2 square may be all one " +
  "colour. Tap cycles white → black → empty. Any valid fill wins.";

type Cell = 0 | 1 | 2; // empty | white | black

function nbrs(i: number, n: number): number[] {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/** Every 2×2 block that is entirely one (nonzero) colour. */
function blocks2x2(cells: Cell[], n: number): Set<number> {
  const bad = new Set<number>();
  for (let r = 0; r + 1 < n; r++)
    for (let c = 0; c + 1 < n; c++) {
      const q = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
      const v = cells[q[0]];
      if (v !== 0 && q.every((i) => cells[i] === v)) q.forEach((i) => bad.add(i));
    }
  return bad;
}

function connected(cells: Cell[], n: number, col: Cell): boolean {
  let start = -1, count = 0;
  for (let i = 0; i < n * n; i++)
    if (cells[i] === col) {
      count++;
      if (start < 0) start = i;
    }
  if (count === 0) return false;
  const seen = Array(n * n).fill(false);
  const stack = [start];
  seen[start] = true;
  let reach = 1;
  while (stack.length) {
    const j = stack.pop()!;
    for (const k of nbrs(j, n))
      if (!seen[k] && cells[k] === col) {
        seen[k] = true;
        reach++;
        stack.push(k);
      }
  }
  return reach === count;
}

/** Grow the black region as a tree polyomino — every added cell touches
 *  exactly one black cell, so black stays cycle-free (a 2×2 is a 4-cycle,
 *  so it can never form one) — while white must stay connected. Growth
 *  chases white's remaining 2×2 blocks until none are left. */
function generateYinYang(seed: string, n: number, reveal: number): Cell[] {
  const rng = makeRng(seed);
  const total = n * n;

  const attemptOnce = (): Cell[] | null => {
    const black = Array(total).fill(false);
    const whiteConnectedWithout = (extra: number): boolean => {
      let start = -1, count = 0;
      for (let i = 0; i < total; i++)
        if (!black[i] && i !== extra) {
          count++;
          if (start < 0) start = i;
        }
      if (count === 0) return false;
      const seen = Array(total).fill(false);
      const stack = [start];
      seen[start] = true;
      let reach = 1;
      while (stack.length) {
        const j = stack.pop()!;
        for (const k of nbrs(j, n))
          if (!seen[k] && !black[k] && k !== extra) {
            seen[k] = true;
            reach++;
            stack.push(k);
          }
      }
      return reach === count;
    };
    const white2x2sAt = (i: number): number => {
      const r = Math.floor(i / n), c = i % n;
      let count = 0;
      for (let dr = -1; dr <= 0; dr++)
        for (let dc = -1; dc <= 0; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr + 1 >= n || cc + 1 >= n) continue;
          const q = [rr * n + cc, rr * n + cc + 1, (rr + 1) * n + cc, (rr + 1) * n + cc + 1];
          if (q.every((j) => !black[j])) count++;
        }
      return count;
    };
    const anyWhite2x2 = (): boolean => {
      for (let r = 0; r + 1 < n; r++)
        for (let c = 0; c + 1 < n; c++)
          if (
            !black[r * n + c] && !black[r * n + c + 1] &&
            !black[(r + 1) * n + c] && !black[(r + 1) * n + c + 1]
          )
            return true;
      return false;
    };

    black[Math.floor(rng() * total)] = true;
    let guard = total * 2;
    while (anyWhite2x2() && guard-- > 0) {
      const cands: { i: number; w: number }[] = [];
      for (let i = 0; i < total; i++) {
        if (black[i]) continue;
        if (nbrs(i, n).filter((j) => black[j]).length !== 1) continue;
        const w = white2x2sAt(i);
        if (w === 0 && rng() < 0.7) continue; // mostly chase the 2×2s
        cands.push({ i, w: w * 3 + 1 });
      }
      let placed = false;
      let sum = cands.reduce((a, c) => a + c.w, 0);
      while (cands.length) {
        let roll = rng() * sum, idx = 0;
        for (let k = 0; k < cands.length; k++) {
          roll -= cands[k].w;
          if (roll <= 0) {
            idx = k;
            break;
          }
        }
        if (whiteConnectedWithout(cands[idx].i)) {
          black[cands[idx].i] = true;
          placed = true;
          break;
        }
        sum -= cands[idx].w;
        cands.splice(idx, 1);
      }
      if (!placed) return null;
    }
    if (guard <= 0) return null;
    return black.map((b) => (b ? 2 : 1)) as Cell[];
  };

  for (;;) {
    const solution = attemptOnce();
    if (!solution) continue;
    const givens = Array(total).fill(0) as Cell[];
    const order = shuffled([...Array(total).keys()], rng);
    for (const i of order.slice(0, Math.round(total * reveal))) givens[i] = solution[i];
    // Guarantee both colours appear among the givens.
    if (!givens.includes(1)) givens[order.find((i) => solution[i] === 1)!] = 1;
    if (!givens.includes(2)) givens[order.find((i) => solution[i] === 2)!] = 2;
    return givens;
  }
}

interface SavedState {
  cells: Cell[]; // player marks on non-given cells
  done: boolean;
}

export default function YinYang({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("yinyang", (_s, d) => ({
      cells: Array(SIZE[d] * SIZE[d]).fill(0) as Cell[],
      done: false
    }));
  const n = SIZE[diff];
  const givens = useMemo(
    () => generateYinYang(`yinyang-${seed}`, n, REVEAL[diff]),
    [seed, n, diff]
  );
  const [flash, setFlash] = useState(false);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.cells[i])) as Cell[],
    [givens, saved.cells]
  );

  const conflicts = useMemo(() => blocks2x2(board, n), [board, n]);

  useEffect(() => {
    if (saved.done || board.some((v) => v === 0) || conflicts.size > 0) return;
    if (connected(board, n, 1) && connected(board, n, 2)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("yinyang", true);
      setFlash(false);
    } else {
      setFlash(true); // full board, no 2×2, but a colour is split
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, saved]);

  function tap(i: number) {
    if (saved.done || givens[i] !== 0) return;
    const cells = saved.cells.slice() as Cell[];
    cells[i] = ((cells[i] + 1) % 3) as Cell;
    setFlash(false);
    commit({ ...saved, cells });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setFlash(false);
  }

  return (
    <div className="game game-yinyang">
      <GameHeader title="Yin-Yang" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        One connected white group, one connected black group, no 2×2 of
        either.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="yy-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Yin-yang board"
      >
        {board.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "yy-cell",
              givens[i] !== 0 ? "given" : "",
              conflicts.has(i) ? "conflict" : ""
            ].join(" ")}
            onClick={() => tap(i)}
            aria-label={`Cell ${Math.floor(i / n) + 1},${(i % n) + 1}`}
          >
            {v === 1 ? "○" : v === 2 ? "●" : ""}
          </button>
        ))}
      </div>

      {flash && !saved.done && (
        <p className="game-help">
          Almost — every square is filled with no 2×2 blocks, but one of the
          colours is split into separate groups.
        </p>
      )}

      {saved.done && (
        <Result
          key={seed}
          game="yinyang"
          won
          message="Perfect balance!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
