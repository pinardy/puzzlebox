import { useMemo, useState, type CSSProperties } from "react";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const N = 7;
const HELP =
  "A peg jumps over an adjacent peg into an empty hole, and the jumped peg " +
  "is removed — like checkers. Keep jumping until no moves remain; finish " +
  "with a single peg (in the centre for a perfect game).";

/** English cross board: the 3×3 arms of a 7×7 grid. */
const valid = (i: number): boolean => {
  const r = Math.floor(i / N), c = i % N;
  return (r >= 2 && r <= 4) || (c >= 2 && c <= 4);
};
const CENTER = 3 * N + 3;

interface SavedState {
  pegs: boolean[];
  moves: number;
  done: boolean;
  won: boolean;
}

function fresh(): SavedState {
  const pegs = Array(N * N).fill(false);
  for (let i = 0; i < N * N; i++) if (valid(i)) pegs[i] = true;
  pegs[CENTER] = false;
  return { pegs, moves: 0, done: false, won: false };
}

function jumps(pegs: boolean[], from: number): number[] {
  const r = Math.floor(from / N), c = from % N;
  const out: number[] = [];
  for (const [dr, dc] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
    const to = rr * N + cc;
    const over = (r + dr / 2) * N + (c + dc / 2);
    if (valid(to) && valid(over) && pegs[over] && !pegs[to]) out.push(to);
  }
  return out;
}

export default function PegSolitaire({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("pegs", fresh);
  const [picked, setPicked] = useState<number | null>(null);

  const pegCount = useMemo(
    () => saved.pegs.filter(Boolean).length,
    [saved.pegs]
  );

  const targets = useMemo(
    () => (picked !== null ? new Set(jumps(saved.pegs, picked)) : new Set<number>()),
    [picked, saved.pegs]
  );

  function tap(i: number) {
    if (saved.done || !valid(i)) return;
    if (saved.pegs[i]) {
      setPicked(picked === i ? null : i);
      return;
    }
    if (picked === null || !targets.has(i)) return;
    const pegs = saved.pegs.slice();
    const over = (picked + i) / 2;
    pegs[picked] = false;
    pegs[over] = false;
    pegs[i] = true;
    setPicked(null);

    const anyMove = pegs.some((p, k) => p && jumps(pegs, k).length > 0);
    const left = pegs.filter(Boolean).length;
    const done = !anyMove;
    const won = done && left === 1;
    commit({ pegs, moves: saved.moves + 1, done, won });
    if (done) recordResult("pegs", won);
  }

  function startNew() {
    newPuzzle();
    setPicked(null);
  }

  return (
    <div className="game game-pegs">
      <GameHeader title="Peg Solitaire" onExit={onExit} onNew={startNew} />
      <p className="game-hint">
        Jump pegs over each other into empty holes — end with one peg left.
      </p>
      <GameTools help={HELP} onUndo={undo} canUndo={canUndo && !saved.done} />

      <div className="lights-meta">
        <span>Pegs left: {pegCount}</span>
        <button
          className="mini-btn"
          onClick={() => {
            commit(fresh());
            setPicked(null);
          }}
        >
          Restart
        </button>
      </div>

      <div
        className="pegs-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Peg solitaire board"
      >
        {saved.pegs.map((peg, i) => {
          if (!valid(i)) return <span key={i} />;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "peg-hole",
                peg ? "peg" : "",
                picked === i ? "picked" : "",
                targets.has(i) ? "target" : "",
                i === CENTER ? "center" : ""
              ].join(" ")}
              onClick={() => tap(i)}
              aria-label={peg ? "Peg" : "Empty hole"}
            />
          );
        })}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="pegs"
          won={saved.won}
          message={
            saved.won
              ? saved.pegs[CENTER]
                ? "Perfect — one peg, dead centre!"
                : "One peg left — solved!"
              : `No moves left — ${pegCount} pegs remain`
          }
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
