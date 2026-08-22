import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeRng } from "../lib/rng";
import { ANSWERS, LetterState, scoreGuess } from "../lib/words";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Result } from "./ui";

const ROWS = 6;
const COLS = 5;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

interface SavedState {
  guesses: string[];
  done: boolean;
  won: boolean;
}

function answerFor(seed: string): string {
  return ANSWERS[Math.floor(makeRng(seed)() * ANSWERS.length)].toUpperCase();
}

export default function Wordle({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "word",
    () => ({ guesses: [], done: false, won: false })
  );
  const answer = useMemo(() => answerFor(seed), [seed]);
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
    if (current.length !== COLS) {
      flash("Not enough letters");
      return;
    }
    // Any five letters count as a guess — it costs a try either way, and
    // a small bundled word list rejecting real words feels like a bug.
    const guesses = [...saved.guesses, current];
    const won = current === answer;
    const done = won || guesses.length >= ROWS;
    commit({ guesses, done, won });
    setCurrent("");
    if (done) recordResult("word", won);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, saved, answer]);

  const onKey = useCallback(
    (k: string) => {
      if (saved.done) return;
      if (k === "enter") submit();
      else if (k === "back") setCurrent((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(k) && current.length < COLS)
        setCurrent((c) => c + k);
    },
    [saved.done, submit, current.length]
  );

  function startNew() {
    newPuzzle();
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

  return (
    <div className="game game-word">
      <GameHeader title="Word Guess" onExit={onExit} onNew={startNew} />
      <p className="game-hint">Guess the 5-letter word in 6 tries.</p>

      <div className="word-grid" role="grid" aria-label="Guess grid">
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
              {Array.from({ length: COLS }).map((_, c) => (
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
          onNew={startNew}
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
