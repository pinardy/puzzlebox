import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateLatin } from "../lib/latin";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { cellLabel, useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import { Numpad } from "./Numpad";
import "./Skyscrapers.css";

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
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const clues = useMemo(() => generateClues(seed, n), [seed, n]);
  // Same seed string as generateClues, so this is the grid the clues
  // were read from.
  const solution = useMemo(() => generateLatin(`sky-${seed}`, n), [seed, n]);
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

  const solved =
    board.every((v) => v !== 0) &&
    conflicts.size === 0 &&
    [...clueOk.top, ...clueOk.bottom, ...clueOk.left, ...clueOk.right].every(
      (ok) => ok === true
    );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) => board[i] !== solution[i];
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

  useGridKeys({ cols: n, rows: n, max: n, selected, setSelected, setCell });

  const clueClass = (ok: boolean | null) =>
    `sky-clue${ok === true ? " ok" : ok === false ? " bad" : ""}`;

  const G = n + 2;
  /** An edge clue, named for screen readers: "Column 2 from the top: 3
   *  visible". */
  const clue = (k: number, side: keyof typeof clues, at: number, line: string) => {
    const ok = clueOk[side][at];
    return (
      <span
        key={k}
        className={clueClass(ok)}
        role="gridcell"
        aria-label={`${line === "row" ? "Row" : "Column"} ${at + 1} from the ${side}: ${
          clues[side][at]
        } visible${ok === true ? ", met" : ok === false ? ", broken" : ""}`}
      >
        {clues[side][at]}
      </span>
    );
  };

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
        onHint={saved.done ? undefined : hint}
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
                aria-label={cellLabel(i, n, board[i], conflicts.has(i) && "conflict")}
                aria-selected={selected === i}
                onClick={() => setSelected(i)}
              >
                {board[i] || ""}
              </button>
            );
          }
          if (gr === 0 && gc > 0 && gc <= n)
            return clue(k, "top", gc - 1, "column");
          if (gr === G - 1 && gc > 0 && gc <= n)
            return clue(k, "bottom", gc - 1, "column");
          if (gc === 0 && gr > 0 && gr <= n)
            return clue(k, "left", gr - 1, "row");
          if (gc === G - 1 && gr > 0 && gr <= n)
            return clue(k, "right", gr - 1, "row");
          return <span key={k} />;
        })}
      </div>

      <Numpad max={n} onDigit={(d) => selected !== null && setCell(selected, d)} />

      {saved.done && (
        <Result
          key={seed}
          won
          message="Skyline complete!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
