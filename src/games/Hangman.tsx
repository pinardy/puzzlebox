import { useEffect } from "react";
import { makeRng } from "../lib/rng";
import { ANSWERS } from "../lib/words";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { Result } from "./ui";

const LIVES = 6;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

interface SavedState {
  guessed: string[]; // uppercase letters tried
  done: boolean;
  won: boolean;
}

function answerFor(seed: string): string {
  return ANSWERS[Math.floor(makeRng(`hangman-${seed}`)() * ANSWERS.length)].toUpperCase();
}

export default function Hangman({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "hangman",
    () => ({ guessed: [], done: false, won: false })
  );
  const answer = answerFor(seed);

  const wrong = saved.guessed.filter((g) => !answer.includes(g));
  const livesLeft = LIVES - wrong.length;

  function guess(letter: string) {
    if (saved.done || saved.guessed.includes(letter)) return;
    const guessed = [...saved.guessed, letter];
    const won = [...answer].every((c) => guessed.includes(c));
    const lost = guessed.filter((g) => !answer.includes(g)).length >= LIVES;
    commit({ guessed, done: won || lost, won });
    if (won || lost) recordResult("hangman", won);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) guess(e.key.toUpperCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="game game-hangman">
      <GameHeader title="Hangman" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Guess the 5-letter word one letter at a time — {LIVES} misses and it's
        gone.
      </p>

      <div className="hangman-lives" aria-label={`${livesLeft} lives left`}>
        {Array.from({ length: LIVES }).map((_, i) => (
          <span key={i} className={i < livesLeft ? "" : "lost"}>
            {i < livesLeft ? "♥" : "♡"}
          </span>
        ))}
      </div>

      <div className="word-grid hangman-word" role="group" aria-label="The word">
        <div className="word-row">
          {[...answer].map((c, i) => {
            const show = saved.guessed.includes(c) || saved.done;
            return (
              <div
                key={i}
                className={`word-cell${show ? " filled" : ""}${
                  saved.done && !saved.guessed.includes(c) ? " is-absent" : ""
                }`}
              >
                {show ? c : ""}
              </div>
            );
          })}
        </div>
      </div>

      <div className="keyboard">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row}>
            {row.split("").map((k) => {
              const K = k.toUpperCase();
              const used = saved.guessed.includes(K);
              const state = used ? (answer.includes(K) ? " is-correct" : " is-absent") : "";
              return (
                <button
                  key={k}
                  className={`key${state}`}
                  onClick={() => guess(K)}
                  disabled={used}
                >
                  {K}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="hangman"
          won={saved.won}
          message={
            saved.won
              ? `Saved with ${livesLeft} ♥ to spare!`
              : `The word was ${answer}`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
