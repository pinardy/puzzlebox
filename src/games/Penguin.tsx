import { CellGame, type CellRules } from "./CellGame";

// Seven by seven with seven cells. The first card dealt — the beak — sets
// the rank every foundation starts from, and its three siblings are already
// home, so the foundations wrap through king back to ace.
const RULES: CellRules = {
  seedTag: "penguin",
  cols: [7, 7, 7, 7, 7, 7, 7],
  cells: 7,
  cellsFilled: 0,
  empty: "base-1",
  beak: true
};

const HELP =
  "The first card dealt is the beak: its three siblings start on the " +
  "foundations, and every foundation builds up in suit from that rank, " +
  "wrapping past the king round to the ace. Columns build DOWN IN SUIT, " +
  "seven cells each hold one card, and an emptied column accepts only a " +
  "card one rank BELOW the beak's rank. Release the beak, then bring all " +
  "fifty-two home.";

export default function Penguin({ onExit }: { onExit: () => void }) {
  return (
    <CellGame
      game="penguin"
      title="Penguin"
      hint="Foundations start at the beak's rank and wrap past the king."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `Penguin home in ${m} moves!`}
      onExit={onExit}
    />
  );
}
