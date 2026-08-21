import { useCallback, useEffect, useMemo, useState } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { ANSWERS, LetterState, scoreGuess } from "../lib/words";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const ROWS = 6;
const COLS = 5;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

interface SavedState {
  guesses: string[];
  done: boolean;
  won: boolean;
}

const FRESH: SavedState = { guesses: [], done: false, won: false };

function answerFor(seed: string): string {
  return ANSWERS[Math.floor(makeRng(seed)() * ANSWERS.length)].toUpperCase();
}

export default function Wordle({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("word")?.seed ?? newSeed()
  );
  const answer = useMemo(() => answerFor(seed), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("word")?.state ?? FRESH
  );
  const [current, setCurrent] = useState("");
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const guesses = [...saved.guesses, current];
    const won = current === answer;
    const done = won || guesses.length >= ROWS;
    const next = { guesses, done, won };
    setSaved(next);
    saveSlot("word", seed, next);
    setCurrent("");
    if (done) {
      recordResult("word", won);
      setToast(won ? winMessage(guesses.length) : `The word was ${answer}`);
    }
  }, [current, saved, answer, seed]);

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

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(FRESH);
    saveSlot("word", s, FRESH);
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
      <GameHeader title="Word Guess" onExit={onExit} onNew={newPuzzle} />
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
    </div>
  );
}

function winMessage(tries: number): string {
  const msgs = ["Uncanny!", "Brilliant!", "Sharp!", "Nice work!", "Got there!", "Phew!"];
  return msgs[tries - 1] ?? "Solved!";
}
