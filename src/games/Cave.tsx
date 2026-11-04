import { useCallback } from "react";
import { makeCave, caveSolved } from "../lib/cave";
import type { Diff } from "../lib/storage";
import { ShadeGame, type ShadePuzzle } from "./ShadeGame";

const SIZE: Record<Diff, number> = { easy: 7, medium: 8, hard: 9 };
const CLUES: Record<Diff, number> = { easy: 0.34, medium: 0.28, hard: 0.22 };
const HELP =
  "Fill in the rock so that what is left is ONE connected cave holding " +
  "every number, and every patch of rock can still reach the edge of the " +
  "grid — no sealed pockets. A numbered cell is always inside the cave and " +
  "counts the cells it can see without leaving it: itself, plus the run in " +
  "each of the four directions up to the wall. Tap once for rock, twice to " +
  "pencil a dot on a cell you have settled as cave.";

export default function Cave({ onExit }: { onExit: () => void }) {
  const build = useCallback((seed: string, diff: Diff): ShadePuzzle => {
    const p = makeCave(seed, SIZE[diff], CLUES[diff]);
    return {
      n: p.n,
      clue: (i) => {
        const c = p.clues[i];
        return c === null ? null : <span className="kd-clue">{c}</span>;
      },
      solved: (filled) => caveSolved(p, filled),
      solution: p.solution
    };
  }, []);

  return (
    <ShadeGame
      title="Cave"
      hint="One cave holding every number; all rock must reach the edge."
      help={HELP}
      className="game-cave"
      fillWord="rock"
      build={build}
      onExit={onExit}
    />
  );
}
