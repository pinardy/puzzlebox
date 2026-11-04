import { CellGame, type CellRules } from "./CellGame";

// Ten narrow towers of five, four cells with two already taken. Kings are
// the only thing that opens a column, and they start buried — that is the
// puzzle.
const RULES: CellRules = {
  seedTag: "seahaven",
  cols: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  cells: 4,
  cellsFilled: 2,
  empty: "king"
};

const HELP =
  "Ten towers of five, plus two cards parked in the four cells. Towers " +
  "build DOWN IN SUIT and only a king may fill an emptied tower, so " +
  "digging the kings out early is everything. A same-suit run moves as a " +
  "unit when the free cells and empty towers can carry it. Foundations go " +
  "up by suit from ace to king.";

export default function Seahaven({ onExit }: { onExit: () => void }) {
  return (
    <CellGame
      title="Seahaven Towers"
      hint="Down in suit; only kings open an empty tower."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `Towers cleared in ${m} moves!`}
      onExit={onExit}
    />
  );
}
