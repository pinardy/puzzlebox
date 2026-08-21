import { useState } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const COLORS = ["#e05252", "#e0a23b", "#2e9e6b", "#3b6fe0", "#7857c9", "#e06fb2"];
const CODE_LEN = 4;
const MAX_GUESSES = 10;

function codeFor(seed: string): number[] {
  const rng = makeRng(`mastermind-${seed}`);
  return Array.from({ length: CODE_LEN }, () => Math.floor(rng() * COLORS.length));
}

/** Standard feedback: exact = right colour right spot, near = right colour
 *  wrong spot (counted without double-use). */
function score(guess: number[], code: number[]): { exact: number; near: number } {
  let exact = 0;
  const codeLeft: number[] = [], guessLeft: number[] = [];
  for (let i = 0; i < CODE_LEN; i++) {
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

const FRESH: SavedState = { guesses: [], done: false, won: false };

export default function Mastermind({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("mastermind")?.seed ?? newSeed()
  );
  const code = codeFor(seed);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("mastermind")?.state ?? FRESH
  );
  const [current, setCurrent] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  function submit() {
    if (saved.done || current.length !== CODE_LEN) return;
    const guesses = [...saved.guesses, current];
    const { exact } = score(current, code);
    const won = exact === CODE_LEN;
    const done = won || guesses.length >= MAX_GUESSES;
    const next = { guesses, done, won };
    setSaved(next);
    saveSlot("mastermind", seed, next);
    setCurrent([]);
    if (done) {
      recordResult("mastermind", won);
      setToast(won ? `Cracked in ${guesses.length}!` : "Out of guesses — code revealed");
    }
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(FRESH);
    saveSlot("mastermind", s, FRESH);
    setCurrent([]);
    setToast(null);
  }

  return (
    <div className="game game-mastermind">
      <GameHeader title="Mastermind" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Crack the {CODE_LEN}-colour code in {MAX_GUESSES}. ● right colour &
        spot, ○ right colour, wrong spot.
      </p>

      <div className="mm-rows">
        {saved.guesses.map((g, i) => {
          const { exact, near } = score(g, code);
          return (
            <div key={i} className="mm-row">
              {g.map((c, j) => (
                <span key={j} className="mm-peg" style={{ background: COLORS[c] }} />
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
            {Array.from({ length: CODE_LEN }).map((_, j) => (
              <button
                key={j}
                className="mm-peg mm-slot"
                style={current[j] !== undefined ? { background: COLORS[current[j]] } : undefined}
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
              <span key={j} className="mm-peg" style={{ background: COLORS[c] }} />
            ))}
            <span className="mm-feedback">code</span>
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="mm-palette">
        {COLORS.map((col, i) => (
          <button
            key={col}
            className="mm-peg mm-pick"
            style={{ background: col }}
            onClick={() =>
              setCurrent((c) => (c.length < CODE_LEN ? [...c, i] : c))
            }
            aria-label={`Colour ${i + 1}`}
          />
        ))}
        <button
          className="mini-btn"
          disabled={current.length !== CODE_LEN}
          onClick={submit}
        >
          Guess
        </button>
      </div>
    </div>
  );
}
