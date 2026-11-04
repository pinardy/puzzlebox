import { useEffect, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import { useGridNav } from "../lib/gridnav";
import "./BallSort.css";

const COLOR_COUNT: Record<Diff, number> = { easy: 4, medium: 6, hard: 8 };
const TUBE_SIZE = 4;
const COLORS = [
  "#e05252",
  "#3b6fe0",
  "#2e9e6b",
  "#e0a23b",
  "#7857c9",
  "#e06fb2",
  "#2a9d8f",
  "#8a5a2b"
];
const COLOR_NAMES = ["red", "blue", "green", "amber", "purple", "pink", "teal", "brown"];
const HELP =
  "Pour balls between tubes until every tube holds a single colour. A ball " +
  "can only land on a matching colour (or an empty tube), and same-colour " +
  "balls on top pour together when there's room. Two spare tubes give you " +
  "working space — undo generously. On a keyboard, arrows move between " +
  "tubes and Enter picks or pours; the digit keys pick tube 1 to 10 directly.";

interface SavedState {
  tubes: number[][]; // bottom → top, colour indices
  moves: number;
  done: boolean;
}

function deal(seed: string, colors: number): SavedState {
  const rng = makeRng(`ballsort-${seed}`);
  const balls = shuffled(
    Array.from({ length: colors * TUBE_SIZE }, (_, i) => i % colors),
    rng
  );
  const tubes: number[][] = [];
  for (let t = 0; t < colors; t++)
    tubes.push(balls.slice(t * TUBE_SIZE, (t + 1) * TUBE_SIZE));
  tubes.push([], []);
  return { tubes, moves: 0, done: false };
}

function isSolved(tubes: number[][]): boolean {
  return tubes.every(
    (t) => t.length === 0 || (t.length === TUBE_SIZE && t.every((b) => b === t[0]))
  );
}

export default function BallSort({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } = useGame<SavedState>(
    (s, d) => deal(s, COLOR_COUNT[d])
  );
  const [sel, setSel] = useState<number | null>(null);

  function tap(t: number) {
    if (saved.done) return;
    const tubes = saved.tubes.map((x) => x.slice());
    if (sel === null) {
      if (tubes[t].length) setSel(t);
      return;
    }
    if (sel === t) {
      setSel(null);
      return;
    }
    const from = tubes[sel],
      to = tubes[t];
    const color = from[from.length - 1];
    if (color === undefined) {
      setSel(null);
      return;
    }
    if (to.length >= TUBE_SIZE || (to.length && to[to.length - 1] !== color)) {
      // Not a legal pour — treat as picking the other tube instead.
      setSel(tubes[t].length ? t : null);
      return;
    }
    // Pour the whole same-colour run that fits.
    let run = 0;
    while (
      run < from.length &&
      from[from.length - 1 - run] === color &&
      to.length + run < TUBE_SIZE
    )
      run++;
    for (let k = 0; k < run; k++) to.push(from.pop()!);
    setSel(null);
    const done = isSolved(tubes);
    commit(
      { tubes, moves: saved.moves + 1, done },
      { outcome: done ? "won" : undefined }
    );
  }

  // Keyboard: arrows walk the tubes and Enter taps (the button's own
  // click); digits 1–9 and 0 tap tubes 1–10 directly.
  const nav = useGridNav();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !/^[0-9]$/.test(e.key)) return;
      const t = e.key === "0" ? 9 : Number(e.key) - 1;
      if (t < saved.tubes.length) tap(t);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSel(null);
  }

  return (
    <div className="game game-ballsort">
      <GameHeader title="Ball Sort" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap a tube, then where to pour. One colour per tube wins.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
        <button
          className="mini-btn"
          onClick={() => {
            commit(deal(seed, COLOR_COUNT[diff]));
            setSel(null);
          }}
        >
          Restart
        </button>
      </div>

      <div className="bs-board" role="group" aria-label="Tubes" {...nav}>
        {saved.tubes.map((tube, t) => (
          <button
            key={t}
            data-cell={t}
            className={`bs-tube${sel === t ? " selected" : ""}`}
            onClick={() => tap(t)}
            aria-pressed={sel === t}
            aria-label={`Tube ${t + 1}, ${
              tube.length
                ? `bottom to top: ${tube.map((c) => COLOR_NAMES[c]).join(", ")}`
                : "empty"
            }${sel === t ? ", selected" : ""}`}
          >
            {tube.map((c, k) => (
              <span
                key={k}
                className={`bs-ball${
                  sel === t && k === tube.length - 1 ? " lifted" : ""
                }`}
                style={{ "--ball": COLORS[c] } as CSSProperties}
              />
            ))}
          </button>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={`Sorted in ${saved.moves} pours!`}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
