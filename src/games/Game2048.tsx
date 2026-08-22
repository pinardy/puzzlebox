import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 5, medium: 4, hard: 3 };
// A 3×3 board can't realistically reach 2048 — 256 is the honest summit.
const TARGET_BY: Record<Diff, number> = { easy: 2048, medium: 2048, hard: 256 };
const HELP =
  "Swipe (or use the arrow keys) to slide every tile. Two equal tiles that " +
  "collide merge into their sum — reach the target before the board locks. " +
  "Easy plays a roomy 5×5; Hard squeezes onto 3×3, chasing 256.";

interface Tile {
  id: number;
  v: number;
  r: number;
  c: number;
  merged?: boolean;
  spawned?: boolean;
}

interface SavedState {
  tiles: Tile[];
  nextId: number;
  score: number;
  spawns: number;
  done: boolean;
  won: boolean;
}

/** Deterministic spawn: the k-th tile of a given seed always lands the same
 *  way, so a reloaded game replays identically. */
function spawnTile(tiles: Tile[], nextId: number, seed: string, k: number, n: number): { tiles: Tile[]; nextId: number } {
  const rng = makeRng(`2048-${seed}-${k}`);
  const occupied = new Set(tiles.map((t) => t.r * n + t.c));
  const empty = [...Array(n * n).keys()].filter((i) => !occupied.has(i));
  if (!empty.length) return { tiles, nextId };
  const cell = empty[Math.floor(rng() * empty.length)];
  const v = rng() < 0.9 ? 2 : 4;
  return {
    tiles: [...tiles, { id: nextId, v, r: Math.floor(cell / n), c: cell % n, spawned: true }],
    nextId: nextId + 1
  };
}

function fresh(seed: string, n: number): SavedState {
  let s = spawnTile([], 1, seed, 0, n);
  s = spawnTile(s.tiles, s.nextId, seed, 1, n);
  return { tiles: s.tiles, nextId: s.nextId, score: 0, spawns: 2, done: false, won: false };
}

type Dir = "left" | "right" | "up" | "down";

function moveTiles(tiles: Tile[], dir: Dir, n: number): { tiles: Tile[]; gained: number; changed: boolean } {
  const horiz = dir === "left" || dir === "right";
  const rev = dir === "right" || dir === "down";
  let gained = 0;
  let changed = false;
  const out: Tile[] = [];
  for (let line = 0; line < n; line++) {
    const inLine = tiles
      .filter((t) => (horiz ? t.r : t.c) === line)
      .sort((a, b) => (horiz ? a.c - b.c : a.r - b.r));
    if (rev) inLine.reverse();
    const placed: Tile[] = [];
    for (const t of inLine) {
      const prev = placed[placed.length - 1];
      if (prev && prev.v === t.v && !prev.merged) {
        prev.v *= 2;
        prev.merged = true;
        gained += prev.v;
        changed = true; // the absorbed tile disappears
      } else {
        placed.push({ ...t, merged: false, spawned: false });
      }
    }
    placed.forEach((t, k) => {
      const pos = rev ? n - 1 - k : k;
      const nr = horiz ? line : pos;
      const nc = horiz ? pos : line;
      if (nr !== t.r || nc !== t.c) changed = true;
      t.r = nr;
      t.c = nc;
      out.push(t);
    });
  }
  return { tiles: out, gained, changed };
}

function anyMoves(tiles: Tile[], n: number): boolean {
  if (tiles.length < n * n) return true;
  const at = new Map(tiles.map((t) => [t.r * n + t.c, t.v]));
  for (const t of tiles) {
    if (at.get(t.r * n + t.c + 1) === t.v && t.c < n - 1) return true;
    if (at.get((t.r + 1) * n + t.c) === t.v && t.r < n - 1) return true;
  }
  return false;
}

/** Convert a save from before tiles had identity (plain cells array). */
function migrate(state: SavedState & { cells?: number[] }, n: number): SavedState {
  if (state.tiles) return state;
  const cells = state.cells ?? [];
  const tiles: Tile[] = [];
  cells.forEach((v, i) => {
    if (v) tiles.push({ id: tiles.length + 1, v, r: Math.floor(i / n), c: i % n });
  });
  return { ...state, tiles, nextId: tiles.length + 1 };
}

export default function Game2048({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("2048", (s, d) => fresh(s, SIZE[d]));
  const N = SIZE[diff];
  const TARGET = TARGET_BY[diff];
  const state = useMemo(() => migrate(saved, N), [saved, N]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const move = useCallback(
    (dir: Dir) => {
      if (state.done) return;
      const res = moveTiles(state.tiles, dir, N);
      if (!res.changed) return;
      const sp = spawnTile(res.tiles, state.nextId, seed, state.spawns, N);
      const next: SavedState = {
        tiles: sp.tiles,
        nextId: sp.nextId,
        score: state.score + res.gained,
        spawns: state.spawns + 1,
        done: false,
        won: state.won
      };
      if (!next.won && next.tiles.some((t) => t.v >= TARGET)) {
        next.done = true;
        next.won = true;
        recordResult("2048", true);
      } else if (!anyMoves(next.tiles, N)) {
        next.done = true;
        recordResult("2048", false);
      }
      commit(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, seed, N, TARGET]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const dir = (
        { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const
      )[e.key as "ArrowLeft"];
      if (dir) {
        e.preventDefault();
        move(dir);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move]);

  return (
    <div className="game game-2048">
      <GameHeader title="2048" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Swipe or use arrow keys. Equal tiles merge — reach {TARGET}.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !state.done}
      />

      <div className="lights-meta">
        <span>Score: {state.score}</span>
      </div>

      <div
        className="t2048-board"
        style={{ "--gn": N } as CSSProperties}
        role="grid"
        aria-label="2048 board"
        onPointerDown={(e) => {
          touch.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (!touch.current) return;
          const dx = e.clientX - touch.current.x;
          const dy = e.clientY - touch.current.y;
          touch.current = null;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          move(
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0 ? "right" : "left"
              : dy > 0 ? "down" : "up"
          );
        }}
      >
        <div className="t2048-bg">
          {Array.from({ length: N * N }).map((_, i) => (
            <div key={i} className="t2048-slot" />
          ))}
        </div>
        {state.tiles.map((t) => (
          <div
            key={t.id}
            className={[
              "t2048-tile",
              `t${t.v > 2048 ? "big" : t.v}`,
              t.merged ? "pulse" : "",
              t.spawned ? "pop" : ""
            ].join(" ")}
            style={{ "--r": t.r, "--c": t.c } as CSSProperties}
          >
            {t.v}
          </div>
        ))}
      </div>

      <div className="t2048-pad">
        <button className="mini-btn" onClick={() => move("up")} aria-label="Up">↑</button>
        <div>
          <button className="mini-btn" onClick={() => move("left")} aria-label="Left">←</button>
          <button className="mini-btn" onClick={() => move("down")} aria-label="Down">↓</button>
          <button className="mini-btn" onClick={() => move("right")} aria-label="Right">→</button>
        </div>
      </div>

      {state.done && (
        <Result
          key={seed}
          game="2048"
          won={state.won}
          message={state.won ? `${TARGET} — you made it!` : `No moves left — score ${state.score}`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
