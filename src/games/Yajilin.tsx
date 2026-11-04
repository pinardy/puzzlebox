import { useEffect, useMemo, type CSSProperties } from "react";
import { useGridNav } from "../lib/gridnav";
import type { EdgeState } from "../lib/slither";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import {
  DIR_ARROW,
  DIR_NAME,
  cellDegree,
  freshEdges,
  generateYajilin,
  rayCount,
  yajilinSolved
} from "../lib/yajilin";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Yajilin.css";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const HELP =
  "Draw one closed loop through cell centres that visits every white cell. " +
  "Grey cells hold an arrow and a number: that many cells are shaded in " +
  "that direction, in the same row or column, all the way to the edge. " +
  "Shaded cells never touch each other side by side, and the loop never " +
  "enters a grey or a shaded cell. Tap a white cell to shade it; tap the " +
  "gap between two cells to draw or erase the segment joining them (a " +
  "second tap marks it × as ruled out).";

interface SavedState {
  edges: EdgeState; // 0 empty, 1 line, 2 ✕
  shaded: boolean[];
  done: boolean;
}

const fresh = (n: number): SavedState => ({
  edges: freshEdges(n),
  shaded: Array(n * n).fill(false),
  done: false
});

export default function Yajilin({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => fresh(SIZE[d]));
  const n = SIZE[diff];
  const puzzle = useMemo(() => generateYajilin(`yajilin-${seed}`, n), [seed, n]);

  const view = useMemo(() => {
    const deg = Array.from({ length: n * n }, (_, i) => cellDegree(n, saved.edges, i));
    // A cell is wrong when two shaded cells touch, when the loop runs into
    // a grey or shaded cell, or when a clue's ray holds too many shades.
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n),
        c = i % n;
      if (saved.shaded[i]) {
        if (deg[i] > 0) bad.add(i);
        for (const j of [c > 0 ? i - 1 : -1, r > 0 ? i - n : -1])
          if (j >= 0 && saved.shaded[j]) {
            bad.add(i);
            bad.add(j);
          }
      } else if (puzzle.clues[i] && deg[i] > 0) bad.add(i);
    }
    let okClues = 0,
      total = 0;
    const clueState = puzzle.clues.map((cl, i) => {
      if (!cl) return "";
      total++;
      const got = rayCount(n, i, cl.dir, saved.shaded);
      if (got === cl.count) {
        okClues++;
        return "ok";
      }
      return got > cl.count ? "over" : "";
    });
    const shadedCount = saved.shaded.filter(Boolean).length;
    return { deg, bad, clueState, okClues, total, shadedCount };
  }, [n, saved.edges, saved.shaded, puzzle]);

  const solved = useMemo(
    () => yajilinSolved(puzzle, saved.edges, saved.shaded),
    [puzzle, saved.edges, saved.shaded]
  );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  /** Cycle a segment empty → line → ✕ (`back` runs the cycle the other way). */
  function tapEdge(kind: "h" | "v", idx: number, back = false) {
    if (saved.done) return;
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][idx] = (edges[kind][idx] + (back ? 2 : 1)) % 3;
    commit({ ...saved, edges });
  }

  function tapCell(i: number) {
    if (saved.done || puzzle.clues[i]) return;
    const shaded = saved.shaded.slice();
    shaded[i] = !shaded[i];
    commit({ ...saved, shaded });
  }

  // Cells and the segments between them are all focusable: cells are
  // 0..n²-1, horizontal segments follow, then vertical ones. Arrows move
  // to the nearest one on screen; Enter shades a cell or cycles a segment
  // (Shift+Enter cycles a segment back).
  const N2 = n * n,
    H = n * (n - 1);
  const nav = useGridNav((i, back) => {
    if (i < N2) tapCell(i);
    else if (i < N2 + H) tapEdge("h", i - N2, back);
    else tapEdge("v", i - N2 - H, back);
  });

  /** Fix one cell or segment that disagrees with the generated answer. */
  function hint() {
    if (saved.done) return;
    const sol = puzzle.solution;
    const wrong: ["c" | "h" | "v", number][] = [];
    saved.shaded.forEach((on, i) => {
      if (!puzzle.clues[i] && on !== sol.shaded[i]) wrong.push(["c", i]);
    });
    saved.edges.h.forEach((m, i) => {
      if ((m === 1) !== (sol.edges.h[i] === 1)) wrong.push(["h", i]);
    });
    saved.edges.v.forEach((m, i) => {
      if ((m === 1) !== (sol.edges.v[i] === 1)) wrong.push(["v", i]);
    });
    if (!wrong.length) return;
    const [kind, i] = wrong[Math.floor(Math.random() * wrong.length)];
    if (kind === "c") {
      const shaded = saved.shaded.slice();
      shaded[i] = sol.shaded[i];
      commitHint({ ...saved, shaded });
      return;
    }
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][i] = sol.edges[kind][i] === 1 ? 1 : 2;
    commitHint({ ...saved, edges });
  }

  const G = 2 * n - 1;
  const track =
    Array(n - 1)
      .fill("1fr 0.55fr")
      .join(" ") + " 1fr";
  const edgeMark = (m: number) => (m === 1 ? "line" : m === 2 ? "off" : "");
  const edgeState = (m: number) => (m === 1 ? "line" : m === 2 ? "crossed" : "empty");
  const edgeBad = (m: number, a: number, b: number) =>
    m === 1 && [a, b].some((i) => saved.shaded[i] || puzzle.clues[i]) ? " bad" : "";

  return (
    <div className="game game-yajilin">
      <GameHeader title="Yajilin" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Shade cells to match every arrow, then loop through all the rest.
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
        className="yj-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Yajilin board"
        {...nav}
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G),
            gc = k % G;
          const r = gr >> 1,
            c = gc >> 1;

          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = r * n + c;
            const where = `Row ${r + 1}, column ${c + 1}`;
            const clue = puzzle.clues[i];
            if (clue) {
              const state = view.clueState[i];
              return (
                <div
                  key={k}
                  role="gridcell"
                  className={`yj-cell yj-clue ${state}${view.bad.has(i) ? " bad" : ""}`}
                  aria-label={`${where}, clue ${clue.count} ${DIR_NAME[clue.dir]}, ${
                    state === "ok" ? "satisfied" : state === "over" ? "too many" : "unmet"
                  }`}
                >
                  <span className="yj-arrow" aria-hidden="true">
                    {DIR_ARROW[clue.dir]}
                  </span>
                  <span className="yj-num" aria-hidden="true">
                    {clue.count}
                    {state === "over" ? "!" : ""}
                  </span>
                </div>
              );
            }
            const shaded = saved.shaded[i];
            const flag = view.bad.has(i);
            return (
              <button
                key={k}
                role="gridcell"
                data-cell={i}
                className={[
                  "yj-cell",
                  shaded ? "shade" : "",
                  flag ? "bad" : "",
                  !shaded && view.deg[i] === 2 ? "on" : ""
                ].join(" ")}
                onClick={() => tapCell(i)}
                aria-pressed={shaded}
                aria-label={`${where}, ${shaded ? "shaded" : view.deg[i] === 2 ? "on the loop" : "empty"}${
                  flag ? ", conflict" : ""
                }`}
              >
                {flag ? "!" : shaded ? "" : "·"}
              </button>
            );
          }

          if (gr % 2 === 0 && gc % 2 === 1) {
            const idx = r * (n - 1) + c;
            const m = saved.edges.h[idx];
            return (
              <button
                key={k}
                data-cell={N2 + idx}
                className={`yj-edge h ${edgeMark(m)}${edgeBad(m, r * n + c, r * n + c + 1)}`}
                onClick={() => tapEdge("h", idx)}
                aria-label={`Segment right of row ${r + 1}, column ${c + 1}, ${edgeState(m)}`}
              >
                {m === 2 ? "×" : ""}
              </button>
            );
          }

          if (gr % 2 === 1 && gc % 2 === 0) {
            const idx = r * n + c;
            const m = saved.edges.v[idx];
            return (
              <button
                key={k}
                data-cell={N2 + H + idx}
                className={`yj-edge v ${edgeMark(m)}${edgeBad(m, r * n + c, (r + 1) * n + c)}`}
                onClick={() => tapEdge("v", idx)}
                aria-label={`Segment below row ${r + 1}, column ${c + 1}, ${edgeState(m)}`}
              >
                {m === 2 ? "×" : ""}
              </button>
            );
          }
          return <span key={k} className="yj-nub" />;
        })}
      </div>

      <div className="lights-meta">
        <span>
          {view.shadedCount} shaded · {view.okClues}/{view.total} arrows
        </span>
        <button className="mini-btn" onClick={() => commit(fresh(n))}>
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Loop closed, every arrow counted!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
