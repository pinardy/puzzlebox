import { useEffect, useLayoutEffect, useRef } from "react";

/** How long a typed digit waits for a second one when `max` > 9. */
const MULTI_DIGIT_MS = 900;

/** Desktop keyboard entry for numpad grids: digits set the selected cell,
 *  Backspace/Delete/0 erase, arrow keys move the selection (skipping cells
 *  where `isCell` says no — clue or given cells).
 *
 *  When `max` is above 9 (Magic Square, Hidato, Numbrix), numbers take
 *  more than one key: a digit that could still start a larger number waits
 *  briefly for the next one ("1" then "2" places 12), and is placed on its
 *  own after a pause, when another key is pressed, or straight away once no
 *  further digit could fit. A leading "0" still erases. Boards with `max`
 *  of 9 or less behave exactly as before. */
export function useGridKeys(opts: {
  cols: number;
  rows: number;
  max: number;
  selected: number | null;
  setSelected: (i: number) => void;
  setCell: (idx: number, val: number) => void;
  isCell?: (idx: number) => boolean;
}) {
  const { cols, rows, max, selected, setSelected, setCell, isCell } = opts;
  // The digits typed so far toward a multi-digit number, and where.
  const pending = useRef<{ cell: number; text: string; timer: number } | null>(null);
  const write = useRef(setCell);
  useLayoutEffect(() => {
    write.current = setCell;
  });
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = null;
    },
    []
  );

  useEffect(() => {
    const total = cols * rows;
    const ok = (i: number) => (isCell ? isCell(i) : true);
    /** Place whatever is pending (`keep` false drops it instead). */
    const flush = (keep = true) => {
      const p = pending.current;
      if (!p) return;
      clearTimeout(p.timer);
      pending.current = null;
      if (keep) write.current(p.cell, Number(p.text));
    };
    const typeDigit = (cell: number, d: string) => {
      const p = pending.current;
      let text = d;
      if (p && p.cell === cell && Number(p.text + d) <= max) text = p.text + d;
      else flush();
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = null;
      const v = Number(text);
      if (v === 0) {
        setCell(cell, 0);
        return;
      }
      if (v > max) return;
      if (v * 10 > max) {
        setCell(cell, v);
        return;
      }
      pending.current = {
        cell,
        text,
        timer: window.setTimeout(() => flush(), MULTI_DIGIT_MS)
      };
    };
    const h = (e: KeyboardEvent) => {
      const step: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -cols,
        ArrowDown: cols
      };
      if (e.key in step) {
        e.preventDefault();
        flush();
        if (selected === null) {
          const first = [...Array(total).keys()].find(ok);
          if (first !== undefined) setSelected(first);
          return;
        }
        let i = selected;
        do i += step[e.key];
        while (i >= 0 && i < total && !ok(i));
        if (i >= 0 && i < total) setSelected(i);
        return;
      }
      if (selected === null) return;
      if (max > 9 && /^[0-9]$/.test(e.key)) {
        typeDigit(selected, e.key);
      } else if (/^[1-9]$/.test(e.key)) {
        const v = Number(e.key);
        if (v <= max) setCell(selected, v);
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        flush(false);
        setCell(selected, 0);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cols, rows, max, selected, setSelected, setCell, isCell]);
}

/** The accessible name of a grid cell: its position, its value (or
 *  "empty"), then any extra facts. Falsy entries are skipped, so callers
 *  can write `given && "given"`. */
export function cellLabel(
  i: number,
  cols: number,
  value: number | string | null | undefined,
  ...extra: (string | false | 0 | null | undefined)[]
): string {
  const head = `Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}`;
  return [head, value ? String(value) : "empty", ...extra.filter(Boolean)].join(", ");
}

/** "notes 1 4 7" for a cell's pencil marks, or null when it has none. */
export function notesLabel(notes: readonly number[] | undefined): string | null {
  return notes && notes.length
    ? `notes ${[...notes].sort((a, b) => a - b).join(" ")}`
    : null;
}
