import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import {
  colorBoard,
  generateWaffle,
  hintSwap,
  HOLES,
  LETTER_CELLS,
  type Mark
} from "../lib/waffle";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const DEPTH: Record<Diff, number> = { easy: 8, medium: 11, hard: 13 };
const BUDGET = 15;
const MARK_LABEL: Record<Mark, string> = {
  correct: "correct place",
  misplaced: "wrong place",
  absent: "not in these words"
};
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
};
const HELP =
  "Six five-letter words interlock here — three across and three down. " +
  "Every letter is already on the board, but most are in the wrong place. " +
  "Tap one tile then another to swap them, and sort all six words out " +
  "within 15 swaps. Green means the letter is home; amber means it belongs " +
  "somewhere else in one of the words crossing that tile; grey means it " +
  "belongs to neither of them.";

interface SavedState {
  letters: (string | null)[]; // 25 cells, null at the four holes
  swaps: number;
  done: boolean;
  won: boolean;
}

const key = (seed: string) => `waffle-${seed}`;

export default function Waffle({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => ({
      letters: generateWaffle(key(s), DEPTH[d]).start,
      swaps: 0,
      done: false,
      won: false
    }));
  const { solution, words } = useMemo(
    () => generateWaffle(key(seed), DEPTH[diff]),
    [seed, diff]
  );
  const [held, setHeld] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const marks = useMemo(() => colorBoard(saved.letters, solution), [saved.letters, solution]);
  const placed = LETTER_CELLS.filter((c) => saved.letters[c] === solution[c]).length;
  const solved = placed === LETTER_CELLS.length;
  const left = BUDGET - saved.swaps;

  useEffect(() => {
    // Solved wins even on the very last swap, so check that first.
    if (solved) finish(true, { won: true });
    else if (saved.swaps >= BUDGET) finish(false, { won: false });
  }, [solved, saved.swaps, finish]);

  function tap(i: number) {
    if (saved.done) return;
    setCursor(i);
    if (held === null || held === i) {
      setHeld(held === i ? null : i);
      return;
    }
    // Trading two identical letters changes nothing, so it costs nothing —
    // spending a swap on an invisible move would read as a bug.
    if (saved.letters[held] === saved.letters[i]) {
      setHeld(null);
      return;
    }
    const letters = saved.letters.slice();
    [letters[held], letters[i]] = [letters[i], letters[held]];
    commit({ ...saved, letters, swaps: saved.swaps + 1 });
    setHeld(null);
  }

  /** Hints make a swap for free; the budget is the whole tension here, so
   *  charging for help would make the button useless when it's needed. */
  function hint() {
    const sw = hintSwap(saved.letters, solution);
    if (!sw) return;
    const letters = saved.letters.slice();
    [letters[sw[0]], letters[sw[1]]] = [letters[sw[1]], letters[sw[0]]];
    commitHint({ ...saved, letters });
    setHeld(null);
  }

  function moveCursor(dr: number, dc: number) {
    let r = Math.floor(cursor / 5);
    let c = cursor % 5;
    for (let step = 0; step < 5; step++) {
      r += dr;
      c += dc;
      if (r < 0 || r > 4 || c < 0 || c > 4) return;
      const i = r * 5 + c;
      if (HOLES.includes(i)) continue;
      setCursor(i);
      tiles.current[i]?.focus();
      return;
    }
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setHeld(null);
    setCursor(0);
  }

  return (
    <div className="game game-waffle">
      <GameHeader title="Waffle" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap two tiles to trade their letters. Sort all six words out in {BUDGET} swaps.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="lights-meta wf-meta">
        <span className={`wf-left${left <= 3 ? " low" : ""}`}>
          <b>{left}</b> swaps left
        </span>
        <span>{placed} of 21 home</span>
      </div>

      <div
        className="wf-grid"
        style={{ "--n": 5 } as CSSProperties}
        role="grid"
        aria-label="Waffle board"
        onKeyDown={(e) => {
          const d = ARROWS[e.key];
          if (!d) return;
          e.preventDefault();
          moveCursor(d[0], d[1]);
        }}
      >
        {[...Array(25).keys()].map((i) => {
          if (HOLES.includes(i))
            return <div key={i} className="wf-hole" aria-hidden="true" />;
          const mark = marks[i] ?? "absent";
          const letter = saved.letters[i] ?? "";
          const r = Math.floor(i / 5) + 1;
          const c = (i % 5) + 1;
          return (
            <button
              key={i}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              role="gridcell"
              className={`wf-cell is-${mark}${held === i ? " held" : ""}`}
              tabIndex={cursor === i ? 0 : -1}
              aria-pressed={held === i}
              aria-label={`${letter}, row ${r} column ${c}, ${MARK_LABEL[mark]}`}
              onClick={() => tap(i)}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {saved.done && !saved.won && (
        <p className="wf-answer">
          The words were{" "}
          {words.map((w, k) => (
            <span key={k}>
              {k > 0 && ", "}
              <b>{w.toUpperCase()}</b>
            </span>
          ))}
          .
        </p>
      )}

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won
              ? `Solved in ${saved.swaps} swap${saved.swaps === 1 ? "" : "s"}!`
              : "Out of swaps"
          }
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
