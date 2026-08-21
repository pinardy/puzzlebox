import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateLatin } from "../lib/latin";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 5;

/** Towers visible along a line of heights: each new maximum is visible. */
function visible(line: number[]): number {
  let max = 0, count = 0;
  for (const v of line) {
    if (v > max) { max = v; count++; }
  }
  return count;
}

interface Clues {
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
}

function generateClues(seed: string): Clues {
  const sol = generateLatin(`sky-${seed}`, N);
  const col = (c: number) => Array.from({ length: N }, (_, r) => sol[r * N + c]);
  const row = (r: number) => Array.from({ length: N }, (_, c) => sol[r * N + c]);
  return {
    top: Array.from({ length: N }, (_, c) => visible(col(c))),
    bottom: Array.from({ length: N }, (_, c) => visible(col(c).reverse())),
    left: Array.from({ length: N }, (_, r) => visible(row(r))),
    right: Array.from({ length: N }, (_, r) => visible(row(r).reverse()))
  };
}

interface SavedState {
  entries: number[];
  done: boolean;
}

function fresh(): SavedState {
  return { entries: Array(N * N).fill(0), done: false };
}

export default function Skyscrapers({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("sky")?.seed ?? newSeed()
  );
  const clues = useMemo(() => generateClues(seed), [seed]);
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("sky")?.state ?? fresh()
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const board = saved.entries;

  const conflicts = useMemo(() => {
    const bad = new Set<number>();
    for (let i = 0; i < N * N; i++) {
      const v = board[i];
      if (v === 0) continue;
      const r = Math.floor(i / N), c = i % N;
      for (let k = 0; k < N; k++) {
        const row = r * N + k, col = k * N + c;
        if (row !== i && board[row] === v) bad.add(i);
        if (col !== i && board[col] === v) bad.add(i);
      }
    }
    return bad;
  }, [board]);

  /** null while the line is incomplete; then whether the clue holds. */
  const clueOk = useMemo(() => {
    const col = (c: number) => Array.from({ length: N }, (_, r) => board[r * N + c]);
    const row = (r: number) => Array.from({ length: N }, (_, c) => board[r * N + c]);
    const judge = (line: number[], want: number): boolean | null =>
      line.some((v) => v === 0) ? null : visible(line) === want;
    return {
      top: clues.top.map((w, c) => judge(col(c), w)),
      bottom: clues.bottom.map((w, c) => judge(col(c).reverse(), w)),
      left: clues.left.map((w, r) => judge(row(r), w)),
      right: clues.right.map((w, r) => judge(row(r).reverse(), w))
    };
  }, [board, clues]);

  useEffect(() => {
    const allOk =
      board.every((v) => v !== 0) &&
      conflicts.size === 0 &&
      [...clueOk.top, ...clueOk.bottom, ...clueOk.left, ...clueOk.right].every(
        (ok) => ok === true
      );
    if (!saved.done && allOk) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("sky", seed, next);
      recordResult("sky", true);
      setToast("Skyline complete!");
    }
  }, [board, conflicts, clueOk, saved, seed]);

  function setCell(idx: number, val: number) {
    if (saved.done) return;
    const entries = saved.entries.slice();
    entries[idx] = entries[idx] === val ? 0 : val;
    const next = { ...saved, entries };
    setSaved(next);
    saveSlot("sky", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("sky", s, fresh());
    setSelected(null);
    setToast(null);
  }

  const clueClass = (ok: boolean | null) =>
    `sky-clue${ok === true ? " ok" : ok === false ? " bad" : ""}`;

  const G = N + 2;

  return (
    <div className="game game-sky">
      <GameHeader title="Skyscrapers" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Heights 1–{N} once per row and column. Edge numbers count the towers
        visible from that side — taller ones hide shorter ones.
      </p>

      <div
        className="sky-grid"
        style={{ "--gn": G } as CSSProperties}
        role="grid"
        aria-label="Skyscrapers board"
      >
        {Array.from({ length: G * G }).map((_, k) => {
          const gr = Math.floor(k / G), gc = k % G;
          const inner = gr > 0 && gr <= N && gc > 0 && gc <= N;
          if (inner) {
            const i = (gr - 1) * N + (gc - 1);
            return (
              <button
                key={k}
                role="gridcell"
                className={[
                  "sky-cell",
                  selected === i ? "selected" : "",
                  conflicts.has(i) ? "conflict" : ""
                ].join(" ")}
                onClick={() => setSelected(i)}
              >
                {board[i] || ""}
              </button>
            );
          }
          if (gr === 0 && gc > 0 && gc <= N)
            return <span key={k} className={clueClass(clueOk.top[gc - 1])}>{clues.top[gc - 1]}</span>;
          if (gr === G - 1 && gc > 0 && gc <= N)
            return <span key={k} className={clueClass(clueOk.bottom[gc - 1])}>{clues.bottom[gc - 1]}</span>;
          if (gc === 0 && gr > 0 && gr <= N)
            return <span key={k} className={clueClass(clueOk.left[gr - 1])}>{clues.left[gr - 1]}</span>;
          if (gc === G - 1 && gr > 0 && gr <= N)
            return <span key={k} className={clueClass(clueOk.right[gr - 1])}>{clues.right[gr - 1]}</span>;
          return <span key={k} />;
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="numpad numpad-5">
        {[1, 2, 3, 4, 5].map((d) => (
          <button
            key={d}
            className="num-key"
            onClick={() => selected !== null && setCell(selected, d)}
          >
            {d}
          </button>
        ))}
        <button
          className="num-key tool"
          onClick={() => selected !== null && setCell(selected, 0)}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
