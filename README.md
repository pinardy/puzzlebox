# PuzzleBox

A puzzle PWA — thirty games, endless boards: word guess, sudoku,
picross, word search, lights out, minesweeper, queens, suns & moons,
zip, 2048, pairs, fifteen, hangman, futoshiki, skyscrapers, hitori,
nurikabe, bridges, kenken, kropki, star battle, flow, tents & trees,
shikaku, battleships, slitherlink, kakuro, mastermind, towers of
hanoi, and klondike solitaire. Pick any game, play as many rounds as
you like. Fully offline: puzzles are generated **on-device** from
random seeds, so nothing is ever fetched at runtime.

## Games

| Game | Rules | Board |
|---|---|---|
| **Word Guess** | Guess the 5-letter word in 6 tries | Random pick from 360 curated answers |
| **Sudoku** | Classic 9×9, unique solution guaranteed | Medium difficulty (~34 clues) |
| **Picross** | Fill cells to satisfy run clues | 10×10 |
| **Word Search** | Tap first + last letter to select | 7 words, 8 directions |
| **Lights Out** | Turn every light off | 5×5, 8-press scramble; always solvable |
| **Minesweeper** | Clear the field; first tap is safe | 9×9, 13 mines |
| **Queens** | One crown per row/column/colour, none touching | 8×8; unique solution |
| **Suns & Moons** | Balance two symbols, no three in a row | 6×6; unique fill |
| **Zip** | One line through every square, numbers in order | 6×6; solvable by construction |
| **2048** | Swipe to merge equal tiles, reach 2048 | 4×4; deterministic spawns per seed |
| **Pairs** | Flip two cards, find every match | 4×4, 8 symbol pairs |
| **Fifteen** | Slide tiles into 1–15 order | 4×4; scrambled by legal moves, always solvable |
| **Hangman** | Guess the word letter by letter | 6 lives, 5-letter answers |
| **Futoshiki** | Latin square with inequality arrows | 5×5, 10 arrows, 3 givens |
| **Skyscrapers** | Latin square with visibility clues | 5×5, all 20 edge clues |
| **Hitori** | Shade duplicates: no touching, rest connected | 6×6; built from a Latin square |
| **Nurikabe** | Fill a connected sea around sized islands | 7×7; constraint-repair generator |
| **Bridges** | Link islands with 1–2 bridges, no crossings | 7×7, ~9 islands; connected by construction |
| **KenKen** | Latin square with arithmetic cages | 5×5, cages of 1–3 cells |
| **Kropki** | Latin square with consecutive/double dots | 5×5, full negative constraint |
| **Star Battle** | 2 stars per row/column/region, none touching | 8×8, 8 regions; carved around a placed solution |
| **Flow** | Join dot pairs, fill every square | 6×6, 6 pipes; cut from one Hamiltonian path |
| **Tents & Trees** | Tent beside every tree, none touching | 8×8, 10 tents; matching-verified win |
| **Shikaku** | Boxes matching their area clue | 8×8; recursive rectangle partition |
| **Battleships** | Find the straight, non-touching fleet | 8×8, fleet 4·33·22·111, 4 revealed cells |
| **Slitherlink** | One loop matching edge-count clues | 5×5; loop = boundary of a grown blob |
| **Kakuro** | Crossword sums, unique digits per run | 7×7, runs of 2–5 |
| **Mastermind** | Crack the colour code from peg feedback | 6 colours, length 4, 10 guesses |
| **Towers of Hanoi** | Rebuild the tower, big never on small | 5–7 disks by seed |
| **Solitaire** | Klondike, draw-1, tap-to-move | Seeded deals |

The current puzzle of each game (its seed plus your progress) persists in
`localStorage`, so leaving and returning resumes where you left off.
**New** in a game's header deals a fresh board; solve counts accumulate
per game.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build in dist/
npm run preview    # serve the production build locally
```

> **PWA note:** service workers require a secure context. `npm run preview`
> on `localhost` counts as secure; in production, serve `dist/` over HTTPS.
> After the first visit, the app is fully installable and works with the
> network disabled (airplane-mode friendly).

## How offline works

- `vite-plugin-pwa` (Workbox `generateSW`) precaches **every** built asset
  at install time — HTML, JS, CSS, icons (~180 KB total).
- Puzzle content is deterministic per seed: a `mulberry32` PRNG seeded with
  a random string generates each board, and the seed is stored with the
  save so an in-progress puzzle survives reloads. No API, no fetch.
- `registerType: "autoUpdate"` — returning players get new builds silently
  next launch.

## Architecture

```
src/
  lib/
    rng.ts       seeded RNG + seed minting shared by all games
    sudoku.ts    backtracking generator + uniqueness-counting solver
    words.ts     360 curated answers + duplicate-aware guess scoring
    storage.ts   typed localStorage: current-puzzle slots + solve stats
  games/
    Wordle.tsx   grid, on-screen + hardware keyboard, key-state colouring
    Sudoku.tsx   notes mode, conflict highlighting, remaining-digit counts
    Picross.tsx  fill/cross tools, live clue satisfaction dimming
    WordSearch.tsx tap-two-ends selection, overlap-aware placement
    LightsOut.tsx  solvable-by-construction scramble, move counter
    Mines.tsx      first-tap-safe mine layout, flood reveal, flag mode
    Queens.tsx     region-coloured board, conflict highlighting
    Tango.tsx      cycle suns/moons, live rule-violation marking
    Zip.tsx        drag-to-draw path, checkpoint order enforced, rewind
  App.tsx        hub: game cards with continue/play-again state + solve counts
```

## Performance notes

- Queens generation retries random crown placements + region growth
  until the layout has a unique solution, verified unique across
  benchmark boards.
- Sudoku generation uses a precomputed 20-peer table (O(20) constraint
  checks vs O(81) scans), a few ms per board.
- Each game is a lazy-loaded chunk (1–4 KB); the hub paints without
  parsing any game code. The service worker still precaches all chunks,
  so offline behaviour is unchanged.

## Extending

- **Add a game:** implement `({ onExit }) => JSX`, register a card in
  `App.tsx`, use `loadSlot`/`saveSlot`/`recordResult` with a new `GameId`.
- **Guess dictionary:** guesses are currently shape-validated (any 5
  letters). To enforce a dictionary, add a word set and check it in
  `Wordle.tsx → submit()`.
- **Difficulty settings:** every generator takes a size/removal parameter —
  expose a picker and store the choice alongside the seed.
