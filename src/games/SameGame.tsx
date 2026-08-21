import { useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const CONF: Record<Diff, { w: number; h: number; colors: number }> = {
  easy: { w: 8, h: 8, colors: 4 },
  medium: { w: 10, h: 10, colors: 5 },
  hard: { w: 12, h: 12, colors: 5 }
};
const COLORS = ["#e05252", "#3b6fe0", "#2e9e6b", "#e0a23b", "#7857c9"];
const HELP =
  "Tap any group of two or more touching tiles of one colour to pop it. " +
  "Tiles fall, empty columns close up. Bigger groups score far more — " +
  "(n−2)² points — and clearing the whole board earns a 1000-point bonus. " +
  "The game ends when no groups remain.";

interface SavedState {
  cells: (number | null)[];
  w: number;
  h: number;
  score: number;
  done: boolean;
  won: boolean; // board fully cleared
}

function deal(seed: string, diff: Diff): SavedState {
  const { w, h, colors } = CONF[diff];
  const rng = makeRng(`samegame-${seed}`);
  return {
    cells: Array.from({ length: w * h }, () => Math.floor(rng() * colors)),
    w,
    h,
    score: 0,
    done: false,
    won: false
  };
}

function groupAt(cells: (number | null)[], w: number, h: number, start: number): number[] {
  const color = cells[start];
  if (color === null) return [];
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / w), c = i % w;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      const j = rr * w + cc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w && cells[j] === color && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return [...seen];
}

function anyGroup(cells: (number | null)[], w: number, h: number): boolean {
  for (let i = 0; i < w * h; i++) {
    if (cells[i] === null) continue;
    const r = Math.floor(i / w), c = i % w;
    if (c < w - 1 && cells[i + 1] === cells[i]) return true;
    if (r < h - 1 && cells[i + w] === cells[i]) return true;
  }
  return false;
}

/** Gravity, then close empty columns to the left. */
function settle(cells: (number | null)[], w: number, h: number): (number | null)[] {
  const cols: (number | null)[][] = [];
  for (let c = 0; c < w; c++) {
    const col = [];
    for (let r = h - 1; r >= 0; r--)
      if (cells[r * w + c] !== null) col.push(cells[r * w + c]);
    if (col.length) cols.push(col);
  }
  const out: (number | null)[] = Array(w * h).fill(null);
  cols.forEach((col, c) => {
    col.forEach((v, k) => {
      out[(h - 1 - k) * w + c] = v;
    });
  });
  return out;
}

export default function SameGame({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("samegame", (s, d) => deal(s, d));
  const { w, h } = saved;

  const remaining = useMemo(
    () => saved.cells.filter((c) => c !== null).length,
    [saved.cells]
  );

  function tap(i: number) {
    if (saved.done || saved.cells[i] === null) return;
    const group = groupAt(saved.cells, w, h, i);
    if (group.length < 2) return;
    let cells = saved.cells.slice();
    for (const j of group) cells[j] = null;
    cells = settle(cells, w, h);
    let score = saved.score + (group.length - 2) ** 2;
    const cleared = cells.every((c) => c === null);
    const stuck = !cleared && !anyGroup(cells, w, h);
    if (cleared) score += 1000;
    const done = cleared || stuck;
    commit({ ...saved, cells, score, done, won: cleared });
    if (done) recordResult("samegame", cleared);
  }

  return (
    <div className="game game-samegame">
      <GameHeader title="SameGame" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Pop groups of two or more. Big groups score (n−2)².
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>Score: {saved.score} · {remaining} tiles</span>
      </div>

      <div
        className="sg-grid"
        style={{ "--w": w, "--h": h } as CSSProperties}
        role="grid"
        aria-label="SameGame board"
      >
        {saved.cells.map((v, i) => (
          <button
            key={i}
            role="gridcell"
            className={`sg-cell${v === null ? " empty" : ""}`}
            style={v !== null ? ({ "--tile": COLORS[v] } as CSSProperties) : undefined}
            onClick={() => tap(i)}
            tabIndex={-1}
          />
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="samegame"
          won={saved.won}
          message={
            saved.won
              ? `Board cleared — ${saved.score} points!`
              : `No moves left — ${saved.score} points, ${remaining} tiles stuck`
          }
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
