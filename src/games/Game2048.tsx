import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const N = 4;
const TARGET = 2048;
const HELP =
  "Swipe (or use the arrow keys) to slide every tile. Two equal tiles that " +
  "collide merge into their sum — build up to 2048 before the board locks.";

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
function spawnTile(tiles: Tile[], nextId: number, seed: string, k: number): { tiles: Tile[]; nextId: number } {
  const rng = makeRng(`2048-${seed}-${k}`);
  const occupied = new Set(tiles.map((t) => t.r * N + t.c));
  const empty = [...Array(N * N).keys()].filter((i) => !occupied.has(i));
  if (!empty.length) return { tiles, nextId };
  const cell = empty[Math.floor(rng() * empty.length)];
  const v = rng() < 0.9 ? 2 : 4;
  return {
    tiles: [...tiles, { id: nextId, v, r: Math.floor(cell / N), c: cell % N, spawned: true }],
    nextId: nextId + 1
  };
}

function fresh(seed: string): SavedState {
  let s = spawnTile([], 1, seed, 0);
  s = spawnTile(s.tiles, s.nextId, seed, 1);
  return { tiles: s.tiles, nextId: s.nextId, score: 0, spawns: 2, done: false, won: false };
}

type Dir = "left" | "right" | "up" | "down";

function moveTiles(tiles: Tile[], dir: Dir): { tiles: Tile[]; gained: number; changed: boolean } {
  const horiz = dir === "left" || dir === "right";
  const rev = dir === "right" || dir === "down";
  let gained = 0;
  let changed = false;
  const out: Tile[] = [];
  for (let line = 0; line < N; line++) {
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
      const pos = rev ? N - 1 - k : k;
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

function anyMoves(tiles: Tile[]): boolean {
  if (tiles.length < N * N) return true;
  const at = new Map(tiles.map((t) => [t.r * N + t.c, t.v]));
  for (const t of tiles) {
    if (at.get(t.r * N + t.c + 1) === t.v && t.c < N - 1) return true;
    if (at.get((t.r + 1) * N + t.c) === t.v && t.r < N - 1) return true;
  }
  return false;
}

/** Convert a save from before tiles had identity (plain cells array). */
function migrate(state: SavedState & { cells?: number[] }): SavedState {
  if (state.tiles) return state;
  const cells = state.cells ?? [];
  const tiles: Tile[] = [];
  cells.forEach((v, i) => {
    if (v) tiles.push({ id: tiles.length + 1, v, r: Math.floor(i / N), c: i % N });
  });
  return { ...state, tiles, nextId: tiles.length + 1 };
}

export default function Game2048({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("2048", (s) => fresh(s));
  const state = useMemo(() => migrate(saved), [saved]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const move = useCallback(
    (dir: Dir) => {
      if (state.done) return;
      const res = moveTiles(state.tiles, dir);
      if (!res.changed) return;
      const sp = spawnTile(res.tiles, state.nextId, seed, state.spawns);
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
      } else if (!anyMoves(next.tiles)) {
        next.done = true;
        recordResult("2048", false);
      }
      commit(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, seed]
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
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !state.done} />

      <div className="lights-meta">
        <span>Score: {state.score}</span>
      </div>

      <div
        className="t2048-board"
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
          message={state.won ? "2048 — you made it!" : `No moves left — score ${state.score}`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
