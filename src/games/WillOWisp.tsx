import { SpiderGame, type SpiderRules } from "./SpiderGame";

// Spiderette's kinder twin: seven threes, everything face-up from the
// start, and a fat deck to work through.
const RULES: SpiderRules = {
  seedTag: "wisp",
  cols: [3, 3, 3, 3, 3, 3, 3],
  allUp: true
};

const HELP =
  "Seven columns of three, every card face-up. Stack downward on any " +
  "column regardless of suit; only a same-suit descending run moves as a " +
  "unit, and only a same-suit K-to-A run clears. Clear all four runs to " +
  "win. The deck deals one card onto every column at a time — thirty-one " +
  "cards, so four full rows and a short one.";

export default function WillOWisp({ onExit }: { onExit: () => void }) {
  return (
    <SpiderGame
      game="wisp"
      title="Will o' the Wisp"
      hint="All face-up. Down by rank anywhere; same-suit runs travel together."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `Chased down in ${m} moves!`}
      onExit={onExit}
    />
  );
}
