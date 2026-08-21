import { useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const SIZE: Record<Diff, number> = { easy: 7, medium: 8, hard: 9 };
const BOXES: Record<Diff, number> = { easy: 2, medium: 3, hard: 4 };
const HELP =
  "Push every crate onto a goal circle. You can only push — never pull — " +
  "and only one crate at a time, so don't wedge one into a corner. Move " +
  "with taps, swipes on the board, arrow keys, or the pad. Undo is your " +
  "friend.";

interface Level {
  n: number;
  walls: boolean[];
  goals: number[];
  startPlayer: number;
  startBoxes: number[];
}

/** Generate by reverse play: start with the crates already on the goals
 *  and PULL them backwards with a random walk. Replaying the pulls
 *  forwards solves the level, so it is always solvable. */
function generateSokoban(seed: string, n: number, boxCount: number): Level {
  const rng = makeRng(seed);
  const DIRS = [1, -1, n, -n];

  for (;;) {
    const walls = Array(n * n).fill(false);
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n;
      if (r === 0 || r === n - 1 || c === 0 || c === n - 1) walls[i] = true;
      else if (rng() < 0.12) walls[i] = true;
    }
    const floor = [...Array(n * n).keys()].filter((i) => !walls[i]);
    if (floor.length < boxCount * 4) continue;

    // Goals (initial box spots), then the player somewhere else.
    const spots = new Set<number>();
    while (spots.size < boxCount + 1)
      spots.add(floor[Math.floor(rng() * floor.length)]);
    const picked = [...spots];
    const goals = picked.slice(0, boxCount);
    let player = picked[boxCount];
    const boxes = new Set(goals);

    // Random reverse walk with pulls.
    const steps = 40 * boxCount + Math.floor(rng() * 40);
    let pulls = 0;
    for (let s = 0; s < steps; s++) {
      const d = DIRS[Math.floor(rng() * DIRS.length)];
      const back = player - d;
      if (walls[back] || boxes.has(back)) continue;
      const ahead = player + d;
      if (boxes.has(ahead) && rng() < 0.7) {
        // Pull the crate onto our square as we step back.
        boxes.delete(ahead);
        boxes.add(player);
        pulls++;
      }
      player = back;
    }
    if (pulls < boxCount * 3) continue;
    const startBoxes = [...boxes];
    // The level must actually need solving.
    if (startBoxes.every((b) => goals.includes(b))) continue;
    return { n, walls, goals, startPlayer: player, startBoxes };
  }
}

interface SavedState {
  player: number;
  boxes: number[];
  moves: number;
  done: boolean;
}

export default function Sokoban({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("sokoban", (s, d) => {
      const lvl = generateSokoban(`sokoban-${s}`, SIZE[d], BOXES[d]);
      return { player: lvl.startPlayer, boxes: lvl.startBoxes, moves: 0, done: false };
    });
  const n = SIZE[diff];
  const level = useMemo(
    () => generateSokoban(`sokoban-${seed}`, n, BOXES[diff]),
    [seed, n, diff]
  );
  const goalSet = useMemo(() => new Set(level.goals), [level]);

  const move = useCallback(
    (d: number) => {
      if (saved.done) return;
      const target = saved.player + d;
      if (level.walls[target]) return;
      const boxes = saved.boxes.slice();
      const boxAt = boxes.indexOf(target);
      if (boxAt !== -1) {
        const beyond = target + d;
        if (level.walls[beyond] || boxes.includes(beyond)) return;
        boxes[boxAt] = beyond;
      }
      const done = boxes.every((b) => goalSet.has(b));
      commit({ player: target, boxes, moves: saved.moves + 1, done });
      if (done) recordResult("sokoban", true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, level, goalSet]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const d = (
        { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n } as Record<string, number>
      )[e.key];
      if (d !== undefined) {
        e.preventDefault();
        move(d);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, n]);

  function tapCell(i: number) {
    const diffIdx = i - saved.player;
    if ([1, -1, n, -n].includes(diffIdx)) move(diffIdx);
  }

  return (
    <div className="game game-sokoban">
      <GameHeader title="Sokoban" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Push every crate onto a circle. Tap next to the worker, swipe, or use
        arrows.
      </p>
      <GameTools
        diff={diff}
        onDiff={newPuzzle}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="lights-meta">
        <span>
          Moves: {saved.moves} · 📦{" "}
          {saved.boxes.filter((b) => goalSet.has(b)).length}/{saved.boxes.length}
        </span>
      </div>

      <div
        className="soko-grid"
        style={{ "--n": n } as CSSProperties}
        role="grid"
        aria-label="Sokoban board"
      >
        {Array.from({ length: n * n }).map((_, i) => {
          const wall = level.walls[i];
          const goal = goalSet.has(i);
          const box = saved.boxes.includes(i);
          const player = saved.player === i;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "soko-cell",
                wall ? "wall" : "",
                goal ? "goal" : "",
                box ? (goal ? "box on-goal" : "box") : "",
                player ? "player" : ""
              ].join(" ")}
              onClick={() => tapCell(i)}
              tabIndex={-1}
            >
              {wall ? "" : box ? "📦" : player ? "🧍" : goal ? "◎" : ""}
            </button>
          );
        })}
      </div>

      <div className="t2048-pad">
        <button className="mini-btn" onClick={() => move(-n)} aria-label="Up">↑</button>
        <div>
          <button className="mini-btn" onClick={() => move(-1)} aria-label="Left">←</button>
          <button className="mini-btn" onClick={() => move(n)} aria-label="Down">↓</button>
          <button className="mini-btn" onClick={() => move(1)} aria-label="Right">→</button>
        </div>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="sokoban"
          won
          message={`Warehouse cleared in ${saved.moves} moves!`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
