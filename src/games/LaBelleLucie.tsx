import { PileGame } from "./PileGame";
import type { PileRules } from "../lib/piles";

// Seventeen fans of three and one lone card. Nothing fills an empty
// space, so the two shuffles are the only way out of a dead end.
const RULES: PileRules = {
  layout: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  fit: "downSuit",
  empty: "none",
  redeals: 2,
  seedTag: "lucie"
};

const HELP =
  "The pack is spread as seventeen fans of three plus one single card. " +
  "Only the exposed end card of a fan moves: onto another fan's end card " +
  "of the SAME SUIT one rank higher, or onto its suit's foundation as the " +
  "next rank up. Empty spaces are never filled — when you run dry, gather " +
  "every tableau card and shuffle again. You get two shuffles.";

export default function LaBelleLucie({ onExit }: { onExit: () => void }) {
  return (
    <PileGame
      title="La Belle Lucie"
      hint="Same suit, one rank down. Stuck? Shuffle — twice only."
      help={HELP}
      rules={RULES}
      grid
      wonMessage={(m) => `Beautifully done — ${m} moves!`}
      onExit={onExit}
    />
  );
}
