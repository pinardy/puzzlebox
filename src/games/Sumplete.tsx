import { useEffect, useMemo, type CSSProperties } from "react";
import { generateSumplete, lineSums } from "../lib/sumplete";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 6, hard: 8 };
const HELP =
  "Every row has a total on its right and every column one below it. " +
  "Cross out numbers until the numbers still standing in each row add up " +
  "to exactly that row's total, and likewise down every column. Tap a " +
  "number to cross it out, tap it again to bring it back. A total turns " +
  "green when its line is right and red once the line has overshot — an " +
  "overshot line can only be fixed by crossing something else out.";

interface SavedState {
  crossed: boolean[];
  done: boolean;
}

export default function Sumplete({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => ({
      crossed: Array(SIZE[d] * SIZE[d]).fill(false),
      done: false
    }));
  const n = SIZE[diff];
  const { values, solution, rowTargets, colTargets } = useMemo(
    () => generateSumplete(`sumplete-${seed}`, n),
    [seed, n]
  );

  const kept = useMemo(() => saved.crossed.map((x) => !x), [saved.crossed]);
  const sums = useMemo(() => lineSums(values, kept, n), [values, kept, n]);

  const rowsOk = useMemo(
    () => sums.rows.filter((s, r) => s === rowTargets[r]).length,
    [sums.rows, rowTargets]
  );
  const colsOk = useMemo(
    () => sums.cols.filter((s, c) => s === colTargets[c]).length,
    [sums.cols, colTargets]
  );

  useEffect(() => {
    if (!saved.done && rowsOk === n && colsOk === n) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("sumplete", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsOk, colsOk, n, saved]);

  function toggle(i: number) {
    if (saved.done) return;
    const crossed = saved.crossed.slice();
    crossed[i] = !crossed[i];
    commit({ ...saved, crossed });
  }

  /** Set one wrong cell to the state it has in the generator's solution.
   *  That solution stays consistent with the targets, so the nudge is
   *  always safe even though other solutions may exist. */
  function hint() {
    const wrong = [...Array(n * n).keys()].filter((i) => kept[i] !== solution[i]);
    if (!wrong.length) return;
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    const crossed = saved.crossed.slice();
    crossed[i] = !solution[i];
    commitHint({ ...saved, crossed });
  }

  const mark = (got: number, want: number) =>
    got === want ? " ok" : got > want ? " over" : "";
  const crossedCount = saved.crossed.filter(Boolean).length;

  return (
    <div className="game game-sumplete">
      <GameHeader title="Sumplete" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Cross out numbers until every row and column hits its total.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="sp-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Sumplete board"
      >
        {Array.from({ length: n }, (_, r) => [
          ...Array.from({ length: n }, (_, c) => {
            const i = r * n + c;
            const out = saved.crossed[i];
            return (
              <button
                key={i}
                role="gridcell"
                className={`sp-cell${out ? " out" : ""}`}
                onClick={() => toggle(i)}
                aria-pressed={out}
                aria-label={`Row ${r + 1} column ${c + 1}, ${values[i]}${
                  out ? ", crossed out" : ""
                }`}
              >
                {values[i]}
              </button>
            );
          }),
          <span
            key={`rt${r}`}
            className={`sp-target row${mark(sums.rows[r], rowTargets[r])}`}
          >
            {rowTargets[r]}
          </span>
        ])}

        {Array.from({ length: n }, (_, c) => (
          <span
            key={`ct${c}`}
            className={`sp-target col${mark(sums.cols[c], colTargets[c])}`}
          >
            {colTargets[c]}
          </span>
        ))}
        <span className="sp-corner" aria-hidden="true">
          Σ
        </span>
      </div>

      <div className="lights-meta">
        <span>
          Lines done {rowsOk + colsOk}/{n * 2}
        </span>
        <span>Crossed out {crossedCount}</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every line adds up!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
