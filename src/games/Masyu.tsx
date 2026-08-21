import { useEffect, useMemo, type CSSProperties } from "react";
import { generateMasyu, masyuSolved } from "../lib/masyu";
import type { EdgeState } from "../lib/slither";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 8 };
const HELP =
  "Draw one closed loop through cell centres. The loop must pass every " +
  "pearl: at a black pearl it turns, then runs straight through the next " +
  "cell on both sides; at a white pearl it runs straight, but turns in the " +
  "very next cell on at least one side. Tap between two cells to draw.";

interface SavedState {
  edges: EdgeState; // 0 empty, 1 line, 2 ✕
  done: boolean;
}

function fresh(n: number): SavedState {
  return {
    edges: { h: Array(n * (n - 1)).fill(0), v: Array((n - 1) * n).fill(0) },
    done: false
  };
}

export default function Masyu({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("masyu", (_s, d) => fresh(SIZE[d]));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateMasyu(`masyu-${seed}`, n), [seed, n]);

  useEffect(() => {
    if (!saved.done && masyuSolved(puzzle, saved.edges)) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("masyu", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, puzzle]);

  function tapEdge(kind: "h" | "v", idx: number) {
    if (saved.done) return;
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][idx] = (edges[kind][idx] + 1) % 3;
    commit({ ...saved, edges });
  }

  const G = 2 * n - 1;
  const track = Array(n - 1).fill("1fr 0.5fr").join(" ") + " 1fr";
  const edgeMark = (m: number) => (m === 1 ? "line" : m === 2 ? "off" : "");

  return (
    <div className="game game-masyu">
      <GameHeader title="Masyu" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        One loop through the pearls: ● turn here, ○ pass straight through.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="masyu-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Masyu board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = (gr / 2) * n + gc / 2;
            const pearl = puzzle.pearls.get(i);
            return (
              <span
                key={k}
                className={`masyu-cell${pearl ? ` pearl-${pearl}` : ""}`}
                aria-label={pearl ? `${pearl} pearl` : undefined}
              >
                {pearl === "black" ? "⬤" : pearl === "white" ? "◯" : "·"}
              </span>
            );
          }
          if (gr % 2 === 0 && gc % 2 === 1) {
            const idx = (gr / 2) * (n - 1) + (gc - 1) / 2;
            return (
              <button
                key={k}
                className={`slither-edge h ${edgeMark(saved.edges.h[idx])}`}
                onClick={() => tapEdge("h", idx)}
                aria-label="Horizontal segment"
              >
                {saved.edges.h[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          if (gr % 2 === 1 && gc % 2 === 0) {
            const idx = ((gr - 1) / 2) * n + gc / 2;
            return (
              <button
                key={k}
                className={`slither-edge v ${edgeMark(saved.edges.v[idx])}`}
                onClick={() => tapEdge("v", idx)}
                aria-label="Vertical segment"
              >
                {saved.edges.v[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          return <span key={k} />;
        })}
      </div>

      <div className="lights-meta">
        <span>
          {saved.edges.h.filter((m) => m === 1).length +
            saved.edges.v.filter((m) => m === 1).length}{" "}
          segments drawn
        </span>
        <button className="mini-btn" onClick={() => commit(fresh(n))}>
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="masyu"
          won
          message="Every pearl satisfied!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
