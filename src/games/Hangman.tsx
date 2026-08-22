import { useEffect } from "react";
import { makeRng } from "../lib/rng";
import { ANSWERS } from "../lib/words";
import { COMMON4 } from "../lib/words4";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

// Short words are brutal in hangman — fewer letters means fewer freebies —
// so Hard pairs 4-letter answers with a shorter rope.
const LIVES_BY: Record<Diff, number> = { easy: 8, medium: 6, hard: 5 };
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const HELP =
  "Guess the hidden word one letter at a time; every miss costs a life. " +
  "Easy gives eight lives, Medium six. Hard hides a 4-letter word with " +
  "five lives — short words leave nowhere to hide.";

interface SavedState {
  guessed: string[]; // uppercase letters tried
  done: boolean;
  won: boolean;
}

function answerFor(seed: string, diff: Diff): string {
  const pool = diff === "hard" ? COMMON4 : ANSWERS;
  return pool[Math.floor(makeRng(`hangman-${seed}`)() * pool.length)].toUpperCase();
}

export default function Hangman({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "hangman",
    () => ({ guessed: [], done: false, won: false })
  );
  const LIVES = LIVES_BY[diff];
  const answer = answerFor(seed, diff);

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
        Guess the {answer.length}-letter word one letter at a time — {LIVES}{" "}
        misses and it's gone.
      </p>
      <GameTools diff={diff} onDiff={newPuzzle} help={HELP} />

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
