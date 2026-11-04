import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { generateHashi, hashiSolved, corridor, edgeKey, Edges } from "../lib/hashi";
import { useGridNav } from "../lib/gridnav";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Hashi.css";

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
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>(() => ({ edges: {}, done: false }));
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

  const solved = useMemo(
    () => hashiSolved(puzzle, saved.edges),
    [puzzle, saved.edges]
  );
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

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

  // Only the islands are in the keyboard grid: arrows hop to the nearest
  // island that way, and Enter selects one / bridges to the selected one,
  // exactly like a tap.
  const nav = useGridNav((i) => tap(i));

  /** Set one bridge to its count in the generated layout (removing a wrong
   *  bridge counts too), clearing any bridge that crosses it. */
  function hint() {
    if (saved.done) return;
    const want = puzzle.bridges;
    const keys = new Set([...Object.keys(want), ...Object.keys(saved.edges)]);
    const wrong = [...keys].filter((k) => (saved.edges[k] ?? 0) !== (want[k] ?? 0));
    if (!wrong.length) return;
    const key = wrong[Math.floor(Math.random() * wrong.length)];
    const edges = { ...saved.edges };
    if (want[key]) {
      const [a, b] = key.split("-").map(Number);
      const cells = new Set(corridor(a, b, n) ?? []);
      for (const k of Object.keys(edges)) {
        if (k === key) continue;
        const [x, y] = k.split("-").map(Number);
        if ((corridor(x, y, n) ?? []).some((i) => cells.has(i))) delete edges[k];
      }
      edges[key] = want[key];
    } else delete edges[key];
    setSel(null);
    commitHint({ ...saved, edges });
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
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="hashi-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Bridges board"
        {...nav}
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const clue = puzzle.islands.get(i);
          const where = `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;
          if (clue !== undefined) {
            const deg = degrees.get(i) ?? 0;
            return (
              <button
                key={i}
                role="gridcell"
                data-cell={i}
                aria-label={`${where}, island ${clue}, ${deg} bridge${deg === 1 ? "" : "s"}${
                  sel === i ? ", selected" : ""
                }`}
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
              aria-label={`${where}, ${
                bridge
                  ? `${bridge.count === 2 ? "double" : "single"} ${
                      bridge.horizontal ? "horizontal" : "vertical"
                    } bridge`
                  : "water"
              }`}
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
          won
          message="All islands connected!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
