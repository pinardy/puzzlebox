import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { ANSWERS } from "../lib/words";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const GRID = 10;
const WORD_COUNT = 7;

const DIRS = [
  [0, 1], [1, 0], [1, 1], [1, -1],
  [0, -1], [-1, 0], [-1, -1], [-1, 1]
] as const;

interface Placed {
  word: string;
  cells: number[];
}

interface Puzzle {
  letters: string[];
  placed: Placed[];
}

function buildPuzzle(seed: string, wordCount: number): Puzzle {
  const rng = makeRng(seed);
  const pool = shuffled(ANSWERS, rng);
  const letters: string[] = Array(GRID * GRID).fill("");
  const placed: Placed[] = [];

  for (const raw of pool) {
    if (placed.length >= wordCount) break;
    const word = raw.toUpperCase();
    let done = false;
    for (let attempt = 0; attempt < 60 && !done; attempt++) {
      const [dr, dc] = DIRS[Math.floor(rng() * DIRS.length)];
      const r0 = Math.floor(rng() * GRID);
      const c0 = Math.floor(rng() * GRID);
      const rEnd = r0 + dr * (word.length - 1);
      const cEnd = c0 + dc * (word.length - 1);
      if (rEnd < 0 || rEnd >= GRID || cEnd < 0 || cEnd >= GRID) continue;
      const cells: number[] = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const idx = (r0 + dr * i) * GRID + (c0 + dc * i);
        if (letters[idx] !== "" && letters[idx] !== word[i]) { ok = false; break; }
        cells.push(idx);
      }
      if (!ok) continue;
      cells.forEach((idx, i) => { letters[idx] = word[i]; });
      placed.push({ word, cells });
      done = true;
    }
  }

  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === "") letters[i] = A[Math.floor(rng() * 26)];
  }
  return { letters, placed };
}

/** Cells on a straight line between two indices, or null if not straight. */
function lineBetween(a: number, b: number): number[] | null {
  const r0 = Math.floor(a / GRID), c0 = a % GRID;
  const r1 = Math.floor(b / GRID), c1 = b % GRID;
  const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
  const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
  if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0)))
    return null;
  return Array.from({ length: len }, (_, i) => (r0 + dr * i) * GRID + (c0 + dc * i));
}

interface SavedState {
  found: string[];
  done: boolean;
}

const FRESH: SavedState = { found: [], done: false };

export default function WordSearch({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("wordsearch")?.seed ?? newSeed()
  );
  const { letters, placed } = useMemo(
    () => buildPuzzle(`wordsearch-${seed}`, WORD_COUNT),
    [seed]
  );

  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("wordsearch")?.state ?? FRESH
  );
  const [anchor, setAnchor] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const foundCells = useMemo(() => {
    const s = new Set<number>();
    for (const p of placed)
      if (saved.found.includes(p.word)) p.cells.forEach((c) => s.add(c));
    return s;
  }, [saved.found, placed]);

  function tap(idx: number) {
    if (saved.done) return;
    if (anchor === null) { setAnchor(idx); return; }
    if (anchor === idx) { setAnchor(null); return; }
    const line = lineBetween(anchor, idx);
    setAnchor(null);
    if (!line) return;
    const text = line.map((i) => letters[i]).join("");
    const rev = [...text].reverse().join("");
    const hit = placed.find(
      (p) => !saved.found.includes(p.word) && (p.word === text || p.word === rev)
    );
    if (!hit) return;
    const found = [...saved.found, hit.word];
    const done = found.length === placed.length;
    const next = { found, done };
    setSaved(next);
    saveSlot("wordsearch", seed, next);
    if (done) {
      recordResult("wordsearch", true);
      setToast("All words found!");
    }
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(FRESH);
    saveSlot("wordsearch", s, FRESH);
    setAnchor(null);
    setToast(null);
  }

  return (
    <div className="game game-wordsearch">
      <GameHeader title="Word Search" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Tap the first letter of a word, then its last letter.
      </p>

      <div
        className="ws-grid"
        style={{ "--n": GRID } as CSSProperties}
        role="grid"
        aria-label="Letter grid"
      >
        {letters.map((ch, i) => (
          <button
            key={i}
            role="gridcell"
            className={[
              "ws-cell",
              foundCells.has(i) ? "found" : "",
              anchor === i ? "anchor" : ""
            ].join(" ")}
            onClick={() => tap(i)}
          >
            {ch}
          </button>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="ws-words">
        {placed.map((p) => (
          <span
            key={p.word}
            className={`ws-word${saved.found.includes(p.word) ? " found" : ""}`}
          >
            {p.word.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
