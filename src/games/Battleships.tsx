import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 8;
const FLEET = [4, 3, 3, 2, 2, 1, 1, 1]; // ship lengths

interface Puzzle {
  rows: number[];
  cols: number[];
  givenShip: number[];
  givenWater: number[];
}

/** Hide the fleet (ships never touch, even diagonally), read off the
 *  row/column counts, and reveal a few cells as a foothold. */
function generateShips(seed: string): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const ship = Array(N * N).fill(false);
    const blocked = Array(N * N).fill(false);
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let attempt = 0; attempt < 120 && !placed; attempt++) {
        const horizontal = rng() < 0.5;
        const r = Math.floor(rng() * (horizontal ? N : N - len + 1));
        const c = Math.floor(rng() * (horizontal ? N - len + 1 : N));
        const cells = Array.from({ length: len }, (_, k) =>
          horizontal ? r * N + c + k : (r + k) * N + c
        );
        if (cells.some((i) => blocked[i])) continue;
        for (const i of cells) {
          ship[i] = true;
          const rr = Math.floor(i / N), cc = i % N;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const r2 = rr + dr, c2 = cc + dc;
              if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) blocked[r2 * N + c2] = true;
            }
        }
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (!ok) continue;

    const rows = Array(N).fill(0), cols = Array(N).fill(0);
    const shipCells: number[] = [], waterCells: number[] = [];
    ship.forEach((s, i) => {
      if (s) { rows[Math.floor(i / N)]++; cols[i % N]++; shipCells.push(i); }
      else waterCells.push(i);
    });
    return {
      rows,
      cols,
      givenShip: shuffled(shipCells, rng).slice(0, 2),
      givenWater: shuffled(waterCells, rng).slice(0, 2)
    };
  }
}

/** A ship set is a valid fleet layout when the components are straight
 *  lines of the right sizes and never touch diagonally. */
function fleetOk(shipSet: Set<number>): boolean {
  // No diagonal contact between ship cells of different ships — in any
  // valid layout, no two ship cells touch diagonally at all.
  for (const i of shipSet) {
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && shipSet.has(rr * N + cc))
        return false;
    }
  }
  // Straight components matching the fleet.
  const seen = new Set<number>();
  const sizes: number[] = [];
  for (const start of shipSet) {
    if (seen.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const i = stack.pop()!;
      comp.push(i);
      const r = Math.floor(i / N), c = i % N;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        const j = rr * N + cc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && shipSet.has(j) && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    const rs = comp.map((i) => Math.floor(i / N)), cs = comp.map((i) => i % N);
    const straight = new Set(rs).size === 1 || new Set(cs).size === 1;
    if (!straight) return false;
    sizes.push(comp.length);
  }
  return sizes.sort().join(",") === [...FLEET].sort().join(",");
}

type Mark = 0 | 1 | 2; // unknown | ship | water

interface SavedState {
  marks: Mark[];
  done: boolean;
}

function fresh(): SavedState {
  return { marks: Array(N * N).fill(0) as Mark[], done: false };
}

export default function Battleships({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("ships")?.seed ?? newSeed()
  );
  const puzzle = useMemo(() => generateShips(`ships-${seed}`), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("ships")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  const givenShip = useMemo(() => new Set(puzzle.givenShip), [puzzle]);
  const givenWater = useMemo(() => new Set(puzzle.givenWater), [puzzle]);

  const ships = useMemo(() => {
    const s = new Set<number>(puzzle.givenShip);
    saved.marks.forEach((m, i) => { if (m === 1) s.add(i); });
    return s;
  }, [saved.marks, puzzle]);

  useEffect(() => {
    if (saved.done) return;
    const rows = Array(N).fill(0), cols = Array(N).fill(0);
    for (const i of ships) { rows[Math.floor(i / N)]++; cols[i % N]++; }
    const countsOk =
      rows.every((v, r) => v === puzzle.rows[r]) &&
      cols.every((v, c) => v === puzzle.cols[c]);
    if (countsOk && fleetOk(ships)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("ships", seed, next);
      recordResult("ships", true);
      setToast("Fleet found!");
    }
  }, [ships, puzzle, saved, seed]);

  function tap(idx: number) {
    if (saved.done || givenShip.has(idx) || givenWater.has(idx)) return;
    const marks = saved.marks.slice() as Mark[];
    marks[idx] = ((marks[idx] + 1) % 3) as Mark;
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("ships", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("ships", s, fresh());
    setToast(null);
  }

  const G = N + 1;
  const fleetLabel = "4 · 3 3 · 2 2 · 1 1 1";

  return (
    <div className="game game-ships">
      <GameHeader title="Battleships" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Find the hidden fleet ({fleetLabel}). Ships are straight and never
        touch, even diagonally; edge numbers count ship cells.
      </p>

      <div
        className="tents-grid ships-grid"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Battleships board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr === 0 && gc === 0) return <span key={k} />;
          if (gr === 0)
            return <span key={k} className="edge-count">{puzzle.cols[gc - 1]}</span>;
          if (gc === 0)
            return <span key={k} className="edge-count">{puzzle.rows[gr - 1]}</span>;
          const i = (gr - 1) * N + (gc - 1);
          const isShip = givenShip.has(i) || saved.marks[i] === 1;
          const isWater = givenWater.has(i) || saved.marks[i] === 2;
          const given = givenShip.has(i) || givenWater.has(i);
          return (
            <button
              key={k}
              role="gridcell"
              className={[
                "ships-cell",
                isShip ? "ship" : "",
                isWater ? "water" : "",
                given ? "given" : ""
              ].join(" ")}
              onClick={() => tap(i)}
            >
              {isShip ? "■" : isWater ? "≈" : ""}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>■ {ships.size} / {FLEET.reduce((a, b) => a + b, 0)}</span>
      </div>
    </div>
  );
}
