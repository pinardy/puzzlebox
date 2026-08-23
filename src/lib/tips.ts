/** Gestures the board doesn't advertise. Shown once, the first time you
 *  open the game, because a hold-to-flag nobody discovers may as well not
 *  be there — the rules text alone is where these went to die.
 *
 *  Only games with a genuinely hidden second gesture belong here. A game
 *  whose every move is a plain tap doesn't need a tip. */

import { GameId } from "./storage";

export const TIPS: Partial<Record<GameId, string>> = {
  // Hold to cycle a multi-state cell the other way round.
  mines: "Hold a cell — or right-click — to flag a mine.",
  slant: "Hold a cell to cycle the diagonal backwards.",
  tracks: "Hold a cell to cycle the track piece backwards.",
  magnets: "Hold a cell to cycle the sign backwards.",

  // Drag to repeat one mark across many cells.
  picross: "Drag across the grid to fill a whole run at once.",
  hitori: "Drag across the grid to shade several cells at once.",
  nurikabe: "Drag across the grid to mark several cells at once.",
  aquarium: "Drag across the grid to fill several cells at once.",
  fillapix: "Drag across the grid to paint several cells at once.",
  tents: "Drag across the grid to mark several cells at once.",
  ships: "Drag across the grid to mark several cells at once.",
  galaxies: "Drag across the grid to claim several cells at once.",

  // Drag as the primary gesture.
  flow: "Drag from a dot to draw its pipe.",
  zip: "Drag through the squares to draw the path.",
  untangle: "Drag the dots to untangle the lines.",
  unblock: "Drag a car along its own lane.",
  "2048": "Swipe the board, or use the arrow keys."
};
