import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { useGridKeys } from "../lib/keys";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import { Numpad } from "./Numpad";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const REVEAL: Record<Diff, number> = { easy: 0.5, medium: 0.4, hard: 0.32 };
const HELP =
  "Each outlined region of N cells holds the numbers 1 to N exactly once — " +
  "and identical numbers may never touch, not even diagonally. Regions are " +
  "small, so start with the 1-cell and 2-cell ones.";

interface Puzzle {
  regionOf: number[];
  regionSize: number[];
  givens: number[]; // 0 = player cell
  solution: number[];
}

function generateSuguru(seed: string, n: number, reveal: number): Puzzle {
  const rng = makeRng(seed);

  for (;;) {
    // Partition into regions of 2–5 cells (stragglers may be smaller).
    const regionOf = Array(n * n).fill(-1);
    const regions: number[][] = [];
    for (const start of shuffled([...Array(n * n).keys()], rng)) {
      if (regionOf[start] !== -1) continue;
      const id = regions.length;
      const cells = [start];
      regionOf[start] = id;
      const want = 2 + Math.floor(rng() * 4); // 2–5
      while (cells.length < want) {
        const frontier = cells.flatMap((i) => {
          const r = Math.floor(i / n), c = i % n;
          const out: number[] = [];
          if (r > 0 && regionOf[i - n] === -1) out.push(i - n);
          if (r < n - 1 && regionOf[i + n] === -1) out.push(i + n);
          if (c > 0 && regionOf[i - 1] === -1) out.push(i - 1);
          if (c < n - 1 && regionOf[i + 1] === -1) out.push(i + 1);
          return out;
        });
        if (!frontier.length) break;
        const pick = frontier[Math.floor(rng() * frontier.length)];
        regionOf[pick] = id;
        cells.push(pick);
      }
      regions.push(cells);
    }
    // A boxed-in straggler is a 1-cell region, and two of those touching
    // would both have to be 1 — unsolvable. Fold each into a neighbouring
    // region with room to spare.
    for (let id = 0; id < regions.length; id++) {
      if (regions[id].length !== 1) continue;
      const i = regions[id][0];
      const r = Math.floor(i / n), c = i % n;
      const nbrs = [
        r > 0 ? i - n : -1,
        r < n - 1 ? i + n : -1,
        c > 0 ? i - 1 : -1,
        c < n - 1 ? i + 1 : -1
      ].filter((j) => j !== -1 && regions[regionOf[j]].length < 5);
      if (!nbrs.length) continue;
      const into = regionOf[nbrs[Math.floor(rng() * nbrs.length)]];
      regions[into].push(i);
      regionOf[i] = into;
      regions[id] = [];
    }
    const regionSize = regionOf.map((id) => regions[id].length);

    // Fill: 1..size per region, no equal numbers touching (8-way). Always
    // branch on the cell with the fewest options left — a random cell order
    // could backtrack for tens of seconds on a 6×6 board.
    const values = Array(n * n).fill(0);
    const options = (i: number): number[] => {
      const r = Math.floor(i / n), c = i % n;
      const used = new Set(regions[regionOf[i]].map((j) => values[j]));
      const out: number[] = [];
      for (let v = 1; v <= regionSize[i]; v++) {
        if (used.has(v)) continue;
        let ok = true;
        for (let dr = -1; dr <= 1 && ok; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < n && cc >= 0 && cc < n && values[rr * n + cc] === v) {
              ok = false;
              break;
            }
          }
        if (ok) out.push(v);
      }
      return out;
    };
    let steps = 0;
    const fill = (): boolean => {
      if (++steps > 20000) return false;
      let best = -1;
      let bestOpts: number[] = [];
      for (let i = 0; i < n * n; i++) {
        if (values[i]) continue;
        const o = options(i);
        if (!o.length) return false;
        if (best === -1 || o.length < bestOpts.length) {
          best = i;
          bestOpts = o;
          if (o.length === 1) break;
        }
      }
      if (best === -1) return true;
      for (const v of shuffled(bestOpts, rng)) {
        values[best] = v;
        if (fill()) return true;
      }
      values[best] = 0;
      return false;
    };
    if (!fill()) continue;

    const givens = Array(n * n).fill(0);
    for (const i of shuffled([...Array(n * n).keys()], rng).slice(
      0,
      Math.round(n * n * reveal)
    ))
      givens[i] = values[i];
    return { regionOf, regionSize, givens, solution: values };
  }
}

interface SavedState {
  entries: number[];
  done: boolean;
}

export default function Suguru({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>(
      (_s, d) => ({
        entries: Array(SIZE[d] * SIZE[d]).fill(0),
        done: false
      }),
      // v1: the generator changed, so a seed now deals a different board.
      1
    );
  const n = SIZE[diff];
  const puzzle = useMemo(
    () => generateSuguru(`suguru-${seed}`, n, REVEAL[diff]),
    [seed, n, diff]
  );
  const [selected, setSelected] = useState<number | null>(null);

  const board = useMemo(
    () => puzzle.givens.map((v, i) => (v !== 0 ? v : saved.entries[i])),
    [puzzle, saved.entries]
  );

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const v = board[i];
      if (v === 0) continue;
      if (v > puzzle.regionSize[i]) bad.add(i);
      const r = Math.floor(i / n), c = i % n;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          const j = rr * n + cc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && board[j] === v) {
            bad.add(i);
            bad.add(j);
          }
        }
      // duplicate within region
      for (let j = 0; j < n * n; j++)
        if (j !== i && puzzle.regionOf[j] === puzzle.regionOf[i] && board[j] === v)
          bad.add(i);
    }
    return bad;
  }, [board, puzzle, n]);

  const solved = board.every((v) => v !== 0) && conflicts.size === 0;
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function setCell(idx: number, val: number) {
    if (saved.done || puzzle.givens[idx] !== 0) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) =>
      puzzle.givens[i] === 0 && board[i] !== puzzle.solution[i];
    const cands = [...Array(n * n).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    entries[idx] = puzzle.solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: n, rows: n, max: 5, selected, setSelected, setCell });

  return (
    <div className="game game-suguru">
      <GameHeader title="Suguru" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        1 to N in each N-cell region; equal numbers never touch, even
        diagonally.
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
        className="kenken-grid suguru-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Suguru board"
      >
        {board.map((v, i) => {
          const r = Math.floor(i / n), c = i % n;
          const given = puzzle.givens[i] !== 0;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "kenken-cell suguru-cell",
                given ? "given" : "",
                selected === i ? "selected" : "",
                conflicts.has(i) ? "conflict" : "",
                r > 0 && puzzle.regionOf[i - n] !== puzzle.regionOf[i] ? "cage-t" : "",
                c > 0 && puzzle.regionOf[i - 1] !== puzzle.regionOf[i] ? "cage-l" : ""
              ].join(" ")}
              onClick={() => setSelected(i)}
            >
              <span className="kenken-val">{v || ""}</span>
            </button>
          );
        })}
      </div>

      <Numpad max={5} onDigit={(d) => selected !== null && setCell(selected, d)} />

      {saved.done && (
        <Result
          key={seed}
          won
          message="Regions all in order!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
