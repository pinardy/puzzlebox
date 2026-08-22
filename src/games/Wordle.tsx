import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeRng } from "../lib/rng";
import { ANSWERS, LetterState, scoreGuess } from "../lib/words";
import { WORDS4 } from "../lib/words4";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const ROWS = 6;
const LEN: Record<Diff, number> = { easy: 4, medium: 5, hard: 5 };
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const HELP =
  "Guess the word within six tries. Green is the right letter in the " +
  "right spot; amber is in the word but elsewhere. Easy plays 4-letter " +
  "words; Hard makes every revealed hint binding — greens must stay put " +
  "and ambers must be reused. Any real-shaped guess counts and costs a " +
  "try.";

// 4-letter answers reuse the word-ladder list, minus plain plurals.
const ANSWERS4 = WORDS4.filter((w) => !w.endsWith("s") || w.endsWith("ss"));

interface SavedState {
  guesses: string[];
  revealed: (string | null)[]; // hint-revealed letters by position
  done: boolean;
  won: boolean;
}

function answerFor(seed: string, diff: Diff): string {
  const pool = diff === "easy" ? ANSWERS4 : ANSWERS;
  return pool[Math.floor(makeRng(seed)() * pool.length)].toUpperCase();
}

/** Hard mode: every hint from earlier guesses is binding. Returns the
 *  reason the guess is rejected, or null when it's fine. */
function hardModeViolation(
  guess: string,
  prior: string[],
  answer: string
): string | null {
  for (const g of prior) {
    const score = scoreGuess(g, answer);
    for (let i = 0; i < g.length; i++) {
      if (score[i] === "correct" && guess[i] !== g[i])
        return `Letter ${i + 1} must be ${g[i]}`;
    }
    for (let i = 0; i < g.length; i++) {
      if (score[i] === "present" && !guess.includes(g[i]))
        return `Guess must contain ${g[i]}`;
    }
  }
  return null;
}

export default function Wordle({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, newPuzzle, playMs } =
    useGame<SavedState>("word", (_s, d) => ({
      guesses: [],
      revealed: Array(LEN[d]).fill(null),
      done: false,
      won: false
    }));
  const cols = LEN[diff];
  const answer = useMemo(() => answerFor(seed, diff), [seed, diff]);
  // Slots saved before hints existed lack `revealed`.
  const revealed = saved.revealed ?? Array(cols).fill(null);
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
    if (current.length !== cols) {
      flash("Not enough letters");
      return;
    }
    // Any letters count as a guess — it costs a try either way, and a
    // small bundled word list rejecting real words feels like a bug.
    if (diff === "hard") {
      const violation = hardModeViolation(current, saved.guesses, answer);
      if (violation) {
        flash(violation);
        return;
      }
    }
    const guesses = [...saved.guesses, current];
    const won = current === answer;
    const done = won || guesses.length >= ROWS;
    commit({ ...saved, guesses, done, won });
    setCurrent("");
    if (done) recordResult("word", won);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, saved, answer, diff, cols]);

  const onKey = useCallback(
    (k: string) => {
      if (saved.done) return;
      if (k === "enter") submit();
      else if (k === "back") setCurrent((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(k) && current.length < cols)
        setCurrent((c) => c + k);
    },
    [saved.done, submit, current.length, cols]
  );

  /** Reveal one letter in a spot no guess has turned green yet. */
  function hint() {
    const greened = (i: number) => saved.guesses.some((g) => g[i] === answer[i]);
    const cands = [...Array(cols).keys()].filter((i) => !revealed[i] && !greened(i));
    if (!cands.length) return;
    const idx = cands[Math.floor(Math.random() * cands.length)];
    const next = revealed.slice();
    next[idx] = answer[idx];
    commitHint({ ...saved, revealed: next });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setCurrent("");
    setToast(null);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") onKey("enter");
      else if (e.key === "Backspace") onKey("back");
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  const anyRevealed = revealed.some((c) => c !== null);

  return (
    <div className="game game-word">
      <GameHeader title="Word Guess" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Guess the {cols}-letter word in 6 tries.
        {diff === "hard" && " Hints are binding."}
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onHint={saved.done ? undefined : hint}
      />

      <div className="word-grid" role="grid" aria-label="Guess grid">
        {anyRevealed && !saved.done && (
          <div className="word-row" role="row" aria-label="Revealed letters">
            {revealed.map((c, i) => (
              <div key={i} className={`word-cell hint-reveal${c ? " filled" : ""}`}>
                {c ?? ""}
              </div>
            ))}
          </div>
        )}
        {Array.from({ length: ROWS }).map((_, r) => {
          const guess = saved.guesses[r];
          const isCurrent = r === saved.guesses.length && !saved.done;
          const letters = guess ?? (isCurrent ? current : "");
          const score = guess ? scoreGuess(guess, answer) : null;
          return (
            <div
              key={r}
              className={`word-row${isCurrent && shake ? " shake" : ""}`}
              role="row"
            >
              {Array.from({ length: cols }).map((_, c) => (
                <div
                  key={c}
                  role="gridcell"
                  className={`word-cell${score ? ` is-${score[c]}` : ""}${
                    letters[c] ? " filled" : ""
                  }`}
                  style={score ? { transitionDelay: `${c * 60}ms` } : undefined}
                >
                  {letters[c] ?? ""}
                </div>
              ))}
            </div>
          );
        })}
        {saved.done && !saved.won && (
          <div className="word-row" role="row" aria-label="The answer">
            {answer.split("").map((c, i) => (
              <div key={i} className="word-cell filled answer-cell">
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="keyboard">
        {KEY_ROWS.map((row, i) => (
          <div className="key-row" key={row}>
            {i === 2 && (
              <button className="key key-wide" onClick={() => onKey("enter")}>
                Enter
              </button>
            )}
            {row.split("").map((k) => {
              const K = k.toUpperCase();
              const st = keyStates[K];
              return (
                <button
                  key={k}
                  className={`key${st ? ` is-${st}` : ""}`}
                  onClick={() => onKey(K)}
                >
                  {K}
                </button>
              );
            })}
            {i === 2 && (
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
          game="word"
          won={saved.won}
          message={saved.won ? winMessage(saved.guesses.length) : `The word was ${answer}`}
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function winMessage(tries: number): string {
  const msgs = ["Uncanny!", "Brilliant!", "Sharp!", "Nice work!", "Got there!", "Phew!"];
  return msgs[tries - 1] ?? "Solved!";
}
