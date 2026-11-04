import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateHidato, kingAdjacent } from "../lib/hidato";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { cellLabel, useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Hidato.css";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
// Diagonal steps make the chain far looser than Numbrix's, so more of the
// board is given away or the search turns into a slog.
const REVEAL: Record<Diff, number> = { easy: 0.5, medium: 0.4, hard: 0.32 };
const HELP =
  "Fill the grid with every number from 1 to the last one so that " +
  "consecutive numbers always touch — sideways, up and down, or " +
  "diagonally, so each number sits in one of the eight squares around " +
  "the next. Tap a square, then a number from the tray; tap a number " +
  "you placed to take it back.";

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Hidato({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      entries: Array(SIZE[d] * SIZE[d]).fill(0),
      done: false
    }));
  const n = SIZE[diff];
  const { givens, solution } = useMemo(
    () => generateHidato(`hidato-${seed}`, n, REVEAL[diff]),
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
   *  neighbour in the sequence is placed off a king's reach. */
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
      if (!kingAdjacent(i, j, n)) {
        bad.add(i);
        bad.add(j);
      }
    }
    return bad;
  }, [board, cellOf, n]);

  const solved = board.every((v) => v !== 0) && conflicts.size === 0;
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function place(value: number, at = selected) {
    if (saved.done || at === null || givens[at] !== 0) return;
    if (saved.entries[at] === value) return;
    const entries = saved.entries.slice();
    // Each number appears once, so placing it lifts it from anywhere else.
    for (let i = 0; i < n * n; i++) if (entries[i] === value) entries[i] = 0;
    entries[at] = value;
    commit({ ...saved, entries });
  }

  function clear(i: number) {
    if (saved.done || givens[i] !== 0 || saved.entries[i] === 0) return;
    const entries = saved.entries.slice();
    entries[i] = 0;
    commit({ ...saved, entries });
  }

  // Typing: arrows walk the open squares, digits (two for numbers past 9)
  // place a number, Backspace takes one back.
  useGridKeys({
    cols: n,
    rows: n,
    max: n * n,
    selected,
    setSelected,
    setCell: (i, v) => (v === 0 ? clear(i) : place(v, i)),
    isCell: (i) => givens[i] === 0
  });

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
    <div className="game game-hidato">
      <GameHeader title="Hidato" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Lay 1 to {n * n} in one unbroken chain — diagonal steps count here.
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
        className="hd-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Hidato board"
      >
        {board.map((v, i) => {
          const given = givens[i] !== 0;
          const bad = conflicts.has(i);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "hd-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                bad ? "conflict" : ""
              ].join(" ")}
              aria-label={cellLabel(i, n, v, given && "given", bad && "broken chain")}
              aria-selected={selected === i}
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

      <div className="hd-tray" role="group" aria-label="Numbers left to place">
        {tray.length === 0 ? (
          <span className="hd-empty">Every number is on the board.</span>
        ) : (
          tray.map((v) => (
            <button
              key={v}
              className="hd-chip"
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
          won
          message="One unbroken chain!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
