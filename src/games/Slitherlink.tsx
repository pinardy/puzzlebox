import { useEffect, useMemo, type CSSProperties } from "react";
import { generateSlither, slitherSolved, EdgeState } from "../lib/slither";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 5, hard: 7 };
const HELP =
  "Draw a single closed loop along the grid lines — it never branches or " +
  "crosses itself. Each number says how many of the four edges around that " +
  "square belong to the loop. Mark ✕ on edges you've ruled out.";

interface SavedState {
  edges: EdgeState; // 0 empty, 1 line, 2 ✕
  done: boolean;
}

function fresh(n: number): SavedState {
  return {
    edges: { h: Array((n + 1) * n).fill(0), v: Array(n * (n + 1)).fill(0) },
    done: false
  };
}

export default function Slitherlink({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("slither", (_s, d) => fresh(SIZE[d]));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateSlither(`slither-${seed}`, n), [seed, n]);

  useEffect(() => {
    if (!saved.done && slitherSolved(puzzle, saved.edges)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("slither", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, puzzle]);

  function tapEdge(kind: "h" | "v", idx: number) {
    if (saved.done) return;
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][idx] = (edges[kind][idx] + 1) % 3;
    commit({ ...saved, edges });
  }

  const G = 2 * n + 1;
  const track = "14px " + Array(n).fill("1fr 14px").join(" ");
  const edgeMark = (m: number) => (m === 1 ? "line" : m === 2 ? "off" : "");

  return (
    <div className="game game-slither">
      <GameHeader title="Slitherlink" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        One closed loop; numbers count the loop edges around that square.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="slither-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Slitherlink board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0)
            return <span key={k} className="slither-dot" aria-hidden="true" />;
          if (gr % 2 === 0) {
            const idx = (gr / 2) * n + (gc - 1) / 2;
            return (
              <button
                key={k}
                className={`slither-edge h ${edgeMark(saved.edges.h[idx])}`}
                onClick={() => tapEdge("h", idx)}
                aria-label="Horizontal edge"
              >
                {saved.edges.h[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          if (gc % 2 === 0) {
            const idx = ((gr - 1) / 2) * (n + 1) + gc / 2;
            return (
              <button
                key={k}
                className={`slither-edge v ${edgeMark(saved.edges.v[idx])}`}
                onClick={() => tapEdge("v", idx)}
                aria-label="Vertical edge"
              >
                {saved.edges.v[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          const cell = ((gr - 1) / 2) * n + (gc - 1) / 2;
          return (
            <span key={k} className="slither-cell">
              {puzzle.clues[cell] ?? ""}
            </span>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>{saved.edges.h.filter((m) => m === 1).length + saved.edges.v.filter((m) => m === 1).length} edges drawn</span>
        <button className="mini-btn" onClick={() => commit(fresh(n))}>
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="slither"
          won
          message="The loop is closed!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
