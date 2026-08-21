import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateHashi, hashiSolved, corridor, edgeKey, Edges } from "../lib/hashi";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 7;
const ISLANDS = 9;

interface SavedState {
  edges: Edges;
  done: boolean;
}

const FRESH: SavedState = { edges: {}, done: false };

interface BridgeMark {
  horizontal: boolean;
  count: number;
}

export default function Hashi({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("hashi")?.seed ?? newSeed()
  );
  const puzzle = useMemo(() => generateHashi(`hashi-${seed}`, N, ISLANDS), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("hashi")?.state ?? FRESH
  );
  const [sel, setSel] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** Cell → bridge drawn over it, and cell → owning edge key (for the
   *  crossing check when toggling). */
  const { bridgeAt, ownerAt } = useMemo(() => {
    const bridgeAt = new Map<number, BridgeMark>();
    const ownerAt = new Map<number, string>();
    for (const [key, count] of Object.entries(saved.edges)) {
      if (count <= 0) continue;
      const [a, b] = key.split("-").map(Number);
      const between = corridor(a, b, N) ?? [];
      const horizontal = Math.floor(a / N) === Math.floor(b / N);
      for (const i of between) {
        bridgeAt.set(i, { horizontal, count });
        ownerAt.set(i, key);
      }
    }
    return { bridgeAt, ownerAt };
  }, [saved.edges]);

  const degrees = useMemo(() => {
    const d = new Map<number, number>();
    for (const [key, count] of Object.entries(saved.edges)) {
      if (count <= 0) continue;
      const [a, b] = key.split("-").map(Number);
      d.set(a, (d.get(a) ?? 0) + count);
      d.set(b, (d.get(b) ?? 0) + count);
    }
    return d;
  }, [saved.edges]);

  useEffect(() => {
    if (!saved.done && hashiSolved(puzzle, saved.edges)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("hashi", seed, next);
      recordResult("hashi", true);
      setToast("All islands connected!");
    }
  }, [saved, puzzle, seed]);

  function toggle(a: number, b: number) {
    const key = edgeKey(a, b);
    const between = corridor(a, b, N);
    if (!between) return;
    if (between.some((i) => puzzle.islands.has(i))) return;
    // No crossing another bridge (cells owned by a different edge).
    if (between.some((i) => ownerAt.has(i) && ownerAt.get(i) !== key)) return;
    const edges = { ...saved.edges };
    const count = ((edges[key] ?? 0) + 1) % 3;
    if (count === 0) delete edges[key];
    else edges[key] = count;
    const next = { ...saved, edges };
    setSaved(next);
    saveSlot("hashi", seed, next);
  }

  function tap(idx: number) {
    if (saved.done) return;
    if (!puzzle.islands.has(idx)) {
      setSel(null);
      return;
    }
    if (sel === null || sel === idx) {
      setSel(sel === idx ? null : idx);
      return;
    }
    toggle(sel, idx);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(FRESH);
    saveSlot("hashi", s, FRESH);
    setSel(null);
    setToast(null);
  }

  return (
    <div className="game game-hashi">
      <GameHeader title="Bridges" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Tap two islands to bridge them (tap again for a double, again to
        clear). Every island needs exactly its number of bridges, all
        connected, none crossing.
      </p>

      <div
        className="hashi-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Bridges board"
      >
        {Array.from({ length: N * N }).map((_, i) => {
          const clue = puzzle.islands.get(i);
          if (clue !== undefined) {
            const deg = degrees.get(i) ?? 0;
            return (
              <button
                key={i}
                role="gridcell"
                className={[
                  "hashi-island",
                  sel === i ? "selected" : "",
                  deg === clue ? "full" : deg > clue ? "over" : ""
                ].join(" ")}
                onClick={() => tap(i)}
              >
                {clue}
              </button>
            );
          }
          const bridge = bridgeAt.get(i);
          return (
            <button
              key={i}
              role="gridcell"
              className="hashi-cell"
              onClick={() => tap(i)}
              tabIndex={-1}
            >
              {bridge
                ? bridge.horizontal
                  ? bridge.count === 2 ? "═" : "─"
                  : bridge.count === 2 ? "║" : "│"
                : ""}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="lights-meta">
        <span>
          {sel !== null ? "Now tap an island in line with it" : "Tap an island to start a bridge"}
        </span>
        <button
          className="mini-btn"
          onClick={() => {
            setSaved(FRESH);
            saveSlot("hashi", seed, FRESH);
            setSel(null);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
