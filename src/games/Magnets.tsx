import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  brokenDominoes,
  clashingCells,
  countSigns,
  generateMagnets,
  magnetsSolved,
  type Sign
} from "../lib/magnets";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Magnets.css";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
/** How many of the 4n clues are withheld — the usual way Magnets scales. */
const HIDDEN: Record<Diff, number> = { easy: 0, medium: 5, hard: 12 };
const HELP =
  "The board is already tiled into 1×2 slabs. Each slab is either a magnet — " +
  "one half +, the other half − — or a blank piece of iron with neither. Two " +
  "squares that share an edge may never hold the same pole. The numbers " +
  "outside each row and column count its + poles (top and left) and its − " +
  "poles (bottom and right); on harder boards some counts are withheld. Tap " +
  "a square to cycle blank → + → −, long-press or right-click to go back.";

const GLYPH: Record<Sign, string> = { 0: "", 1: "+", 2: "−" };
const NAME: Record<Sign, string> = { 0: "blank", 1: "plus", 2: "minus" };

interface SavedState {
  board: Sign[];
  done: boolean;
}

export default function Magnets({ onExit }: { onExit: () => void }) {
  const {
    seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle
  }= useGame<SavedState>((_s, d) => ({
    board: Array<Sign>(SIZE[d] * SIZE[d]).fill(0),
    done: false
  }));
  const n = SIZE[diff];
  const puzzle = useMemo(
    () => generateMagnets(`magnets-${seed}`, n, HIDDEN[diff]),
    [seed, n, diff]
  );
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const got = useMemo(() => countSigns(saved.board, n), [saved.board, n]);
  const clashes = useMemo(() => clashingCells(saved.board, n), [saved.board, n]);
  const broken = useMemo(
    () => brokenDominoes(puzzle, saved.board),
    [puzzle, saved.board]
  );

  const solved = useMemo(
    () => magnetsSolved(puzzle, saved.board),
    [puzzle, saved.board]
  );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  /** Each half is set independently, so a half-filled slab is allowed as a
   *  working state — it is only flagged, never auto-completed. */
  function cycle(i: number, back: boolean) {
    if (saved.done) return;
    const board = saved.board.slice();
    board[i] = ((board[i] + (back ? 2 : 1)) % 3) as Sign;
    commit({ ...saved, board });
  }

  function hint() {
    const cands = [...Array(n * n).keys()].filter(
      (i) => saved.board[i] !== puzzle.solution[i]
    );
    if (!cands.length) return;
    const i = cands[Math.floor(Math.random() * cands.length)];
    const board = saved.board.slice();
    board[i] = puzzle.solution[i];
    commitHint({ ...saved, board });
  }

  const G = n + 2;
  const clueClass = (want: number | null, have: number) =>
    want === null
      ? "edge-count mg-clue mg-hidden"
      : `edge-count mg-clue${have === want ? " ok" : have > want ? " bad" : ""}`;
  const clue = (key: number, want: number | null, have: number, what: string) => (
    <span
      key={key}
      className={clueClass(want, have)}
      aria-label={`${what} ${want === null ? "hidden" : want}`}
    >
      {want ?? "·"}
    </span>
  );

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const issues = clashes.size + broken.size;
  const clearPress = () => {
    if (pressTimer.current !== null) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div className="game game-magnets">
      <GameHeader title="Magnets" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Fill each slab with a + / − pair or leave it blank — like poles never
        touch.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="lights-meta">
        <span>
          + {sum(got.rowPlus)} · − {sum(got.rowMinus)}
        </span>
        <span>{issues ? `${issues} to fix` : "no clashes"}</span>
      </div>

      <div
        className="mg-grid"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Magnets board"
      >
        {Array.from({ length: G * G }, (_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          const edgeR = gr === 0 || gr === G - 1;
          const edgeC = gc === 0 || gc === G - 1;
          if (edgeR && edgeC) {
            // Two opposite corners double as the legend: + counts run along
            // the top and left edges, − counts along the bottom and right.
            const mark = gr === gc ? (gr === 0 ? "+" : "−") : "";
            return (
              <span key={k} className="mg-legend">
                {mark}
              </span>
            );
          }
          if (edgeR) {
            const c = gc - 1;
            return gr === 0
              ? clue(k, puzzle.colPlus[c], got.colPlus[c], `Column ${c + 1} plus`)
              : clue(k, puzzle.colMinus[c], got.colMinus[c], `Column ${c + 1} minus`);
          }
          if (edgeC) {
            const r = gr - 1;
            return gc === 0
              ? clue(k, puzzle.rowPlus[r], got.rowPlus[r], `Row ${r + 1} plus`)
              : clue(k, puzzle.rowMinus[r], got.rowMinus[r], `Row ${r + 1} minus`);
          }

          const r = gr - 1, c = gc - 1, i = r * n + c;
          const id = puzzle.dominoOf[i];
          const s = saved.board[i];
          return (
            <button
              key={k}
              role="gridcell"
              className={[
                "mg-cell",
                s === 1 ? "plus" : s === 2 ? "minus" : "",
                clashes.has(i) ? "clash" : "",
                broken.has(id) ? "broken" : "",
                r === 0 || puzzle.dominoOf[i - n] !== id ? "reg-t" : "",
                c === 0 || puzzle.dominoOf[i - 1] !== id ? "reg-l" : "",
                r === n - 1 ? "reg-b" : "",
                c === n - 1 ? "reg-r" : ""
              ].join(" ")}
              aria-label={`Row ${r + 1} column ${c + 1}, ${NAME[s]}`}
              onClick={() => {
                // A long-press or right-click already acted; swallow the
                // click it leaves behind, then re-arm for the next tap.
                const swallow = longPressed.current;
                longPressed.current = false;
                if (!swallow) cycle(i, false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                clearPress();
                // A touch long-press has already stepped back; a mouse
                // right-click gets here without the timer having fired.
                if (longPressed.current) return;
                longPressed.current = true;
                cycle(i, true);
              }}
              onPointerDown={(e) => {
                clearPress();
                longPressed.current = false;
                if (e.button !== 0) return;
                pressTimer.current = window.setTimeout(() => {
                  longPressed.current = true;
                  cycle(i, true);
                }, 420);
              }}
              onPointerUp={clearPress}
              onPointerLeave={clearPress}
              onPointerCancel={clearPress}
            >
              {GLYPH[s]}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every pole in place!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
