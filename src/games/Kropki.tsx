import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 5, hard: 6 };
const HELP =
  "Fill each row and column with 1 up to the grid size, once each. A white " +
  "dot joins two consecutive numbers; a black dot joins a number and its " +
  "double. Crucially, no dot means neither relation holds there.";

type Dot = "white" | "black" | null; // consecutive | double | neither

interface Puzzle {
  h: Dot[]; // between (r,c) and (r,c+1): index r*(n-1)+c
  v: Dot[]; // between (r,c) and (r+1,c): index r*n+c
}

function dotFor(a: number, b: number, rng: () => number): Dot {
  const consec = Math.abs(a - b) === 1;
  const dbl = a === 2 * b || b === 2 * a;
  if (consec && dbl) return rng() < 0.5 ? "white" : "black"; // the 1–2 pair
  if (dbl) return "black";
  if (consec) return "white";
  return null;
}

function generateKropki(seed: string, n: number): Puzzle {
  const sol = generateLatin(`kropki-${seed}`, n);
  const rng = makeRng(`kropki-dots-${seed}`);
  const h: Dot[] = [], v: Dot[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n - 1; c++)
      h.push(dotFor(sol[r * n + c], sol[r * n + c + 1], rng));
  for (let r = 0; r < n - 1; r++)
    for (let c = 0; c < n; c++)
      v.push(dotFor(sol[r * n + c], sol[(r + 1) * n + c], rng));
  return { h, v };
}

/** Does a filled pair fit its dot? White = consecutive, black = double,
 *  no dot = neither (the negative constraint is part of Kropki). */
function pairOk(a: number, b: number, dot: Dot): boolean {
  const consec = Math.abs(a - b) === 1;
  const dbl = a === 2 * b || b === 2 * a;
  if (dot === "white") return consec;
  if (dot === "black") return dbl;
  return !consec && !dbl;
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Kropki({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("kropki", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { h, v } = useMemo(() => generateKropki(seed, n), [seed, n]);
  const [selected, setSelected] = useState<number | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const val = board[i];
      if (val === 0) continue;
      const r = Math.floor(i / n), c = i % n;
      for (let k = 0; k < n; k++) {
        const row = r * n + k, col = k * n + c;
        if (row !== i && board[row] === val) bad.add(i);
        if (col !== i && board[col] === val) bad.add(i);
      }
    }
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1;
        if (board[a] && board[b] && !pairOk(board[a], board[b], h[r * (n - 1) + c])) {
          bad.add(a); bad.add(b);
        }
      }
    for (let r = 0; r < n - 1; r++)
      for (let c = 0; c < n; c++) {
        const a = r * n + c, b = a + n;
        if (board[a] && board[b] && !pairOk(board[a], board[b], v[r * n + c])) {
          bad.add(a); bad.add(b);
        }
      }
    return bad;
  }, [board, h, v, n]);

  useEffect(() => {
    if (!saved.done && board.every((x) => x !== 0) && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("kropki", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: n, rows: n, max: n, selected, setSelected, setCell });

  const G = 2 * n - 1;
  const track = Array(n - 1).fill("1fr 0.3fr").join(" ") + " 1fr";
  const dotChar = (d: Dot) => (d === "black" ? "●" : d === "white" ? "○" : "");

  return (
    <div className="game game-kropki">
      <GameHeader title="Kropki" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        ○ joins consecutive numbers, ● joins a number and its double — and no
        dot means neither.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="futo-grid kropki-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Kropki board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = (gr / 2) * n + gc / 2;
            return (
              <button
                key={k}
                role="gridcell"
                className={[
                  "futo-cell kropki-cell",
                  selected === i ? "selected" : "",
                  conflicts.has(i) ? "conflict" : ""
                ].join(" ")}
                onClick={() => setSelected(i)}
              >
                {board[i] || ""}
              </button>
            );
          }
          if (gr % 2 === 0 && gc % 2 === 1)
            return (
              <span key={k} className="kropki-dot" aria-hidden="true">
                {dotChar(h[(gr / 2) * (n - 1) + (gc - 1) / 2])}
              </span>
            );
          if (gr % 2 === 1 && gc % 2 === 0)
            return (
              <span key={k} className="kropki-dot" aria-hidden="true">
                {dotChar(v[((gr - 1) / 2) * n + gc / 2])}
              </span>
            );
          return <span key={k} />;
        })}
      </div>

      <div className="numpad numpad-5">
        {Array.from({ length: n }, (_, d) => d + 1).map((d) => (
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
          game="kropki"
          won
          message="Every dot satisfied!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
