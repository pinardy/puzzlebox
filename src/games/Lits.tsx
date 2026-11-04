import { useEffect, useMemo, type CSSProperties } from "react";
import { useGridNav } from "../lib/gridnav";
import { analyseLits, generateLits } from "../lib/lits";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Lits.css";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const HELP =
  "Shade exactly four squares in every outlined region, and make those four " +
  "an L, I, T or S tetromino — never the 2×2 square, which is why the puzzle " +
  "is called LITS. All the shading on the board must join into one connected " +
  "group, no 2×2 block of squares may be fully shaded, and two tetrominoes " +
  "of the same letter (rotations and mirrors count as the same letter) may " +
  "never touch edge to edge. Tap a square to shade or clear it; a finished " +
  "region shows the letter it spells.";

interface SavedState {
  shaded: boolean[];
  done: boolean;
}

export default function Lits({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      shaded: Array(SIZE[d] * SIZE[d]).fill(false),
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateLits(`lits-${seed}`, n), [seed, n]);
  const { regionOf, regions } = puzzle;
  const view = useMemo(() => analyseLits(puzzle, saved.shaded), [puzzle, saved.shaded]);

  useEffect(() => {
    if (view.solved) finish();
  }, [view.solved, finish]);

  function toggle(i: number) {
    if (saved.done) return;
    const shaded = saved.shaded.slice();
    shaded[i] = !shaded[i];
    commit({ ...saved, shaded });
  }

  const nav = useGridNav();

  /** Fix one square that differs from the tetrominoes the board was
   *  seeded with. */
  function hint() {
    if (saved.done) return;
    const want = Array(n * n).fill(false);
    for (const p of puzzle.pieces) for (const i of p.cells) want[i] = true;
    const wrong = saved.shaded.flatMap((on, i) => (on === want[i] ? [] : [i]));
    if (!wrong.length) return;
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    const shaded = saved.shaded.slice();
    shaded[i] = want[i];
    commitHint({ ...saved, shaded });
  }

  const settled = view.letters.filter((l) => l !== null).length;
  const warn = view.square.size
    ? "2×2 fully shaded"
    : view.clash.size
      ? "Same letters touch"
      : view.badRegion.some(Boolean)
        ? "Region overfilled"
        : view.shaded > 0 && !view.linked
          ? "Shading not linked"
          : "";

  return (
    <div className="game game-lits">
      <GameHeader title="LITS" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        One L, I, T or S tetromino per region — all shading linked, no 2×2, no matching
        letters touching.
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
          Regions {settled}/{regions.length}
        </span>
        <span className={warn ? "lt-warn" : ""}>
          {warn ? `⚠ ${warn}` : view.shaded ? "✓ No rule breaks" : "Tap to shade"}
        </span>
      </div>

      <div
        className="lt-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="LITS board"
        {...nav}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n),
            c = i % n;
          const id = regionOf[i];
          const letter = view.letters[id];
          const on = saved.shaded[i];
          const dud = on && view.badRegion[id];
          const mark = !on ? "" : dud ? "×" : (letter ?? "•");
          return (
            <button
              key={i}
              role="gridcell"
              data-cell={i}
              className={[
                "lt-cell",
                on ? "on" : "",
                on && letter ? "set" : "",
                dud ? "dud" : "",
                view.clash.has(i) ? "clash" : "",
                view.square.has(i) ? "sq" : "",
                r > 0 && regionOf[i - n] !== id ? "reg-t" : "",
                c > 0 && regionOf[i - 1] !== id ? "reg-l" : "",
                r === n - 1 ? "reg-b" : "",
                c === n - 1 ? "reg-r" : ""
              ].join(" ")}
              onClick={() => toggle(i)}
              aria-pressed={on}
              aria-label={
                `Row ${r + 1}, column ${c + 1}` +
                (on ? ", shaded" : ", unshaded") +
                (letter ? `, region forms ${letter}` : "")
              }
            >
              <span aria-hidden="true">{mark}</span>
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every region a tetromino!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
