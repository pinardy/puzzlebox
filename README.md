# PuzzleBox

A puzzle PWA — sixty-six games, endless boards: word guess, sudoku,
picross, word search, lights out, minesweeper, queens, suns & moons,
zip, 2048, pairs, fifteen, hangman, futoshiki, skyscrapers, hitori,
nurikabe, bridges, kenken, kropki, star battle, flow, tents & trees,
shikaku, battleships, slitherlink, kakuro, mastermind, towers of
hanoi, klondike, freecell, spider, anagram, masyu, light up,
dominoes, thermometers, suguru, sokoban, peg solitaire, yahtzee,
tripeaks, aquarium, galaxies, pipes, ball sort, samegame, math 24,
killer sudoku, equation guess, fill-a-pix, fillomino, yin-yang,
unblock, pyramid, golf, farkle, cryptogram, word ladder, a mini
crossword, yukon, scorpion, sujiko, untangle, str8ts, and mahjong. Pick any game, play as many rounds as
you like. Fully offline: puzzles are generated **on-device** from
random seeds, so nothing is ever fetched at runtime.

## Games

| Game | Rules | Board |
|---|---|---|
| **Word Guess** | Guess the word in 6 tries | 730 curated answers; 4-letter Easy, binding-hints Hard |
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
| **Towers of Hanoi** | Rebuild the tower, big never on small | 5–7 disks by difficulty |
| **Solitaire** | Klondike, tap-to-move | Draw-1 or draw-3; three passes on Hard |
| **FreeCell** | All face-up, spare cells | 4/3/2 free cells by difficulty, supermove sizing |
| **Spider** | Clear eight same-suit K→A runs | 1/2/4 suits by difficulty |
| **Anagram** | Unscramble a five-letter word | Seeded pick, letter-lock hints |
| **Masyu** | One loop obeying black/white pearls | Loop from a grown blob boundary |
| **Light Up** | Bulbs light all cells, never each other | Bulbs placed first; numbered walls |
| **Dominoes** | Re-draw the hidden domino set | Backtracking tiling, full pair set |
| **Thermometers** | Fill from the bulb to match counts | Hamiltonian path cut into thermos |
| **Suguru** | 1..N per region, no touching twins | Region growth + backtracking fill |
| **Sokoban** | Push crates onto goals | Reverse-play generation, always solvable |
| **Peg Solitaire** | Jump pegs down to one | Classic English cross board |
| **Yahtzee** | 13 rounds of dice, chase a high score | Seeded deterministic dice stream |
| **TriPeaks** | Clear the peaks one rank at a time | A–K wrap on Easy, shorter deck on Hard |
| **Aquarium** | Flood tanks; water obeys gravity | Region growth + level choice |
| **Galaxies** | 180°-symmetric regions around dots | Symmetric-pair region growth |
| **Pipes (Net)** | Rotate tiles into one sealed network | Random spanning tree, scrambled |
| **Ball Sort** | Pour tubes to one colour each | Seeded deals, two spare tubes |
| **SameGame** | Pop groups, chase the clear bonus | Seeded boards, (n−2)² scoring |
| **Math 24** | Reach 24 with +−×÷ | Brute-force-verified solvable deals |
| **Killer Sudoku** | Sudoku with dotted sum cages | 9×9; cages grown over a solved grid |
| **Equation** | Guess the 8-char equation, wordle-style | Generated + verified per seed |
| **Fill-a-Pix** | Clues count painted cells in their 3×3 | 8–12 px; smoothed random picture |
| **Fillomino** | Same-number groups sized to match | Region growth + same-size merge repair |
| **Yin-Yang** | Two connected colours, no 2×2 | Tree-polyomino growth, always valid |
| **Unblock** | Slide the red car out | BFS-graded deals; par shown |
| **Pyramid** | Pair to 13, kings alone | Seeded deals; redeals scale with difficulty |
| **Golf** | Rank up/down onto the waste | Seeded 7×5 course; A–K wrap on Easy |
| **Farkle** | Bank dice points before you bust | Seeded dice; target score by difficulty |
| **Cryptogram** | Crack a substitution cipher | 100 bundled proverbs, deranged mapping |
| **Word Ladder** | Morph one word into another | BFS over a 1,500-word list; par + 2 moves |
| **Mini Crossword** | 5×5 clued crossword | MRV backtracking fill, ~1,000 clued words |
| **Yukon** | Klondike with no deck; move any face-up group | All 52 dealt, seeded |
| **Scorpion** | Build down by suit, grab any face-up card | 7×7 + 3 reserve; clear four K→A runs |
| **Sujiko** | 1–9 once; circles are quadrant sums | Unique solution enforced by search |
| **Untangle** | Drag dots until no lines cross | Greedy planar graph, circle-scrambled |
| **Str8ts** | White runs are consecutive sets | 6×6/7×7, symmetric blacks, DFS-filled |
| **Mahjong** | Match free pairs, clear the layers | Reverse-dealt — a winning order always exists |

The current puzzle of each game (its seed, difficulty, progress, and play
time) persists in `localStorage`, so leaving and returning resumes where
you left off. **New** in a game's header deals a fresh board; solve
counts accumulate per game.

## UX features

- **Undo** (20 steps) in every game where it makes sense, via a shared
  `useGame` hook that also tracks active play time.
- **Hints** (💡) in the solution-backed games — Sudoku, Killer Sudoku,
  Picross, Fill-a-Pix, Fillomino, Futoshiki, Skyscrapers, KenKen,
  Kropki, Kakuro, Suguru, Cryptogram, the Mini Crossword, Sujiko, and
  Str8ts — reveal
  one cell; hinted solves still count, but never set a best time or
  extend a streak.
- **Streaks & best times**: per-game win streaks, longest streak, a
  fastest-solve time per difficulty, and per-difficulty play splits —
  all surfaced on the win banner ("★ New best time!").
- **Back-button navigation & deep links**: the view lives in the URL
  hash (`#/game/sudoku`, `#/cat/logic`), so Android/browser back
  returns to the hub instead of closing the app, and any game can be
  bookmarked.
- **Search** across all 66 games from the hub, by name or tagline.
- **Sound effects** — tiny WebAudio jingles on win/lose/hint, no audio
  assets so the app stays fully offline; mute toggle in the hub header,
  remembered across visits.
- **Difficulty picker** (Easy / Medium / Hard) on 59 of the 66 games —
  board sizes, clue counts, and fleets scale with it.
- **Win banner** with time, lifetime stats, haptic feedback, and
  New puzzle / All games actions.
- **Drag-to-paint** in Picross, Nurikabe, Tents, Battleships, and Hitori
  (a whole stroke is one undo step).
- **Keyboard play** on desktop: digits, arrows, and Backspace in all six
  number-grid games; arrows/letters in 2048, Word Guess, Hangman.
- **Minesweeper**: long-press (or right-click) to flag, chording on
  satisfied numbers.
- **2048**: animated tile slides, merges, and spawns via identity-keyed
  tiles.
- **Solitaire**: one-tap auto-finish once everything is face-up.
- **Rules help** (`? Rules`) on every logic puzzle, a categorised hub
  with a "Jump back in" row, and full dark-mode support via
  `prefers-color-scheme`. Word Guess accepts any five letters as a
  guess — a wrong word costs a try instead of being rejected.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build in dist/
npm run preview    # serve the production build locally
npm run lint       # ESLint (also runs in CI before deploys)
npm run format     # Prettier over src/
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
