import { useEffect, useMemo, useState } from "react";
import { generateJigsaw, jigsawPeers } from "../lib/jigsaw";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HOLES: Record<Diff, number> = { easy: 40, medium: 48, hard: 54 };
const HELP =
  "Sudoku with the boxes redrawn: every row, every column, and every " +
  "one of the nine jigsaw regions holds 1–9 exactly once. The regions " +
  "wander, so scan them as carefully as the rows.";

interface SavedState {
  entries: number[];
  notes: number[][];
  done: boolean;
}

export default function Jigsaw({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("jigsaw", () => ({
      entries: Array(81).fill(0),
      notes: Array.from({ length: 81 }, () => []),
      done: false
    }));
  const { regionOf, puzzle, solution } = useMemo(
    () => generateJigsaw(`jigsaw-${seed}`, HOLES[diff]),
    [seed, diff]
  );
  const peers = useMemo(() => jigsawPeers(regionOf), [regionOf]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);

  const board = useMemo(
    () => puzzle.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [puzzle, saved.entries]
  );

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < 81; i++) {
      const v = board[i];
      if (v !== 0 && peers[i].some((p) => board[p] === v)) bad.add(i);
    }
    return bad;
  }, [board, peers]);

  useEffect(() => {
    if (!saved.done && board.every((v) => v !== 0) && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("jigsaw", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, conflicts, saved]);

  function setCell(idx: number, val: number) {
    if (saved.done || puzzle[idx] !== 0) return;
    const next: SavedState = {
      ...saved,
      entries: saved.entries.slice(),
      notes: saved.notes.map((n) => n.slice())
    };
    if (pencil && val !== 0) {
      const n = next.notes[idx];
      next.notes[idx] = n.includes(val)
        ? n.filter((x) => x !== val)
        : [...n, val].sort();
    } else {
      next.entries[idx] = next.entries[idx] === val ? 0 : val;
      next.notes[idx] = [];
      if (val !== 0 && next.entries[idx] === val)
        for (const p of peers[idx])
          next.notes[p] = next.notes[p].filter((x) => x !== val);
    }
    commit(next);
  }

  function hint() {
    const open = (i: number) => puzzle[i] === 0 && board[i] !== solution[i];
    const cands = [...Array(81).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const next: SavedState = {
      ...saved,
      entries: saved.entries.slice(),
      notes: saved.notes.map((n) => n.slice())
    };
    next.entries[idx] = solution[idx];
    next.notes[idx] = [];
    for (const p of peers[idx])
      next.notes[p] = next.notes[p].filter((x) => x !== solution[idx]);
    commitHint(next);
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: 9, rows: 9, max: 9, selected, setSelected, setCell });

  const selVal = selected !== null ? board[selected] : 0;

  return (
    <div className="game game-jigsaw">
      <GameHeader title="Jigsaw Sudoku" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        1–9 once per row, column, and jigsaw region.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="sudoku-grid" role="grid" aria-label="Jigsaw sudoku board">
        {board.map((v, i) => {
          const given = puzzle[i] !== 0;
          const r = Math.floor(i / 9), c = i % 9;
          const sameVal = selVal !== 0 && v === selVal;
          const inRegion =
            selected !== null && regionOf[selected] === regionOf[i];
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "sudoku-cell jig-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                sameVal ? "same" : "",
                inRegion ? "inline" : "",
                conflicts.has(i) ? "conflict" : "",
                // Region outlines replace the 3×3 box rules.
                r > 0 && regionOf[i - 9] !== regionOf[i] ? "jr-t" : "",
                c > 0 && regionOf[i - 1] !== regionOf[i] ? "jr-l" : "",
                r === 8 ? "jr-b" : "",
                c === 8 ? "jr-r" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              {v !== 0 ? (
                v
              ) : saved.notes[i].length ? (
                <span className="notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <i key={d}>{saved.notes[i].includes(d) ? d : ""}</i>
                  ))}
                </span>
              ) : (
                ""
              )}
            </button>
          );
        })}
      </div>

      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
          const remaining = 9 - board.filter((v) => v === d).length;
          return (
            <button
              key={d}
              className="num-key"
              disabled={remaining <= 0 && !pencil}
              onClick={() => selected !== null && setCell(selected, d)}
            >
              {d}
              <small>{remaining > 0 ? remaining : ""}</small>
            </button>
          );
        })}
        <button
          className={`num-key tool${pencil ? " active" : ""}`}
          onClick={() => setPencil((p) => !p)}
          aria-pressed={pencil}
        >
          ✏️<small>notes</small>
        </button>
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫<small>erase</small>
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="jigsaw"
          won
          message="Every region solved!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
