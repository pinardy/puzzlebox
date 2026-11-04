import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import {
  SIDE_NAMES,
  checkWord,
  generateBoxed,
  hintWord,
  legalWords,
  sideTable,
  usedMask
} from "../lib/boxed";
import { GameHeader } from "./GameHeader";
import { GameTools, Result, Toast } from "./ui";

const HELP =
  "Twelve letters sit three to a side. Spell words by hopping from letter " +
  "to letter — but two letters in a row may never come from the same side, " +
  "which is what the line drawn across the box shows you. Each word after " +
  "the first starts on the letter the last one ended on, and letters may be " +
  "reused as often as you like. Use all twelve in as few words as you can; " +
  "every box here can be done in two.";

// The box outline in the SVG's 0–100 space, and the three stops along each
// edge. Bottom and left run backwards so the letters read clockwise.
const EDGE = 15;
const SPAN = 70;
const STOPS = [1 / 6, 1 / 2, 5 / 6].map((f) => EDGE + SPAN * f);

/** Screen position of dot `k` on `side`. */
function dotAt(side: number, k: number): [number, number] {
  if (side === 0) return [STOPS[k], EDGE];
  if (side === 1) return [EDGE + SPAN, STOPS[k]];
  if (side === 2) return [STOPS[2 - k], EDGE + SPAN];
  return [EDGE, STOPS[2 - k]];
}

interface SavedState {
  words: string[];
  /** A suggested word, and whether the whole of it is showing yet. */
  hint: string | null;
  hintFull: boolean;
  done: boolean;
}

export default function LetterBoxed({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>(() => ({
      words: [],
      hint: null,
      hintFull: false,
      done: false
    }));
  const puzzle = useMemo(() => generateBoxed(`boxed-${seed}`, diff), [seed, diff]);
  const { sides, chain } = puzzle;
  const par = chain.length;
  const table = useMemo(() => sideTable(sides), [sides]);
  const legal = useMemo(() => legalWords(sides), [sides]);

  // A word after the first is locked to the letter the last one ended on,
  // so only the tail is the player's to type or delete. Deriving the lock
  // from `saved` means undo fixes it up for free.
  const lock = saved.words.length ? saved.words[saved.words.length - 1].slice(-1) : null;
  const [tail, setTail] = useState("");
  const word = (lock ?? "") + tail;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const allMask = useMemo(() => usedMask([sides.join("")]), [sides]);
  const used = useMemo(() => usedMask(saved.words), [saved.words]);
  const left = useMemo(
    () =>
      sides
        .join("")
        .split("")
        .filter((c) => !(used & (1 << (c.charCodeAt(0) - 65)))),
    [sides, used]
  );

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const submit = useCallback(() => {
    if (saved.done) return;
    const bad = checkWord(word, sides, lock);
    if (bad) {
      flash(bad);
      return;
    }
    if (saved.words.includes(word)) {
      flash("Already played");
      return;
    }
    commit({ ...saved, words: [...saved.words, word], hint: null, hintFull: false });
    setTail("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, sides, lock, saved, flash]);

  const type = useCallback(
    (c: string) => {
      if (saved.done) return;
      if (table[c.charCodeAt(0) - 65] < 0) {
        flash("Use only the twelve letters");
        return;
      }
      setTail((t) => t + c);
    },
    [saved.done, table, flash]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") setTail((t) => t.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [submit, type]);

  useEffect(() => {
    if (saved.done || used !== allMask) return;
    commit({ ...saved, done: true }, { undoable: false });
    recordResult("boxed", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [used, allMask, saved]);

  /** Nudge first — a length and an opening letter — then the whole word. */
  function hint() {
    if (saved.hint && !saved.hintFull) {
      commitHint({ ...saved, hintFull: true });
      return;
    }
    const w = hintWord(legal, sides, used, lock);
    if (!w) {
      flash("Nothing left to suggest");
      return;
    }
    commitHint({ ...saved, hint: w, hintFull: false });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setTail("");
    setToast(null);
  }

  function doUndo() {
    undo();
    setTail("");
  }

  const dots = sides.flatMap((s, side) =>
    s.split("").map((c, k) => ({ c, side, pos: dotAt(side, k) }))
  );
  const path = word.split("").map((c) => {
    const side = table[c.charCodeAt(0) - 65];
    return dotAt(side, sides[side].indexOf(c));
  });

  return (
    <div className="game game-boxed">
      <GameHeader title="Letter Boxed" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Use all twelve letters. Never two in a row from the same side.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={doUndo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="lights-meta">
        <span>
          {saved.words.length} word{saved.words.length === 1 ? "" : "s"} · par {par}
        </span>
        <span>
          {left.length} letter{left.length === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="lb-left" aria-label="Letters still unused">
        {left.length ? (
          left.map((c) => (
            <span key={c} className="lb-chip">
              {c}
            </span>
          ))
        ) : (
          <span className="lb-chip lb-chip-all">All twelve used</span>
        )}
      </div>

      <div
        className="lb-box"
        role="group"
        aria-label="Letter box, three letters on each side"
      >
        <svg className="lb-lines" viewBox="0 0 100 100" aria-hidden="true">
          <rect
            className="lb-frame"
            x={EDGE}
            y={EDGE}
            width={SPAN}
            height={SPAN}
            rx="2"
          />
          {path.slice(1).map(([x, y], i) => {
            const clash =
              table[word.charCodeAt(i) - 65] === table[word.charCodeAt(i + 1) - 65];
            return (
              <line
                key={i}
                className={`lb-hop${clash ? " bad" : ""}`}
                x1={path[i][0]}
                y1={path[i][1]}
                x2={x}
                y2={y}
              />
            );
          })}
        </svg>
        {dots.map(({ c, side, pos }) => {
          const inWord = word.includes(c);
          const spent = (used & (1 << (c.charCodeAt(0) - 65))) !== 0;
          return (
            <button
              key={c}
              className={`lb-dot${inWord ? " in-word" : ""}${spent ? " spent" : ""}`}
              style={{ "--x": `${pos[0]}%`, "--y": `${pos[1]}%` } as CSSProperties}
              aria-pressed={inWord}
              aria-label={`${c}, ${SIDE_NAMES[side]} side${spent ? ", used" : ""}`}
              onClick={() => type(c)}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="lb-entry">
        <span className="lb-current" aria-live="polite" aria-label="Current word">
          {word.split("").map((c, i) => (
            <b key={i} className={i === 0 && lock ? "lb-locked" : undefined}>
              {c}
            </b>
          ))}
          {!word && <i>Tap letters to spell</i>}
        </span>
        <button
          className="tool-chip"
          onClick={() => setTail((t) => t.slice(0, -1))}
          disabled={!tail || saved.done}
        >
          ⌫ Delete
        </button>
        <button className="tool-chip lb-enter" onClick={submit} disabled={saved.done}>
          Enter
        </button>
      </div>

      <Toast message={toast} />

      {saved.hint && !saved.done && (
        <p className="lb-tip">
          💡 Try {saved.hint.length} letters starting with {saved.hint[0]}
          {saved.hintFull && <> — {saved.hint}</>}
        </p>
      )}

      <div className="lb-played">
        {saved.words.map((w, i) => (
          <span key={i} className="lb-word">
            {w}
          </span>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={resultMessage(saved.words.length, par)}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}

/** Letter Boxed has no losing, only elegance — over par still wins. */
function resultMessage(n: number, par: number): string {
  const words = `${n} word${n === 1 ? "" : "s"}`;
  if (n < par) return `${words} — under par!`;
  if (n === par) return `${words} — par!`;
  return `Solved in ${words} (par ${par})`;
}
