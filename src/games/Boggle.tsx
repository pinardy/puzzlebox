import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import {
  cellLabel,
  findPath,
  generateBoggle,
  neighboursFor,
  scoreWord,
  type BoggleBoard
} from "../lib/boggle";
import { isWord } from "../lib/dict";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result, Toast } from "./ui";
import { useGridNav } from "../lib/gridnav";
import "./Boggle.css";

const SIZE: Record<Diff, number> = { easy: 4, medium: 4, hard: 5 };
const SHARE: Record<Diff, number> = { easy: 0.25, medium: 0.3, hard: 0.32 };
const HELP =
  "Trace words through the grid: step from each letter to any of its eight " +
  "neighbours, diagonals included, never using the same cell twice in one " +
  "word. Words must be at least three letters. Tap letters in turn — only " +
  "cells next to the end of your trace will take a tap — then Enter to " +
  "submit, or type on a keyboard and the board finds the path. Three and " +
  "four letters score 1 point, five 2, six 3, seven 5, and eight or more 11. " +
  "Reach the target score to win; the board always holds far more than that.";

interface SavedState {
  found: string[];
  done: boolean;
}

/** Words in the order a hunter wants to read them back: longest first. */
const byValue = (a: string, b: string) => b.length - a.length || a.localeCompare(b);

export default function Boggle({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, finish, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>(() => ({ found: [], done: false }));
  const n = SIZE[diff];
  const board: BoggleBoard = useMemo(
    () => generateBoggle(`boggle-${seed}`, n, SHARE[diff]),
    [seed, n, diff]
  );

  const [trace, setTrace] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }, []);

  const traceWord = trace.map((i) => board.cells[i]).join("");
  const entry = trace.length ? traceWord : typed;
  // A typed word is shown on the board too, whenever it has a path there.
  const shown = useMemo(
    () => (trace.length ? trace : typed ? (findPath(board.cells, n, typed) ?? []) : []),
    [trace, typed, board, n]
  );
  const score = useMemo(
    () => saved.found.reduce((s, w) => s + scoreWord(w), 0),
    [saved.found]
  );

  const submit = useCallback(() => {
    const w = entry.toLowerCase();
    setTrace([]);
    setTyped("");
    if (w.length < 3) {
      flash("Too short");
      return;
    }
    if (saved.found.includes(w)) {
      flash("Already found");
      return;
    }
    if (!isWord(w)) {
      flash("Not a word");
      return;
    }
    if (!findPath(board.cells, n, w)) {
      flash("Not on the board");
      return;
    }
    if (hint === w) setHint(null);
    commit({ ...saved, found: [...saved.found, w] });
    flash(`${w} +${scoreWord(w)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, saved, board, n, hint, flash]);

  const back = useCallback(() => {
    if (trace.length) setTrace(trace.slice(0, -1));
    else setTyped((t) => t.slice(0, -1));
  }, [trace]);

  const nei = useMemo(() => neighboursFor(n), [n]);
  const last = trace.length ? trace[trace.length - 1] : null;
  /** Illegal traces are unenterable: only a neighbour of the current end
   *  takes a tap, which teaches the adjacency rule without explaining it. */
  const tappable = (i: number) =>
    last === null || i === last || (nei[last].includes(i) && !trace.includes(i));

  function tap(i: number) {
    if (!tappable(i)) return;
    if (i === last) {
      setTrace(trace.slice(0, -1));
      return;
    }
    setTyped("");
    setTrace(last === null ? [i] : [...trace, i]);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // A key the focused grid cell already handled (Enter / Space taps it).
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        // Typing takes over from a part-built trace rather than fighting it.
        setTyped((t) => (trace.length ? traceWord : t) + e.key.toLowerCase());
        setTrace([]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [submit, back, trace, traceWord]);

  useEffect(() => {
    if (score >= board.target) finish();
  }, [score, board.target, finish]);

  /** Name one word still out there — the shortest unfound one, so the hint
   *  is a real lead rather than a nine-letter needle. */
  function reveal() {
    const left = board.words
      .filter((w) => !saved.found.includes(w))
      .sort((a, b) => a.length - b.length);
    if (!left.length) return;
    const pick = left[Math.floor(Math.random() * Math.min(6, left.length))];
    setHint(pick);
    commitHint({ ...saved });
  }

  // Arrows walk the grid; Enter / Space on a cell taps it (and only that —
  // the window handler skips a handled key, so it doesn't also submit).
  const nav = useGridNav((i) => tap(i));

  function startNew(d?: Diff) {
    newPuzzle(d);
    setTrace([]);
    setTyped("");
    setToast(null);
    setHint(null);
  }

  const pct = board.total ? Math.round((100 * score) / board.total) : 0;
  const found = [...saved.found].sort(byValue);

  return (
    <div className="game game-boggle">
      <GameHeader title="Boggle" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap neighbouring letters to spell a word, then Enter. Reach {board.target} points.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.found.length === board.words.length ? undefined : reveal}
      />

      <div className="lights-meta">
        <span>
          {score} / {board.target} pts
        </span>
        <span>
          {saved.found.length} word{saved.found.length === 1 ? "" : "s"} · {pct}% of board
        </span>
      </div>

      <div className="bg-board" style={{ "--n": n } as CSSProperties}>
        <div className="bg-grid" role="grid" aria-label="Letter grid" {...nav}>
          {board.cells.map((cell, i) => {
            const step = shown.indexOf(i);
            return (
              <button
                key={i}
                role="gridcell"
                data-cell={i}
                className={[
                  "bg-cell",
                  step >= 0 ? "on" : "",
                  step === shown.length - 1 && step >= 0 ? "tip" : "",
                  tappable(i) ? "" : "off"
                ].join(" ")}
                aria-label={`Row ${Math.floor(i / n) + 1} column ${(i % n) + 1}, ${cellLabel(
                  cell
                )}${step >= 0 ? `, step ${step + 1} of the trace` : ""}`}
                aria-pressed={step >= 0}
                aria-disabled={!tappable(i)}
                onClick={() => tap(i)}
              >
                {cellLabel(cell)}
                {step >= 0 && <span className="bg-step">{step + 1}</span>}
              </button>
            );
          })}
        </div>
        <svg
          className="bg-path"
          viewBox={`0 0 ${n} ${n}`}
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          {shown.length > 1 && (
            <polyline
              points={shown
                .map((i) => `${(i % n) + 0.5},${Math.floor(i / n) + 0.5}`)
                .join(" ")}
            />
          )}
        </svg>
      </div>

      <div className="bg-entry">
        <span className="bg-word">{entry ? entry.toUpperCase() : "—"}</span>
        <button className="mini-btn" onClick={back} disabled={!entry}>
          ⌫ Delete
        </button>
        <button className="mini-btn bg-enter" onClick={submit} disabled={!entry}>
          Enter
        </button>
      </div>

      <Toast message={toast} />

      {hint && (
        <p className="bg-hint-word">
          💡 Still on the board: <strong>{hint}</strong>
        </p>
      )}

      <div className="bg-found">
        {found.length === 0 && <span className="bg-empty">No words yet.</span>}
        {found.map((w) => (
          <span key={w} className="bg-chip">
            {w}
            <em>{scoreWord(w)}</em>
          </span>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Target reached — ${score} points!`}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
