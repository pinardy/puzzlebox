import { useEffect, useMemo, type CSSProperties } from "react";
import { useGridNav } from "../lib/gridnav";
import { makeRng, shuffled } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Norinori.css";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 10 };
const HELP =
  "Shade exactly two squares in every outlined region, and make every " +
  "shaded square pair off with exactly one shaded neighbour — so the " +
  "shading is a scattering of dominoes. A domino may straddle a region " +
  "border; what matters is two per region.";

interface Puzzle {
  regionOf: number[];
  regions: number[][];
  /** The dominoes the regions were grown around: one valid answer. */
  solution: boolean[];
}

const nbrsOf = (i: number, n: number): number[] => {
  const r = Math.floor(i / n),
    c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** Lay down dominoes that never touch side-on, then grow one region around
 *  each over the rest of the board. Every region then holds exactly two
 *  shaded squares and every shaded square has exactly one shaded
 *  neighbour, so the seed dominoes are a legal answer by construction.
 *  Both conditions matter: dominoes packed edge to edge give squares with
 *  two shaded neighbours, and packing them densely leaves more regions
 *  than any shading can fill — the old generator did both. About one
 *  domino per five squares keeps the regions roomy enough to reason about. */
function generateNorinori(seed: string, n: number): Puzzle {
  const rng = makeRng(seed);
  const target = Math.round((n * n) / 5);
  for (;;) {
    const regionOf = Array(n * n).fill(-1);
    const regions: number[][] = [];
    // A square is blocked once it is a domino half or sits beside one.
    const blocked = Array(n * n).fill(false);
    for (const a of shuffled([...Array(n * n).keys()], rng)) {
      if (regions.length >= target) break;
      if (blocked[a]) continue;
      const free = nbrsOf(a, n).filter((b) => !blocked[b]);
      if (!free.length) continue;
      const b = free[Math.floor(rng() * free.length)];
      const id = regions.length;
      regionOf[a] = id;
      regionOf[b] = id;
      regions.push([a, b]);
      for (const k of [a, b, ...nbrsOf(a, n), ...nbrsOf(b, n)]) blocked[k] = true;
    }
    if (regions.length < target) continue;
    const solution = regionOf.map((id) => id !== -1);

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
    return { regionOf, regions, solution };
  }
}

interface SavedState {
  shaded: boolean[];
  done: boolean;
}

export default function Norinori({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>(
      (_s, d) => ({
        shaded: Array(SIZE[d] * SIZE[d]).fill(false),
        done: false
      }),
      // v1: the generator was rebuilt (the old boards had no answer), so a
      // seed now deals a different board.
      1
    );
  const n = SIZE[diff];
  const { regionOf, regions, solution } = useMemo(
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

  const solved = counts.every((k) => k === 2) && conflicts.size === 0;
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function toggle(i: number) {
    if (saved.done) return;
    const shaded = saved.shaded.slice();
    shaded[i] = !shaded[i];
    commit({ ...saved, shaded });
  }

  /** Set one square that differs from the generated answer. Another legal
   *  shading may exist; the hint steers toward this one. */
  function hint() {
    if (saved.done) return;
    const wrong = solution.flatMap((want, i) => (saved.shaded[i] !== want ? [i] : []));
    if (!wrong.length) return;
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    const shaded = saved.shaded.slice();
    shaded[i] = solution[i];
    commitHint({ ...saved, shaded });
  }

  const nav = useGridNav();

  return (
    <div className="game game-norinori">
      <GameHeader title="Norinori" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Two shaded squares per region; every shaded square touches exactly one more.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="nn-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Norinori board"
        {...nav}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n),
            c = i % n;
          const id = regionOf[i];
          return (
            <button
              key={i}
              role="gridcell"
              data-cell={i}
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
              aria-label={`Row ${r + 1}, column ${c + 1}, ${
                saved.shaded[i] ? "shaded" : "unshaded"
              }${conflicts.has(i) ? ", conflict" : ""}`}
            />
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Dominoes all placed!"
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
