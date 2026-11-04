import { useEffect, useMemo, type CSSProperties } from "react";
import { generateSlither, slitherSolved, EdgeState } from "../lib/slither";
import { useGridNav } from "../lib/gridnav";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Slitherlink.css";

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
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => fresh(SIZE[d]));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateSlither(`slither-${seed}`, n), [seed, n]);

  const solved = useMemo(() => slitherSolved(puzzle, saved.edges), [puzzle, saved.edges]);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  /** Cycle an edge empty → line → ✕ (`back` runs the cycle the other way). */
  function tapEdge(kind: "h" | "v", idx: number, back = false) {
    if (saved.done) return;
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][idx] = (edges[kind][idx] + (back ? 2 : 1)) % 3;
    commit({ ...saved, edges });
  }

  // Every edge is a focusable cell: horizontal edges first, then vertical
  // ones offset by H. The squares (offset by H + V) are stops too, so the
  // arrows step edge → square → edge across the board and reach both kinds
  // of edge; Enter cycles the focused edge, Shift+Enter cycles it back.
  const H = (n + 1) * n,
    V = n * (n + 1);
  const nav = useGridNav((i, back) => {
    if (i < H) tapEdge("h", i, back);
    else if (i < H + V) tapEdge("v", i - H, back);
  });

  /** Draw or erase one edge so it agrees with the generated loop. */
  function hint() {
    if (saved.done) return;
    const sol = puzzle.solution;
    const wrong: ["h" | "v", number][] = [];
    saved.edges.h.forEach((m, i) => {
      if ((m === 1) !== (sol.h[i] === 1)) wrong.push(["h", i]);
    });
    saved.edges.v.forEach((m, i) => {
      if ((m === 1) !== (sol.v[i] === 1)) wrong.push(["v", i]);
    });
    if (!wrong.length) return;
    const [kind, i] = wrong[Math.floor(Math.random() * wrong.length)];
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][i] = sol[kind][i] === 1 ? 1 : 2;
    commitHint({ ...saved, edges });
  }

  const edgeState = (m: number) => (m === 1 ? "line" : m === 2 ? "crossed" : "empty");

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
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="slither-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Slitherlink board"
        {...nav}
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G),
            gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0)
            return <span key={k} className="slither-dot" aria-hidden="true" />;
          if (gr % 2 === 0) {
            const idx = (gr / 2) * n + (gc - 1) / 2;
            const row = gr / 2,
              col = (gc - 1) / 2 + 1;
            return (
              <button
                key={k}
                data-cell={idx}
                className={`slither-edge h ${edgeMark(saved.edges.h[idx])}`}
                onClick={() => tapEdge("h", idx)}
                aria-label={`${
                  row < n ? `Top edge of row ${row + 1}` : `Bottom edge of row ${n}`
                }, column ${col}, ${edgeState(saved.edges.h[idx])}`}
              >
                {saved.edges.h[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          if (gc % 2 === 0) {
            const idx = ((gr - 1) / 2) * (n + 1) + gc / 2;
            const row = (gr - 1) / 2 + 1,
              col = gc / 2;
            return (
              <button
                key={k}
                data-cell={H + idx}
                className={`slither-edge v ${edgeMark(saved.edges.v[idx])}`}
                onClick={() => tapEdge("v", idx)}
                aria-label={`${
                  col < n ? `Left edge of column ${col + 1}` : `Right edge of column ${n}`
                }, row ${row}, ${edgeState(saved.edges.v[idx])}`}
              >
                {saved.edges.v[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          const cell = ((gr - 1) / 2) * n + (gc - 1) / 2;
          return (
            <span
              key={k}
              className="slither-cell"
              role="gridcell"
              data-cell={H + V + cell}
              aria-label={`Row ${(gr - 1) / 2 + 1}, column ${(gc - 1) / 2 + 1}, ${
                puzzle.clues[cell] === null ? "no clue" : `clue ${puzzle.clues[cell]}`
              }`}
            >
              {puzzle.clues[cell] ?? ""}
            </span>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>
          {saved.edges.h.filter((m) => m === 1).length +
            saved.edges.v.filter((m) => m === 1).length}{" "}
          edges drawn
        </span>
        <button className="mini-btn" onClick={() => commit(fresh(n))}>
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="The loop is closed!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
