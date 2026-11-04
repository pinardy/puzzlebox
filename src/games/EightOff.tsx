import { CellGame, type CellRules } from "./CellGame";

// Eight columns of six, eight cells — four of them dealt full, which is
// the whole game: those four cards have to come out before you can breathe.
const RULES: CellRules = {
  seedTag: "eightoff",
  cols: [6, 6, 6, 6, 6, 6, 6, 6],
  cells: 8,
  cellsFilled: 4,
  empty: "king"
};

const HELP =
  "Forty-eight cards fill eight columns and the last four sit in four of " +
  "the eight cells. Columns build DOWN IN SUIT; each cell holds one card; " +
  "only a king may start an empty column. A same-suit run moves as a unit " +
  "when enough cells and empty columns exist to shift it card by card. " +
  "Build the foundations up by suit from ace to king.";

export default function EightOff({ onExit }: { onExit: () => void }) {
  return (
    <CellGame
      title="Eight Off"
      hint="Build down in suit. Tap a run, then its destination."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `All eight off in ${m} moves!`}
      onExit={onExit}
    />
  );
}
