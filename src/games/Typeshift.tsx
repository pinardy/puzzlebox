import { useMemo, useState } from "react";
import { LEN, isShiftWord, makeShift } from "../lib/typeshift";
import { type Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result, Toast } from "./ui";
import "./Typeshift.css";

const COUNT: Record<Diff, number> = { easy: 3, medium: 4, hard: 5 };
const HELP =
  "Five strips of letters. Pick one letter from each strip — tap it, or " +
  "use the arrows — so the five together spell a word, then bank it. You " +
  "win when every letter on every strip has been used by at least one " +
  "banked word, so the leftovers are the puzzle: any word counts, but only " +
  "a full sweep finishes it.";

interface SavedState {
  /** Chosen index into each column's letters. */
  at: number[];
  found: string[];
  /** Per column, which letter indices have been used by a banked word. */
  used: number[][];
  done: boolean;
}

export default function Typeshift({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>((s, d) => fresh(s, d));
  const { cols, source } = useMemo(() => makeShift(seed, COUNT[diff]), [seed, diff]);
  const [toast, setToast] = useState<string | null>(null);

  function fresh(s: string, d: Diff): SavedState {
    const shift = makeShift(s, COUNT[d]);
    return {
      at: shift.cols.map(() => 0),
      found: [],
      used: shift.cols.map(() => []),
      done: false
    };
  }

  const word = saved.at.map((i, c) => cols[c][i] ?? "").join("");
  const remaining = cols.reduce((n, col, c) => n + col.length - saved.used[c].length, 0);

  function say(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  function slide(c: number, delta: number) {
    if (saved.done) return;
    const col = cols[c];
    const next = { ...saved, at: saved.at.slice() };
    next.at[c] = (next.at[c] + delta + col.length) % col.length;
    commit(next, { undoable: false });
  }

  function pick(c: number, i: number) {
    if (saved.done) return;
    const next = { ...saved, at: saved.at.slice() };
    next.at[c] = i;
    commit(next, { undoable: false });
  }

  function bank() {
    if (saved.done) return;
    if (saved.found.includes(word)) {
      say("Already banked");
      return;
    }
    if (!isShiftWord(word)) {
      say("Not in word list");
      return;
    }
    const next: SavedState = {
      ...saved,
      found: [...saved.found, word],
      used: saved.used.map((u, c) => (u.includes(saved.at[c]) ? u : [...u, saved.at[c]]))
    };
    const left = cols.reduce((n, col, c) => n + col.length - next.used[c].length, 0);
    if (left === 0) next.done = true;
    commit(next, { outcome: left === 0 ? "won" : undefined });
  }

  // Hint: bank one of the hidden source words that still covers an unused
  // letter (the source words between them use every letter).
  function hint() {
    if (saved.done) return;
    const fresh = (w: string) =>
      [...w].filter((ch, c) => !saved.used[c].includes(cols[c].indexOf(ch))).length;
    const pick = source
      .filter((w) => !saved.found.includes(w) && fresh(w) > 0)
      .sort((a, b) => fresh(b) - fresh(a))[0];
    if (!pick) return;
    const at = [...pick].map((ch, c) => cols[c].indexOf(ch));
    const next: SavedState = {
      ...saved,
      at,
      found: [...saved.found, pick],
      used: saved.used.map((u, c) => (u.includes(at[c]) ? u : [...u, at[c]]))
    };
    const left = cols.reduce((n, col, c) => n + col.length - next.used[c].length, 0);
    if (left === 0) next.done = true;
    commitHint(next, { outcome: left === 0 ? "won" : undefined });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setToast(null);
  }

  return (
    <div className="game game-typeshift">
      <GameHeader title="Typeshift" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        One letter per strip, then bank the word. {remaining} letters unused.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="ts-strips" role="group" aria-label="Letter strips">
        {cols.map((col, c) => (
          <div key={c} className="ts-strip" role="group" aria-label={`Strip ${c + 1}`}>
            <button
              className="ts-arrow"
              onClick={() => slide(c, -1)}
              aria-label={`Strip ${c + 1} up`}
            >
              ▲
            </button>
            <div className="ts-letters">
              {col.map((ch, i) => (
                <button
                  key={i}
                  className={[
                    "ts-letter",
                    i === saved.at[c] ? "ts-on" : "",
                    saved.used[c].includes(i) ? "ts-used" : ""
                  ].join(" ")}
                  onClick={() => pick(c, i)}
                  aria-label={`Strip ${c + 1}, letter ${ch}${
                    i === saved.at[c] ? ", chosen" : ""
                  }${saved.used[c].includes(i) ? ", used" : ""}`}
                  aria-pressed={i === saved.at[c]}
                >
                  {ch}
                </button>
              ))}
            </div>
            <button
              className="ts-arrow"
              onClick={() => slide(c, 1)}
              aria-label={`Strip ${c + 1} down`}
            >
              ▼
            </button>
          </div>
        ))}
      </div>

      <div className="ts-current">
        <span className="ts-word" aria-live="polite">
          {word}
        </span>
        <button className="mini-btn" onClick={bank} disabled={word.length < LEN}>
          Bank ↵
        </button>
      </div>

      <Toast message={toast} />

      <div className="ts-found">
        {saved.found.length === 0 ? (
          <span className="ts-none">No words banked yet</span>
        ) : (
          saved.found.map((w) => (
            <span key={w} className="ts-chip">
              {w}
            </span>
          ))
        )}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Every letter used — ${saved.found.length} words!`}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
