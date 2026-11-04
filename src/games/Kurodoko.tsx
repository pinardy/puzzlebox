import { useCallback } from "react";
import { makeKurodoko, kurodokoSolved } from "../lib/kurodoko";
import type { Diff } from "../lib/storage";
import { ShadeGame, type ShadePuzzle } from "./ShadeGame";

const SIZE: Record<Diff, number> = { easy: 7, medium: 8, hard: 9 };
const CLUES: Record<Diff, number> = { easy: 0.36, medium: 0.3, hard: 0.24 };
const HELP =
  "Blacken cells so that no two black cells touch edge to edge and every " +
  "white cell is still joined to every other. A numbered cell is always " +
  "white and says how many white cells it can SEE in total: itself, plus " +
  "the unbroken white runs left, right, up and down until a black cell or " +
  "the edge stops the view. Tap once to blacken, twice to pencil a dot on " +
  "a cell you have ruled out.";

export default function Kurodoko({ onExit }: { onExit: () => void }) {
  const build = useCallback((seed: string, diff: Diff): ShadePuzzle => {
    const p = makeKurodoko(seed, SIZE[diff], CLUES[diff]);
    return {
      n: p.n,
      clue: (i) => {
        const c = p.clues[i];
        return c === null ? null : <span className="kd-clue">{c}</span>;
      },
      solved: (filled) => kurodokoSolved(p, filled),
      solution: p.solution
    };
  }, []);

  return (
    <ShadeGame
      title="Kurodoko"
      hint="Numbers count the white cells they can see, themselves included."
      help={HELP}
      className="game-kurodoko"
      fillWord="black"
      build={build}
      onExit={onExit}
    />
  );
}
