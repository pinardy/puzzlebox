import { PileGame } from "./PileGame";
import type { PileRules } from "../lib/piles";

// La Belle Lucie with the aces already home: sixteen fans of three, and
// a real chance of finishing.
const RULES: PileRules = {
  layout: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  fit: "downSuit",
  empty: "none",
  acesHome: true,
  redeals: 2,
  seedTag: "trefoil"
};

const HELP =
  "The four aces start on their foundations and the remaining forty-eight " +
  "cards form sixteen fans of three. Only a fan's exposed end card moves: " +
  "onto another end card of the SAME SUIT one rank higher, or onto its " +
  "foundation as the next rank up. Empty spaces stay empty; two shuffles " +
  "gather and re-deal the tableau when you stall.";

export default function Trefoil({ onExit }: { onExit: () => void }) {
  return (
    <PileGame
      game="trefoil"
      title="Trefoil"
      hint="Aces are home already. Same suit, one rank down."
      help={HELP}
      rules={RULES}
      grid
      wonMessage={(m) => `Trefoil complete in ${m} moves!`}
      onExit={onExit}
    />
  );
}
