import {
  useCallback,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent
} from "react";

const DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
};

const cellsOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-cell]"));

/** Keyboard play for a grid of `data-cell={i}` elements. Spread the result
 *  on the grid element:
 *
 *  - Tab enters the grid once, at the last cell used (a roving tabindex),
 *    instead of stepping through every square.
 *  - Arrow keys move focus to the nearest cell in that direction *on
 *    screen*, so clue cells, gaps, offset rows and hexes need no geometry
 *    from the game.
 *  - Enter / Space call `onActivate(i)` when given (boards driven by pointer
 *    events, which a key press doesn't fire); otherwise the cell's own
 *    click handler runs as usual. `onActivate(i, true)` is the
 *    Shift-modified press, for boards with a second action (flag, cycle
 *    backwards).
 *
 *  Cells that are `<div>`s get `tabIndex` and `role` from here too. */
export function useGridNav(onActivate?: (i: number, alt: boolean) => void) {
  const node = useRef<HTMLElement | null>(null);
  // A callback ref, so it fits whatever element the grid is (div, svg…).
  const ref = useCallback((el: HTMLElement | null) => {
    node.current = el;
  }, []);
  const active = useRef<number | null>(null);

  // Runs after every render: cells come and go as the board changes, so
  // keep exactly one of them in the tab order.
  useLayoutEffect(() => {
    const root = node.current;
    if (!root) return;
    const cells = cellsOf(root);
    if (!cells.length) return;
    const current =
      cells.find((c) => Number(c.dataset.cell) === active.current) ?? cells[0];
    for (const c of cells) {
      c.tabIndex = c === current ? 0 : -1;
      if (!c.getAttribute("role") && c.tagName !== "BUTTON")
        c.setAttribute("role", "button");
    }
  });

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const root = node.current;
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!root || !from || !root.contains(from)) return;
    const i = Number(from.dataset.cell);

    if ((e.key === "Enter" || e.key === " ") && onActivate) {
      e.preventDefault();
      onActivate(i, e.shiftKey);
      return;
    }
    const dir = DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2,
      ay = a.top + a.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const c of cellsOf(root)) {
      if (c === from) continue;
      const b = c.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax,
        dy = b.top + b.height / 2 - ay;
      const along = dx * dir[0] + dy * dir[1];
      if (along < 1) continue; // not in that direction
      const across = Math.abs(dx * dir[1] + dy * dir[0]);
      // Stay in the row/column: drift sideways costs far more than distance.
      const score = along + across * 4;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      from.tabIndex = -1;
      best.tabIndex = 0;
      active.current = Number(best.dataset.cell);
      best.focus();
    }
  }

  function onFocus(e: FocusEvent<HTMLElement>) {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (cell) active.current = Number(cell.dataset.cell);
  }

  return { ref, onKeyDown, onFocus };
}
