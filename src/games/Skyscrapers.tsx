import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateLatin } from "../lib/latin";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 5, hard: 6 };
const HELP =
  "Every cell holds a tower, heights 1 up to the grid size, each height " +
  "once per row and column. An edge clue counts how many towers are " +
  "visible looking in from that edge — taller towers hide everything " +
  "shorter behind them. Clues turn green when their line works.";

/** Towers visible along a line of heights: each new maximum is visible. */
function visible(line: number[]): number {
  let max = 0, count = 0;
  for (const v of line) {
    if (v > max) { max = v; count++; }
  }
  return count;
}

interface Clues {
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
}

function generateClues(seed: string, n: number): Clues {
  const sol = generateLatin(`sky-${seed}`, n);
  const col = (c: number) => Array.from({ length: n }, (_, r) => sol[r * n + c]);
  const row = (r: number) => Array.from({ length: n }, (_, c) => sol[r * n + c]);
  return {
    top: Array.from({ length: n }, (_, c) => visible(col(c))),
    bottom: Array.from({ length: n }, (_, c) => visible(col(c).reverse())),
    left: Array.from({ length: n }, (_, r) => visible(row(r))),
    right: Array.from({ length: n }, (_, r) => visible(row(r).reverse()))
  };
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Skyscrapers({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("sky", (_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const clues = useMemo(() => generateClues(seed, n), [seed, n]);
  const [selected, setSelected] = useState<number | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const v = board[i];
      if (v === 0) continue;
      const r = Math.floor(i / n), c = i % n;
      for (let k = 0; k < n; k++) {
        const row = r * n + k, col = k * n + c;
        if (row !== i && board[row] === v) bad.add(i);
        if (col !== i && board[col] === v) bad.add(i);
      }
    }
    return bad;
  }, [board, n]);

  /** null while the line is incomplete; then whether the clue holds. */
  const clueOk = useMemo(() => {
    const col = (c: number) => Array.from({ length: n }, (_, r) => board[r * n + c]);
    const row = (r: number) => Array.from({ length: n }, (_, c) => board[r * n + c]);
    const judge = (line: number[], want: number): boolean | null =>
      line.some((v) => v === 0) ? null : visible(line) === want;
    return {
      top: clues.top.map((w, c) => judge(col(c), w)),
      bottom: clues.bottom.map((w, c) => judge(col(c).reverse(), w)),
      left: clues.left.map((w, r) => judge(row(r), w)),
      right: clues.right.map((w, r) => judge(row(r).reverse(), w))
    };
  }, [board, clues, n]);

  useEffect(() => {
    const allOk =
      board.every((v) => v !== 0) &&
      conflicts.size === 0 &&
      [...clueOk.top, ...clueOk.bottom, ...clueOk.left, ...clueOk.right].every(
        (ok) => ok === true
      );
    if (!saved.done && allOk) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("sky", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, clueOk, saved]);

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

  const clueClass = (ok: boolean | null) =>
    `sky-clue${ok === true ? " ok" : ok === false ? " bad" : ""}`;

  const G = n + 2;

  return (
    <div className="game game-sky">
      <GameHeader title="Skyscrapers" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Heights 1–{n} once per row and column. Edge numbers count the towers
        visible from that side.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="sky-grid"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Skyscrapers board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          const inner = gr > 0 && gr <= n && gc > 0 && gc <= n;
          if (inner) {
            const i = (gr - 1) * n + (gc - 1);
            return (
              <button
                key={k}
                role="gridcell"
                className={[
                  "sky-cell",
                  selected === i ? "selected" : "",
                  conflicts.has(i) ? "conflict" : ""
                ].join(" ")}
                onClick={() => setSelected(i)}
              >
                {board[i] || ""}
              </button>
            );
          }
          if (gr === 0 && gc > 0 && gc <= n)
            return <span key={k} className={clueClass(clueOk.top[gc - 1])}>{clues.top[gc - 1]}</span>;
          if (gr === G - 1 && gc > 0 && gc <= n)
            return <span key={k} className={clueClass(clueOk.bottom[gc - 1])}>{clues.bottom[gc - 1]}</span>;
          if (gc === 0 && gr > 0 && gr <= n)
            return <span key={k} className={clueClass(clueOk.left[gr - 1])}>{clues.left[gr - 1]}</span>;
          if (gc === G - 1 && gr > 0 && gr <= n)
            return <span key={k} className={clueClass(clueOk.right[gr - 1])}>{clues.right[gr - 1]}</span>;
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
          game="sky"
          won
          message="Skyline complete!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
