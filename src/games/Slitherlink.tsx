import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateSlither, slitherSolved, EdgeState } from "../lib/slither";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 5;

interface SavedState {
  edges: EdgeState; // 0 empty, 1 line, 2 ✕
  done: boolean;
}

function fresh(): SavedState {
  return {
    edges: { h: Array((N + 1) * N).fill(0), v: Array(N * (N + 1)).fill(0) },
    done: false
  };
}

export default function Slitherlink({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("slither")?.seed ?? newSeed()
  );
  const puzzle = useMemo(() => generateSlither(`slither-${seed}`, N), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("slither")?.state ?? fresh()
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!saved.done && slitherSolved(puzzle, saved.edges)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("slither", seed, next);
      recordResult("slither", true);
      setToast("The loop is closed!");
    }
  }, [saved, puzzle, seed]);

  function tapEdge(kind: "h" | "v", idx: number) {
    if (saved.done) return;
    const edges = { h: saved.edges.h.slice(), v: saved.edges.v.slice() };
    edges[kind][idx] = (edges[kind][idx] + 1) % 3;
    const next = { ...saved, edges };
    setSaved(next);
    saveSlot("slither", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("slither", s, fresh());
    setToast(null);
  }

  const G = 2 * N + 1;
  const track = "14px " + Array(N).fill("1fr 14px").join(" ");
  const edgeMark = (m: number) => (m === 1 ? "line" : m === 2 ? "off" : "");

  return (
    <div className="game game-slither">
      <GameHeader title="Slitherlink" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Draw one closed loop along the grid lines. A number counts the loop
        edges around that square. Tap an edge: line → ✕ → clear.
      </p>

      <div
        className="slither-grid"
        style={{ gridTemplateColumns: track, gridTemplateRows: track } as CSSProperties}
        role="grid"
        aria-label="Slitherlink board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          if (gr % 2 === 0 && gc % 2 === 0)
            return <span key={k} className="slither-dot" aria-hidden="true" />;
          if (gr % 2 === 0) {
            const idx = (gr / 2) * N + (gc - 1) / 2;
            return (
              <button
                key={k}
                className={`slither-edge h ${edgeMark(saved.edges.h[idx])}`}
                onClick={() => tapEdge("h", idx)}
                aria-label="Horizontal edge"
              >
                {saved.edges.h[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          if (gc % 2 === 0) {
            const idx = ((gr - 1) / 2) * (N + 1) + gc / 2;
            return (
              <button
                key={k}
                className={`slither-edge v ${edgeMark(saved.edges.v[idx])}`}
                onClick={() => tapEdge("v", idx)}
                aria-label="Vertical edge"
              >
                {saved.edges.v[idx] === 2 ? "×" : ""}
              </button>
            );
          }
          const cell = ((gr - 1) / 2) * N + (gc - 1) / 2;
          return (
            <span key={k} className="slither-cell">
              {puzzle.clues[cell] ?? ""}
            </span>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>{saved.edges.h.filter((m) => m === 1).length + saved.edges.v.filter((m) => m === 1).length} edges drawn</span>
        <button
          className="mini-btn"
          onClick={() => {
            const next = fresh();
            setSaved(next);
            saveSlot("slither", seed, next);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
