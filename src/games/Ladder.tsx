import { useEffect, useMemo, useRef, useState } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { WORDS4 } from "../lib/words4";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result, Toast } from "./ui";

const PAR: Record<Diff, number> = { easy: 4, medium: 5, hard: 6 };
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const HELP =
  "Turn the top word into the target, one letter at a time — every step " +
  "must be a real word. Tap a letter position, then a replacement. You " +
  "get two moves more than the shortest possible ladder.";

const DICT = new Set(WORDS4);

function neighbours(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 4; i++)
    for (const c of "abcdefghijklmnopqrstuvwxyz") {
      if (c === w[i]) continue;
      const v = w.slice(0, i) + c + w.slice(i + 1);
      if (DICT.has(v)) out.push(v);
    }
  return out;
}

interface Puzzle {
  start: string;
  target: string;
  par: number;
}

/** Pick a random start, walk BFS to the exact target depth, and choose a
 *  word from that ring. Retries with new starts until one has a ring. */
function generateLadder(seed: string, par: number): Puzzle {
  const rng = makeRng(seed);
  for (const start of shuffled(WORDS4, rng)) {
    const dist = new Map([[start, 0]]);
    const queue = [start];
    const ring: string[] = [];
    while (queue.length) {
      const w = queue.shift()!;
      const d = dist.get(w)!;
      if (d === par) {
        ring.push(w);
        continue;
      }
      for (const v of neighbours(w))
        if (!dist.has(v)) {
          dist.set(v, d + 1);
          queue.push(v);
        }
    }
    if (ring.length) return { start, target: ring[Math.floor(rng() * ring.length)], par };
  }
  return { start: "cold", target: "warm", par }; // unreachable with this dictionary
}

interface SavedState {
  chain: string[]; // chain[0] = start word
  done: boolean;
  won: boolean;
}

export default function Ladder({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("ladder", (s, d) => ({
      chain: [generateLadder(`ladder-${s}`, PAR[d]).start],
      done: false,
      won: false
    }));
  const { target, par } = useMemo(
    () => generateLadder(`ladder-${seed}`, PAR[diff]),
    [seed, diff]
  );
  const budget = par + 2;
  const [slot, setSlot] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const current = saved.chain[saved.chain.length - 1];
  const movesLeft = budget - (saved.chain.length - 1);

  function flash(msg: string) {
    setToast(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  }

  const play = (letter: string) => {
    if (saved.done || slot === null) return;
    const next = current.slice(0, slot) + letter + current.slice(slot + 1);
    if (next === current) return;
    if (!DICT.has(next)) {
      flash("Not in word list");
      return;
    }
    const chain = [...saved.chain, next];
    const won = next === target;
    const done = won || chain.length - 1 >= budget;
    commit({ chain, done, won });
    setSlot(null);
    if (done) recordResult("ladder", won);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) play(e.key.toLowerCase());
      else if (e.key === "ArrowLeft" && slot !== null) setSlot(Math.max(0, slot - 1));
      else if (e.key === "ArrowRight" && slot !== null) setSlot(Math.min(3, slot + 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, saved]);

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSlot(null);
    setToast(null);
  }

  return (
    <div className="game game-ladder">
      <GameHeader title="Word Ladder" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Change one letter per step, always making a real word.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="ld-status">
        <span>
          Target <b className="ld-target">{target.toUpperCase()}</b>
        </span>
        <span>
          {movesLeft} move{movesLeft === 1 ? "" : "s"} left · par {par}
        </span>
      </div>

      <div className="word-grid ld-grid" role="grid" aria-label="Ladder">
        {saved.chain.map((word, r) => {
          const isCurrent = r === saved.chain.length - 1 && !saved.done;
          return (
            <div key={r} className={`word-row${isCurrent && shake ? " shake" : ""}`} role="row">
              {word.split("").map((ch, c) => {
                const good = target[c] === ch;
                return (
                  <button
                    key={c}
                    role="gridcell"
                    className={[
                      "word-cell filled ld-cell",
                      good ? "is-correct" : "",
                      isCurrent && slot === c ? "ld-slot" : ""
                    ].join(" ")}
                    disabled={!isCurrent}
                    onClick={() => isCurrent && setSlot(slot === c ? null : c)}
                  >
                    {ch.toUpperCase()}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <Toast message={toast} />
      {slot === null && !saved.done && (
        <p className="game-hint">Tap the letter you want to change.</p>
      )}

      <div className="keyboard">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row}>
            {row.split("").map((k) => (
              <button
                key={k}
                className="key"
                disabled={slot === null || saved.done}
                onClick={() => play(k.toLowerCase())}
              >
                {k}
              </button>
            ))}
          </div>
        ))}
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="ladder"
          won={saved.won}
          message={
            saved.won
              ? saved.chain.length - 1 <= par
                ? `Climbed in ${saved.chain.length - 1} — right on par!`
                : `Climbed in ${saved.chain.length - 1} steps`
              : `Out of moves — it was ${saved.chain[0].toUpperCase()} → ${target.toUpperCase()}`
          }
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
