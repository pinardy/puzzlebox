import { useEffect, useMemo, useState } from "react";
import { generateSuko, sukoSolved, SUKO_CIRCLES } from "../lib/suko";
import { useGridKeys } from "../lib/keys";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Suko.css";

const LETTERS = ["A", "B", "C"];
const CORNER = ["Top left", "Top right", "Bottom left", "Bottom right"];
const HELP =
  "Place 1–9 once each in the nine squares. Every circle sitting on a " +
  "crossing must equal the sum of the four squares it touches, and every " +
  "colour block must add up to the total shown for its letter. Tap a " +
  "square, then tap a digit; tap the square again to empty it.";

interface SavedState {
  entries: number[];
  done: boolean;
}

type Mark = "open" | "ok" | "bad";

const markOf = (vals: number[], target: number): Mark =>
  vals.some((v) => v === 0)
    ? "open"
    : vals.reduce((a, b) => a + b, 0) === target
      ? "ok"
      : "bad";

const GLYPH: Record<Mark, string> = { open: "", ok: "✓", bad: "✗" };

export default function Suko({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, finish, undo, canUndo, newPuzzle } =
    useGame<SavedState>(() => ({ entries: Array(9).fill(0), done: false }));
  const puzzle = useMemo(() => generateSuko(`suko-${seed}`, diff), [seed, diff]);
  const { circles, groups, groupOf, groupSums, solution } = puzzle;
  const [selected, setSelected] = useState<number | null>(null);
  const board = saved.entries;

  const circleMark = useMemo(
    () => SUKO_CIRCLES.map((q, k) => markOf(q.map((c) => board[c]), circles[k])),
    [board, circles]
  );
  const groupMark = useMemo(
    () => groups.map((g, k) => markOf(g.map((c) => board[c]), groupSums[k])),
    [board, groups, groupSums]
  );

  const solved = sukoSolved(board, puzzle);
  useEffect(() => {
    if (solved) finish();
  }, [solved, finish]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = board.slice();
    // Each digit is used once, so placing one lifts it from wherever it sat.
    if (val !== 0) for (let i = 0; i < 9; i++) if (entries[i] === val) entries[i] = 0;
    entries[idx] = entries[idx] === val ? 0 : val;
    commit({ ...saved, entries });
  }

  function hint() {
    const open = (i: number) => board[i] !== solution[i];
    const cands = [...Array(9).keys()].filter(open);
    if (!cands.length) return;
    const idx =
      selected !== null && open(selected)
        ? selected
        : cands[Math.floor(Math.random() * cands.length)];
    const entries = board.slice();
    for (let i = 0; i < 9; i++) if (entries[i] === solution[idx]) entries[i] = 0;
    entries[idx] = solution[idx];
    commitHint({ ...saved, entries });
    setSelected(idx);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  useGridKeys({ cols: 3, rows: 3, max: 9, selected, setSelected, setCell });

  const used = new Set(board.filter((v) => v !== 0));

  return (
    <div className="game game-suko">
      <GameHeader title="Suko" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Match every circled crossing sum and every colour block total.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="sk-wrap">
        <div className="sk-grid" role="grid" aria-label="Suko board">
          {board.map((v, i) => {
            const letter = LETTERS[groupOf[i]];
            return (
              <button
                key={i}
                role="gridcell"
                className={[
                  "sk-cell",
                  `sk-g${groupOf[i]}`,
                  selected === i ? "selected" : ""
                ].join(" ")}
                aria-label={`Row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1}, block ${letter}, ${v || "empty"}`}
                onClick={() => {
                  if (v !== 0 && selected === i) setCell(i, 0);
                  else setSelected(i);
                }}
              >
                <span className="sk-val">{v || ""}</span>
                <span className="sk-tag" aria-hidden="true">
                  {letter}
                </span>
              </button>
            );
          })}
        </div>
        {circles.map((s, k) => (
          <span
            key={k}
            className={`sk-sum ${circleMark[k]}`}
            style={{
              left: `${(k % 2) * 33.333 + 33.333}%`,
              top: `${Math.floor(k / 2) * 33.333 + 33.333}%`
            }}
          >
            <b>{s}</b>
            <i>{GLYPH[circleMark[k]]}</i>
            <em>
              {CORNER[k]} crossing, {s}
            </em>
          </span>
        ))}
      </div>

      <div className="sk-legend" role="list" aria-label="Colour block totals">
        {groupSums.map((s, g) => (
          <span key={g} className={`sk-key sk-g${g} ${groupMark[g]}`} role="listitem">
            <b>{LETTERS[g]}</b> {s} <i>{GLYPH[groupMark[g]]}</i>
          </span>
        ))}
      </div>

      <div className="sk-tray" role="group" aria-label="Digits">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            className={`sk-chip${used.has(d) ? " used" : ""}`}
            disabled={selected === null || saved.done}
            aria-label={used.has(d) ? `${d}, already on the board` : `${d}`}
            onClick={() => selected !== null && setCell(selected, d)}
          >
            {d}
          </button>
        ))}
        <button
          className="sk-chip erase"
          disabled={selected === null || saved.done}
          aria-label="Empty the selected square"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫
        </button>
      </div>

      <div className="lights-meta">
        <span>{used.size} of 9 placed</span>
        <span>
          {groups.length} colour blocks · {circleMark.filter((m) => m === "ok").length}
          /4 crossings
        </span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message="Every sum lands!"
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
