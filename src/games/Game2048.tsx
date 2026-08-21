import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 4;
const TARGET = 2048;

interface SavedState {
  cells: number[];
  score: number;
  spawns: number; // total tiles spawned — keys the deterministic spawn RNG
  done: boolean;
  won: boolean;
}

/** Deterministic spawn: the k-th tile of a given seed always lands the same
 *  way, so a reloaded game replays identically. */
function spawn(cells: number[], seed: string, k: number): number[] {
  const rng = makeRng(`2048-${seed}-${k}`);
  const empty = cells.flatMap((v, i) => (v === 0 ? [i] : []));
  if (!empty.length) return cells;
  const out = cells.slice();
  out[empty[Math.floor(rng() * empty.length)]] = rng() < 0.9 ? 2 : 4;
  return out;
}

function fresh(seed: string): SavedState {
  let cells = Array(N * N).fill(0);
  cells = spawn(cells, seed, 0);
  cells = spawn(cells, seed, 1);
  return { cells, score: 0, spawns: 2, done: false, won: false };
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const vals = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++;
    } else out.push(vals[i]);
  }
  while (out.length < N) out.push(0);
  return { line: out, gained };
}

type Dir = "left" | "right" | "up" | "down";

/** Cell indices of each line, in slide order for `dir`. */
function lines(dir: Dir): number[][] {
  return Array.from({ length: N }, (_, i) => {
    const idx = Array.from({ length: N }, (_, j) => {
      if (dir === "left" || dir === "right") return i * N + j;
      return j * N + i;
    });
    return dir === "right" || dir === "down" ? idx.reverse() : idx;
  });
}

function anyMoves(cells: number[]): boolean {
  if (cells.some((v) => v === 0)) return true;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = cells[r * N + c];
      if (c < N - 1 && cells[r * N + c + 1] === v) return true;
      if (r < N - 1 && cells[(r + 1) * N + c] === v) return true;
    }
  return false;
}

export default function Game2048({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("2048")?.seed ?? newSeed()
  );
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("2048")?.state ?? fresh(seed)
  );
  const [toast, setToast] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const move = useCallback(
    (dir: Dir) => {
      if (saved.done) return;
      const cells = saved.cells.slice();
      let gained = 0;
      let changed = false;
      for (const idx of lines(dir)) {
        const res = slideLine(idx.map((i) => cells[i]));
        gained += res.gained;
        idx.forEach((i, j) => {
          if (cells[i] !== res.line[j]) changed = true;
          cells[i] = res.line[j];
        });
      }
      if (!changed) return;
      const next: SavedState = {
        cells: spawn(cells, seed, saved.spawns),
        score: saved.score + gained,
        spawns: saved.spawns + 1,
        done: false,
        won: saved.won
      };
      if (!next.won && next.cells.some((v) => v >= TARGET)) {
        next.done = true;
        next.won = true;
        recordResult("2048", true);
        setToast("2048 — you made it!");
      } else if (!anyMoves(next.cells)) {
        next.done = true;
        recordResult("2048", false);
        setToast(`No moves left — score ${next.score}`);
      }
      setSaved(next);
      saveSlot("2048", seed, next);
    },
    [saved, seed]
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

  function newPuzzle() {
    const s = newSeed();
    const next = fresh(s);
    setSeed(s);
    setSaved(next);
    saveSlot("2048", s, next);
    setToast(null);
  }

  return (
    <div className="game game-2048">
      <GameHeader title="2048" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Swipe or use arrow keys. Equal tiles merge — reach {TARGET}.
      </p>

      <div className="lights-meta">
        <span>Score: {saved.score}</span>
      </div>

      <div
        className="t2048-grid"
        style={{ "--n": N } as CSSProperties}
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
        {saved.cells.map((v, i) => (
          <div
            key={i}
            role="gridcell"
            className={`t2048-cell${v ? ` t${v > 2048 ? "big" : v}` : ""}`}
          >
            {v || ""}
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
