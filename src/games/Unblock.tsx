import { useMemo, useRef, useState, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const N = 6;
const HELP =
  "Slide the red car out through the gap on the right. Other cars only " +
  "move along their own axis. Drag any car to slide it. Par is the " +
  "fewest moves possible for this board — beat the puzzle in as few " +
  "moves as you can.";

interface Car {
  h: boolean; // horizontal?
  len: number;
  fix: number; // the row (horizontal) or column (vertical) it lives in
}

interface Layout {
  cars: Car[];
  start: number[]; // each car's variable coordinate
  par: number;
}

interface Config {
  carCount: number;
  blockers: number;
  lo: number;
  hi: number;
}

const CONFIG: Record<Diff, Config> = {
  easy: { carCount: 7, blockers: 1, lo: 3, hi: 6 },
  medium: { carCount: 9, blockers: 2, lo: 5, hi: 7 },
  hard: { carCount: 11, blockers: 3, lo: 8, hi: 35 }
};

function occupancy(cars: Car[], pos: number[]): Int8Array {
  const grid = new Int8Array(N * N).fill(-1);
  cars.forEach((car, k) => {
    for (let i = 0; i < car.len; i++) {
      const r = car.h ? car.fix : pos[k] + i;
      const c = car.h ? pos[k] + i : car.fix;
      grid[r * N + c] = k;
    }
  });
  return grid;
}

/** Minimum moves to free the red car (one move = one car sliding any
 *  distance), or null if unsolvable / the search cap is hit. */
function solve(cars: Car[], startPos: number[], moveCap: number, stateCap: number): number | null {
  const key = (p: number[]) => p.join(",");
  const seen = new Set([key(startPos)]);
  let frontier = [startPos];
  let moves = 0;
  let states = 0;
  while (frontier.length && moves <= moveCap) {
    const next: number[][] = [];
    for (const pos of frontier) {
      if (++states > stateCap) return null;
      if (pos[0] === N - cars[0].len) return moves;
      const grid = occupancy(cars, pos);
      for (let k = 0; k < cars.length; k++) {
        const car = cars[k];
        for (const dir of [-1, 1]) {
          for (let d = 1; ; d++) {
            const head = pos[k] + dir * d;
            if (head < 0 || head + car.len > N) break;
            const probe = dir === 1 ? head + car.len - 1 : head;
            const r = car.h ? car.fix : probe;
            const c = car.h ? probe : car.fix;
            if (grid[r * N + c] !== -1) break;
            const np = pos.slice();
            np[k] = head;
            const kk = key(np);
            if (!seen.has(kk)) {
              seen.add(kk);
              next.push(np);
            }
          }
        }
      }
    }
    frontier = next;
    moves++;
  }
  return null;
}

/** Deal boards until one solves inside the difficulty's move band; after a
 *  fixed attempt budget, settle for the deepest solvable deal seen (keeps
 *  generation bounded and, since the budget is attempt-counted, fully
 *  deterministic per seed). */
function generateUnblock(seed: string, diff: Diff): Layout {
  const { carCount, blockers, lo, hi } = CONFIG[diff];
  const rng = makeRng(`unblock-${seed}`);
  let best: Layout | null = null;

  for (let attempt = 0; attempt < 60; attempt++) {
    const cars: Car[] = [{ h: true, len: 2, fix: 2 }];
    const pos = [Math.floor(rng() * 2)];
    const grid = Array(N * N).fill(false);
    for (let i = 0; i < 2; i++) grid[2 * N + pos[0] + i] = true;

    // Vertical cars crossing the exit row make boards meaningfully deep.
    let ok = true;
    for (let b = 0; b < blockers && ok; b++) {
      let placed = false;
      for (let a = 0; a < 40; a++) {
        const c = pos[0] + 2 + Math.floor(rng() * (N - pos[0] - 2));
        const len = rng() < 0.6 ? 2 : 3;
        const head = Math.max(0, Math.min(2 - Math.floor(rng() * len), N - len));
        if (head > 2 || head + len <= 2) continue;
        let free = true;
        for (let i = 0; i < len; i++) if (grid[(head + i) * N + c]) free = false;
        if (!free) continue;
        for (let i = 0; i < len; i++) grid[(head + i) * N + c] = true;
        cars.push({ h: false, len, fix: c });
        pos.push(head);
        placed = true;
        break;
      }
      if (!placed) ok = false;
    }
    if (!ok) continue;

    while (cars.length < carCount) {
      let placed = false;
      for (let a = 0; a < 60; a++) {
        const h = rng() < 0.5;
        const len = rng() < 0.65 ? 2 : 3;
        const fix = Math.floor(rng() * N);
        if (h && fix === 2) continue; // exit row is the red car's alone
        const head = Math.floor(rng() * (N - len + 1));
        let free = true;
        for (let i = 0; i < len; i++) {
          const r = h ? fix : head + i;
          const c = h ? head + i : fix;
          if (grid[r * N + c]) free = false;
        }
        if (!free) continue;
        for (let i = 0; i < len; i++) {
          const r = h ? fix : head + i;
          const c = h ? head + i : fix;
          grid[r * N + c] = true;
        }
        cars.push({ h, len, fix });
        pos.push(head);
        placed = true;
        break;
      }
      if (!placed) break;
    }
    if (cars.length < carCount) continue;

    const par = solve(cars, pos, hi + 1, 8000);
    if (par === null || par < 1) continue;
    if (par >= lo && par <= hi) return { cars, start: pos, par };
    if (!best || par > best.par) best = { cars, start: pos, par };
  }
  if (best) return best;
  // Vanishingly unlikely; a trivial fallback keeps the type honest.
  return {
    cars: [{ h: true, len: 2, fix: 2 }, { h: false, len: 3, fix: 4 }],
    start: [0, 0],
    par: 2
  };
}

interface SavedState {
  pos: number[];
  moves: number;
  done: boolean;
}

export default function Unblock({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("unblock", (s, d) => ({
      pos: generateUnblock(s, d).start,
      moves: 0,
      done: false
    }));
  const layout = useMemo(() => generateUnblock(seed, diff), [seed, diff]);
  const { cars, par } = layout;

  // Transient drag state: which car, and its current offset in cells.
  const drag = useRef<{ k: number; startCoord: number; from: number } | null>(null);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const pos = saved.pos;

  /** How far car k can slide in each direction from the saved position. */
  function slideRange(k: number): [number, number] {
    const grid = occupancy(cars, pos);
    const car = cars[k];
    let min = pos[k], max = pos[k];
    while (min > 0) {
      const probe = min - 1;
      const r = car.h ? car.fix : probe;
      const c = car.h ? probe : car.fix;
      if (grid[r * N + c] !== -1) break;
      min--;
    }
    while (max + car.len < N) {
      const probe = max + car.len;
      const r = car.h ? car.fix : probe;
      const c = car.h ? probe : car.fix;
      if (grid[r * N + c] !== -1) break;
      max++;
    }
    return [min, max];
  }

  function onPointerDown(e: React.PointerEvent, k: number) {
    if (saved.done) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      k,
      startCoord: cars[k].h ? e.clientX : e.clientY,
      from: pos[k]
    };
    setDragPos(pos[k]);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !boardRef.current) return;
    const { k, startCoord, from } = drag.current;
    const cell = boardRef.current.clientWidth / N;
    const delta = Math.round(((cars[k].h ? e.clientX : e.clientY) - startCoord) / cell);
    const [min, max] = slideRange(k);
    setDragPos(Math.max(min, Math.min(max, from + delta)));
  }

  function onPointerUp() {
    if (!drag.current) return;
    const { k, from } = drag.current;
    const to = dragPos ?? from;
    drag.current = null;
    setDragPos(null);
    if (to === from || saved.done) return;
    const next = pos.slice();
    next[k] = to;
    const done = k === 0 && to === N - cars[0].len;
    const state: SavedState = { pos: next, moves: saved.moves + 1, done };
    commit(state);
    if (done) recordResult("unblock", true);
  }

  return (
    <div className="game game-unblock">
      <GameHeader title="Unblock" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Drag cars along their axis; get the red one to the right edge.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="ub-status">
        <span>
          Moves: <b>{saved.moves}</b>
        </span>
        <span>Par {par}</span>
      </div>

      <div className="ub-board drag-paint" ref={boardRef} role="group" aria-label="Unblock board">
        <span className="ub-exit" aria-hidden="true">
          ➜
        </span>
        {cars.map((car, k) => {
          const v = drag.current?.k === k && dragPos !== null ? dragPos : pos[k];
          return (
            <div
              key={k}
              className={[
                "ub-car",
                car.h ? "h" : "v",
                k === 0 ? "red" : "",
                `len${car.len}`
              ].join(" ")}
              style={
                {
                  "--r": car.h ? car.fix : v,
                  "--c": car.h ? v : car.fix,
                  "--len": car.len
                } as CSSProperties
              }
              onPointerDown={(e) => onPointerDown(e, k)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="unblock"
          won
          message={
            saved.moves <= par
              ? `Freed in ${saved.moves} — perfect!`
              : `Freed in ${saved.moves} moves (par ${par})`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
