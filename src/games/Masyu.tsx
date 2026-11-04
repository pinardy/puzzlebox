import { useEffect, useMemo, type CSSProperties } from "react";
import { generateMasyu, masyuSolved } from "../lib/masyu";
import type { EdgeState } from "../lib/slither";
import { useGridNav } from "../lib/gridnav";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Masyu.css";

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
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => fresh(SIZE[d]));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateMasyu(`masyu-${seed}`, n), [seed, n]);

  const solved = useMemo(() => masyuSolved(puzzle, saved.edges), [puzzle, saved.edges]);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  /** Cycle a link empty → line → ✕ (`back` runs the cycle the other way). */
  function tapEdge(kind: "h" | "v", idx: number, back = false) {
    if (saved.done) return;
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][idx] = (edges[kind][idx] + (back ? 2 : 1)) % 3;
    commit({ ...saved, edges });
  }

  // Every link between two cells is a focusable cell: horizontal links
  // first, then vertical ones offset by H. The cells (offset by 2H) are
  // stops too, so the arrows step cell → link → cell and reach both kinds
  // of link; Enter cycles the focused link, Shift+Enter cycles it back.
  const H = n * (n - 1);
  const nav = useGridNav((i, back) => {
    if (i < H) tapEdge("h", i, back);
    else if (i < 2 * H) tapEdge("v", i - H, back);
  });

  /** Draw or erase one link so it agrees with the generated loop. */
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

  const G = 2 * n - 1;
  const track =
    Array(n - 1)
      .fill("1fr 0.5fr")
      .join(" ") + " 1fr";
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
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="masyu-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Masyu board"
        {...nav}
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G),
            gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = (gr / 2) * n + gc / 2;
            const pearl = puzzle.pearls.get(i);
            return (
              <span
                key={k}
                className={`masyu-cell${pearl ? ` pearl-${pearl}` : ""}`}
                role="gridcell"
                data-cell={2 * H + i}
                aria-label={`Row ${gr / 2 + 1}, column ${gc / 2 + 1}, ${
                  pearl ? `${pearl} pearl` : "no pearl"
                }`}
              >
                {pearl === "black" ? "⬤" : pearl === "white" ? "◯" : "·"}
              </span>
            );
          }
          if (gr % 2 === 0 && gc % 2 === 1) {
            const idx = (gr / 2) * (n - 1) + (gc - 1) / 2;
            const r = gr / 2 + 1,
              c = (gc - 1) / 2 + 1;
            return (
              <button
                key={k}
                data-cell={idx}
                className={`slither-edge h ${edgeMark(saved.edges.h[idx])}`}
                onClick={() => tapEdge("h", idx)}
                aria-label={`Link from row ${r}, column ${c} to column ${c + 1}, ${edgeState(
                  saved.edges.h[idx]
                )}`}
              >
                {saved.edges.h[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          if (gr % 2 === 1 && gc % 2 === 0) {
            const idx = ((gr - 1) / 2) * n + gc / 2;
            const r = (gr - 1) / 2 + 1,
              c = gc / 2 + 1;
            return (
              <button
                key={k}
                data-cell={H + idx}
                className={`slither-edge v ${edgeMark(saved.edges.v[idx])}`}
                onClick={() => tapEdge("v", idx)}
                aria-label={`Link from column ${c}, row ${r} to row ${r + 1}, ${edgeState(
                  saved.edges.v[idx]
                )}`}
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
          won
          message="Every pearl satisfied!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
