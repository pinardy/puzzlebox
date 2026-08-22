import { useEffect, useMemo, type CSSProperties } from "react";
import { generateHeyawake } from "../lib/heyawake";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 6, medium: 7, hard: 8 };
const CLUE_RATE: Record<Diff, number> = { easy: 0.75, medium: 0.6, hard: 0.5 };
const HELP =
  "Shade squares so that: a numbered room holds exactly that many shaded " +
  "squares; no two shaded squares touch edge to edge; every unshaded " +
  "square is reachable from every other; and no straight run of unshaded " +
  "squares passes through three or more rooms.";

interface SavedState {
  shaded: boolean[];
  done: boolean;
}

export default function Heyawake({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("heyawake", (_s, d) => ({
      shaded: Array(SIZE[d] * SIZE[d]).fill(false),
      done: false
    }));
  const n = SIZE[diff];
  const puzzle = useMemo(
    () => generateHeyawake(`heyawake-${seed}`, n, CLUE_RATE[diff]),
    [seed, n, diff]
  );
  const { rooms, roomOf, clue } = puzzle;

  const counts = useMemo(() => {
    const k = Array(rooms.length).fill(0);
    saved.shaded.forEach((on, i) => {
      if (on) k[roomOf[i]]++;
    });
    return k;
  }, [saved.shaded, roomOf, rooms.length]);

  /** Touching shaded squares, and rooms already over their number. */
  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      if (!saved.shaded[i]) continue;
      const r = Math.floor(i / n), c = i % n;
      if (c > 0 && saved.shaded[i - 1]) {
        bad.add(i);
        bad.add(i - 1);
      }
      if (r > 0 && saved.shaded[i - n]) {
        bad.add(i);
        bad.add(i - n);
      }
      const want = clue[roomOf[i]];
      if (want !== null && counts[roomOf[i]] > want) bad.add(i);
    }
    return bad;
  }, [saved.shaded, clue, counts, roomOf, n]);

  /** The two global rules: unshaded squares all connected, and no
   *  straight unshaded run crossing three rooms. */
  const globalsOk = useMemo(() => {
    const open = (i: number) => !saved.shaded[i];
    const start = [...Array(n * n).keys()].find(open);
    if (start === undefined) return false;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const j = stack.pop()!;
      const r = Math.floor(j / n), c = j % n;
      for (const k of [
        r > 0 ? j - n : -1,
        r < n - 1 ? j + n : -1,
        c > 0 ? j - 1 : -1,
        c < n - 1 ? j + 1 : -1
      ])
        if (k !== -1 && open(k) && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
    }
    if (seen.size !== saved.shaded.filter((s) => !s).length) return false;

    const scan = (cells: number[]): boolean => {
      let run: number[] = [];
      for (const i of [...cells, -1]) {
        if (i !== -1 && open(i)) {
          run.push(i);
          continue;
        }
        if (new Set(run.map((j) => roomOf[j])).size >= 3) return false;
        run = [];
      }
      return true;
    };
    for (let r = 0; r < n; r++)
      if (!scan(Array.from({ length: n }, (_, c) => r * n + c))) return false;
    for (let c = 0; c < n; c++)
      if (!scan(Array.from({ length: n }, (_, r) => r * n + c))) return false;
    return true;
  }, [saved.shaded, roomOf, n]);

  useEffect(() => {
    const cluesOk = clue.every((want, id) => want === null || counts[id] === want);
    if (!saved.done && cluesOk && conflicts.size === 0 && globalsOk) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("heyawake", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, conflicts, globalsOk, saved]);

  function toggle(i: number) {
    if (saved.done) return;
    const shaded = saved.shaded.slice();
    shaded[i] = !shaded[i];
    commit({ ...saved, shaded });
  }

  // A room's number goes in its top-left cell.
  const labelAt = useMemo(() => {
    const m = new Map<number, number>();
    rooms.forEach((rm, id) => {
      if (clue[id] !== null) m.set(rm.r0 * n + rm.c0, clue[id]!);
    });
    return m;
  }, [rooms, clue, n]);

  return (
    <div className="game game-heyawake">
      <GameHeader title="Heyawake" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Numbers count shaded squares in their room; shaded squares never
        touch.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div
        className="hw-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Heyawake board"
      >
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n), c = i % n;
          const id = roomOf[i];
          const want = clue[id];
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "hw-cell",
                saved.shaded[i] ? "on" : "",
                conflicts.has(i) ? "conflict" : "",
                want !== null && counts[id] === want ? "settled" : "",
                r > 0 && roomOf[i - n] !== id ? "room-t" : "",
                c > 0 && roomOf[i - 1] !== id ? "room-l" : "",
                r === n - 1 ? "room-b" : "",
                c === n - 1 ? "room-r" : ""
              ].join(" ")}
              onClick={() => toggle(i)}
              aria-pressed={saved.shaded[i]}
            >
              {labelAt.has(i) && (
                <span className="hw-clue">{labelAt.get(i)}</span>
              )}
            </button>
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="heyawake"
          won
          message="Rooms balanced!"
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
