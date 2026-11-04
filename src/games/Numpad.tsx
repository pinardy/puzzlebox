/** The digit pad under the number grids: 1…max, then a notes toggle (if
 *  the game has pencil marks) and erase. `remaining`, when given, shows
 *  how many of each digit are still to place and disables a digit that is
 *  used up (unless notes are on — pencilling a used digit is fine).
 *  Erasing calls `onDigit(0)`, matching the games' "0 clears" convention. */
export function Numpad({
  max,
  onDigit,
  remaining,
  notes
}: {
  max: number;
  onDigit: (d: number) => void;
  remaining?: (d: number) => number;
  notes?: { on: boolean; toggle: () => void };
}) {
  // Nine digits plus erase fill two rows of five; anything else uses the
  // default six-across grid.
  const wide = max === 9 && !notes;
  return (
    <div className={`numpad${wide ? " numpad-9" : ""}`}>
      {Array.from({ length: max }, (_, k) => k + 1).map((d) => {
        const left = remaining?.(d);
        return (
          <button
            key={d}
            className="num-key"
            disabled={left !== undefined && left <= 0 && !notes?.on}
            onClick={() => onDigit(d)}
          >
            {d}
            {left !== undefined && <small>{left > 0 ? left : ""}</small>}
          </button>
        );
      })}
      {notes && (
        <button
          className={`num-key tool${notes.on ? " active" : ""}`}
          onClick={notes.toggle}
          aria-pressed={notes.on}
        >
          ✏️<small>notes</small>
        </button>
      )}
      <button className="num-key tool" onClick={() => onDigit(0)} aria-label="Erase">
        ⌫{notes && <small>erase</small>}
      </button>
    </div>
  );
}
