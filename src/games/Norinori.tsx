import { useEffect, useMemo, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const HELP =
  "Shade exactly two squares in every outlined region, and make every " +
  "shaded square pair off with exactly one shaded neighbour — so the " +
  "shading is a scattering of dominoes. A domino may straddle a region " +
  "border; what matters is two per region.";

interface Puzzle {
  regionOf: number[];
  regions: number[][];
}

const nbrsOf = (i: number, n: number): number[] => {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** Seed each region with its own domino, then grow the regions over the
 *  rest of the board. Every region ends up holding exactly one domino,
 *  so a legal shading exists by construction. */
function generateNorinori(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);
  for (;;) {
    const regionOf = Array(n * n).fill(-1);
    const regions: number[][] = [];
    // Lay down non-touching dominoes as region seeds.
    for (const a of shuffled([...Array(n * n).keys()], rng)) {
      if (regionOf[a] !== -1) continue;
      const free = nbrsOf(a, n).filter((b) => regionOf[b] === -1);
      if (!free.length) continue;
      const b = free[Math.floor(rng() * free.length)];
      const id = regions.length;
      regionOf[a] = id;
      regionOf[b] = id;
      regions.push([a, b]);
    }
    if (regions.length < 3) continue;

    // Grow round-robin so regions stay compact and every cell lands in one.
    let free = [...Array(n * n).keys()].filter((i) => regionOf[i] === -1);
    let guard = n * n * 4;
    while (free.length && guard-- > 0) {
      for (const cells of shuffled(regions, rng)) {
        const frontier = cells.flatMap((i) =>
          nbrsOf(i, n).filter((j) => regionOf[j] === -1)
        );
        if (!frontier.length) continue;
        const pick = frontier[Math.floor(rng() * frontier.length)];
        regionOf[pick] = regions.indexOf(cells);
        cells.push(pick);
      }
      free = [...Array(n * n).keys()].filter((i) => regionOf[i] === -1);
    }
    if (free.length) continue;
    return { regionOf, regions };
  }
}

interface SavedState {
  shaded: boolean[];
  done: boolean;
}

export default function Norinori({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("norinori", (_s, d) => ({
      shaded: Array(SIZE[d] * SIZE[d]).fill(false),
      done: false
    }));
  const n = SIZE[diff];
  const { regionOf, regions } = useMemo(
    () => generateNorinori(`norinori-${seed}`, n),
    [seed, n]
  );

  const counts = useMemo(
    () => regions.map((cells) => cells.filter((i) => saved.shaded[i]).length),
    [regions, saved.shaded]
  );

  /** A shaded square is wrong when it has no shaded neighbour, or more
   *  than one — either way it isn't part of a clean domino. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      if (!saved.shaded[i]) continue;
      const k = nbrsOf(i, n).filter((j) => saved.shaded[j]).length;
      if (k !== 1) bad.add(i);
    }
    for (let id = 0; id < regions.length; id++)
      if (counts[id] > 2) regions[id].forEach((i) => saved.shaded[i] && bad.add(i));
    return bad;
  }, [saved.shaded, regions, counts, n]);

  useEffect(() => {
    if (!saved.done && counts.every((k) => k === 2) && conflicts.size === 0) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("norinori", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, conflicts, saved]);

  function toggle(i: number) {
    if (saved.done) return;
    const shaded = saved.shaded.slice();
    shaded[i] = !shaded[i];
    commit({ ...saved, shaded });
  }

  return (
    <div className="game game-norinori">
      <GameHeader title="Norinori" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Two shaded squares per region; every shaded square touches exactly
        one more.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="nn-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Norinori board"
      >
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n), c = i % n;
          const id = regionOf[i];
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "nn-cell",
                saved.shaded[i] ? "on" : "",
                conflicts.has(i) ? "conflict" : "",
                counts[id] === 2 ? "settled" : "",
                r > 0 && regionOf[i - n] !== id ? "reg-t" : "",
                c > 0 && regionOf[i - 1] !== id ? "reg-l" : "",
                r === n - 1 ? "reg-b" : "",
                c === n - 1 ? "reg-r" : ""
              ].join(" ")}
              onClick={() => toggle(i)}
              aria-pressed={saved.shaded[i]}
              aria-label={`Row ${r + 1} column ${c + 1}`}
            />
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="norinori"
          won
          message="Dominoes all placed!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
