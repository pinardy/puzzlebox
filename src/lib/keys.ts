import { useEffect } from "react";

/** Desktop keyboard entry for numpad grids: digits set the selected cell,
 *  Backspace/Delete/0 erase, arrow keys move the selection (skipping cells
 *  where `isCell` says no — clue or given cells). */
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
  useEffect(() => {
    const total = cols * rows;
    const ok = (i: number) => (isCell ? isCell(i) : true);
    const h = (e: KeyboardEvent) => {
      const step: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -cols,
        ArrowDown: cols
      };
      if (e.key in step) {
        e.preventDefault();
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
      if (/^[1-9]$/.test(e.key)) {
        const v = Number(e.key);
        if (v <= max) setCell(selected, v);
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        setCell(selected, 0);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cols, rows, max, selected, setSelected, setCell, isCell]);
}
