import { useEffect, useMemo, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { ANSWERS } from "../lib/words";
import { COMMON4 } from "../lib/words4";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "Rearrange the scrambled letters into a real word. Tap tiles to build " +
  "your answer, tap a slot to take a letter back. A hint locks the next " +
  "correct letter into place — but counts against you. Easy scrambles " +
  "4-letter words; Hard allows only three wrong attempts.";
const MAX_TRIES_HARD = 3;

interface SavedState {
  tries: number;
  hints: number;
  done: boolean;
  won?: boolean;
}

interface Puzzle {
  word: string;
  scrambled: string[];
}

function generateAnagram(seed: string, diff: Diff): Puzzle {
  const rng = makeRng(`anagram-${seed}`);
  const pool = diff === "easy" ? COMMON4 : ANSWERS;
  const word = pool[Math.floor(rng() * pool.length)].toUpperCase();
  let scrambled = shuffled([...word], rng);
  // Never show the solved arrangement.
  while (scrambled.join("") === word) scrambled = shuffled(scrambled, rng);
  return { word, scrambled };
}

export default function Anagram({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, newPuzzle, playMs } = useGame<SavedState>(
    "anagram",
    () => ({ tries: 0, hints: 0, done: false, won: false })
  );
  const { word, scrambled } = useMemo(() => generateAnagram(seed, diff), [seed, diff]);
  const L = word.length;
  const won = saved.won ?? saved.done; // pre-mode saves couldn't lose

  // Which scrambled-tile index fills each slot (null = empty).
  const [slots, setSlots] = useState<(number | null)[]>(Array(L).fill(null));
  const [shake, setShake] = useState(false);
  useEffect(() => setSlots(Array(word.length).fill(null)), [word]);

  function tapTile(t: number) {
    if (saved.done || slots.includes(t)) return;
    const at = slots.indexOf(null);
    if (at === -1) return;
    const next = slots.slice();
    next[at] = t;
    setSlots(next);
    check(next);
  }

  function tapSlot(i: number) {
    if (saved.done || slots[i] === null) return;
    const next = slots.slice();
    next[i] = null;
    setSlots(next);
  }

  function check(next: (number | null)[]) {
    if (next.some((t) => t === null)) return;
    const attempt = next.map((t) => scrambled[t!]).join("");
    if (attempt === word) {
      commit({ ...saved, tries: saved.tries + 1, done: true, won: true });
      recordResult("anagram", true);
    } else if (diff === "hard" && saved.tries + 1 >= MAX_TRIES_HARD) {
      commit({ ...saved, tries: saved.tries + 1, done: true, won: false });
      recordResult("anagram", false);
    } else {
      commit({ ...saved, tries: saved.tries + 1 });
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  /** Lock the next correct letter into its slot. */
  function hint() {
    if (saved.done) return;
    const next = slots.slice();
    for (let i = 0; i < L; i++) {
      const want = word[i];
      if (next[i] !== null && scrambled[next[i]!] === want) continue;
      // Free a tile showing the wanted letter and place it here.
      const tile = scrambled.findIndex(
        (ch, t) => ch === want && (!next.includes(t) || next.indexOf(t) === i)
      );
      const freeTile = scrambled.findIndex((ch, t) => ch === want && !next.includes(t));
      const use = freeTile !== -1 ? freeTile : tile;
      if (use === -1) return;
      const previously = next.indexOf(use);
      if (previously !== -1) next[previously] = null;
      if (next[i] !== null) {
        /* displaced letter goes back to the rack */
      }
      next[i] = use;
      setSlots(next);
      commit({ ...saved, hints: saved.hints + 1 });
      check(next);
      return;
    }
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
  }

  return (
    <div className="game game-anagram">
      <GameHeader title="Anagram" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Unscramble the letters into a word.
        {diff === "hard" && !saved.done &&
          ` ${MAX_TRIES_HARD - saved.tries} attempt${
            MAX_TRIES_HARD - saved.tries === 1 ? "" : "s"
          } left.`}
      </p>
      <GameTools diff={diff} onDiff={startNew} help={HELP} />

      <div className={`word-grid anagram-slots${shake ? " shake" : ""}`}>
        <div className="word-row">
          {slots.map((t, i) => (
            <button
              key={i}
              className={`word-cell${t !== null ? " filled" : ""}${
                saved.done && won ? " is-correct" : ""
              }`}
              onClick={() => tapSlot(i)}
            >
              {t !== null ? scrambled[t] : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="anagram-rack">
        {scrambled.map((ch, t) => (
          <button
            key={t}
            className="key anagram-tile"
            disabled={slots.includes(t) || saved.done}
            onClick={() => tapTile(t)}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="lights-meta">
        <span>
          Tries: {saved.tries}
          {saved.hints > 0 && ` · hints: ${saved.hints}`}
        </span>
        <button className="mini-btn" onClick={hint} disabled={saved.done}>
          Hint 💡
        </button>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="anagram"
          won={won}
          message={
            !won
              ? `Out of attempts — it was ${word}`
              : saved.hints
                ? `${word} — with ${saved.hints} hint${saved.hints > 1 ? "s" : ""}`
                : `${word} — in ${saved.tries} ${saved.tries === 1 ? "try" : "tries"}!`
          }
          playMs={playMs}
          onNew={startNew}
          onExit={onExit}
        />
      )}
    </div>
  );
}
