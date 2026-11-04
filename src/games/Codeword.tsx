import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { N, makeCodeword } from "../lib/codeword";
import { type Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import { useGridNav } from "../lib/gridnav";
import "./Codeword.css";

const GIVENS: Record<Diff, number> = { easy: 4, medium: 3, hard: 2 };
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const HELP =
  "Every letter in the grid has been swapped for a number, and the same " +
  "number always means the same letter. A couple of letters are given to " +
  "start. Tap a square, then a letter, to decide what that NUMBER stands " +
  "for everywhere at once. All six answers are ordinary words, so the " +
  "crossings and the letter patterns are the way in — there are no clues.";

interface SavedState {
  /** assign[n - 1] is the letter the player has given number n, or "". */
  assign: string[];
  done: boolean;
}

export default function Codeword({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => fresh(s, d));
  const puzzle = useMemo(() => makeCodeword(seed, GIVENS[diff]), [seed, diff]);
  const [sel, setSel] = useState<number | null>(null);

  function fresh(s: string, d: Diff): SavedState {
    const p = makeCodeword(s, GIVENS[d]);
    const assign = p.key.map(() => "");
    for (const n of p.given) assign[n - 1] = p.key[n - 1];
    return { assign, done: false };
  }

  const isGiven = (n: number) => puzzle.given.includes(n);
  const letterAt = (i: number) => {
    const n = puzzle.nums[i];
    return n === null ? "" : saved.assign[n - 1] ?? "";
  };

  // Which letters are already spoken for, for the tracker row.
  const usedLetters = useMemo(
    () => new Set(saved.assign.filter((l) => l !== "")),
    [saved.assign]
  );

  useEffect(() => {
    if (!puzzle.key.length) return;
    if (saved.assign.every((l, i) => l === puzzle.key[i])) finish();
  }, [saved.assign, puzzle.key, finish]);

  /** Assign a letter to the selected cell's number, freeing it elsewhere. */
  function setLetter(letter: string) {
    if (saved.done || sel === null) return;
    const n = puzzle.nums[sel];
    if (n === null || isGiven(n)) return;
    const next = { ...saved, assign: saved.assign.slice() };
    // A letter belongs to one number only — take it off whoever had it.
    const held = next.assign.indexOf(letter);
    if (held >= 0 && !isGiven(held + 1)) next.assign[held] = "";
    next.assign[n - 1] = next.assign[n - 1] === letter ? "" : letter;
    commit(next);
  }

  function erase() {
    if (saved.done || sel === null) return;
    const n = puzzle.nums[sel];
    if (n === null || isGiven(n)) return;
    const next = { ...saved, assign: saved.assign.slice() };
    next.assign[n - 1] = "";
    commit(next);
  }

  /** Fill in one number correctly — marks the puzzle as assisted. */
  function hint() {
    if (saved.done) return;
    const wrong = puzzle.key
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch, i }) => saved.assign[i] !== ch);
    if (!wrong.length) return;
    const pickFrom =
      sel !== null && puzzle.nums[sel] !== null
        ? wrong.filter((w) => w.i === puzzle.nums[sel]! - 1)
        : [];
    const target = (pickFrom.length ? pickFrom : wrong)[0];
    const next = { ...saved, assign: saved.assign.slice() };
    const held = next.assign.indexOf(target.ch);
    if (held >= 0) next.assign[held] = "";
    next.assign[target.i] = target.ch;
    commitHint(next);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        setLetter(e.key.toUpperCase());
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        erase();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSel(null);
  }

  const selNum = sel === null ? null : puzzle.nums[sel];
  // Arrows walk the squares; Enter / Space selects (the button's own click).
  const nav = useGridNav();

  return (
    <div className="game game-codeword">
      <GameHeader title="Codeword" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Same number, same letter. Tap a square, then a letter.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div
        className="cw-grid"
        role="grid"
        aria-label="Codeword grid"
        {...nav}
        style={{ "--n": N } as CSSProperties}
      >
        {puzzle.cells.map((ch, i) => {
          const n = puzzle.nums[i];
          if (ch === null || n === null)
            return <span key={i} className="cw-block" aria-hidden="true" />;
          const letter = letterAt(i);
          return (
            <button
              key={i}
              role="gridcell"
              data-cell={i}
              aria-selected={sel === i}
              className={[
                "cw-cell",
                sel === i ? "selected" : "",
                selNum === n && sel !== i ? "cw-same" : "",
                isGiven(n) ? "cw-given" : ""
              ].join(" ")}
              onClick={() => setSel(i)}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, number ${n}${
                letter ? `, ${letter}` : ", blank"
              }${isGiven(n) ? ", given" : ""}`}
            >
              <span className="cw-letter">{letter}</span>
              <span className="cw-num">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="cw-tracker" aria-label="Letters used">
        {ALPHABET.map((l) => (
          <button
            key={l}
            className={`cw-key${usedLetters.has(l) ? " cw-spent" : ""}`}
            onClick={() => setLetter(l)}
            aria-label={`${l}${usedLetters.has(l) ? ", already used" : ""}`}
          >
            {l}
          </button>
        ))}
        <button className="cw-key cw-erase" onClick={erase} aria-label="Erase">
          ⌫
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Code cracked!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
