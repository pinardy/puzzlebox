import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed, shuffled } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 9;
const MINE_COUNT = 13;

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

function fresh(): SavedState {
  return {
    firstTap: null,
    revealed: Array(N * N).fill(false),
    flagged: Array(N * N).fill(false),
    done: false,
    won: false
  };
}

export default function Mines({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("mines")?.seed ?? newSeed()
  );
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("mines")?.state ?? fresh()
  );
  const [flagMode, setFlagMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isMine = useMemo(
    () =>
      saved.firstTap === null
        ? null
        : layMines(seed, N, MINE_COUNT, saved.firstTap),
    [saved.firstTap, seed]
  );

  const counts = useMemo(() => {
    if (!isMine) return null;
    return isMine.map((_, i) =>
      neighbours(i, N).filter((j) => isMine[j]).length
    );
  }, [isMine]);

  useEffect(() => {
    if (!isMine || saved.done) return;
    const allClear = saved.revealed.every((r, i) => r || isMine[i]);
    if (allClear) {
      const next = { ...saved, done: true, won: true };
      setSaved(next);
      saveSlot("mines", seed, next);
      recordResult("mines", true);
      setToast("Field cleared!");
    }
  }, [saved, isMine, seed]);

  function floodReveal(start: number, mines: boolean[], cnts: number[], revealed: boolean[]) {
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (revealed[i] || mines[i]) continue;
      revealed[i] = true;
      if (cnts[i] === 0) for (const j of neighbours(i, N)) if (!revealed[j]) stack.push(j);
    }
  }

  function tap(idx: number) {
    if (saved.done) return;

    if (flagMode) {
      if (saved.revealed[idx]) return;
      const flagged = saved.flagged.slice();
      flagged[idx] = !flagged[idx];
      const next = { ...saved, flagged };
      setSaved(next);
      saveSlot("mines", seed, next);
      return;
    }

    if (saved.flagged[idx] || saved.revealed[idx]) return;

    // First tap: fix the mine layout with a safe zone, then flood.
    if (saved.firstTap === null) {
      const mines = layMines(seed, N, MINE_COUNT, idx);
      const cnts = mines.map((_, i) =>
        neighbours(i, N).filter((j) => mines[j]).length
      );
      const revealed = saved.revealed.slice();
      floodReveal(idx, mines, cnts, revealed);
      const next = { ...saved, firstTap: idx, revealed };
      setSaved(next);
      saveSlot("mines", seed, next);
      return;
    }

    if (isMine![idx]) {
      const revealed = saved.revealed.map((r, i) => r || isMine![i]);
      const next = { ...saved, revealed, done: true, won: false };
      setSaved(next);
      saveSlot("mines", seed, next);
      recordResult("mines", false);
      setToast("Boom — try a new field");
      return;
    }

    const revealed = saved.revealed.slice();
    floodReveal(idx, isMine!, counts!, revealed);
    const next = { ...saved, revealed };
    setSaved(next);
    saveSlot("mines", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("mines", s, fresh());
    setToast(null);
  }

  const flagsUsed = saved.flagged.filter(Boolean).length;

  return (
    <div className="game game-mines">
      <GameHeader title="Minesweeper" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Numbers count mines in touching squares. Your first tap is always safe.
      </p>

      <div className="lights-meta">
        <span>🚩 {flagsUsed} / {MINE_COUNT}</span>
      </div>

      <div
        className="mines-grid"
        style={{ "--n": N } as CSSProperties}
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
            >
              {rev ? (mine ? "✹" : cnt > 0 ? cnt : "") : saved.flagged[i] ? "🚩" : ""}
            </button>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}

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
    </div>
  );
}
