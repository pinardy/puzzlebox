import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shuffled } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { generateBee, geniusScore, isPangram, rankFor, scoreWord } from "../lib/bee";
import { GameHeader } from "./GameHeader";
import { GameTools, Result, Toast } from "./ui";
import "./SpellingBee.css";

/** Words a set yields. A fat set forgives a miss — no single word carries
 *  much of the total — while a lean one leans on its longest words, and on
 *  eight sets in a hundred the pangram becomes compulsory for Genius. */
const BAND: Record<Diff, [number, number]> = {
  easy: [40, 90],
  medium: [25, 60],
  hard: [15, 32]
};

// Clockwise from the top; percentages of the hive box, which is sized so
// the six hexes ring the centre one exactly.
const RING: [number, number][] = [
  [50, 16.7],
  [80, 33.3],
  [80, 66.7],
  [50, 83.3],
  [20, 66.7],
  [20, 33.3]
];

const HELP =
  "Build words of four letters or more from the seven letters shown. " +
  "Every word must use the centre letter, and any letter may be reused as " +
  "often as you like. A four-letter word scores 1, a longer word scores " +
  "its length, and the pangram — one word using all seven letters — scores " +
  "seven more. Reach Genius, about 70% of the points on offer, to win; " +
  "find every word for Queen Bee.";

interface SavedState {
  found: string[];
  done: boolean;
}

const praise = (word: string): string =>
  isPangram(word)
    ? "Pangram!"
    : word.length >= 7
      ? "Amazing!"
      : word.length === 6
        ? "Great!"
        : word.length === 5
          ? "Nice!"
          : "Good!";

export default function SpellingBee({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, newPuzzle } =
    useGame<SavedState>(() => ({ found: [], done: false }));
  const [min, max] = BAND[diff];
  const puzzle = useMemo(() => generateBee(`bee-${seed}`, min, max), [seed, min, max]);

  const [current, setCurrent] = useState("");
  const [ring, setRing] = useState(puzzle.outer);
  const [note, setNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setRing(puzzle.outer);
    setCurrent("");
    setNote(null);
  }, [puzzle]);

  const found = saved.found;
  const score = useMemo(() => found.reduce((s, w) => s + scoreWord(w), 0), [found]);
  const genius = geniusScore(puzzle.total);
  const rank = rankFor(score, puzzle.total);
  const queen = found.length === puzzle.answers.length;

  function flash(msg: string, bad = false) {
    setToast(msg);
    if (bad) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }

  const submit = useCallback(() => {
    const w = current;
    setCurrent("");
    if (!w) return;
    if (w.length < 4) {
      flash("Too short", true);
    } else if (!w.includes(puzzle.centre)) {
      flash("Missing the centre letter", true);
    } else if (found.includes(w)) {
      flash("Already found", true);
    } else if (!puzzle.answers.includes(w)) {
      flash("Not in the word list", true);
    } else {
      flash(`${praise(w)} +${scoreWord(w)}`);
      setNote(null);
      commit({ ...saved, found: [...found, w].sort() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, found, puzzle, saved]);

  const onKey = useCallback(
    (k: string) => {
      if (k === "enter") submit();
      else if (k === "back") setCurrent((c) => c.slice(0, -1));
      else if (puzzle.letters.includes(k))
        setCurrent((c) => (c.length < 24 ? c + k : c));
    },
    [submit, puzzle.letters]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") onKey("enter");
      else if (e.key === "Backspace") {
        e.preventDefault();
        onKey("back");
      } else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toLowerCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  // Genius ends the game, but nothing stops a player carrying on to Queen Bee.
  useEffect(() => {
    if (score >= genius) finish();
  }, [score, genius, finish]);

  /** Name the shape of one word still missing — enough to hunt for it. */
  function hint() {
    const left = puzzle.answers.filter((w) => !found.includes(w));
    if (!left.length) return;
    const w = left[Math.floor(Math.random() * left.length)];
    setNote(
      `${w.length} letters, starting with ${w[0].toUpperCase()}` +
        (isPangram(w) ? " — that one's the pangram" : "")
    );
    commitHint({ ...saved });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setCurrent("");
    setToast(null);
    setNote(null);
  }

  return (
    <div className="game game-bee">
      <GameHeader title="Spelling Bee" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">Words of 4+ letters, always using the centre letter.</p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onHint={queen ? undefined : hint}
      />

      <div className="lights-meta">
        <span>{queen ? "Queen Bee" : rank.name}</span>
        <span>{score} pts</span>
        <span>
          {found.length}/{puzzle.answers.length} words
        </span>
      </div>
      <div
        className="sb-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={puzzle.total}
        aria-valuenow={score}
        aria-label={`${rank.name}, ${score} of ${puzzle.total} points`}
      >
        <div
          className="sb-bar-fill"
          style={{ width: `${Math.min(100, (score / puzzle.total) * 100)}%` }}
        />
        <span
          className="sb-genius"
          style={{ left: `${(genius / puzzle.total) * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <div
        className={`sb-entry${shake ? " shake" : ""}`}
        aria-live="polite"
        aria-atomic="true"
        aria-label={current ? `Building ${current}` : "No letters yet"}
      >
        {current.split("").map((c, i) => (
          <span key={i} className={c === puzzle.centre ? "sb-key-letter" : ""}>
            {c.toUpperCase()}
          </span>
        ))}
        <span className="sb-caret" aria-hidden="true" />
      </div>

      <div className="sb-hive" role="group" aria-label="Letter hive">
        <button
          className="sb-hex sb-centre"
          style={{ left: "50%", top: "50%" }}
          onClick={() => onKey(puzzle.centre)}
          aria-label={`Centre letter ${puzzle.centre.toUpperCase()}, required`}
        >
          <span className="sb-face">{puzzle.centre.toUpperCase()}</span>
        </button>
        {ring.map((c, i) => (
          <button
            key={c}
            className="sb-hex"
            style={{ left: `${RING[i][0]}%`, top: `${RING[i][1]}%` }}
            onClick={() => onKey(c)}
            aria-label={`Letter ${c.toUpperCase()}`}
          >
            <span className="sb-face">{c.toUpperCase()}</span>
          </button>
        ))}
      </div>

      <div className="sb-pad">
        <button className="mini-btn" onClick={() => onKey("back")} disabled={!current}>
          Delete
        </button>
        <button
          className="mini-btn sb-spin"
          onClick={() => setRing(shuffled(ring, Math.random))}
          aria-label="Shuffle the outer letters"
        >
          ⟳
        </button>
        <button className="mini-btn" onClick={() => onKey("enter")} disabled={!current}>
          Enter
        </button>
      </div>

      <Toast message={toast} />
      {note && <p className="sb-note">💡 {note}</p>}

      <div className="sb-found" aria-label={`${found.length} words found`}>
        {found.length === 0 ? (
          <span className="sb-empty">No words yet — tap letters, then Enter.</span>
        ) : (
          found.map((w) => (
            <span key={w} className={`sb-word${isPangram(w) ? " sb-pan" : ""}`}>
              {w.toUpperCase()}
              {isPangram(w) && " ★"}
            </span>
          ))
        )}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={queen ? "Queen Bee!" : "Genius!"}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
