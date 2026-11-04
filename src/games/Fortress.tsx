import { PileGame } from "./PileGame";
import type { PileRules } from "../lib/piles";

// Ten walls, and the tableau builds either way — but strictly in suit,
// which is what keeps it hard.
const RULES: PileRules = {
  layout: [6, 6, 5, 5, 5, 5, 5, 5, 5, 5],
  fit: "upDownSuit",
  empty: "any",
  seedTag: "fortress"
};

const HELP =
  "All fifty-two cards are dealt into ten walls. Only the exposed end card " +
  "moves, and it must go onto a card of the SAME SUIT exactly one rank " +
  "above or below it — either direction is fine. An empty wall takes any " +
  "single card. Foundations build up by suit from ace to king.";

export default function Fortress({ onExit }: { onExit: () => void }) {
  return (
    <PileGame
      title="Fortress"
      hint="End cards only, same suit, one rank up or down."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `Fortress fell in ${m} moves!`}
      onExit={onExit}
    />
  );
}
