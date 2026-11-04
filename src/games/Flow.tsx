import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useCellDrag } from "../lib/drag";
import { makeRng } from "../lib/rng";
import { hamiltonianPath, areAdjacent } from "../lib/zip";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Flow.css";

const SIZE: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const HELP =
  "Join each pair of matching dots with a pipe by dragging between them. " +
  "Pipes can't cross or share squares, and when everything is connected " +
  "every square must be covered.";
const COLORS = [
  "#e05252",
  "#3b6fe0",
  "#2e9e6b",
  "#e0a23b",
  "#7857c9",
  "#e06fb2",
  "#8a5a2b"
];

interface Puzzle {
  ends: [number, number][];
  /** Each colour's pipe in the generated full-grid answer. */
  pipes: number[][];
}

/** Cut one Hamiltonian path into segments — the segment ends become the
 *  dot pairs, so a full-grid solution exists by construction. */
function generateFlow(seed: string, n: number, pipes: number): Puzzle {
  const rng = makeRng(seed);
  const path = hamiltonianPath(n, rng);
  const lens: number[] = [];
  let left = path.length;
  for (let k = pipes; k > 1; k--) {
    const max = left - 3 * (k - 1);
    const len = 3 + Math.floor(rng() * (max - 2));
    lens.push(len);
    left -= len;
  }
  lens.push(left);
  const ends: [number, number][] = [];
  const segs: number[][] = [];
  let at = 0;
  for (const len of lens) {
    ends.push([path[at], path[at + len - 1]]);
    segs.push(path.slice(at, at + len));
    at += len;
  }
  return { ends, pipes: segs };
}

type Paths = Record<number, number[]>; // colour → path of cells

interface SavedState {
  paths: Paths;
  done: boolean;
}

export default function Flow({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, newPuzzle } =
    useGame<SavedState>(() => ({ paths: {}, done: false }));
  const n = SIZE[diff];
  const pipes = SIZE[diff];
  const { ends, pipes: answer } = useMemo(
    () => generateFlow(`flow-${seed}`, n, pipes),
    [seed, n, pipes]
  );
  const active = useRef<number | null>(null);

  const endColor = useMemo(() => {
    const map = new Map<number, number>();
    ends.forEach(([a, b], c) => {
      map.set(a, c);
      map.set(b, c);
    });
    return map;
  }, [ends]);

  const pipeAt = useMemo(() => {
    const map = new Map<number, number>();
    for (const [c, cells] of Object.entries(saved.paths))
      for (const i of cells) map.set(i, Number(c));
    return map;
  }, [saved.paths]);

  function isDone(paths: Paths) {
    const covered = new Set<number>();
    for (const cells of Object.values(paths)) cells.forEach((i) => covered.add(i));
    const complete = ends.every(([a, b], c) => {
      const p = paths[c];
      return (
        p &&
        p.length > 1 &&
        ((p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a))
      );
    });
    return complete && covered.size === n * n;
  }

  function apply(paths: Paths) {
    const done = isDone(paths);
    // Drawing has its own rewind, so moves aren't undoable.
    commit(
      { paths, done },
      { undoable: false, outcome: done && !saved.done ? "won" : undefined }
    );
  }

  function startAt(idx: number) {
    const c = endColor.get(idx);
    if (c !== undefined) {
      active.current = c;
      apply({ ...saved.paths, [c]: [idx] });
      return;
    }
    const on = pipeAt.get(idx);
    if (on !== undefined) {
      const p = saved.paths[on];
      const at = p.indexOf(idx);
      active.current = on;
      apply({ ...saved.paths, [on]: p.slice(0, at + 1) });
    }
  }

  function extend(idx: number) {
    const next = extended(idx);
    if (next) apply(next);
  }

  /** The paths after the active pipe steps onto (or back to) `idx`, or
   *  null when that move isn't allowed. */
  function extended(idx: number): Paths | null {
    const c = active.current;
    if (c === null) return null;
    const p = saved.paths[c] ?? [];
    if (!p.length) return null;
    const head = p[p.length - 1];
    if (idx === head) return null;
    const [a, b] = ends[c];
    const connectsBoth =
      p.length > 1 && ((p[0] === a && head === b) || (p[0] === b && head === a));
    if (connectsBoth) return null;

    const at = p.indexOf(idx);
    if (at !== -1) return { ...saved.paths, [c]: p.slice(0, at + 1) };
    if (!areAdjacent(head, idx, n)) return null;
    const owner = pipeAt.get(idx);
    if (owner !== undefined && owner !== c) return null;
    const endOwner = endColor.get(idx);
    if (endOwner !== undefined && endOwner !== c) return null;
    return { ...saved.paths, [c]: [...p, idx] };
  }

  /** Lay one unfinished pipe exactly as in the generated answer, cutting
   *  back any other pipe that was in its way. */
  function hint() {
    if (saved.done) return;
    const same = (p: number[] | undefined, q: number[]) =>
      !!p &&
      p.length === q.length &&
      (p.every((v, k) => v === q[k]) || p.every((v, k) => v === q[q.length - 1 - k]));
    const todo = answer.flatMap((q, c) => (same(saved.paths[c], q) ? [] : [c]));
    if (!todo.length) return;
    const c = todo[Math.floor(Math.random() * todo.length)];
    const cells = new Set(answer[c]);
    const paths: Paths = {};
    for (const [k, p] of Object.entries(saved.paths)) {
      const cut = p.findIndex((i) => cells.has(i));
      const kept = cut === -1 ? p : p.slice(0, cut);
      if (kept.length) paths[Number(k)] = kept;
    }
    paths[c] = answer[c].slice();
    active.current = null;
    commitHint({ paths, done: false });
  }

  // A hint can complete the board; finish it the way a drawn move would.
  const doneNow = useMemo(() => isDone(saved.paths), [saved.paths]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (doneNow) finish();
  }, [doneNow, finish]);

  const drag = useCellDrag({
    onStart(i) {
      if (saved.done) return false;
      startAt(i);
    },
    onEnter(i) {
      if (!saved.done) extend(i);
    },
    onEnd() {
      active.current = null;
    },
    // Enter extends the pipe in hand onto the focused cell when it can;
    // otherwise it picks up the pipe there (a dot starts it afresh).
    onKey(i) {
      if (saved.done) return;
      const next = extended(i);
      if (next) apply(next);
      else {
        active.current = null;
        startAt(i);
      }
    }
  });

  function startNew(d?: Diff) {
    newPuzzle(d);
    active.current = null;
  }

  const covered = pipeAt.size;

  return (
    <div className="game game-flow">
      <GameHeader title="Flow" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Drag to join each pair of dots with a pipe. Fill every square.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="flow-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Flow board"
        {...drag}
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const dot = endColor.get(i);
          const pipe = pipeAt.get(i);
          return (
            <div
              key={i}
              role="gridcell"
              data-cell={i}
              aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${
                dot !== undefined
                  ? `colour ${dot + 1} dot${pipe !== undefined ? ", piped" : ""}`
                  : pipe !== undefined
                    ? `colour ${pipe + 1} pipe`
                    : "empty"
              }`}
              className="flow-cell"
              style={
                pipe !== undefined
                  ? ({ "--pipe": COLORS[pipe] } as CSSProperties)
                  : undefined
              }
            >
              {pipe !== undefined && <span className="flow-fill" />}
              {dot !== undefined && (
                <span className="flow-dot" style={{ background: COLORS[dot] }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>
          {covered} / {n * n} filled
        </span>
        <button
          className="mini-btn"
          onClick={() => {
            apply({});
            active.current = null;
          }}
        >
          Clear
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Everything flows!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
