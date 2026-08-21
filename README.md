# PuzzleBox

A puzzle PWA — nine games, endless boards: word guess, sudoku, picross,
word search, lights out, minesweeper, queens, suns & moons, and zip.
Pick any game, play as many rounds as you like. Fully offline: puzzles
are generated **on-device** from random seeds, so nothing is ever
fetched at runtime.

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
