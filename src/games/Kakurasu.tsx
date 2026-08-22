import { useEffect, useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const HELP =
  "Every square is worth its position in the line: the first column (or " +
  "row) scores 1, the second 2, and so on. Shade squares so each row adds " +
  "up to the number on its right, and each column to the number below it. " +
  "The little grey numbers along the top and left are the weights.";

interface Puzzle {
  rowTargets: number[];
  colTargets: number[];
  solution: boolean[];
}

function generateKakurasu(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const solution = Array.from({ length: n * n }, () => rng() < 0.42);
    const shaded = solution.filter(Boolean).length;
    if (shaded < n || shaded > n * n - n) continue;
    const rowTargets = Array.from({ length: n }, (_, r) => {
      let s = 0;
      for (let c = 0; c < n; c++) if (solution[r * n + c]) s += c + 1;
      return s;
    });
    const colTargets = Array.from({ length: n }, (_, c) => {
      let s = 0;
      for (let r = 0; r < n; r++) if (solution[r * n + c]) s += r + 1;
      return s;
    });
    return { rowTargets, colTargets, solution };
  }
}

interface SavedState {
  shaded: boolean[];
  done: boolean;
}

export default function Kakurasu({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("kakurasu", (_s, d) => ({
      shaded: Array(SIZE[d] * SIZE[d]).fill(false),
      done: false
    }));
  const n = SIZE[diff];
  const { rowTargets, colTargets } = useMemo(
    () => generateKakurasu(`kakurasu-${seed}`, n),
    [seed, n]
  );

  const sums = useMemo(() => {
    const rows = Array.from({ length: n }, (_, r) => {
      let s = 0;
      for (let c = 0; c < n; c++) if (saved.shaded[r * n + c]) s += c + 1;
      return s;
    });
    const cols = Array.from({ length: n }, (_, c) => {
      let s = 0;
      for (let r = 0; r < n; r++) if (saved.shaded[r * n + c]) s += r + 1;
      return s;
    });
    return { rows, cols };
  }, [saved.shaded, n]);

  useEffect(() => {
    if (
      !saved.done &&
      sums.rows.every((s, r) => s === rowTargets[r]) &&
      sums.cols.every((s, c) => s === colTargets[c])
    ) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("kakurasu", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sums, saved]);

  function toggle(i: number) {
    if (saved.done) return;
    const shaded = saved.shaded.slice();
    shaded[i] = !shaded[i];
    commit({ ...saved, shaded });
  }

  const mark = (got: number, want: number) =>
    got === want ? "ok" : got > want ? "over" : "";

  return (
    <div className="game game-kakurasu">
      <GameHeader title="Kakurasu" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Shade squares so every row and column hits its total.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="ks-grid"
        style={{ "--n": n + 2 } as CSSProperties}
        role="grid"
        aria-label="Kakurasu board"
      >
        <span className="ks-pad" />
        {Array.from({ length: n }, (_, c) => (
          <span key={`w${c}`} className="ks-weight">
            {c + 1}
          </span>
        ))}
        <span className="ks-pad" />

        {Array.from({ length: n }, (_, r) => [
          <span key={`lw${r}`} className="ks-weight">
            {r + 1}
          </span>,
          ...Array.from({ length: n }, (_, c) => {
            const i = r * n + c;
            return (
              <button
                key={i}
                role="gridcell"
                className={`ks-cell${saved.shaded[i] ? " on" : ""}`}
                onClick={() => toggle(i)}
                aria-pressed={saved.shaded[i]}
                aria-label={`Row ${r + 1} column ${c + 1}`}
              />
            );
          }),
          <span key={`rt${r}`} className={`ks-target ${mark(sums.rows[r], rowTargets[r])}`}>
            {rowTargets[r]}
          </span>
        ])}

        <span className="ks-pad" />
        {Array.from({ length: n }, (_, c) => (
          <span key={`ct${c}`} className={`ks-target ${mark(sums.cols[c], colTargets[c])}`}>
            {colTargets[c]}
          </span>
        ))}
        <span className="ks-pad" />
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="kakurasu"
          won
          message="Every line adds up!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
