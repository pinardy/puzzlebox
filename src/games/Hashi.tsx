import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateHashi, hashiSolved, corridor, edgeKey, Edges } from "../lib/hashi";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const LEVELS: Record<Diff, [number, number]> = {
  easy: [7, 7],
  medium: [7, 9],
  hard: [9, 12]
};
const HELP =
  "Connect the islands with straight bridges — one or two per pair — until " +
  "every island has exactly its number and the whole network is joined. " +
  "Bridges never cross. Tap an island, then another in line with it.";

interface SavedState {
  edges: Edges;
  done: boolean;
}

interface BridgeMark {
  horizontal: boolean;
  count: number;
}

export default function Hashi({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("hashi", () => ({ edges: {}, done: false }));
  const [n, islandCount] = LEVELS[diff];
  const puzzle = useMemo(
    () => generateHashi(`hashi-${seed}`, n, islandCount),
    [seed, n, islandCount]
  );
  const [sel, setSel] = useState<number | null>(null);

  const { bridgeAt, ownerAt } = useMemo(() => {
    const bridgeAt = new Map<number, BridgeMark>();
    const ownerAt = new Map<number, string>();
    for (const [key, count] of Object.entries(saved.edges)) {
      if (count <= 0) continue;
      const [a, b] = key.split("-").map(Number);
      const between = corridor(a, b, n) ?? [];
      const horizontal = Math.floor(a / n) === Math.floor(b / n);
      for (const i of between) {
        bridgeAt.set(i, { horizontal, count });
        ownerAt.set(i, key);
      }
    }
    return { bridgeAt, ownerAt };
  }, [saved.edges, n]);

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
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("hashi", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, puzzle]);

  function toggle(a: number, b: number) {
    const key = edgeKey(a, b);
    const between = corridor(a, b, n);
    if (!between) return;
    if (between.some((i) => puzzle.islands.has(i))) return;
    if (between.some((i) => ownerAt.has(i) && ownerAt.get(i) !== key)) return;
    const edges = { ...saved.edges };
    const count = ((edges[key] ?? 0) + 1) % 3;
    if (count === 0) delete edges[key];
    else edges[key] = count;
    commit({ ...saved, edges });
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

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSel(null);
  }

  return (
    <div className="game game-hashi">
      <GameHeader title="Bridges" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap two islands to bridge them — again for a double, again to clear.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="hashi-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Bridges board"
      >
        {Array.from({ length: n * n }).map((_, i) => {
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

      <div className="lights-meta">
        <span>
          {sel !== null ? "Now tap an island in line with it" : "Tap an island to start a bridge"}
        </span>
        <button
          className="mini-btn"
          onClick={() => {
            commit({ edges: {}, done: false });
            setSel(null);
          }}
        >
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="hashi"
          won
          message="All islands connected!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
