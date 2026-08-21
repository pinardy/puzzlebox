import { useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 7, hard: 9 };
const HELP =
  "Every tile holds a piece of pipe. Tap a tile to rotate it a quarter " +
  "turn. Reconnect everything into one network with no open ends — pipes " +
  "glow once they're connected to the centre.";

// Direction bits: U=1, R=2, D=4, L=8. Rotating clockwise maps U→R→D→L.
const U = 1, R = 2, D = 4, L = 8;
const rot = (m: number, times: number): number =>
  ((m << times) | (m >> (4 - times))) & 15;

/** Random spanning tree over the grid — each cell's connection mask. */
function generateNet(seed: string, n: number): number[] {
  const rng = makeRng(seed);
  const masks = Array(n * n).fill(0);
  const inTree = Array(n * n).fill(false);
  const start = Math.floor(rng() * n * n);
  inTree[start] = true;
  const frontier: [number, number, number, number][] = []; // from, to, bitFrom, bitTo

  const pushEdges = (i: number) => {
    const r = Math.floor(i / n), c = i % n;
    if (r > 0 && !inTree[i - n]) frontier.push([i, i - n, U, D]);
    if (r < n - 1 && !inTree[i + n]) frontier.push([i, i + n, D, U]);
    if (c > 0 && !inTree[i - 1]) frontier.push([i, i - 1, L, R]);
    if (c < n - 1 && !inTree[i + 1]) frontier.push([i, i + 1, R, L]);
  };
  pushEdges(start);
  while (frontier.length) {
    const k = Math.floor(rng() * frontier.length);
    const [from, to, bitFrom, bitTo] = frontier[k];
    frontier.splice(k, 1);
    if (inTree[to]) continue;
    inTree[to] = true;
    masks[from] |= bitFrom;
    masks[to] |= bitTo;
    pushEdges(to);
  }
  return masks;
}

function scramble(seed: string, n: number): number[] {
  const rng = makeRng(`${seed}-rot`);
  for (;;) {
    const rots = Array.from({ length: n * n }, () => Math.floor(rng() * 4));
    if (rots.some((x) => x !== 0)) return rots;
  }
}

/** Tiles reachable from the centre through matched joins. */
function reachable(masks: number[], n: number): Set<number> {
  const centre = Math.floor(n / 2) * n + Math.floor(n / 2);
  const seen = new Set([centre]);
  const stack = [centre];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n), c = i % n;
    const m = masks[i];
    const tryGo = (j: number, need: number) => {
      if (!seen.has(j) && masks[j] & need) {
        seen.add(j);
        stack.push(j);
      }
    };
    if (m & U && r > 0) tryGo(i - n, D);
    if (m & D && r < n - 1) tryGo(i + n, U);
    if (m & L && c > 0) tryGo(i - 1, R);
    if (m & R && c < n - 1) tryGo(i + 1, L);
  }
  return seen;
}

/** Solved: no open or mismatched pipe ends, and one connected network. */
function solved(masks: number[], n: number): boolean {
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const m = masks[i];
    if (m & U && (r === 0 || !(masks[i - n] & D))) return false;
    if (m & D && (r === n - 1 || !(masks[i + n] & U))) return false;
    if (m & L && (c === 0 || !(masks[i - 1] & R))) return false;
    if (m & R && (c === n - 1 || !(masks[i + 1] & L))) return false;
  }
  return reachable(masks, n).size === n * n;
}

interface SavedState {
  rots: number[];
  taps: number;
  done: boolean;
}

export default function Net({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("net", (s, d) => ({
      rots: scramble(`net-${s}`, SIZE[d]),
      taps: 0,
      done: false
    }));
  const n = SIZE[diff];
  const base = useMemo(() => generateNet(`net-${seed}`, n), [seed, n]);

  const masks = useMemo(
    () => base.map((m, i) => rot(m, saved.rots[i] % 4)),
    [base, saved.rots]
  );

  const lit = useMemo(() => reachable(masks, n), [masks, n]);

  function tap(i: number) {
    if (saved.done) return;
    const rots = saved.rots.slice();
    rots[i] = (rots[i] + 1) % 4;
    const nextMasks = base.map((m, k) => rot(m, rots[k] % 4));
    const done = solved(nextMasks, n);
    commit({ rots, taps: saved.taps + 1, done });
    if (done && !saved.done) recordResult("net", true);
  }

  return (
    <div className="game game-net">
      <GameHeader title="Pipes" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Tap tiles to rotate. Join every pipe into one glowing network.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>
          Taps: {saved.taps} · {lit.size}/{n * n} connected
        </span>
      </div>

      <div
        className="net-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Pipes board"
      >
        {masks.map((m, i) => {
          const arms: string[] = [];
          if (m & U) arms.push("u");
          if (m & R) arms.push("r");
          if (m & D) arms.push("d");
          if (m & L) arms.push("l");
          const terminal = arms.length === 1;
          const centre = i === Math.floor(n / 2) * n + Math.floor(n / 2);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "net-cell",
                lit.has(i) ? "lit" : "",
                centre ? "centre" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {arms.map((a) => (
                <span key={a} className={`net-arm arm-${a}`} />
              ))}
              <span className={`net-core${terminal ? " terminal" : ""}`} />
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="net"
          won
          message={`Network sealed in ${saved.taps} taps!`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
