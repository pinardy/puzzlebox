import { useCallback } from "react";
import { makeTapa, tapaSolved } from "../lib/tapa";
import type { Diff } from "../lib/storage";
import { ShadeGame, type ShadePuzzle } from "./ShadeGame";

const SIZE: Record<Diff, number> = { easy: 6, medium: 8, hard: 9 };
const CLUES: Record<Diff, number> = { easy: 0.55, medium: 0.45, hard: 0.38 };
const HELP =
  "Shade cells so the shaded ones form ONE connected wall, and no 2×2 " +
  "block anywhere is completely solid. A numbered cell is never shaded: " +
  "its numbers are the lengths of the separate runs of shaded cells among " +
  "its eight neighbours, in any rotation — so 3 means three in a row round " +
  "the cell, while 1 1 means two single neighbours with gaps between them. " +
  "Tap once to shade, twice to pencil a dot on a square you have ruled out.";

export default function Tapa({ onExit }: { onExit: () => void }) {
  const build = useCallback((seed: string, diff: Diff): ShadePuzzle => {
    const p = makeTapa(seed, SIZE[diff], CLUES[diff]);
    return {
      n: p.n,
      clue: (i) => {
        const c = p.clues[i];
        if (!c) return null;
        return (
          <span className={`tapa-clue tapa-c${c.length}`}>
            {c.map((v, k) => (
              <i key={k}>{v}</i>
            ))}
          </span>
        );
      },
      solved: (filled) => tapaSolved(p, filled),
      solution: p.solution
    };
  }, []);

  return (
    <ShadeGame
      game="tapa"
      title="Tapa"
      hint="One connected wall, no solid 2×2. Numbers count runs of neighbours."
      help={HELP}
      className="game-tapa"
      fillWord="shaded"
      build={build}
      onExit={onExit}
    />
  );
}
