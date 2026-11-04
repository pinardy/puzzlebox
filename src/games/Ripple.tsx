import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGridKeys } from "../lib/keys";
import {
  generateRipple,
  rippleConflicts,
  rippleSolved,
  MAX_ROOM
} from "../lib/ripple";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const GIVEN_RATE: Record<Diff, number> = { easy: 0.5, medium: 0.34, hard: 0.24 };
const HELP =
  "Every outlined room of k cells holds the numbers 1 to k, each once. " +
  "And numbers ripple: if the same number appears twice in a row or a " +
  "column, at least that many cells must separate them — two 1s can never " +
  "touch, two 3s need three cells of clear space, and so on. Tap a cell, " +
  "then a number from the tray; tap the cell again to rub it out.";

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Ripple({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(
    () => generateRipple(`ripple-${seed}`, n, GIVEN_RATE[diff]),
    [seed, n, diff]
  );
  const { roomOf, rooms, roomSize, givens, solution } = puzzle;
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [givens, saved.entries]
  );

  const conflicts = useMemo(
    () => rippleConflicts(n, roomOf, rooms, board),
    [n, roomOf, rooms, board]
  );

  const solved = useMemo(
    () => rippleSolved(n, roomOf, rooms, board),
    [n, roomOf, rooms, board]
  );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  /** Values too big for the room are refused rather than shown as errors —
   *  the tray greys them out, and the keyboard should agree. */
  function setCell(i: number, v: number) {
    if (saved.done || givens[i] !== 0 || v > roomSize[i]) return;
    const entries = saved.entries.slice();
    entries[i] = entries[i] === v ? 0 : v;
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

  useGridKeys({
    cols: n,
    rows: n,
    max: MAX_ROOM,
    selected,
    setSelected,
    setCell,
    isCell: (i) => givens[i] === 0
  });

  const left = board.filter((v) => v === 0).length;

  return (
    <div className="game game-ripple">
      <GameHeader title="Ripple Effect" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        1 to k in every k-cell room; a repeated number keeps that many
        cells clear.
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
        <span>{left === 0 ? "Board full" : `${left} to fill`}</span>
        <span className={conflicts.size ? "rp-warn" : ""}>
          {conflicts.size ? `⚠ ${conflicts.size} clashing` : "No clashes"}
        </span>
      </div>

      <div
        className="rp-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Ripple Effect board"
      >
        {board.map((v, i) => {
          const r = Math.floor(i / n), c = i % n;
          const id = roomOf[i];
          const given = givens[i] !== 0;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "rp-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : "",
                r > 0 && roomOf[i - n] !== id ? "reg-t" : "",
                c > 0 && roomOf[i - 1] !== id ? "reg-l" : "",
                r === n - 1 ? "reg-b" : "",
                c === n - 1 ? "reg-r" : ""
              ].join(" ")}
              onClick={() => {
                if (!given && saved.entries[i] !== 0 && selected === i) setCell(i, v);
                else setSelected(i);
              }}
              aria-label={`Row ${r + 1} column ${c + 1}, room of ${roomSize[i]}, ${
                v === 0 ? "empty" : v
              }${conflicts.has(i) ? ", clashing" : ""}`}
            >
              {v || ""}
            </button>
          );
        })}
      </div>

      <div className="rp-tray" role="group" aria-label="Numbers">
        {[...Array(MAX_ROOM).keys()].map((k) => {
          const v = k + 1;
          const room = selected === null ? 0 : roomSize[selected];
          return (
            <button
              key={v}
              className="rp-chip"
              disabled={selected === null || givens[selected] !== 0 || v > room}
              onClick={() => selected !== null && setCell(selected, v)}
            >
              {v}
            </button>
          );
        })}
        <button
          className="rp-chip tool"
          disabled={selected === null || board[selected] === 0 || givens[selected] !== 0}
          onClick={() => selected !== null && setCell(selected, board[selected])}
          aria-label="Erase"
        >
          ⌫
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every ripple settled!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
