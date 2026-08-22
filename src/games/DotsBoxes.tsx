import { useEffect, useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 4, medium: 5, hard: 5 };
const HELP =
  "Take turns drawing one line between two dots. Close the fourth side of " +
  "a box and you claim it — and go again. Most boxes wins. The trick is " +
  "the endgame: when every safe line is gone, hand over the shortest chain " +
  "you can.";

interface SavedState {
  h: boolean[]; // (n+1) rows × n
  v: boolean[]; // n rows × (n+1)
  owner: number[]; // -1 open, 0 you, 1 opponent
  turn: number;
  moves: number;
  done: boolean;
  won: boolean;
}

function fresh(n: number): SavedState {
  return {
    h: Array((n + 1) * n).fill(false),
    v: Array(n * (n + 1)).fill(false),
    owner: Array(n * n).fill(-1),
    turn: 0,
    moves: 0,
    done: false,
    won: false
  };
}

type Edge = { kind: "h" | "v"; i: number };

const boxEdges = (b: number, n: number) => {
  const r = Math.floor(b / n), c = b % n;
  return {
    top: r * n + c,
    bottom: (r + 1) * n + c,
    left: r * (n + 1) + c,
    right: r * (n + 1) + c + 1
  };
};

function sidesOf(b: number, n: number, h: boolean[], v: boolean[]): number {
  const e = boxEdges(b, n);
  return (
    (h[e.top] ? 1 : 0) + (h[e.bottom] ? 1 : 0) +
    (v[e.left] ? 1 : 0) + (v[e.right] ? 1 : 0)
  );
}

function openEdges(h: boolean[], v: boolean[]): Edge[] {
  const out: Edge[] = [];
  h.forEach((on, i) => !on && out.push({ kind: "h", i }));
  v.forEach((on, i) => !on && out.push({ kind: "v", i }));
  return out;
}

/** Boxes this edge would complete. */
function completedBy(e: Edge, n: number, h: boolean[], v: boolean[]): number[] {
  const nh = h.slice(), nv = v.slice();
  if (e.kind === "h") nh[e.i] = true;
  else nv[e.i] = true;
  const out: number[] = [];
  for (let b = 0; b < n * n; b++)
    if (sidesOf(b, n, h, v) === 3 && sidesOf(b, n, nh, nv) === 4) out.push(b);
  return out;
}

/** How many boxes a greedy opponent could run off after this edge — the
 *  cost of opening a chain. */
function giveaway(e: Edge, n: number, h0: boolean[], v0: boolean[]): number {
  const h = h0.slice(), v = v0.slice();
  if (e.kind === "h") h[e.i] = true;
  else v[e.i] = true;
  let taken = 0;
  for (;;) {
    let moved = false;
    for (let b = 0; b < n * n; b++) {
      if (sidesOf(b, n, h, v) !== 3) continue;
      const eg = boxEdges(b, n);
      if (!h[eg.top]) h[eg.top] = true;
      else if (!h[eg.bottom]) h[eg.bottom] = true;
      else if (!v[eg.left]) v[eg.left] = true;
      else v[eg.right] = true;
      taken++;
      moved = true;
    }
    if (!moved) break;
  }
  return taken;
}

/** Free boxes first; then a line that gifts nothing; then, when every
 *  line gives something away, the one that gives away least. */
function chooseMove(state: SavedState, n: number, diff: Diff, rng: () => number): Edge | null {
  const { h, v } = state;
  const open = shuffled(openEdges(h, v), rng);
  if (!open.length) return null;

  const free = open.find((e) => completedBy(e, n, h, v).length > 0);
  if (free) return free;
  if (diff === "easy") return open[0];

  const safe = open.filter((e) => {
    const nh = h.slice(), nv = v.slice();
    if (e.kind === "h") nh[e.i] = true;
    else nv[e.i] = true;
    for (let b = 0; b < n * n; b++) if (sidesOf(b, n, nh, nv) === 3) return false;
    return true;
  });
  if (safe.length) return safe[0];
  if (diff === "medium") return open[0];

  let best = open[0];
  let bestCost = Infinity;
  for (const e of open) {
    const cost = giveaway(e, n, h, v);
    if (cost < bestCost) {
      bestCost = cost;
      best = e;
    }
  }
  return best;
}

export default function DotsBoxes({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "dots",
    (_s, d) => fresh(SIZE[d])
  );
  const n = SIZE[diff];

  const scores = useMemo(() => {
    let you = 0, them = 0;
    for (const o of saved.owner) {
      if (o === 0) you++;
      else if (o === 1) them++;
    }
    return { you, them };
  }, [saved.owner]);

  /** Draw an edge for `who`; closing a box keeps the turn. */
  function play(e: Edge, who: number) {
    const h = saved.h.slice(), v = saved.v.slice();
    if (e.kind === "h") h[e.i] = true;
    else v[e.i] = true;
    const owner = saved.owner.slice();
    let claimed = 0;
    for (let b = 0; b < n * n; b++)
      if (owner[b] === -1 && sidesOf(b, n, h, v) === 4) {
        owner[b] = who;
        claimed++;
      }
    const full = openEdges(h, v).length === 0;
    const you = owner.filter((o) => o === 0).length;
    const them = owner.filter((o) => o === 1).length;
    const next: SavedState = {
      h,
      v,
      owner,
      turn: claimed > 0 ? who : 1 - who,
      moves: saved.moves + 1,
      done: full,
      won: full && you > them
    };
    commit(next, { undoable: false });
    if (full) recordResult("dots", next.won);
  }

  useEffect(() => {
    if (saved.done || saved.turn !== 1) return;
    const t = window.setTimeout(() => {
      const rng = makeRng(`dots-${seed}-${saved.moves}`);
      const move = chooseMove(saved, n, diff, rng);
      if (move) play(move, 1);
    }, 340);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, seed, n, diff]);

  const yourTurn = saved.turn === 0 && !saved.done;

  // One CSS grid holds dots, both edge orientations, and the boxes.
  const span = 2 * n + 1;

  return (
    <div className="game game-dots">
      <GameHeader title="Dots & Boxes" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        {saved.done
          ? "Game over."
          : yourTurn
            ? "Your line."
            : "Opponent thinking…"}
      </p>
      <GameTools diff={diff} onDiff={newPuzzle} help={HELP} />

      <div className="db-score">
        <span className="db-you">
          You <b>{scores.you}</b>
        </span>
        <span className="db-them">
          Opponent <b>{scores.them}</b>
        </span>
      </div>

      <div
        className="db-board"
        style={{ "--n": n } as CSSProperties}
        role="group"
        aria-label="Dots and boxes"
      >
        {Array.from({ length: span * span }, (_, k) => {
          const gr = Math.floor(k / span), gc = k % span;
          if (gr % 2 === 0 && gc % 2 === 0)
            return <span key={k} className="db-dot" />;
          if (gr % 2 === 0) {
            const i = (gr / 2) * n + (gc - 1) / 2;
            return (
              <button
                key={k}
                className={`db-edge db-h${saved.h[i] ? " on" : ""}`}
                disabled={saved.h[i] || !yourTurn}
                onClick={() => play({ kind: "h", i }, 0)}
                aria-label="Horizontal line"
              />
            );
          }
          if (gc % 2 === 0) {
            const i = ((gr - 1) / 2) * (n + 1) + gc / 2;
            return (
              <button
                key={k}
                className={`db-edge db-v${saved.v[i] ? " on" : ""}`}
                disabled={saved.v[i] || !yourTurn}
                onClick={() => play({ kind: "v", i }, 0)}
                aria-label="Vertical line"
              />
            );
          }
          const b = ((gr - 1) / 2) * n + (gc - 1) / 2;
          const o = saved.owner[b];
          return (
            <span key={k} className={`db-box${o === 0 ? " you" : o === 1 ? " them" : ""}`}>
              {o === 0 ? "●" : o === 1 ? "○" : ""}
            </span>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="dots"
          won={saved.won}
          message={
            scores.you === scores.them
              ? `Dead heat, ${scores.you} apiece`
              : saved.won
                ? `You win ${scores.you}–${scores.them}!`
                : `Lost ${scores.you}–${scores.them}`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
