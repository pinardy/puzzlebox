import { useMemo, useState } from "react";
import { makeRng } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const TURNS = 10;
const TARGET: Record<Diff, number> = { easy: 2000, medium: 3500, hard: 5000 };
const HELP =
  "Reach the target score within ten turns. Each roll, set aside scoring " +
  "dice — single 1s (100) and 5s (50), three-or-more of a kind (face × " +
  "100, 1s score 1000; each extra die doubles it), a full straight " +
  "(1500), or three pairs (1500) — then roll the rest or bank the turn. " +
  "A roll with nothing scoring is a farkle: the whole turn is lost. Use " +
  "all six dice and they come back fresh.";

/** Score a kept selection, or null if any selected die doesn't pull its
 *  weight. Counts index 1–6. */
function scoreSelection(faces: number[]): number | null {
  if (!faces.length) return null;
  const counts = Array(7).fill(0);
  for (const f of faces) counts[f]++;
  if (faces.length === 6) {
    if (counts.slice(1).every((c) => c === 1)) return 1500; // straight
    if (counts.slice(1).filter((c) => c === 2).length === 3) return 1500; // three pairs
  }
  let total = 0;
  for (let f = 1; f <= 6; f++) {
    const c = counts[f];
    if (c === 0) continue;
    if (c >= 3) total += (f === 1 ? 1000 : f * 100) * Math.pow(2, c - 3);
    else if (f === 1) total += c * 100;
    else if (f === 5) total += c * 50;
    else return null; // a 2, 3, 4, or 6 outside a triple scores nothing
  }
  return total;
}

/** Does this roll contain any scoring dice at all? */
function anyScore(faces: number[]): boolean {
  const counts = Array(7).fill(0);
  for (const f of faces) counts[f]++;
  if (counts[1] > 0 || counts[5] > 0) return true;
  if (counts.some((c) => c >= 3)) return true;
  if (faces.length === 6) {
    if (counts.slice(1).every((c) => c === 1)) return true;
    if (counts.slice(1).filter((c) => c === 2).length === 3) return true;
  }
  return false;
}

interface SavedState {
  total: number;
  turn: number; // 1-based
  turnPoints: number; // banked sub-scores from earlier keeps this turn
  dice: number[]; // the live roll
  rollCount: number; // keys the deterministic dice stream
  farkled: boolean; // last roll was a bust (shown briefly)
  done: boolean;
  won: boolean;
}

function roll(seed: string, k: number, count: number): number[] {
  const rng = makeRng(`farkle-${seed}-${k}`);
  return Array.from({ length: count }, () => 1 + Math.floor(rng() * 6));
}

function fresh(seed: string): SavedState {
  return {
    total: 0,
    turn: 1,
    turnPoints: 0,
    dice: roll(seed, 0, 6),
    rollCount: 1,
    farkled: false,
    done: false,
    won: false
  };
}

export default function Farkle({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "farkle",
    (s) => fresh(s)
  );
  const [picked, setPicked] = useState<boolean[]>([]);
  const target = TARGET[diff];

  const pickedFaces = saved.dice.filter((_, i) => picked[i]);
  const pickedScore = useMemo(() => scoreSelection(pickedFaces), [saved.dice, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  // The current roll has nothing scoring — a farkle waiting to be waved off.
  const busted = !saved.done && !anyScore(saved.dice);

  function togglePick(i: number) {
    if (saved.done || busted) return;
    const next = picked.slice();
    next[i] = !next[i];
    setPicked(next);
  }

  function nextTurn(state: SavedState, banked: number): SavedState {
    const total = state.total + banked;
    const turn = state.turn + 1;
    if (total >= target) {
      recordResult("farkle", true);
      return { ...state, total, done: true, won: true };
    }
    if (turn > TURNS) {
      recordResult("farkle", false);
      return { ...state, total, turn: TURNS, done: true, won: false };
    }
    return {
      ...state,
      total,
      turn,
      turnPoints: 0,
      dice: roll(seed, state.rollCount, 6),
      rollCount: state.rollCount + 1,
      farkled: false
    };
  }

  /** Keep the picked dice and roll the rest (all six again on hot dice).
   *  A busted roll stays on screen — the player waves it off. */
  function rollAgain() {
    if (saved.done || pickedScore === null) return;
    const remaining = saved.dice.length - pickedFaces.length;
    const count = remaining === 0 ? 6 : remaining;
    const dice = roll(seed, saved.rollCount, count);
    const bust = !anyScore(dice);
    commit({
      ...saved,
      dice,
      rollCount: saved.rollCount + 1,
      turnPoints: bust ? 0 : saved.turnPoints + pickedScore,
      farkled: bust
    });
    setPicked([]);
  }

  function bank() {
    if (saved.done || busted) return;
    const extra = pickedScore ?? 0;
    if (saved.turnPoints + extra <= 0) return;
    commit(nextTurn(saved, saved.turnPoints + extra));
    setPicked([]);
  }

  /** Acknowledge a busted roll and move on. */
  function acceptFarkle() {
    if (saved.done) return;
    commit(nextTurn({ ...saved, turnPoints: 0 }, 0));
    setPicked([]);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setPicked([]);
  }

  const PIPS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  return (
    <div className="game game-farkle">
      <GameHeader title="Farkle" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Reach {target} in {TURNS} turns. Tap scoring dice, then roll on or bank.
      </p>
      <GameTools diff={diff} onDiff={startNew} help={HELP} />

      <div className="fk-status">
        <span>
          Turn <b>{saved.turn}</b>/{TURNS}
        </span>
        <span>
          Banked <b>{saved.total}</b>/{target}
        </span>
        <span>
          Turn pts <b>{saved.turnPoints + (pickedScore ?? 0)}</b>
        </span>
      </div>

      <div className="yz-dice" role="group" aria-label="Dice">
        {saved.dice.map((d, i) => (
          <button
            key={i}
            className={`yz-die${picked[i] ? " held" : ""}`}
            onClick={() => togglePick(i)}
            aria-pressed={!!picked[i]}
          >
            {PIPS[d]}
          </button>
        ))}
      </div>

      {busted && (
        <p className="fk-farkle">
          💥 Farkle! No scoring dice — the turn's points are gone.
        </p>
      )}

      <div className="fk-actions">
        {busted ? (
          <button className="result-primary fk-btn" onClick={acceptFarkle}>
            Next turn
          </button>
        ) : (
          <>
            <button
              className="fk-btn"
              disabled={saved.done || pickedScore === null}
              onClick={rollAgain}
            >
              Keep {pickedScore !== null ? `+${pickedScore}` : ""} & roll
            </button>
            <button
              className="fk-btn"
              disabled={saved.done || saved.turnPoints + (pickedScore ?? 0) <= 0}
              onClick={bank}
            >
              Bank {saved.turnPoints + (pickedScore ?? 0)}
            </button>
          </>
        )}
      </div>

      <p className="fk-legend">
        1 = 100 · 5 = 50 · three of a kind = face×100 (1s = 1000), each extra
        die doubles · straight or three pairs = 1500
      </p>

      {saved.done && (
        <Result
          key={seed}
          game="farkle"
          won={saved.won}
          message={
            saved.won
              ? `${saved.total} points — target beaten!`
              : `${saved.total} of ${target} — out of turns`
          }
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
