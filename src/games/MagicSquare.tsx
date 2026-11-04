import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateMagic } from "../lib/magic";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { cellLabel, useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./MagicSquare.css";

const SIZE: Record<Diff, number> = { easy: 3, medium: 4, hard: 4 };
const GIVENS: Record<Diff, number> = { easy: 3, medium: 8, hard: 6 };
const HELP =
  "Place every number from 1 to 9 (or 1 to 16 on the bigger board) exactly " +
  "once so that each row, each column and both long diagonals add up to the " +
  "same magic total. Tap a square, then a number from the tray; tap a number " +
  "you placed to take it back. The running sums beside each line tell you " +
  "how close you are — a ✓ line is finished and right, an ✗ line cannot work.";

type LineState = "open" | "ok" | "bad";

interface Line {
  sum: number;
  state: LineState;
  label: string;
}

/** A line is settled when it holds no holes. A partial line is already
 *  dead once its sum plus one per hole passes the total, since every
 *  number left to place is positive. */
const lineOf = (vals: number[], total: number, label: string): Line => {
  const sum = vals.reduce((a, b) => a + b, 0);
  const holes = vals.filter((v) => v === 0).length;
  const state: LineState =
    holes === 0 ? (sum === total ? "ok" : "bad") : sum + holes > total ? "bad" : "open";
  return { sum, state, label };
};

const MARK: Record<LineState, string> = { open: "", ok: "✓", bad: "✗" };
const SAY: Record<LineState, string> = { open: "so far", ok: "complete", bad: "wrong" };

function Sum({ line }: { line: Line }) {
  return (
    <span
      className={`ms-sum ${line.state}`}
      aria-label={`${line.label}: ${line.sum} ${SAY[line.state]}`}
    >
      {MARK[line.state]}
      {line.sum}
    </span>
  );
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function MagicSquare({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { givens, solution, total } = useMemo(
    () => generateMagic(`magic-${seed}`, n, GIVENS[diff]),
    [seed, n, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );
  const pinned = useMemo(() => new Set(givens.filter((v) => v !== 0)), [givens]);
  const placed = useMemo(() => new Set(board.filter((v) => v !== 0)), [board]);

  const lines = useMemo(() => {
    const at = (r: number, c: number) => board[r * n + c];
    const idx = [...Array(n).keys()];
    return {
      rows: idx.map((r) => lineOf(idx.map((c) => at(r, c)), total, `Row ${r + 1}`)),
      cols: idx.map((c) => lineOf(idx.map((r) => at(r, c)), total, `Column ${c + 1}`)),
      down: lineOf(idx.map((k) => at(k, k)), total, "Diagonal down"),
      up: lineOf(idx.map((k) => at(k, n - 1 - k)), total, "Diagonal up")
    };
  }, [board, n, total]);

  const solved =
    placed.size === n * n &&
    board.every((v) => v !== 0) &&
    [...lines.rows, ...lines.cols, lines.down, lines.up].every((l) => l.state === "ok");

  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  /** Every number appears once, so writing one lifts it from anywhere else. */
  function setCell(i: number, v: number) {
    if (saved.done || givens[i] !== 0 || pinned.has(v)) return;
    if (v === saved.entries[i]) return;
    const entries = saved.entries.slice();
    for (let k = 0; k < n * n; k++) if (entries[k] === v) entries[k] = 0;
    entries[i] = v;
    commit({ ...saved, entries });
  }

  useGridKeys({
    cols: n,
    rows: n,
    max: n * n,
    selected,
    setSelected,
    setCell,
    isCell: (i) => givens[i] === 0
  });

  function hint() {
    const open = (i: number) => givens[i] === 0 && board[i] !== solution[i];
    const cands = [...Array(n * n).keys()].filter(open);
    if (!cands.length) return;
    const i =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    for (let k = 0; k < n * n; k++) if (entries[k] === solution[i]) entries[k] = 0;
    entries[i] = solution[i];
    commitHint({ ...saved, entries });
    setSelected(i);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  const left = n * n - placed.size;

  return (
    <div className="game game-magic">
      <GameHeader title="Magic Square" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Every row, column and diagonal must add up to {total}.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />
      <div className="lights-meta">
        <span>Magic total {total}</span>
        <span>{left === 0 ? "All placed" : `${left} left to place`}</span>
      </div>

      <div className="ms-wrap" style={{ "--n": n } as CSSProperties}>
        <div className="ms-diag ms-up">
          ↗<Sum line={lines.up} />
        </div>
        <div className="ms-grid" role="grid" aria-label="Magic square board">
          {board.map((v, i) => {
            const r = Math.floor(i / n), c = i % n;
            const given = givens[i] !== 0;
            return (
              <button
                key={i}
                role="gridcell"
                className={[
                  "ms-cell",
                  given ? "given" : "",
                  selected === i ? "selected" : "",
                  r === c || r + c === n - 1 ? "diag" : ""
                ].join(" ")}
                aria-label={cellLabel(i, n, v, given && "given")}
                aria-selected={selected === i}
                onClick={() => {
                  if (!given && saved.entries[i] !== 0 && selected === i) setCell(i, 0);
                  else setSelected(i);
                }}
              >
                {v || ""}
              </button>
            );
          })}
        </div>
        <div className="ms-rowsums">
          {lines.rows.map((l, r) => (
            <Sum key={r} line={l} />
          ))}
        </div>
        <div className="ms-colsums">
          {lines.cols.map((l, c) => (
            <Sum key={c} line={l} />
          ))}
        </div>
        <div className="ms-diag ms-down">
          ↘<Sum line={lines.down} />
        </div>
      </div>

      <div className="ms-tray" role="group" aria-label="Numbers to place">
        {[...Array(n * n).keys()].map((k) => k + 1).map((v) => {
          const used = placed.has(v);
          return (
            <button
              key={v}
              className={`ms-chip ${used ? "used" : ""}`}
              disabled={used || selected === null || givens[selected] !== 0}
              onClick={() => selected !== null && setCell(selected, v)}
              aria-label={`Place ${v}${used ? ", already on the board" : ""}`}
            >
              {v}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Every line adds to ${total}!`}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
