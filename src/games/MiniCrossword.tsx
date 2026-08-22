import { useEffect, useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { WORDS3, WORDS4, WORDS5, Entry } from "../lib/crossword";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const N = 5;
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const HELP =
  "A pocket crossword: fill every white square so the across and down " +
  "answers match their clues. Tap a square to select its word, tap again " +
  "to switch direction. A clue dims once its answer is complete and " +
  "correct.";

/** The one block layout that fills reliably from the bundled word lists
 *  (its mirror doesn't — English words constrain endings harder than
 *  starts, so the staircase must lean this way; denser layouts need a
 *  far bigger dictionary). Variety comes from the fill, not the shape. */
const PATTERNS: readonly number[][] = [[0, 1, 5, 19, 23, 24]];

const CLUE_OF = new Map<string, string>(
  ([] as Entry[]).concat([...WORDS3], [...WORDS4], [...WORDS5])
);
const LISTS: Record<number, string[]> = {
  3: WORDS3.map(([w]) => w),
  4: WORDS4.map(([w]) => w),
  5: WORDS5.map(([w]) => w)
};

// Try common crossing letters first — lifts fill rates a lot.
const FREQ: Record<string, number> = {};
"etaoinshrdlcumwfgypbvkjxqz".split("").forEach((c, i) => (FREQ[c] = 26 - i));

interface Slot {
  cells: number[];
  across: boolean;
  num: number;
  word: string;
  clue: string;
}

interface Puzzle {
  black: boolean[];
  slots: Slot[];
  solution: string[]; // per cell, "" on black
}

function slotCells(black: boolean[]): { cells: number[]; across: boolean }[] {
  const out: { cells: number[]; across: boolean }[] = [];
  const scan = (line: number[], across: boolean) => {
    let run: number[] = [];
    for (const i of [...line, -1]) {
      if (i !== -1 && !black[i]) {
        run.push(i);
        continue;
      }
      if (run.length >= 3) out.push({ cells: run, across });
      run = [];
    }
  };
  for (let r = 0; r < N; r++) scan(Array.from({ length: N }, (_, c) => r * N + c), true);
  for (let c = 0; c < N; c++) scan(Array.from({ length: N }, (_, r) => r * N + c), false);
  return out;
}

/** Backtracking fill, most-constrained slot first. */
function fillGrid(
  slots: { cells: number[]; across: boolean }[],
  lists: Record<number, string[]>,
  nodeCap: number
): string[] | null {
  const grid = Array(N * N).fill("");
  const used = new Set<string>();
  const filled = Array(slots.length).fill(false);
  let nodes = 0;
  const candidates = (cells: number[]) =>
    lists[cells.length].filter((w) => {
      if (used.has(w)) return false;
      for (let i = 0; i < cells.length; i++)
        if (grid[cells[i]] && grid[cells[i]] !== w[i]) return false;
      return true;
    });
  const step = (): boolean => {
    if (++nodes > nodeCap) return false;
    let best = -1;
    let bestCands: string[] | null = null;
    for (let k = 0; k < slots.length; k++) {
      if (filled[k]) continue;
      const cands = candidates(slots[k].cells);
      if (cands.length === 0) return false;
      if (bestCands === null || cands.length < bestCands.length) {
        best = k;
        bestCands = cands;
      }
    }
    if (best === -1 || bestCands === null) return true;
    const cells = slots[best].cells;
    const ordered = bestCands
      .map((w) => {
        let score = 0;
        for (let i = 0; i < w.length; i++) if (!grid[cells[i]]) score += FREQ[w[i]] ?? 0;
        return { w, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.w);
    filled[best] = true;
    for (const w of ordered) {
      const prev = cells.map((c) => grid[c]);
      for (let i = 0; i < cells.length; i++) grid[cells[i]] = w[i];
      used.add(w);
      if (step()) return true;
      used.delete(w);
      for (let i = 0; i < cells.length; i++) grid[cells[i]] = prev[i];
    }
    filled[best] = false;
    return false;
  };
  return step() ? grid : null;
}

function generateMini(seed: string): Puzzle {
  const rng = makeRng(seed);
  for (let round = 0; ; round++) {
    for (const blocks of shuffled(PATTERNS, rng)) {
      const black = Array(N * N).fill(false);
      for (const b of blocks) black[b] = true;
      const raw = slotCells(black);
      const lists: Record<number, string[]> = {
        3: shuffled(LISTS[3], rng),
        4: shuffled(LISTS[4], rng),
        5: shuffled(LISTS[5], rng)
      };
      const grid = fillGrid(raw, lists, 30000 * (round + 1));
      if (!grid) continue;

      // Standard numbering: row-major over slot-starting cells.
      const startNum = new Map<number, number>();
      let n = 0;
      for (let i = 0; i < N * N; i++)
        if (raw.some((s) => s.cells[0] === i)) startNum.set(i, ++n);
      const slots: Slot[] = raw.map((s) => {
        const word = s.cells.map((c) => grid[c]).join("");
        return {
          cells: s.cells,
          across: s.across,
          num: startNum.get(s.cells[0])!,
          word,
          clue: CLUE_OF.get(word) ?? word
        };
      });
      return { black, slots, solution: grid };
    }
  }
}

interface SavedState {
  entries: string[]; // per cell, "" when empty
  done: boolean;
}

export default function MiniCrossword({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, commitHint, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("mini", () => ({
      entries: Array(N * N).fill(""),
      done: false
    }));
  const puzzle = useMemo(() => generateMini(`mini-${seed}`), [seed]);
  const [cursor, setCursor] = useState<number>(puzzle.black.findIndex((b) => !b));
  const [acrossMode, setAcrossMode] = useState(true);

  const activeSlot = useMemo(() => {
    const has = (s: Slot) => s.cells.includes(cursor);
    return (
      puzzle.slots.find((s) => s.across === acrossMode && has(s)) ??
      puzzle.slots.find(has) ??
      puzzle.slots[0]
    );
  }, [puzzle, cursor, acrossMode]);

  const solvedSlots = useMemo(
    () =>
      new Set(
        puzzle.slots
          .filter((s) => s.cells.every((c) => saved.entries[c] === puzzle.solution[c]))
          .map((s) => `${s.num}${s.across ? "a" : "d"}`)
      ),
    [puzzle, saved.entries]
  );

  useEffect(() => {
    const complete = puzzle.solution.every(
      (ch, i) => puzzle.black[i] || saved.entries[i] === ch
    );
    if (!saved.done && complete) {
      commit({ ...saved, done: true }, { undoable: false });
      recordResult("mini", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, puzzle]);

  function tapCell(i: number) {
    if (puzzle.black[i]) return;
    if (i === cursor) setAcrossMode((m) => !m);
    else setCursor(i);
  }

  const type = (letter: string) => {
    if (saved.done || puzzle.black[cursor]) return;
    const entries = saved.entries.slice();
    entries[cursor] = letter;
    commit({ ...saved, entries });
    const idx = activeSlot.cells.indexOf(cursor);
    if (idx !== -1 && idx < activeSlot.cells.length - 1)
      setCursor(activeSlot.cells[idx + 1]);
  };

  const erase = () => {
    if (saved.done) return;
    const entries = saved.entries.slice();
    if (entries[cursor]) entries[cursor] = "";
    else {
      const idx = activeSlot.cells.indexOf(cursor);
      if (idx > 0) {
        setCursor(activeSlot.cells[idx - 1]);
        entries[activeSlot.cells[idx - 1]] = "";
      }
    }
    commit({ ...saved, entries });
  };

  function hint() {
    const open = (i: number) =>
      !puzzle.black[i] && saved.entries[i] !== puzzle.solution[i];
    const cands = [...Array(N * N).keys()].filter(open);
    if (!cands.length) return;
    const idx = open(cursor) ? cursor : cands[Math.floor(Math.random() * cands.length)];
    const entries = saved.entries.slice();
    entries[idx] = puzzle.solution[idx];
    commitHint({ ...saved, entries });
    setCursor(idx);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
      else if (e.key === "Backspace" || e.key === "Delete") erase();
      else if (e.key === " ") {
        e.preventDefault();
        setAcrossMode((m) => !m);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, saved, activeSlot]);

  function startNew() {
    newPuzzle();
    setAcrossMode(true);
    setCursor(2); // first white cell of the staircase layout
  }

  const numAt = new Map<number, number>();
  for (const s of puzzle.slots)
    if (!numAt.has(s.cells[0])) numAt.set(s.cells[0], s.num);

  const clueList = (across: boolean) =>
    puzzle.slots
      .filter((s) => s.across === across)
      .sort((a, b) => a.num - b.num)
      .map((s) => (
        <button
          key={`${s.num}${across ? "a" : "d"}`}
          className={[
            "xw-clue",
            solvedSlots.has(`${s.num}${s.across ? "a" : "d"}`) ? "solved" : "",
            activeSlot === s ? "active" : ""
          ].join(" ")}
          onClick={() => {
            setCursor(s.cells[0]);
            setAcrossMode(s.across);
          }}
        >
          <b>{s.num}</b> {s.clue}
        </button>
      ));

  return (
    <div className="game game-mini">
      <GameHeader title="Mini Crossword" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Fill the grid from the clues. Tap a square twice to switch direction.
      </p>
      <GameTools
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="xw-grid" role="grid" aria-label="Crossword">
        {puzzle.black.map((isBlack, i) => {
          if (isBlack) return <span key={i} className="xw-black" />;
          const inWord = activeSlot.cells.includes(i);
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "xw-cell",
                cursor === i ? "selected" : "",
                inWord ? "inword" : ""
              ].join(" ")}
              onClick={() => tapCell(i)}
            >
              {numAt.has(i) && <span className="xw-num">{numAt.get(i)}</span>}
              {saved.entries[i]?.toUpperCase() ?? ""}
            </button>
          );
        })}
      </div>

      <div className="xw-active">
        <b>
          {activeSlot.num}
          {activeSlot.across ? "A" : "D"}
        </b>{" "}
        {activeSlot.clue}
      </div>

      <div className="keyboard">
        {KEY_ROWS.map((row, i) => (
          <div className="key-row" key={row}>
            {row.split("").map((k) => (
              <button key={k} className="key" onClick={() => type(k.toLowerCase())}>
                {k}
              </button>
            ))}
            {i === 2 && (
              <button className="key key-wide" onClick={erase}>
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="xw-clues">
        <div>
          <h3>Across</h3>
          {clueList(true)}
        </div>
        <div>
          <h3>Down</h3>
          {clueList(false)}
        </div>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="mini"
          won
          message="Crossword complete!"
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
