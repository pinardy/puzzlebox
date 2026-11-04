import { useEffect, useState } from "react";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Hanoi.css";

// Hard once jumped to 8 disks (255 optimal moves) — a slog on touch.
const DISKS: Record<Diff, number> = { easy: 5, medium: 6, hard: 7 };
const HELP =
  "Move the whole tower to the rightmost peg, one disk at a time. A disk " +
  "may never sit on a smaller one. Tap a peg to lift its top disk, then " +
  "tap where it should go. The optimal solve takes 2ⁿ−1 moves.";

/** The first move of the shortest way to stack disks 1..k on `target`:
 *  if disk k is already there, look at the smaller ones; otherwise the
 *  smaller ones must first clear to the third peg, then k moves. */
function nextMove(pegs: number[][], k: number, target: number): [number, number] | null {
  if (k === 0) return null;
  const from = pegs.findIndex((p) => p.includes(k));
  if (from === target) return nextMove(pegs, k - 1, target);
  return nextMove(pegs, k - 1, 3 - from - target) ?? [from, target];
}

interface SavedState {
  pegs: number[][]; // each peg: disk sizes, bottom → top
  moves: number;
  done: boolean;
}

function fresh(disks: number): SavedState {
  return {
    pegs: [Array.from({ length: disks }, (_, i) => disks - i), [], []],
    moves: 0,
    done: false
  };
}

export default function Hanoi({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle } =
    useGame<SavedState>((_s, d) => fresh(DISKS[d]));
  const disks = DISKS[diff];
  const optimal = 2 ** disks - 1;
  const [picked, setPicked] = useState<number | null>(null);

  // A save from before disk count was difficulty-driven may not match.
  useEffect(() => {
    if (saved.pegs.flat().length !== disks)
      commit(fresh(disks), { undoable: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disks]);

  function tap(peg: number) {
    if (saved.done) return;
    const pegs = saved.pegs.map((p) => p.slice());
    if (picked === null) {
      if (pegs[peg].length === 0) return;
      setPicked(peg);
      return;
    }
    if (picked === peg) {
      setPicked(null);
      return;
    }
    const disk = pegs[picked][pegs[picked].length - 1];
    const top = pegs[peg][pegs[peg].length - 1];
    if (top !== undefined && top < disk) return; // bigger on smaller — no
    pegs[picked].pop();
    pegs[peg].push(disk);
    setPicked(null);
    const done = pegs[2].length === disks;
    commit({ pegs, moves: saved.moves + 1, done }, { outcome: done ? "won" : undefined });
  }

  /** Hint: make the next move of the optimal solve from here. */
  function hint() {
    if (saved.done) return;
    const mv = nextMove(saved.pegs, disks, 2);
    if (!mv) return;
    const pegs = saved.pegs.map((p) => p.slice());
    pegs[mv[1]].push(pegs[mv[0]].pop()!);
    setPicked(null);
    const done = pegs[2].length === disks;
    commit({ pegs, moves: saved.moves + 1, done }, { hint: true, outcome: done ? "won" : undefined });
  }

  // Digits 1–3 tap a peg; Tab / Enter work on the peg buttons as usual.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1" || e.key === "2" || e.key === "3") tap(Number(e.key) - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function startNew(d?: Diff) {
    newPuzzle(d);
    setPicked(null);
  }

  return (
    <div className="game game-hanoi">
      <GameHeader title="Towers of Hanoi" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Rebuild the tower on the right peg — never a bigger disk on a smaller
        one. Optimal: {optimal} moves.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
        onHint={saved.done ? undefined : hint}
      />

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
        <button
          className="mini-btn"
          onClick={() => {
            commit(fresh(disks));
            setPicked(null);
          }}
        >
          Restart
        </button>
      </div>

      <div className="hanoi-board" role="group" aria-label="Pegs">
        {saved.pegs.map((peg, p) => (
          <button
            key={p}
            className={`hanoi-peg${picked === p ? " picked" : ""}`}
            onClick={() => tap(p)}
            aria-pressed={picked === p}
            aria-label={`Peg ${p + 1}, ${
              peg.length ? `disks bottom to top: ${peg.join(", ")}` : "empty"
            }${picked === p ? ", top disk lifted" : ""}`}
          >
            <span className="hanoi-pole" />
            <span className="hanoi-stack">
              {peg.map((d, i) => (
                <span
                  key={i}
                  className={`hanoi-disk${
                    picked === p && i === peg.length - 1 ? " lifted" : ""
                  }`}
                  style={{ width: `${28 + (d * 66) / disks}%` }}
                >
                  {""}
                </span>
              ))}
            </span>
            <span className="hanoi-base" />
          </button>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          won
          message={
            saved.moves === optimal
              ? `Perfect — ${optimal} moves!`
              : `Solved in ${saved.moves} (optimal ${optimal})`
          }
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
