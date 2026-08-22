import { useMemo, useState, type CSSProperties } from "react";
import { makeRng, shuffled } from "../lib/rng";
import { recordResult, Diff } from "../lib/storage";
import { useGame } from "../lib/useGame";
import { GameHeader } from "./GameHeader";
import { GameTools, Result } from "./ui";

const HELP =
  "Clear the board by removing matching pairs. A tile is free when " +
  "nothing sits on top of it and at least one long side (left or right) " +
  "is open. Boards are dealt by playing a game backwards, so a winning " +
  "order always exists — but a careless pair can still lock you out.";

// Aligned layered layouts; upper layers are centered on the base.
const LAYOUTS: Record<Diff, [number, number][]> = {
  easy: [[10, 5], [6, 3], [2, 1]],
  medium: [[12, 6], [8, 4], [4, 2], [2, 2]],
  hard: [[12, 7], [10, 5], [6, 3], [2, 1]]
};

// 42 faces: three suits of 1–9, four winds, three dragons, eight blooms.
interface Face {
  main: string;
  sub: string;
  hue: number; // 0 blue, 1 rose, 2 green, 3 amber, 4 indigo
}
const FACES: Face[] = [];
for (const [sub, hue] of [["●", 0], ["▲", 1], ["■", 2]] as [string, number][])
  for (let v = 1; v <= 9; v++) FACES.push({ main: String(v), sub, hue });
for (const w of ["N", "E", "S", "W"]) FACES.push({ main: w, sub: "✦", hue: 4 });
for (const d of ["R", "G", "B"]) FACES.push({ main: d, sub: "◆", hue: 3 });
for (let v = 1; v <= 8; v++) FACES.push({ main: String(v), sub: "❀", hue: 1 });

interface Pos {
  l: number;
  gx: number;
  gy: number;
}

function positions(layers: [number, number][]): Pos[] {
  const out: Pos[] = [];
  const [W, H] = layers[0];
  layers.forEach(([w, h], l) => {
    const ox = (W - w) / 2, oy = (H - h) / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) out.push({ l, gx: x + ox, gy: y + oy });
  });
  return out;
}

function freeIn(pos: Pos[], present: boolean[], index: Map<string, number>, i: number): boolean {
  const p = pos[i];
  const above = index.get(`${p.l + 1},${p.gx},${p.gy}`);
  if (above !== undefined && present[above]) return false;
  const left = index.get(`${p.l},${p.gx - 1},${p.gy}`);
  const right = index.get(`${p.l},${p.gx + 1},${p.gy}`);
  return left === undefined || !present[left] || right === undefined || !present[right];
}

interface Board {
  pos: Pos[];
  faces: number[]; // face index per tile
  index: Map<string, number>;
  cols: number;
  rows: number;
}

/** Deal by playing backwards: repeatedly take two free tiles off the full
 *  layout and stamp them with the next pair's face — so a winning removal
 *  order (the reverse) always exists. */
function generateMahjong(seed: string, diff: Diff): Board {
  const layers = LAYOUTS[diff];
  const pos = positions(layers);
  const index = new Map(pos.map((p, i) => [`${p.l},${p.gx},${p.gy}`, i]));
  const rng = makeRng(`mahjong-${seed}`);

  // Pair faces: every face used at most twice (≤4 copies), shuffled.
  const pairFaces = shuffled(
    [...Array(FACES.length).keys(), ...Array(FACES.length).keys()],
    rng
  ).slice(0, pos.length / 2);

  for (;;) {
    const present = pos.map(() => true);
    const faces = Array(pos.length).fill(-1);
    let stuck = false;
    for (const face of pairFaces) {
      const free: number[] = [];
      for (let i = 0; i < pos.length; i++)
        if (present[i] && freeIn(pos, present, index, i)) free.push(i);
      if (free.length < 2) {
        stuck = true;
        break;
      }
      const a = free.splice(Math.floor(rng() * free.length), 1)[0];
      const b = free.splice(Math.floor(rng() * free.length), 1)[0];
      present[a] = present[b] = false;
      faces[a] = faces[b] = face;
    }
    if (!stuck)
      return { pos, faces, index, cols: layers[0][0], rows: layers[0][1] };
  }
}

interface SavedState {
  present: boolean[];
  done: boolean;
  won: boolean;
}

export default function Mahjong({ onExit }: { onExit: () => void }) {
  const { seed, diff, saved, commit, undo, canUndo, newPuzzle, playMs } =
    useGame<SavedState>("mahjong", (s, d) => ({
      present: generateMahjong(s, d).pos.map(() => true),
      done: false,
      won: false
    }));
  const board = useMemo(() => generateMahjong(seed, diff), [seed, diff]);
  const [selected, setSelected] = useState<number | null>(null);

  const { pos, faces, index } = board;
  const isFree = (i: number) => freeIn(pos, saved.present, index, i);
  const left = saved.present.filter(Boolean).length;

  /** Any matching pair among the free tiles? */
  function judge(next: SavedState) {
    if (next.present.every((p) => !p)) {
      next.done = true;
      next.won = true;
      recordResult("mahjong", true);
      return;
    }
    const freeFaces: number[] = [];
    for (let i = 0; i < pos.length; i++)
      if (next.present[i] && freeIn(pos, next.present, index, i))
        freeFaces.push(faces[i]);
    const counts = new Map<number, number>();
    for (const f of freeFaces) counts.set(f, (counts.get(f) ?? 0) + 1);
    if (![...counts.values()].some((c) => c >= 2)) {
      next.done = true;
      recordResult("mahjong", false);
    }
  }

  function tap(i: number) {
    if (saved.done || !saved.present[i] || !isFree(i)) return;
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (selected !== null && faces[selected] === faces[i]) {
      const present = saved.present.slice();
      present[selected] = present[i] = false;
      const next: SavedState = { ...saved, present };
      judge(next);
      commit(next);
      setSelected(null);
      return;
    }
    setSelected(i);
  }

  function startNew(d?: Diff) {
    newPuzzle(d);
    setSelected(null);
  }

  return (
    <div
      className="game game-mahjong"
      style={{ "--mjc": board.cols, "--mjr": board.rows } as CSSProperties}
    >
      <GameHeader title="Mahjong" onExit={onExit} onNew={() => startNew()} />
      <p className="game-hint">
        Match free pairs — nothing on top, an open left or right side.
      </p>
      <GameTools
        diff={diff}
        onDiff={startNew}
        help={HELP}
        onUndo={undo}
        canUndo={canUndo && !saved.done}
      />

      <div className="mj-board" role="group" aria-label="Mahjong board">
        {pos.map((p, i) => {
          if (!saved.present[i]) return null;
          const face = FACES[faces[i]];
          const free = isFree(i);
          return (
            <button
              key={i}
              className={[
                "mj-tile",
                `mj-hue${face.hue}`,
                free ? "" : "locked",
                selected === i ? "selected" : ""
              ].join(" ")}
              style={
                {
                  "--gx": p.gx,
                  "--gy": p.gy,
                  "--l": p.l
                } as CSSProperties
              }
              onClick={() => tap(i)}
              aria-label={`${face.main}${face.sub}${free ? "" : " (blocked)"}`}
            >
              <b>{face.main}</b>
              <i>{face.sub}</i>
            </button>
          );
        })}
      </div>

      <div className="lights-meta">
        <span>{left} tiles left</span>
      </div>

      {saved.done && (
        <Result
          key={seed}
          game="mahjong"
          won={saved.won}
          message={
            saved.won ? "Board cleared!" : `No matches left — ${left} tiles remained`
          }
          playMs={playMs}
          onNew={() => startNew()}
          onExit={onExit}
        />
      )}
    </div>
  );
}
