import { useMemo, useState, type CSSProperties } from "react";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "A peg jumps over an adjacent peg into an empty hole, and the jumped peg " +
  "is removed — like checkers. Easy plays the 15-hole triangle; Medium is " +
  "the classic English cross, one peg left anywhere to win; Hard demands " +
  "that final peg land dead centre.";

interface Cell {
  r: number;
  c: number;
}

interface Board {
  cells: Cell[];
  vectors: [number, number][];
  emptyAt: number; // starting hole
  center: number; // index of the centre hole (or -1)
  winCenter: boolean;
  rows: number;
}

function boardFor(diff: Diff): Board {
  if (diff === "easy") {
    // Triangle-15, apex empty — the classic Cracker Barrel board. Row r
    // holds r+1 holes; diagonal jumps follow the triangular lattice.
    const cells: Cell[] = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) cells.push({ r, c });
    return {
      cells,
      vectors: [[0, 2], [0, -2], [2, 0], [-2, 0], [2, 2], [-2, -2]],
      emptyAt: 0,
      center: -1,
      winCenter: false,
      rows: 5
    };
  }
  // English cross: the 3×3 arms of a 7×7 grid.
  const cells: Cell[] = [];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++)
      if ((r >= 2 && r <= 4) || (c >= 2 && c <= 4)) cells.push({ r, c });
  const center = cells.findIndex((p) => p.r === 3 && p.c === 3);
  return {
    cells,
    vectors: [[0, 2], [0, -2], [2, 0], [-2, 0]],
    emptyAt: center,
    center,
    winCenter: diff === "hard",
    rows: 7
  };
}

interface SavedState {
  pegs: boolean[];
  moves: number;
  done: boolean;
  won: boolean;
}

function fresh(diff: Diff): SavedState {
  const board = boardFor(diff);
  const pegs = board.cells.map((_, i) => i !== board.emptyAt);
  return { pegs, moves: 0, done: false, won: false };
}

export default function PegSolitaire({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("pegs", (_s, d) => fresh(d));
  const board = useMemo(() => boardFor(diff), [diff]);
  const [picked, setPicked] = useState<number | null>(null);

  const at = useMemo(() => {
    const m = new Map<string, number>();
    board.cells.forEach((p, i) => m.set(`${p.r},${p.c}`, i));
    return m;
  }, [board]);

  // A pre-modes save is a 7×7 pegs array (49 booleans, invalid cells
  // included); its shape no longer matches, so restart cleanly.
  const pegs =
    saved.pegs.length === board.cells.length ? saved.pegs : fresh(diff).pegs;

  function jumps(from: number, state: boolean[]): { to: number; over: number }[] {
    const { r, c } = board.cells[from];
    const out: { to: number; over: number }[] = [];
    for (const [dr, dc] of board.vectors) {
      const to = at.get(`${r + dr},${c + dc}`);
      const over = at.get(`${r + dr / 2},${c + dc / 2}`);
      if (to !== undefined && over !== undefined && state[over] && !state[to])
        out.push({ to, over });
    }
    return out;
  }

  const pegCount = useMemo(() => pegs.filter(Boolean).length, [pegs]);
  const targets = useMemo(() => {
    if (picked === null) return new Map<number, number>();
    return new Map(jumps(picked, pegs).map((j) => [j.to, j.over]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, pegs, board]);

  function tap(i: number) {
    if (saved.done) return;
    if (pegs[i]) {
      setPicked(picked === i ? null : i);
      return;
    }
    const over = targets.get(i);
    if (picked === null || over === undefined) return;
    const next = pegs.slice();
    next[picked] = false;
    next[over] = false;
    next[i] = true;
    setPicked(null);

    const anyMove = next.some((p, k) => p && jumps(k, next).length > 0);
    const left = next.filter(Boolean).length;
    const done = !anyMove;
    const won =
      done && left === 1 && (!board.winCenter || next[board.center]);
    commit({ pegs: next, moves: saved.moves + 1, done, won });
    if (done) recordResult("pegs", won);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setPicked(null);
  }

  const rows = useMemo(() => {
    const out: number[][] = Array.from({ length: board.rows }, () => []);
    board.cells.forEach((p, i) => out[p.r].push(i));
    return out;
  }, [board]);

  return (
    <div className="game game-pegs">
      <GameHeader title="Peg Solitaire" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Jump pegs over each other into empty holes — end with one peg
        {board.winCenter ? " in the centre" : " left"}.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>Pegs left: {pegCount}</span>
        <button
          className="mini-btn"
          onClick={() => {
            commit(fresh(diff));
            setPicked(null);
          }}
        >
          Restart
        </button>
      </div>

      <div
        className="pegs-rows"
        style={{ "--n": board.rows } as CSSProperties}
        role="grid"
        aria-label="Peg solitaire board"
      >
        {rows.map((row, r) => (
          <div key={r} className="pegs-row" role="row">
            {row.map((i) => (
              <button
                key={i}
                role="gridcell"
                className={[
                  "peg-hole",
                  pegs[i] ? "peg" : "",
                  picked === i ? "picked" : "",
                  targets.has(i) ? "target" : "",
                  i === board.center && board.winCenter ? "center" : ""
                ].join(" ")}
                onClick={() => tap(i)}
                aria-label={pegs[i] ? "Peg" : "Empty hole"}
              />
            ))}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="pegs"
          won={saved.won}
          message={
            saved.won
              ? board.winCenter
                ? "One peg, dead centre — perfect!"
                : "One peg left — solved!"
              : pegCount === 1
                ? "One peg left, but not in the centre"
                : `No moves left — ${pegCount} pegs remain`
          }
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
