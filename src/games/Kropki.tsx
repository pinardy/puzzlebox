import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 5;

type Dot = "white" | "black" | null; // consecutive | double | neither

interface Puzzle {
  h: Dot[]; // between (r,c) and (r,c+1): index r*(N-1)+c
  v: Dot[]; // between (r,c) and (r+1,c): index r*N+c
}

function dotFor(a: number, b: number, rng: () => number): Dot {
  const consec = Math.abs(a - b) === 1;
  const dbl = a === 2 * b || b === 2 * a;
  if (consec && dbl) return rng() < 0.5 ? "white" : "black"; // the 1–2 pair
  if (dbl) return "black";
  if (consec) return "white";
  return null;
}

function generateKropki(seed: string): Puzzle {
  const sol = generateLatin(`kropki-${seed}`, N);
  const rng = makeRng(`kropki-dots-${seed}`);
  const h: Dot[] = [], v: Dot[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N - 1; c++)
      h.push(dotFor(sol[r * N + c], sol[r * N + c + 1], rng));
  for (let r = 0; r < N - 1; r++)
    for (let c = 0; c < N; c++)
      v.push(dotFor(sol[r * N + c], sol[(r + 1) * N + c], rng));
  return { h, v };
}

/** Does a filled pair fit its dot? White = consecutive, black = double,
 *  no dot = neither (the negative constraint is part of Kropki). */
function pairOk(a: number, b: number, dot: Dot): boolean {
  const consec = Math.abs(a - b) === 1;
  const dbl = a === 2 * b || b === 2 * a;
  if (dot === "white") return consec;
  if (dot === "black") return dbl;
  return !consec && !dbl;
}

interface SavedState {
  entries: number[];
  done: boolean;
}

function fresh(): SavedState {
  return { entries: Array(N * N).fill(0), done: false };
}

export default function Kropki({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("kropki")?.seed ?? newSeed()
  );
  const { h, v } = useMemo(() => generateKropki(seed), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("kropki")?.state ?? fresh()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < N * N; i++) {
      const val = board[i];
      if (val === 0) continue;
      const r = Math.floor(i / N), c = i % N;
      for (let k = 0; k < N; k++) {
        const row = r * N + k, col = k * N + c;
        if (row !== i && board[row] === val) bad.add(i);
        if (col !== i && board[col] === val) bad.add(i);
      }
    }
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N - 1; c++) {
        const a = r * N + c, b = a + 1;
        if (board[a] && board[b] && !pairOk(board[a], board[b], h[r * (N - 1) + c])) {
          bad.add(a); bad.add(b);
        }
      }
    for (let r = 0; r < N - 1; r++)
      for (let c = 0; c < N; c++) {
        const a = r * N + c, b = a + N;
        if (board[a] && board[b] && !pairOk(board[a], board[b], v[r * N + c])) {
          bad.add(a); bad.add(b);
        }
      }
    return bad;
  }, [board, h, v]);

  useEffect(() => {
    if (!saved.done && board.every((x) => x !== 0) && conflicts.size === 0) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("kropki", seed, next);
      recordResult("kropki", true);
      setToast("Every dot satisfied!");
    }
  }, [board, conflicts, saved, seed]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    const next = { ...saved, entries };
    setSaved(next);
    saveSlot("kropki", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("kropki", s, fresh());
    setSelected(null);
    setToast(null);
  }

  const G = 2 * N - 1;
  const track = Array(N - 1).fill("1fr 0.3fr").join(" ") + " 1fr";
  const dotChar = (d: Dot) => (d === "black" ? "●" : d === "white" ? "○" : "");

  return (
    <div className="game game-kropki">
      <GameHeader title="Kropki" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        1–{N} once per row and column. ○ joins consecutive numbers, ● joins a
        number and its double — and no dot means neither.
      </p>

      <div
        className="futo-grid kropki-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Kropki board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0) {
            const i = (gr / 2) * N + gc / 2;
            return (
              <button
                key={k}
                role="gridcell"
                className={[
                  "futo-cell kropki-cell",
                  selected === i ? "selected" : "",
                  conflicts.has(i) ? "conflict" : ""
                ].join(" ")}
                onClick={() => setSelected(i)}
              >
                {board[i] || ""}
              </button>
            );
          }
          if (gr % 2 === 0 && gc % 2 === 1)
            return (
              <span key={k} className="kropki-dot" aria-hidden="true">
                {dotChar(h[(gr / 2) * (N - 1) + (gc - 1) / 2])}
              </span>
            );
          if (gr % 2 === 1 && gc % 2 === 0)
            return (
              <span key={k} className="kropki-dot" aria-hidden="true">
                {dotChar(v[((gr - 1) / 2) * N + gc / 2])}
              </span>
            );
          return <span key={k} />;
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="numpad numpad-5">
        {[1, 2, 3, 4, 5].map((d) => (
          <button
            key={d}
            className="num-key"
            onClick={() => selected !== null && setCell(selected, d)}
          >
            {d}
          </button>
        ))}
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
