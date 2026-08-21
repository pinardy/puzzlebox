import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const LEVELS: Record<Diff, [number, number]> = {
  easy: [8, 9],
  medium: [9, 13],
  hard: [12, 26]
};
const HELP =
  "Numbers count mines in the eight touching squares; the first tap is " +
  "always safe. Long-press to plant a flag, and tap a satisfied number to " +
  "reveal its remaining neighbours at once.";

function neighbours(idx: number, n: number): number[] {
  const r = Math.floor(idx / n), c = idx % n;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
  return out;
}

/** Lay mines deterministically from the seed, excluding the 3×3 zone around
 *  the first tap so the opening move is always safe. */
function layMines(seed: string, n: number, mines: number, firstTap: number): boolean[] {
  const rng = makeRng(`mines-${seed}`);
  const safe = new Set([firstTap, ...neighbours(firstTap, n)]);
  const order = shuffled(
    [...Array(n * n).keys()].filter((i) => !safe.has(i)),
    rng
  );
  const isMine = Array(n * n).fill(false);
  for (const idx of order.slice(0, mines)) isMine[idx] = true;
  return isMine;
}

interface SavedState {
  firstTap: number | null;
  revealed: boolean[];
  flagged: boolean[];
  done: boolean;
  won: boolean;
}

function fresh(n: number): SavedState {
  return {
    firstTap: null,
    revealed: Array(n * n).fill(false),
    flagged: Array(n * n).fill(false),
    done: false,
    won: false
  };
}

export default function Mines({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("mines", (_s, d) => fresh(LEVELS[d][0]));
  const [n, mineCount] = LEVELS[diff];
  const [flagMode, setFlagMode] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const isMine = useMemo(
    () =>
      saved.firstTap === null
        ? null
        : layMines(seed, n, mineCount, saved.firstTap),
    [saved.firstTap, seed, n, mineCount]
  );

  const counts = useMemo(() => {
    if (!isMine) return null;
    return isMine.map((_, i) =>
      neighbours(i, n).filter((j) => isMine[j]).length
    );
  }, [isMine, n]);

  useEffect(() => {
    if (!isMine || saved.done) return;
    const allClear = saved.revealed.every((r, i) => r || isMine[i]);
    if (allClear) {
      commit({ ...saved, done: true, won: true }, { undoable: false });
      recordResult("mines", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, isMine]);

  function floodReveal(start: number, mines: boolean[], cnts: number[], revealed: boolean[]) {
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (revealed[i] || mines[i]) continue;
      revealed[i] = true;
      if (cnts[i] === 0) for (const j of neighbours(i, n)) if (!revealed[j]) stack.push(j);
    }
  }

  function toggleFlag(idx: number) {
    if (saved.done || saved.revealed[idx]) return;
    const flagged = saved.flagged.slice();
    flagged[idx] = !flagged[idx];
    commit({ ...saved, flagged });
  }

  /** Reveal several cells; a mine among them ends the game. */
  function revealCells(targets: number[]) {
    if (!isMine || !counts) return;
    if (targets.some((i) => isMine[i])) {
      const revealed = saved.revealed.map((r, i) => r || isMine[i]);
      commit({ ...saved, revealed, done: true, won: false });
      recordResult("mines", false);
      return;
    }
    const revealed = saved.revealed.slice();
    for (const i of targets) floodReveal(i, isMine, counts, revealed);
    commit({ ...saved, revealed });
  }

  function tap(idx: number) {
    if (saved.done || longPressed.current) return;

    if (flagMode) {
      toggleFlag(idx);
      return;
    }

    // Chord: tapping a satisfied number opens its unflagged neighbours.
    if (saved.revealed[idx]) {
      if (!counts || counts[idx] === 0) return;
      const around = neighbours(idx, n);
      const flags = around.filter((j) => saved.flagged[j]).length;
      if (flags !== counts[idx]) return;
      const targets = around.filter((j) => !saved.flagged[j] && !saved.revealed[j]);
      if (targets.length) revealCells(targets);
      return;
    }

    if (saved.flagged[idx]) return;

    // First tap: fix the mine layout with a safe zone, then flood.
    if (saved.firstTap === null) {
      const mines = layMines(seed, n, mineCount, idx);
      const cnts = mines.map((_, i) =>
        neighbours(i, n).filter((j) => mines[j]).length
      );
      const revealed = saved.revealed.slice();
      floodReveal(idx, mines, cnts, revealed);
      commit({ ...saved, firstTap: idx, revealed });
      return;
    }

    revealCells([idx]);
  }

  const flagsUsed = saved.flagged.filter(Boolean).length;

  return (
    <div className="game game-mines">
      <GameHeader title="Minesweeper" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        First tap is always safe. Long-press (or use 🚩 mode) to flag.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>🚩 {flagsUsed} / {mineCount}</span>
      </div>

      <div
        className="mines-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Minefield"
      >
        {saved.revealed.map((rev, i) => {
          const mine = isMine?.[i] ?? false;
          const cnt = counts?.[i] ?? 0;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "mine-cell",
                rev ? "open" : "",
                rev && mine ? "boom" : "",
                rev && !mine && cnt > 0 ? `c${cnt}` : ""
              ].join(" ")}
              onClick={() => tap(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleFlag(i);
              }}
              onPointerDown={() => {
                longPressed.current = false;
                pressTimer.current = window.setTimeout(() => {
                  longPressed.current = true;
                  toggleFlag(i);
                }, 420);
              }}
              onPointerUp={() => {
                if (pressTimer.current !== null) clearTimeout(pressTimer.current);
              }}
              onPointerLeave={() => {
                if (pressTimer.current !== null) clearTimeout(pressTimer.current);
              }}
            >
              {rev ? (mine ? "✹" : cnt > 0 ? cnt : "") : saved.flagged[i] ? "🚩" : ""}
            </button>
          );
        })}
      </div>

      <div className="picross-tools">
        <button
          className={`tool-btn${!flagMode ? " active" : ""}`}
          onClick={() => setFlagMode(false)}
          aria-pressed={!flagMode}
        >
          ⛏ Dig
        </button>
        <button
          className={`tool-btn mines-flag${flagMode ? " active" : ""}`}
          onClick={() => setFlagMode(true)}
          aria-pressed={flagMode}
        >
          🚩 Flag
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="mines"
          won={saved.won}
          message={saved.won ? "Field cleared!" : "Boom — that was a mine"}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
