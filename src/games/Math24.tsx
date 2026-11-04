import { useEffect, useState } from "react";
import { makeRng } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Math24.css";

const HELP =
  "Combine all four numbers with +, −, ×, ÷ to make exactly 24, using each " +
  "number once. Tap a number, an operator, then a second number to merge " +
  "them. Fractions along the way are fine. Reset or undo freely — every " +
  "deal is solvable.";

type Frac = { n: number; d: number };

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const frac = (n: number, d: number): Frac => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
};
const show = (f: Frac): string => (f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`);

type Op = "+" | "−" | "×" | "÷";
const OPS: Op[] = ["+", "−", "×", "÷"];

function apply(a: Frac, b: Frac, op: Op): Frac | null {
  switch (op) {
    case "+": return frac(a.n * b.d + b.n * a.d, a.d * b.d);
    case "−": return frac(a.n * b.d - b.n * a.d, a.d * b.d);
    case "×": return frac(a.n * b.n, a.d * b.d);
    case "÷": return b.n === 0 ? null : frac(a.n * b.d, a.d * b.n);
  }
}

/** Count successful solve paths (a rough difficulty proxy). */
function solutions(nums: Frac[]): number {
  if (nums.length === 1) return nums[0].n === 24 && nums[0].d === 1 ? 1 : 0;
  let count = 0;
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        if ((op === "+" || op === "×") && i > j) continue; // commutative once
        const r = apply(nums[i], nums[j], op);
        if (r) count += solutions([...rest, r]);
      }
    }
  return count;
}

/** One merge that keeps 24 reachable from these tiles, or null when the
 *  position is already a dead end. */
function nextStep(nums: Frac[]): { i: number; j: number; op: Op } | null {
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        const r = apply(nums[i], nums[j], op);
        if (r && solutions([...rest, r]) > 0) return { i, j, op };
      }
    }
  return null;
}

const OP_NAME: Record<Op, string> = { "+": "plus", "−": "minus", "×": "times", "÷": "divided by" };
const OP_KEYS: Record<string, Op> = { "+": "+", "-": "−", "*": "×", x: "×", X: "×", "/": "÷" };

function generate24(seed: string, diff: Diff): number[] {
  const rng = makeRng(`math24-${seed}`);
  const max = diff === "easy" ? 9 : diff === "medium" ? 10 : 13;
  for (;;) {
    const nums = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * max));
    const paths = solutions(nums.map((v) => frac(v, 1)));
    const fits =
      diff === "easy" ? paths >= 10 :
      diff === "medium" ? paths >= 1 :
      paths >= 1 && paths <= 6;
    if (fits) return nums;
  }
}

interface SavedState {
  tiles: Frac[];
  merges: number;
  done: boolean;
}

export default function Math24({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => ({
      tiles: generate24(s, d).map((v) => frac(v, 1)),
      merges: 0,
      done: false
    }));
  const [pick, setPick] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);

  function tapTile(i: number) {
    if (saved.done) return;
    if (pick === null) {
      setPick(i);
      return;
    }
    if (pick === i) {
      setPick(null);
      setOp(null);
      return;
    }
    if (op === null) {
      setPick(i); // re-pick without an operator
      return;
    }
    const result = apply(saved.tiles[pick], saved.tiles[i], op);
    setPick(null);
    setOp(null);
    if (!result) return; // division by zero
    const tiles = saved.tiles.filter((_, k) => k !== pick && k !== i);
    tiles.push(result);
    const done = tiles.length === 1 && result.n === 24 && result.d === 1;
    commit(
      { tiles, merges: saved.merges + 1, done },
      done ? { outcome: "won" } : undefined
    );
  }

  /** Make one merge that still leads to 24. From a dead end, start over
   *  from the deal and make its first good merge instead. Counts as a
   *  hint, so a win after it is marked assisted. */
  function hint() {
    if (saved.done) return;
    let tiles = saved.tiles;
    let merges = saved.merges;
    let step = nextStep(tiles);
    if (!step) {
      tiles = generate24(seed, diff).map((v) => frac(v, 1));
      merges = 0;
      step = nextStep(tiles);
      if (!step) return;
    }
    const { i, j, op: o } = step;
    const result = apply(tiles[i], tiles[j], o)!;
    const next = tiles.filter((_, k) => k !== i && k !== j);
    next.push(result);
    const done = next.length === 1 && result.n === 24 && result.d === 1;
    commit(
      { tiles: next, merges: merges + 1, done },
      done ? { hint: true, outcome: "won" } : { hint: true }
    );
    setPick(null);
    setOp(null);
  }

  // Typing an operator (+ - * x /) picks it once a number is chosen; the
  // numbers themselves are buttons, reached with Tab.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const o = OP_KEYS[e.key];
      if (!o || pick === null || saved.done) return;
      e.preventDefault();
      setOp((cur) => (cur === o ? null : o));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pick, saved.done]);

  function reset() {
    commit({
      tiles: generate24(seed, diff).map((v) => frac(v, 1)),
      merges: 0,
      done: false
    });
    setPick(null);
    setOp(null);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setPick(null);
    setOp(null);
  }

  return (
    <div className="game game-math24">
      <GameHeader title="Math 24" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Make exactly <b>24</b> from all four numbers.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="m24-tiles" role="group" aria-label="Numbers">
        {saved.tiles.map((f, i) => (
          <button
            key={i}
            className={`m24-tile${pick === i ? " picked" : ""}${
              saved.done && saved.tiles.length === 1 ? " win" : ""
            }`}
            onClick={() => tapTile(i)}
            aria-pressed={pick === i}
            aria-label={`${show(f)}${pick === i ? ", picked" : ""}`}
          >
            {show(f)}
          </button>
        ))}
      </div>

      <div className="m24-ops" role="group" aria-label="Operators">
        {OPS.map((o) => (
          <button
            key={o}
            className={`num-key m24-op${op === o ? " active" : ""}`}
            disabled={pick === null || saved.done}
            onClick={() => setOp(op === o ? null : o)}
            aria-pressed={op === o}
            aria-label={OP_NAME[o]}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          {pick === null
            ? "Tap a number to start"
            : op === null
              ? "Now tap an operator"
              : "Tap the second number"}
        </span>
        <button className="mini-btn" onClick={reset} disabled={saved.done}>
          Reset
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`24 — in ${saved.merges} merges!`}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
