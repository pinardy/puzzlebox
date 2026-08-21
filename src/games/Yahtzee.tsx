import { useState } from "react";
import { makeRng } from "../lib/rng";
import { recordResult } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "Thirteen rounds: roll up to three times, tapping dice to hold them " +
  "between rolls, then score the dice in one empty category. The upper " +
  "section pays a 35-point bonus at 63+. Chase your best total.";

const CATS = [
  "Ones", "Twos", "Threes", "Fours", "Fives", "Sixes",
  "3 of a kind", "4 of a kind", "Full house", "Sm straight", "Lg straight",
  "Yahtzee", "Chance"
] as const;

interface SavedState {
  scores: (number | null)[]; // 13 categories
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  rollCount: number; // keys the deterministic dice stream
  done: boolean;
}

function rollDice(seed: string, k: number, prev: number[], held: boolean[]): number[] {
  const rng = makeRng(`yahtzee-${seed}-${k}`);
  return prev.map((v, i) => (held[i] ? v : 1 + Math.floor(rng() * 6)));
}

function fresh(seed: string): SavedState {
  return {
    scores: Array(13).fill(null),
    dice: rollDice(seed, 0, [0, 0, 0, 0, 0], [false, false, false, false, false]),
    held: [false, false, false, false, false],
    rollsLeft: 2,
    rollCount: 1,
    done: false
  };
}

function potential(cat: number, dice: number[]): number {
  const counts = Array(7).fill(0);
  for (const d of dice) counts[d]++;
  const sum = dice.reduce((a, b) => a + b, 0);
  if (cat < 6) return counts[cat + 1] * (cat + 1);
  switch (cat) {
    case 6: return counts.some((c) => c >= 3) ? sum : 0;
    case 7: return counts.some((c) => c >= 4) ? sum : 0;
    case 8: return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case 9: {
      const has = (a: number[]) => a.every((v) => counts[v] > 0);
      return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    }
    case 10: {
      const has = (a: number[]) => a.every((v) => counts[v] > 0);
      return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    }
    case 11: return counts.some((c) => c === 5) ? 50 : 0;
    default: return sum;
  }
}

function totals(scores: (number | null)[]): { upper: number; bonus: number; total: number } {
  const upper = scores.slice(0, 6).reduce((a: number, s) => a + (s ?? 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const total = scores.reduce((a: number, s) => a + (s ?? 0), 0) + bonus;
  return { upper, bonus, total };
}

export default function Yahtzee({ onExit }: { onExit: () => void }) {
  const { seed, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "yahtzee",
    (s) => fresh(s)
  );
  const [rolling, setRolling] = useState(false);

  function roll() {
    if (saved.done || saved.rollsLeft <= 0) return;
    setRolling(true);
    setTimeout(() => setRolling(false), 250);
    commit(
      {
        ...saved,
        dice: rollDice(seed, saved.rollCount, saved.dice, saved.held),
        rollsLeft: saved.rollsLeft - 1,
        rollCount: saved.rollCount + 1
      },
      { undoable: false }
    );
  }

  function toggleHold(i: number) {
    if (saved.done) return;
    const held = saved.held.slice();
    held[i] = !held[i];
    commit({ ...saved, held }, { undoable: false });
  }

  function scoreCat(cat: number) {
    if (saved.done || saved.scores[cat] !== null) return;
    const scores = saved.scores.slice();
    scores[cat] = potential(cat, saved.dice);
    const done = scores.every((s) => s !== null);
    if (done) {
      commit({ ...saved, scores, done }, { undoable: false });
      recordResult("yahtzee", true);
      return;
    }
    // Next round: fresh roll, nothing held.
    const held = [false, false, false, false, false];
    commit(
      {
        ...saved,
        scores,
        dice: rollDice(seed, saved.rollCount, saved.dice, held),
        held,
        rollsLeft: 2,
        rollCount: saved.rollCount + 1,
        done
      },
      { undoable: false }
    );
  }

  const { upper, bonus, total } = totals(saved.scores);
  const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  return (
    <div className="game game-yahtzee">
      <GameHeader title="Yahtzee" onExit={onExit} onNew={() => newPuzzle()} />
      <p className="game-hint">
        Roll up to three times, hold what you like, then pick a category.
      </p>
      <GameTools help={HELP} />

      <div className="yz-dice">
        {saved.dice.map((d, i) => (
          <button
            key={i}
            className={`yz-die${saved.held[i] ? " held" : ""}${rolling && !saved.held[i] ? " rolling" : ""}`}
            onClick={() => toggleHold(i)}
            aria-pressed={saved.held[i]}
            aria-label={`Die showing ${d}${saved.held[i] ? ", held" : ""}`}
          >
            {PIPS[d]}
          </button>
        ))}
        <button
          className="mini-btn yz-roll"
          disabled={saved.rollsLeft <= 0 || saved.done}
          onClick={roll}
        >
          Roll ({saved.rollsLeft})
        </button>
      </div>

      <div className="yz-sheet">
        {CATS.map((name, cat) => {
          const scored = saved.scores[cat];
          const pot = potential(cat, saved.dice);
          return (
            <button
              key={name}
              className={`yz-cat${scored !== null ? " scored" : ""}${
                scored === null && pot > 0 ? " good" : ""
              }`}
              disabled={scored !== null || saved.done}
              onClick={() => scoreCat(cat)}
            >
              <span>{name}</span>
              <b>{scored !== null ? scored : pot}</b>
            </button>
          );
        })}
        <div className="yz-cat yz-total">
          <span>Upper {upper}/63 {bonus ? "· bonus +35" : ""}</span>
          <b>{total}</b>
        </div>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="yahtzee"
          won
          message={`Final score: ${total}${bonus ? " (with bonus)" : ""}`}
          playMs={playMs}
          onNew={() => newPuzzle()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
