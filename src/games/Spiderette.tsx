import { SpiderGame, type SpiderRules } from "./SpiderGame";

// Spider's rules on a Klondike staircase: 1-2-3-4-5-6-7, one pack.
const RULES: SpiderRules = {
  seedTag: "spiderette",
  cols: [1, 2, 3, 4, 5, 6, 7]
};

const HELP =
  "Spider with one pack on a Klondike deal. Stack cards downward on any " +
  "column regardless of suit, but only a same-suit descending run moves as " +
  "a unit, and only a same-suit K-to-A run clears off the board. Clear all " +
  "four to win. The deck deals one card onto every column at a time — " +
  "twenty-four cards, so four full rows.";

export default function Spiderette({ onExit }: { onExit: () => void }) {
  return (
    <SpiderGame
      title="Spiderette"
      hint="Down by rank anywhere; same-suit runs move together."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `Four runs cleared in ${m} moves!`}
      onExit={onExit}
    />
  );
}
