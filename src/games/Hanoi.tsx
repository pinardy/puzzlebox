import { useState } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

/** Disk count varies 5–7 with the seed. */
function diskCount(seed: string): number {
  return 5 + Math.floor(makeRng(`hanoi-${seed}`)() * 3);
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
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("hanoi")?.seed ?? newSeed()
  );
  const disks = diskCount(seed);
  const optimal = 2 ** disks - 1;
  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("hanoi")?.state ?? fresh(disks)
  );
  const [picked, setPicked] = useState<number | null>(null); // source peg
  const [toast, setToast] = useState<string | null>(null);

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
    const next = { pegs, moves: saved.moves + 1, done };
    setSaved(next);
    saveSlot("hanoi", seed, next);
    if (done) {
      recordResult("hanoi", true);
      setToast(
        next.moves === optimal
          ? `Perfect — ${optimal} moves!`
          : `Solved in ${next.moves} (optimal ${optimal})`
      );
    }
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh(diskCount(s)));
    saveSlot("hanoi", s, fresh(diskCount(s)));
    setPicked(null);
    setToast(null);
  }

  return (
    <div className="game game-hanoi">
      <GameHeader title="Towers of Hanoi" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Move the whole tower to the right peg, one disk at a time — never a
        bigger disk on a smaller one. Optimal: {optimal} moves.
      </p>

      <div className="lights-meta">
        <span>Moves: {saved.moves}</span>
        <button
          className="mini-btn"
          onClick={() => {
            setSaved(fresh(disks));
            saveSlot("hanoi", seed, fresh(disks));
            setPicked(null);
            setToast(null);
          }}
        >
          Restart
        </button>
      </div>

      <div className="hanoi-board">
        {saved.pegs.map((peg, p) => (
          <button
            key={p}
            className={`hanoi-peg${picked === p ? " picked" : ""}`}
            onClick={() => tap(p)}
            aria-label={`Peg ${p + 1}, ${peg.length} disks`}
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
