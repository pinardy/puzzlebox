import { useEffect, useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { QUOTES } from "../lib/quotes";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const GIVENS: Record<Diff, number> = { easy: 3, medium: 1, hard: 0 };
const HELP =
  "The saying has been scrambled with a substitution cipher: every letter " +
  "stands for another, consistently. Tap a letter, then type or tap your " +
  "guess — it fills in everywhere at once. Two cipher letters can't share " +
  "an answer; clashes glow amber. Word shapes and one-letter words are " +
  "your way in.";

interface Puzzle {
  answer: string;
  cipherText: string;
  givens: Record<string, string>; // cipher letter → true plain letter
}

function generateCryptogram(seed: string, givenCount: number): Puzzle {
  const rng = makeRng(seed);
  const answer = QUOTES[Math.floor(rng() * QUOTES.length)];
  // Derangement: no letter encodes to itself.
  let perm: string[];
  do {
    perm = shuffled(ALPHA, rng);
  } while (perm.some((c, i) => c === ALPHA[i]));
  const enc: Record<string, string> = {};
  ALPHA.forEach((p, i) => (enc[p] = perm[i]));
  const cipherText = answer.replace(/[A-Z]/g, (ch) => enc[ch]);

  const used = [...new Set(cipherText.replace(/[^A-Z]/g, ""))];
  const givens: Record<string, string> = {};
  for (const c of shuffled(used, rng).slice(0, givenCount)) {
    givens[c] = ALPHA[perm.indexOf(c)];
  }
  return { answer, cipherText, givens };
}

interface SavedState {
  mapping: Record<string, string>; // cipher letter → guessed plain letter
  done: boolean;
}

export default function Cryptogram({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("crypto", () => ({ mapping: {}, done: false }));
  const { answer, cipherText, givens } = useMemo(
    () => generateCryptogram(`crypto-${seed}`, GIVENS[diff]),
    [seed, diff]
  );
  const [selected, setSelected] = useState<string | null>(null);

  /** Effective guess for a cipher letter: given beats player mapping. */
  const guessFor = (c: string): string => givens[c] ?? saved.mapping[c] ?? "";

  const decoded = useMemo(
    () => cipherText.replace(/[A-Z]/g, (ch) => guessFor(ch) || "·"),
    [cipherText, saved.mapping, givens] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Plain letters used by more than one cipher letter. */
  const clashes = useMemo(() => {
    const seen: Record<string, number> = {};
    for (const c of new Set(cipherText.replace(/[^A-Z]/g, ""))) {
      const g = guessFor(c);
      if (g) seen[g] = (seen[g] ?? 0) + 1;
    }
    return new Set(Object.keys(seen).filter((g) => seen[g] > 1));
  }, [cipherText, saved.mapping, givens]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!saved.done && decoded === answer) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("crypto", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded, answer, saved]);

  const assign = (plain: string) => {
    if (saved.done || selected === null || givens[selected]) return;
    const mapping = { ...saved.mapping };
    if (plain === "") delete mapping[selected];
    else mapping[selected] = plain;
    commit({ ...saved, mapping });
  };

  /** Reveal the true letter for the selected (or a random unsolved)
   *  cipher letter. */
  function hint() {
    const unsolved = [...new Set(cipherText.replace(/[^A-Z]/g, ""))].filter((c) => {
      const truth = answer[cipherText.indexOf(c)];
      return guessFor(c) !== truth;
    });
    if (!unsolved.length) return;
    const target =
      selected !== null && unsolved.includes(selected)
        ? selected
        : unsolved[Math.floor(Math.random() * unsolved.length)];
    const truth = answer[cipherText.indexOf(target)];
    commitHint({ ...saved, mapping: { ...saved.mapping, [target]: truth } });
    setSelected(target);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) assign(e.key.toUpperCase());
      else if (e.key === "Backspace" || e.key === "Delete") assign("");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, saved]);

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  const words = cipherText.split(" ");

  return (
    <div className="game game-crypto">
      <GameHeader title="Cryptogram" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Crack the substitution cipher: tap a letter, then guess what it stands
        for.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="cg-quote" role="group" aria-label="Cryptogram">
        {words.map((word, w) => (
          <span key={w} className="cg-word">
            {word.split("").map((ch, i) => {
              if (!/[A-Z]/.test(ch))
                return (
                  <span key={i} className="cg-punct">
                    {ch}
                  </span>
                );
              const g = guessFor(ch);
              return (
                <button
                  key={i}
                  className={[
                    "cg-cell",
                    selected === ch ? "selected" : "",
                    givens[ch] ? "given" : "",
                    g && clashes.has(g) ? "clash" : ""
                  ].join(" ")}
                  onClick={() => setSelected(ch)}
                >
                  <span className="cg-guess">{g || " "}</span>
                  <span className="cg-cipher">{ch}</span>
                </button>
              );
            })}
          </span>
        ))}
      </div>

      <div className="keyboard">
        {KEY_ROWS.map((row, i) => (
          <div className="key-row" key={row}>
            {row.split("").map((k) => (
              <button
                key={k}
                className="key"
                disabled={selected === null || saved.done}
                onClick={() => assign(k)}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button
                className="key key-wide"
                disabled={selected === null || saved.done}
                onClick={() => assign("")}
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="crypto"
          won
          message="Cipher cracked!"
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
