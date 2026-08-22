import { useState } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const ALL_COLORS = [
  "#e05252", "#e0a23b", "#2e9e6b", "#3b6fe0", "#7857c9", "#e06fb2",
  "#2a9d8f", "#8a5a2b"
];
const COLOR_COUNT: Record<Diff, number> = { easy: 5, medium: 6, hard: 8 };
const CODE_LEN: Record<Diff, number> = { easy: 4, medium: 4, hard: 5 };
const MAX_GUESSES = 10;
const HELP =
  "The computer hides a colour code (repeats allowed). After each guess: " +
  "● one peg is the right colour in the right spot, ○ one is the right " +
  "colour in the wrong spot. Deduce the code before the guesses run out.";

function codeFor(seed: string, colors: number, len: number): number[] {
  const rng = makeRng(`mastermind-${seed}`);
  return Array.from({ length: len }, () => Math.floor(rng() * colors));
}

/** Standard feedback: exact = right colour right spot, near = right colour
 *  wrong spot (counted without double-use). */
function score(guess: number[], code: number[]): { exact: number; near: number } {
  let exact = 0;
  const codeLeft: number[] = [], guessLeft: number[] = [];
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) exact++;
    else { codeLeft.push(code[i]); guessLeft.push(guess[i]); }
  }
  let near = 0;
  for (const g of guessLeft) {
    const at = codeLeft.indexOf(g);
    if (at !== -1) { near++; codeLeft.splice(at, 1); }
  }
  return { exact, near };
}

interface SavedState {
  guesses: number[][];
  done: boolean;
  won: boolean;
}

export default function Mastermind({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "mastermind",
    () => ({ guesses: [], done: false, won: false })
  );
  const colors = COLOR_COUNT[diff];
  const codeLen = CODE_LEN[diff];
  const code = codeFor(seed, colors, codeLen);
  const [current, setCurrent] = useState<number[]>([]);

  function submit() {
    if (saved.done || current.length !== codeLen) return;
    const guesses = [...saved.guesses, current];
    const { exact } = score(current, code);
    const won = exact === codeLen;
    const done = won || guesses.length >= MAX_GUESSES;
    commit({ guesses, done, won });
    setCurrent([]);
    if (done) recordResult("mastermind", won);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setCurrent([]);
  }

  return (
    <div className="game game-mastermind">
      <GameHeader title="Mastermind" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Crack the {codeLen}-colour code in {MAX_GUESSES}. ● right colour &
        spot, ○ right colour, wrong spot.
      </p>
      <GameTools diff={diff} onDiff={startNew} help={HELP} />

      <div className="mm-rows">
        {saved.guesses.map((g, i) => {
          const { exact, near } = score(g, code);
          return (
            <div key={i} className="mm-row">
              {g.map((c, j) => (
                <span key={j} className="mm-peg" data-c={c + 1} style={{ background: ALL_COLORS[c] }} />
              ))}
              <span className="mm-feedback">
                {"●".repeat(exact)}
                {"○".repeat(near)}
              </span>
            </div>
          );
        })}
        {!saved.done && (
          <div className="mm-row mm-current">
            {Array.from({ length: codeLen }).map((_, j) => (
              <button
                key={j}
                className="mm-peg mm-slot"
                data-c={current[j] !== undefined ? current[j] + 1 : undefined}
                style={current[j] !== undefined ? { background: ALL_COLORS[current[j]] } : undefined}
                onClick={() => setCurrent((c) => c.slice(0, j))}
                aria-label={`Slot ${j + 1}`}
              />
            ))}
            <span className="mm-feedback mm-count">
              {saved.guesses.length + 1}/{MAX_GUESSES}
            </span>
          </div>
        )}
        {saved.done && !saved.won && (
          <div className="mm-row mm-answer">
            {code.map((c, j) => (
              <span key={j} className="mm-peg" data-c={c + 1} style={{ background: ALL_COLORS[c] }} />
            ))}
            <span className="mm-feedback">code</span>
          </div>
        )}
      </div>

      <div className="mm-palette">
        {ALL_COLORS.slice(0, colors).map((col, i) => (
          <button
            key={col}
            className="mm-peg mm-pick"
            data-c={i + 1}
            style={{ background: col }}
            onClick={() =>
              setCurrent((c) => (c.length < codeLen ? [...c, i] : c))
            }
            aria-label={`Colour ${i + 1}`}
          />
        ))}
        <button
          className="mini-btn"
          disabled={current.length !== codeLen}
          onClick={submit}
        >
          Guess
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="mastermind"
          won={saved.won}
          message={
            saved.won
              ? `Cracked in ${saved.guesses.length}!`
              : "Out of guesses — code revealed"
          }
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
