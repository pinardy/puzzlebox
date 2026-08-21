import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeRng } from "../lib/rng";
import { LetterState, scoreGuess } from "../lib/words";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const ROWS = 6;
const LEN = 8;
const HELP =
  "Find the hidden 8-character equation in 6 tries. Every guess must be a " +
  "valid equation (like 12+35=47) — green means right character, right " +
  "spot; amber means it appears elsewhere. Numbers never start with 0, and " +
  "× and ÷ bind before + and −.";

/** Parse and evaluate one side of a guess. Returns null when malformed:
 *  empty terms, leading zeros, or inexact division. */
function evalExpr(s: string): number | null {
  const parts = s.split(/([+\-×÷])/);
  if (parts.some((p) => p === "")) return null;
  const nums: number[] = [];
  const ops: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (!/^\d+$/.test(parts[i]) || (parts[i].length > 1 && parts[i][0] === "0"))
        return null;
      nums.push(Number(parts[i]));
    } else ops.push(parts[i]);
  }
  // × and ÷ first…
  for (let i = 0; i < ops.length; ) {
    if (ops[i] === "×" || ops[i] === "÷") {
      if (ops[i] === "÷" && (nums[i + 1] === 0 || nums[i] % nums[i + 1] !== 0))
        return null;
      nums.splice(i, 2, ops[i] === "×" ? nums[i] * nums[i + 1] : nums[i] / nums[i + 1]);
      ops.splice(i, 1);
    } else i++;
  }
  // …then + and − left to right.
  let acc = nums[0];
  for (let i = 0; i < ops.length; i++)
    acc = ops[i] === "+" ? acc + nums[i + 1] : acc - nums[i + 1];
  return acc;
}

/** Is this a well-formed, true equation of exactly LEN characters? */
function validEquation(s: string): boolean {
  if (s.length !== LEN) return false;
  const eq = s.indexOf("=");
  if (eq === -1 || eq !== s.lastIndexOf("=")) return false;
  const lhs = s.slice(0, eq);
  const rhs = s.slice(eq + 1);
  if (!/^\d+$/.test(rhs) || (rhs.length > 1 && rhs[0] === "0")) return false;
  if (!/[+\-×÷]/.test(lhs)) return false;
  return evalExpr(lhs) === Number(rhs);
}

const OPS: Record<Diff, string[]> = {
  easy: ["+", "-"],
  medium: ["+", "-", "×"],
  hard: ["+", "-", "×", "÷"]
};

/** Deal a hidden equation: random operands and operators, kept only when
 *  the rendered string is exactly LEN characters and truly holds. Hard
 *  boards prefer two-operator equations. */
function answerFor(seed: string, diff: Diff): string {
  const rng = makeRng(`eq-${seed}`);
  const ops = OPS[diff];
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  for (;;) {
    const twoOps = diff === "hard" ? rng() < 0.7 : diff === "medium" && rng() < 0.3;
    let s: string;
    if (twoOps) {
      const a = int(1, 99), b = int(1, 12), c = int(1, 99);
      s = `${a}${ops[int(0, ops.length - 1)]}${b}${ops[int(0, ops.length - 1)]}${c}`;
    } else {
      const a = int(1, 999), b = int(1, 999);
      s = `${a}${ops[int(0, ops.length - 1)]}${b}`;
    }
    const val = evalExpr(s);
    if (val === null || val < 0) continue;
    const full = `${s}=${val}`;
    if (full.length === LEN && validEquation(full)) return full;
  }
}

interface SavedState {
  guesses: string[];
  done: boolean;
  won: boolean;
}

const KEY_ROWS = ["1234567890", "+-×÷="];

export default function Equation({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "equation",
    () => ({ guesses: [], done: false, won: false })
  );
  const answer = useMemo(() => answerFor(seed, diff), [seed, diff]);
  const [current, setCurrent] = useState("");
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }

  const keyStates = useMemo(() => {
    const map: Record<string, LetterState> = {};
    const rank = { absent: 0, present: 1, correct: 2 };
    for (const g of saved.guesses) {
      const score = scoreGuess(g, answer);
      for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (!map[c] || rank[score[i]] > rank[map[c]]) map[c] = score[i];
      }
    }
    return map;
  }, [saved.guesses, answer]);

  const submit = useCallback(() => {
    if (saved.done) return;
    if (current.length !== LEN) {
      flash("Too short");
      return;
    }
    if (!validEquation(current)) {
      flash("Not a valid equation");
      return;
    }
    const guesses = [...saved.guesses, current];
    const won = current === answer;
    const done = won || guesses.length >= ROWS;
    commit({ guesses, done, won });
    setCurrent("");
    if (done) recordResult("equation", won);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, saved, answer]);

  const onKey = useCallback(
    (k: string) => {
      if (saved.done) return;
      if (k === "enter") submit();
      else if (k === "back") setCurrent((c) => c.slice(0, -1));
      else if (/^[\d+\-×÷=]$/.test(k) && current.length < LEN)
        setCurrent((c) => c + k);
    },
    [saved.done, submit, current.length]
  );

  function startNew(d?: Diff) {
    newPuzzle(d);
    setCurrent("");
    setToast(null);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") onKey("enter");
      else if (e.key === "Backspace") onKey("back");
      else if (e.key === "*") onKey("×");
      else if (e.key === "/") onKey("÷");
      else if (/^[\d+\-=]$/.test(e.key)) onKey(e.key);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  return (
    <div className="game game-equation">
      <GameHeader title="Equation" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">Guess the hidden equation in 6 tries.</p>
      <GameTools diff={diff} onDiff={startNew} help={HELP} />

      <div className="word-grid eq-grid" role="grid" aria-label="Guess grid">
        {Array.from({ length: ROWS }).map((_, r) => {
          const guess = saved.guesses[r];
          const isCurrent = r === saved.guesses.length && !saved.done;
          const chars = guess ?? (isCurrent ? current : "");
          const score = guess ? scoreGuess(guess, answer) : null;
          return (
            <div
              key={r}
              className={`word-row${isCurrent && shake ? " shake" : ""}`}
              role="row"
            >
              {Array.from({ length: LEN }).map((_, c) => (
                <div
                  key={c}
                  role="gridcell"
                  className={`word-cell${score ? ` is-${score[c]}` : ""}${
                    chars[c] ? " filled" : ""
                  }`}
                  style={score ? { transitionDelay: `${c * 50}ms` } : undefined}
                >
                  {chars[c] ?? ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="keyboard">
        {KEY_ROWS.map((row, i) => (
          <div className="key-row" key={row}>
            {i === 1 && (
              <button className="key key-wide" onClick={() => onKey("enter")}>
                Enter
              </button>
            )}
            {row.split("").map((k) => {
              const st = keyStates[k];
              return (
                <button
                  key={k}
                  className={`key${st ? ` is-${st}` : ""}`}
                  onClick={() => onKey(k)}
                >
                  {k}
                </button>
              );
            })}
            {i === 1 && (
              <button className="key key-wide" onClick={() => onKey("back")}>
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="equation"
          won={saved.won}
          message={saved.won ? "Balanced!" : `It was ${answer}`}
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
