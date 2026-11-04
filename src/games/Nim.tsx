import { useEffect, useState } from "react";
import { dealNim, machineMove, type NimMove } from "../lib/nim";
import { Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";
import "./Nim.css";

const HEAPS: Record<Diff, number> = { easy: 3, medium: 4, hard: 5 };
const MAX: Record<Diff, number> = { easy: 5, medium: 7, hard: 9 };
const REPLY_MS = 260;
const HELP =
  "Several heaps of counters. You and the machine take turns, and a turn " +
  "is taking any number of counters — at least one — from a single heap. " +
  "Whoever takes the very last counter wins. Tap a counter to take it and " +
  "every counter to its right in that heap. The machine plays perfectly, " +
  "so the deal is stacked in your favour: the position you are given is " +
  "always winnable, but one slip loses it.";

interface SavedState {
  heaps: number[];
  turn: "you" | "machine";
  last: NimMove | null; // the machine's last reply, for the status strip
  tip: NimMove | null; // a revealed winning move, until you move again
  done: boolean;
  won: boolean;
}

const fresh = (seed: string, d: Diff): SavedState => ({
  heaps: dealNim(seed, HEAPS[d], MAX[d]),
  turn: "you",
  last: null,
  tip: null,
  done: false,
  won: false
});

const describe = (m: NimMove) => `took ${m.take} from heap ${m.heap + 1}`;

export default function Nim({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, commitHint, undo, canUndo, newPuzzle } =
    useGame<SavedState>(fresh);
  const [hover, setHover] = useState<NimMove | null>(null);

  // The reply is keyed on the committed state, so a doubled effect run in
  // development clears its own pending timer instead of moving twice, and
  // a reload mid-think replays the one outstanding reply.
  useEffect(() => {
    if (saved.done || saved.turn !== "machine") return;
    const timer = window.setTimeout(() => {
      const mv = machineMove(saved.heaps);
      if (!mv) return;
      const heaps = saved.heaps.slice();
      heaps[mv.heap] -= mv.take;
      const cleared = heaps.every((h) => h === 0);
      commit(
        { heaps, turn: "you", last: mv, tip: null, done: cleared, won: false },
        { undoable: false, outcome: cleared ? "lost" : undefined }
      );
    }, REPLY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const yourTurn = !saved.done && saved.turn === "you";

  /** Taking down to counter `j` of heap `i` leaves exactly j counters. */
  function take(i: number, j: number) {
    if (!yourTurn) return;
    const heaps = saved.heaps.slice();
    heaps[i] = j;
    const cleared = heaps.every((h) => h === 0);
    commit(
      {
        heaps,
        turn: cleared ? "you" : "machine",
        last: null,
        tip: null,
        done: cleared,
        won: cleared
      },
      { outcome: cleared ? "won" : undefined }
    );
    setHover(null);
  }

  function hint() {
    const mv = machineMove(saved.heaps);
    if (!yourTurn || !mv) return;
    commitHint({ ...saved, tip: mv });
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setHover(null);
  }

  const total = saved.heaps.reduce((a, h) => a + h, 0);
  const status = saved.won
    ? "You took the last counter."
    : saved.last
      ? `Machine ${describe(saved.last)}.`
      : "You move first.";

  return (
    <div className="game game-nim">
      <GameHeader title="Nim" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Tap a counter to take it and the rest of its row. Take the last one to win.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && yourTurn}
        onHint={yourTurn ? hint : undefined}
      />

      <div className="lights-meta">
        <span aria-live="polite">{status}</span>
        <span className={`nm-turn${saved.turn === "machine" ? " nm-thinking" : ""}`}>
          {!saved.done && !yourTurn ? "Thinking…" : `${total} left`}
        </span>
      </div>

      <div className="nm-heaps" role="grid" aria-label="Nim heaps">
        {saved.heaps.map((h, i) => (
          <div className="nm-heap" role="row" key={i}>
            <span className="nm-label" role="rowheader">
              {i + 1}
            </span>
            <div className="nm-row">
              {h === 0 ? (
                <span className="nm-gone">empty</span>
              ) : (
                [...Array(h).keys()].map((j) => {
                  const amount = h - j;
                  const doomed =
                    hover !== null && hover.heap === i && h - hover.take <= j;
                  const tipped =
                    saved.tip !== null && saved.tip.heap === i && h - saved.tip.take <= j;
                  return (
                    <button
                      key={j}
                      role="gridcell"
                      className={[
                        "nm-counter",
                        doomed ? "nm-doomed" : "",
                        tipped ? "nm-tip" : ""
                      ].join(" ")}
                      disabled={!yourTurn}
                      aria-label={`Heap ${i + 1}: take ${amount} of ${h}`}
                      onPointerEnter={() => setHover({ heap: i, take: amount })}
                      onPointerDown={() => setHover({ heap: i, take: amount })}
                      onPointerLeave={() => setHover(null)}
                      onClick={() => take(i, j)}
                    >
                      {doomed ? "×" : ""}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {saved.tip && !saved.done && (
        <p className="nm-note">
          Hint: take {saved.tip.take} from heap {saved.tip.heap + 1}.
        </p>
      )}

      {saved.done && (
        <Result
          key={seed}
          won={saved.won}
          message={
            saved.won ? "You took the last counter!" : "The machine took the last one."
          }
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
