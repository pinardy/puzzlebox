import { useRef, type PointerEvent } from "react";
import { useGridNav } from "./gridnav";

/** The index of the grid cell under a screen point. Cells opt in with a
 *  `data-cell={i}` attribute. */
export function cellAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest("[data-cell]");
  const v = el instanceof HTMLElement ? el.dataset.cell : undefined;
  return v === undefined ? null : Number(v);
}

/** Pointer handlers for dragging across a grid: spread the result on the
 *  grid element and give each cell `data-cell={i}`. `onStart` fires on the
 *  cell pressed (return false to ignore the press), `onEnter` on every new
 *  cell the drag reaches, and `onEnd` when the pointer lifts. Capturing
 *  the pointer keeps the stroke alive when it leaves the grid.
 *
 *  The grid is keyboard-playable too (see `useGridNav`): arrows move
 *  between cells, and Enter / Space call `onKey` — a pointer drag never
 *  fires for a key press, so a board that acts on pointers must say what
 *  a key press does. */
export function useCellDrag(opts: {
  onStart: (i: number) => boolean | void;
  onEnter: (i: number) => void;
  onEnd?: () => void;
  onKey?: (i: number, alt: boolean) => void;
}) {
  const nav = useGridNav(opts.onKey);
  const last = useRef<number | null>(null);
  const end = () => {
    if (last.current === null) return;
    last.current = null;
    opts.onEnd?.();
  };
  return {
    ...nav,
    onPointerDown(e: PointerEvent<HTMLElement>) {
      const i = cellAt(e.clientX, e.clientY);
      if (i === null || opts.onStart(i) === false) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      last.current = i;
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      if (last.current === null) return;
      const i = cellAt(e.clientX, e.clientY);
      if (i === null || i === last.current) return;
      last.current = i;
      opts.onEnter(i);
    },
    onPointerUp: end,
    onPointerCancel: end
  };
}

/** Drag-to-paint for mark grids: pressing a cell picks the mark it cycles
 *  to (`next`, or null to ignore the press), and the drag then paints that
 *  same mark over every cell it crosses. `paint` gets `undoable` true only
 *  for the first cell, so a whole stroke is one undo step. Enter / Space on
 *  a focused cell paints just that cell. */
export function useDragPaint<M>(
  next: (i: number) => M | null,
  paint: (i: number, mark: M, undoable: boolean) => void
) {
  const mark = useRef<M | null>(null);
  return useCellDrag({
    onStart(i) {
      const m = next(i);
      if (m === null) return false;
      mark.current = m;
      paint(i, m, true);
    },
    onEnter(i) {
      if (mark.current !== null) paint(i, mark.current, false);
    },
    onEnd() {
      mark.current = null;
    },
    // A key press is a one-cell stroke.
    onKey(i) {
      const m = next(i);
      if (m !== null) paint(i, m, true);
    }
  });
}

/** `useDragPaint` over a plain array of per-cell marks, the shape most
 *  mark grids save. `next` picks the mark a press paints (null ignores
 *  the press). The stroke then paints it over every cell it crosses
 *  whose mark differs, skipping `locked` cells (givens, clues), and hands
 *  each new array to `write`; `undoable` is true only for the pressed
 *  cell, so the whole stroke is one undo step. */
export function useMarkPaint<M>(opts: {
  marks: readonly M[];
  next: (i: number) => M | null;
  write: (marks: M[], undoable: boolean) => void;
  locked?: (i: number) => boolean;
}) {
  const { marks, next, write, locked } = opts;
  return useDragPaint<M>(
    (i) => (locked?.(i) ? null : next(i)),
    (i, m, undoable) => {
      if (locked?.(i) || (!undoable && marks[i] === m)) return;
      const out = marks.slice();
      out[i] = m;
      write(out, undoable);
    }
  );
}
