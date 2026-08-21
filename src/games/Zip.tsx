import { useMemo, useRef, useState, type CSSProperties } from "react";
import { newSeed } from "../lib/rng";
import { generateZip, areAdjacent } from "../lib/zip";
import { loadSlot, saveSlot, recordResult } from "../lib/storage";
import { GameHeader } from "./GameHeader";

const N = 6;

interface SavedState {
  path: number[];
  done: boolean;
}

export default function Zip({ onExit }: { onExit: () => void }) {
  const [seed, setSeed] = useState(
    () => loadSlot<SavedState>("zip")?.seed ?? newSeed()
  );
  const { checkpoints, start, last } = useMemo(
    () => generateZip(`zip-${seed}`, N, N + 1),
    [seed]
  );

  const [saved, setSaved] = useState<SavedState>(
    () => loadSlot<SavedState>("zip")?.state ?? { path: [start], done: false }
  );
  const [toast, setToast] = useState<string | null>(null);
  const dragging = useRef(false);

  const onPath = useMemo(() => new Set(saved.path), [saved.path]);
  const head = saved.path[saved.path.length - 1];

  /** Checkpoints already collected, in path order — the invariant is that
   *  the path only ever enters checkpoints in ascending order. */
  const nextCheckpoint = useMemo(() => {
    let expect = 1;
    for (const cell of saved.path)
      if (checkpoints.get(cell) === expect) expect++;
    return expect;
  }, [saved.path, checkpoints]);

  function commit(path: number[]) {
    let expect = 1;
    for (const cell of path) if (checkpoints.get(cell) === expect) expect++;
    const done = path.length === N * N && expect > last;
    const next = { path, done };
    setSaved(next);
    saveSlot("zip", seed, next);
    if (done && !saved.done) {
      recordResult("zip", true);
      setToast("Zipped!");
    }
  }

  /** Try to move the path head onto `idx` (extend, backtrack, or rewind). */
  function step(idx: number) {
    if (saved.done) return;
    const path = saved.path;
    // Backtrack one step by moving onto the previous cell
    if (path.length > 1 && idx === path[path.length - 2]) {
      commit(path.slice(0, -1));
      return;
    }
    // Rewind by touching any earlier path cell
    const at = path.indexOf(idx);
    if (at !== -1) {
      if (at < path.length - 1) commit(path.slice(0, at + 1));
      return;
    }
    // Extend to an adjacent unvisited cell
    if (!areAdjacent(head, idx, N)) return;
    const cp = checkpoints.get(idx);
    if (cp !== undefined && cp !== nextCheckpoint) return; // out of order
    commit([...path, idx]);
  }

  function newPuzzle() {
    const s = newSeed();
    const p = generateZip(`zip-${s}`, N, N + 1);
    const next = { path: [p.start], done: false };
    setSeed(s);
    setSaved(next);
    saveSlot("zip", s, next);
    setToast(null);
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y);
    const v = el instanceof HTMLElement ? el.dataset.zipIdx : undefined;
    return v === undefined ? null : Number(v);
  }

  return (
    <div className="game game-zip">
      <GameHeader title="Zip" onExit={onExit} onNew={newPuzzle} />
      <p className="game-hint">
        Draw one line through every square, hitting the numbers in order.
        Drag from the line's end — touch an earlier square to rewind.
      </p>

      <div
        className="zip-grid"
        style={{ "--n": N } as CSSProperties}
        role="grid"
        aria-label="Zip board"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const idx = cellFromPoint(e.clientX, e.clientY);
          if (idx !== null) step(idx);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const idx = cellFromPoint(e.clientX, e.clientY);
          if (idx !== null && idx !== head) step(idx);
        }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {Array.from({ length: N * N }).map((_, i) => {
          const cp = checkpoints.get(i);
          return (
            <div
              key={i}
              role="gridcell"
              data-zip-idx={i}
              className={[
                "zip-cell",
                onPath.has(i) ? "on" : "",
                i === head ? "head" : "",
                cp !== undefined ? "cp" : "",
                cp !== undefined && cp < nextCheckpoint ? "cp-done" : ""
              ].join(" ")}
            >
              <span className="cp-num">{cp ?? ""}</span>
            </div>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>{saved.path.length} / {N * N} squares · next: {nextCheckpoint > last ? "—" : nextCheckpoint}</span>
        <button
          className="mini-btn"
          onClick={() => commit([start])}
        >
          Clear
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
