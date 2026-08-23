import { PileGame } from "./PileGame";
import type { PileRules } from "../lib/piles";

// Beleaguered Castle's open cousin: the aces are dealt with everything
// else, so the whole pack sits in the eight fans and the foundations
// start bare.
const RULES: PileRules = {
  layout: [7, 7, 7, 7, 6, 6, 6, 6],
  fit: "downAny",
  empty: "any",
  seedTag: "streets"
};

const HELP =
  "The whole pack is dealt into eight fans — four of seven, four of six — " +
  "and the foundations start empty. Only the exposed card at the end of a " +
  "fan may be moved: onto another fan's end card one rank higher (suit and " +
  "colour do not matter), or onto its suit's foundation as the next rank " +
  "up. An empty fan takes any single card. Build all four suits ace to king.";

export default function StreetsAlleys({ onExit }: { onExit: () => void }) {
  return (
    <PileGame
      game="streets"
      title="Streets & Alleys"
      hint="Tap the end card of a fan, then a green target. Build down by rank."
      help={HELP}
      rules={RULES}
      wonMessage={(m) => `Streets cleared in ${m} moves!`}
      onExit={onExit}
    />
  );
}
