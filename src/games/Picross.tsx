import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { makeRng, newSeed } from "../lib/rng";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

type Mark = 0 | 1 | 2; // empty | filled | crossed

const SIZE = 10;

interface SavedState {
  marks: Mark[];
  done: boolean;
}

function fresh(): SavedState {
  return { marks: Array(SIZE * SIZE).fill(0) as Mark[], done: false };
}

function runsOf(line: number[]): number[] {
  const runs: number[] = [];
  let n = 0;
  for (const v of line) {
    if (v === 1) n++;
    else if (n) { runs.push(n); n = 0; }
  }
  if (n) runs.push(n);
  return runs.length ? runs : [0];
}

function buildTarget(seed: string, size: number): number[] {
  // Reject boards that are too sparse or too dense to be interesting.
  const rng = makeRng(seed);
  for (;;) {
    const cells = Array.from({ length: size * size }, () =>
      rng() < 0.55 ? 1 : 0
    );
    const fill =
      cells.reduce((a: number, b) => a + b, 0) / cells.length;
    if (fill > 0.4 && fill < 0.68) return cells;
  }
}

export default function Picross({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("picross")?.seed ?? newSeed()
  );
  const target = useMemo(() => buildTarget(`picross-${seed}`, SIZE), [seed]);

  const rowClues = useMemo(
    () =>
      Array.from({ length: SIZE }, (_, r) =>
        runsOf(target.slice(r * SIZE, r * SIZE + SIZE))
      ),
    [target]
  );
  const colClues = useMemo(
    () =>
      Array.from({ length: SIZE }, (_, c) =>
        runsOf(Array.from({ length: SIZE }, (_, r) => target[r * SIZE + c]))
      ),
    [target]
  );

  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("picross")?.state ?? fresh()
  );
  const [mode, setMode] = useState<1 | 2>(1); // fill | cross
  const [toast, setToast] = useState<string | null>(null);

  const playerRow = (r: number) =>
    saved.marks.slice(r * SIZE, r * SIZE + SIZE).map((m) => (m === 1 ? 1 : 0));
  const playerCol = (c: number) =>
    Array.from({ length: SIZE }, (_, r) => (saved.marks[r * SIZE + c] === 1 ? 1 : 0));

  const rowDone = useMemo(
    () => rowClues.map(
      (clue, r) => JSON.stringify(runsOf(playerRow(r))) === JSON.stringify(clue)
    ),
    [saved.marks, rowClues] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const colDone = useMemo(
    () => colClues.map(
      (clue, c) => JSON.stringify(runsOf(playerCol(c))) === JSON.stringify(clue)
    ),
    [saved.marks, colClues] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!saved.done && rowDone.every(Boolean) && colDone.every(Boolean)) {
      const next = { ...saved, done: true };
      setSaved(next);
      saveSlot("picross", seed, next);
      recordResult("picross", true);
      setToast("Picture complete!");
    }
  }, [rowDone, colDone, saved, seed]);

  function tap(i: number) {
    if (saved.done) return;
    const marks = saved.marks.slice() as Mark[];
    marks[i] = marks[i] === mode ? 0 : mode;
    const next = { ...saved, marks };
    setSaved(next);
    saveSlot("picross", seed, next);
  }

  function newPuzzle() {
    const s = newSeed();
    setSeed(s);
    setSaved(fresh());
    saveSlot("picross", s, fresh());
    setToast(null);
  }

  const maxRowClue = Math.max(...rowClues.map((c) => c.length));
  const maxColClue = Math.max(...colClues.map((c) => c.length));

  return (
    <div className="game game-picross">
      <GameHeader title="Picross" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Numbers are runs of filled squares in that row or column, in order.
      </p>

      <div
        className="picross-wrap"
        style={
          {
            "--n": SIZE,
            "--rowclue": maxRowClue,
            "--colclue": maxColClue
          } as CSSProperties
        }
      >
        <div className="picross-corner" />
        <div className="picross-colclues">
          {colClues.map((clue, c) => (
            <div key={c} className={`colclue${colDone[c] ? " satisfied" : ""}`}>
              {clue.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="picross-rowclues">
          {rowClues.map((clue, r) => (
            <div key={r} className={`rowclue${rowDone[r] ? " satisfied" : ""}`}>
              {clue.map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="picross-grid">
          {saved.marks.map((m, i) => {
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            return (
              <button
                key={i}
                className={[
                  "pic-cell",
                  m === 1 ? "fill" : m === 2 ? "cross" : "",
                  c % 5 === 4 && c !== SIZE - 1 ? "br" : "",
                  r % 5 === 4 && r !== SIZE - 1 ? "bb" : ""
                ].join(" ")}
                onClick={() => tap(i)}
                aria-label={`Row ${r + 1} column ${c + 1}`}
              >
                {m === 2 ? "×" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="picross-tools">
        <button
          className={`tool-btn${mode === 1 ? " active" : ""}`}
          onClick={() => setMode(1)}
          aria-pressed={mode === 1}
        >
          ■ Fill
        </button>
        <button
          className={`tool-btn${mode === 2 ? " active" : ""}`}
          onClick={() => setMode(2)}
          aria-pressed={mode === 2}
        >
          × Mark empty
        </button>
      </div>
    </div>
  );
}
