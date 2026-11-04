# PuzzleBox

A puzzle PWA — one hundred and nineteen games, endless boards: word guess, sudoku,
picross, word search, lights out, minesweeper, queens, suns & moons,
zip, 2048, pairs, fifteen, hangman, futoshiki, skyscrapers, hitori,
nurikabe, bridges, kenken, kropki, star battle, flow, tents & trees,
shikaku, battleships, slitherlink, kakuro, mastermind, towers of
hanoi, klondike, freecell, spider, anagram, masyu, light up,
dominoes, thermometers, suguru, sokoban, peg solitaire, yahtzee,
tripeaks, aquarium, galaxies, pipes, ball sort, samegame, math 24,
killer sudoku, equation guess, fill-a-pix, fillomino, yin-yang,
unblock, pyramid, golf, farkle, cryptogram, word ladder, a mini
crossword, yukon, scorpion, sujiko, untangle, str8ts, mahjong, numbrix,
jigsaw sudoku, sandwich, kakurasu, knight's tour, norinori, heyawake,
flood it, dots & boxes, forty thieves, baker's dozen, accordion, aces up,
canfield, spelling bee, waffle, boggle, letter boxed, sumplete, suko,
hidato, magic square, train tracks, slant, magnets, yajilin, LITS, ripple
effect, gaps, beleaguered castle, nim, tapa, kurodoko, cave, codeword,
typeshift, and seventeen more solitaires — eight off, seahaven towers,
penguin, spiderette, will o' the wisp, streets & alleys, fortress, la belle
lucie, trefoil, russian solitaire, whitehead, agnes, monte carlo, clock,
osmosis, calculation, and poker solitaire. Pick any game, play as many rounds as
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
| **2048** | Swipe to merge equal tiles, reach the target | 5×5/4×4/3×3 by difficulty; deterministic spawns |
| **Pairs** | Flip two cards, find every match | 4×4, 8 symbol pairs |
| **Fifteen** | Slide tiles into 1–15 order | 4×4; scrambled by legal moves, always solvable |
| **Hangman** | Guess the word letter by letter | 8/6/5 lives; short brutal words on Hard |
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
| **Anagram** | Unscramble the word | 4- or 5-letter by difficulty; 3 attempts on Hard |
| **Masyu** | One loop obeying black/white pearls | Loop from a grown blob boundary |
| **Light Up** | Bulbs light all cells, never each other | Bulbs placed first; numbered walls |
| **Dominoes** | Re-draw the hidden domino set | Backtracking tiling, full pair set |
| **Thermometers** | Fill from the bulb to match counts | Hamiltonian path cut into thermos |
| **Suguru** | 1..N per region, no touching twins | Region growth + backtracking fill |
| **Sokoban** | Push crates onto goals | Reverse-play generation, always solvable |
| **Peg Solitaire** | Jump pegs down to one | Triangle-15, English cross, or centre-finish |
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
| **Numbrix** | Chain 1…N through every square | Snake path from the Zip generator, numbered |
| **Jigsaw Sudoku** | Sudoku with irregular regions | Box-swap partition, unique solution enforced |
| **Sandwich** | Sudoku plus between-the-1-and-9 sums | Clues read off a solved grid |
| **Kakurasu** | Shade cells so weighted lines hit their totals | 5×5–7×7, clues from a random shading |
| **Knight's Tour** | Visit every square by knight move | Start squares verified tourable; hint completes |
| **Norinori** | Two shaded per region, all in dominoes | Domino-seeded regions — solvable by construction |
| **Heyawake** | Numbered rooms, no touching shaded cells | Rectangle rooms + pruned shading search |
| **Flood It** | Swallow the board from the corner | Budget set from a greedy solve, so always winnable |
| **Dots & Boxes** | Close boxes against an opponent | Chain-aware AI; difficulty picks its strength |
| **Forty Thieves** | Two packs, build down in suit | Seeded deals, one-card moves, no redeal |
| **Baker's Dozen** | Thirteen columns, no stock | Kings buried at deal; empty columns stay empty |
| **Accordion** | Squeeze 52 piles into one | Move one or three places left on suit or rank |
| **Aces Up** | Discard low cards, leave four aces | Seeded deals, four piles |
| **Canfield** | Wrapping foundations from a random base | 13-card reserve, draw-three with redeals |
| **Spelling Bee** | Words of 4+ letters, all using the centre letter | Seven-letter pangram sets; Genius at 70% of the score |
| **Waffle** | Swap letters until all six words read true | 5×5 lattice, 15 swaps; scramble depth by difficulty |
| **Boggle** | Trace adjacent letters, three or more | Standard Boggle dice; target is a share of the board |
| **Letter Boxed** | Use all twelve letters, changing side each step | Two-word chains; sides fixed by graph colouring |
| **Sumplete** | Cross numbers out so every line hits its total | 4/6/8; solvable by construction |
| **Suko** | Nine digits, four circled sums, colour totals | 3×3; brute-forced to a unique solution |
| **Hidato** | Consecutive numbers touch — diagonals count | 5/6/7; Warnsdorff king-move path |
| **Magic Square** | Every row, column and diagonal on one total | 3×3 and 4×4; unique solution guaranteed |
| **Train Tracks** | One line, matching the row and column counts | 5/6/7; any line obeying the rules wins |
| **Slant** | A diagonal per cell, corner counts, no loops | 5/7/9; union-find keeps the board loop-free |
| **Magnets** | Domino magnets, no two like poles adjacent | 6/8/10; clues withheld as difficulty rises |
| **Yajilin** | One loop; arrows count the shaded cells | 6/8/10; loop grown by bumping out a small cycle |
| **LITS** | One L, I, T or S tetromino in every region | 6/8/10; pieces seeded, then regions grown around them |
| **Ripple Effect** | Rooms hold 1..n; equal numbers keep their distance | 5/6/7; unique solution |
| **Gaps** | Order every row 2→K into the four gaps | 4×13 deal, two redeals |
| **Beleaguered Castle** | Build A→K; the tableau descends in any suit | Eight piles of six, four aces up |
| **Nim** | Take the last counter to win | 3–5 heaps; a perfect opponent, always a winnable deal |
| **Tapa** | One connected wall, no solid 2×2; clues count neighbour runs | 6/8/9; grown wall, ~18 clues, any legal answer wins |
| **Kurodoko** | Numbers count the white cells in sight | 7/8/9; blacks placed keeping whites connected |
| **Cave** | One cave holding every clue, no sealed rock | 7/8/9; rock eaten inwards from the border |
| **Codeword** | Numbers hide letters — crack the cipher | 7×7 lattice, six real words, 2–4 letters given |
| **Typeshift** | Pick a letter per strip; use every letter | Five strips cut from 3–5 hidden words |
| **Eight Off** | Down in suit, eight cells, kings open gaps | 8×6, four cells dealt full |
| **Seahaven Towers** | Down in suit; only kings fill a tower | 10×5, two of four cells dealt |
| **Penguin** | The beak sets the rank; foundations wrap | 7×7, seven cells, three siblings start home |
| **Spiderette** | One-pack spider on a Klondike staircase | 1–7 deal, 24-card stock |
| **Will o' the Wisp** | Spiderette with everything face-up | Seven threes, 31-card stock |
| **Streets & Alleys** | Beleaguered Castle with the aces dealt | Eight fans, empty foundations |
| **Fortress** | Same suit, one rank up or down | Ten walls of five and six |
| **La Belle Lucie** | Same suit down; empties stay empty | 17 fans of three plus one, two shuffles |
| **Trefoil** | La Belle Lucie with the aces home | 16 fans of three, two shuffles |
| **Russian Solitaire** | Yukon's rules, but strictly in suit | All 52 dealt; very few deals go home |
| **Whitehead** | Klondike in one colour, all face-up | Runs move in suit; one pass, draw one |
| **Agnes** | The deal names the base rank, foundations wrap | Seven columns, seven reserve slots |
| **Monte Carlo** | Discard touching pairs, then close up | 5×5, refilled from the deck |
| **Clock** | Thirteen hours; the deal has already decided | 13 piles of four, one button |
| **Osmosis** | Ranks seep down the rows | Four reserves of four, two redeals |
| **Calculation** | Four foundations, four steps, wrapping | 48-card stock, four waste heaps |
| **Poker Solitaire** | Place 25 cards, score ten poker lines | English scoring; 60/75/90 target |

The current puzzle of each game (its seed, difficulty, progress, and play
time) persists in `localStorage`, so leaving and returning resumes where
you left off. **New** in a game's header deals a fresh board; solve
counts accumulate per game.

A save is only resumed if it can be trusted. The envelope carries a
version, a game can declare a `stateV` when it changes the shape of what
it stores, and anything unreadable — wrong version, malformed blob — is
dropped so a fresh board is dealt instead. If a board still fails to open,
an error boundary catches it and offers "Deal a new board" rather than
showing a blank screen; stats and every other game are untouched.

## UX features

- **Puzzle of the day** at the top of the hub (`#/daily`): one logic,
  number or word puzzle per date, the same board for everyone, played at
  Medium in its own save slot so your regular board of that game is left
  alone. Solving on consecutive days builds a daily streak.
- **Undo** (20 steps) in every game where it makes sense, via a shared
  `useGame` hook that also tracks active play time.
- **Hints** (💡) in the solution-backed games — Sudoku, Killer Sudoku,
  Picross, Fill-a-Pix, Fillomino, Futoshiki, Skyscrapers, KenKen,
  Kropki, Kakuro, Suguru, Cryptogram, the Mini Crossword, Sujiko,
  Str8ts, Numbrix, Jigsaw Sudoku, Sandwich, and Knight's Tour — reveal
  one cell; hinted solves still count, but never set a best time or
  extend a streak.
- **Streaks & best times**: per-game win streaks, longest streak, a
  fastest-solve time per difficulty, and per-difficulty play splits —
  all surfaced on the win banner ("★ New best time!").
- **Back-button navigation & deep links**: the view lives in the URL
  hash (`#/game/sudoku`, `#/cat/logic`), so Android/browser back
  returns to the hub instead of closing the app, and any game can be
  bookmarked.
- **Search** across all 119 games from the hub, by name or tagline.
- **Sound effects** — tiny WebAudio jingles on win/lose/hint, no audio
  assets so the app stays fully offline; mute toggle in the hub header,
  remembered across visits.
- **Difficulty picker** (Easy / Medium / Hard) on 87 of the 119 games —
  board sizes, clue counts, and fleets scale with it.
- **Win banner** with time, lifetime stats, haptic feedback, and
  New puzzle / All games actions.
- **New puzzle asks twice** once a board has progress, so one stray tap
  can't bin an hour of Killer Sudoku.
- **Rules open themselves** the first time you visit each game, as a sheet
  *over* the board rather than above it, so the words and the thing they
  describe are on screen together. `Esc` closes the sheet; a second `Esc`
  leaves the game.
- **Gesture tips**: the games with an unadvertised second gesture — hold to
  flag in Minesweeper, hold to cycle backwards in Slant, Train Tracks and
  Magnets, drag-to-paint in the shading puzzles — say so once, the first
  time you open them.
- **Your puzzles** (`#/stats`): lifetime solved, played, win rate, longest
  streak, games tried and most-played category, plus a game-by-game table
  of wins, current streak and best time. Reached from a summary strip on
  the hub, and also home to the preferences below.
- **Theme toggle in every game header** (☀/☾), not just the hub — dimming
  the screen at midnight shouldn't cost you your place in a puzzle.
- **Optional clock** (off by default): times the board as you play. Best
  times are recorded either way, so switching it on adds pressure, not
  bookkeeping.
- **Vibration** (on by default, phones only): a short tick on every move,
  fired from the one place every move already passes through.
- **Big categories are sub-grouped**: the 35 logic grids are shown in named
  runs — Loops & paths, Shade the grid, Regions, Placement — instead of one
  undifferentiated column.
- **The hub remembers where you were** — scroll position per view, plus
  a ring around the game you just came back from.
- **Favourites and recents**: star any game to pin it to the top of the
  hub, and the last few you played get their own row (games already
  pinned or in progress aren't listed twice).
- **Colour-blind palette** (◑ in the hub header): swaps the green/amber
  right-letter feedback for Okabe-Ito blue and vermillion across Word
  Guess, Equation, Hangman and Word Ladder, and numbers Mastermind's
  pegs, whose eight colours can't be told apart by hue alone.
- **Drag-to-paint** in Picross, Nurikabe, Tents, Battleships, Hitori,
  Aquarium, Fill-a-Pix, Galaxies, Tapa, Kurodoko and Cave (a whole stroke
  is one undo step).
- **Keyboard play** on desktop: digits, arrows, and Backspace in all six
  number-grid games; arrows/letters in 2048, Word Guess, Hangman. Shell
  shortcuts too — `Esc` back to the hub, `Ctrl`/`Cmd`+`Z` to undo, and
  bare `u`/`n` for undo and new board in games that don't read letters
  as guesses.
- **Minesweeper**: long-press (or right-click) to flag, chording on
  satisfied numbers.
- **2048**: animated tile slides, merges, and spawns via identity-keyed
  tiles.
- **Solitaire**: one-tap auto-finish once everything is face-up.
- **Rules help** (`? Rules`) on every logic puzzle, a categorised hub
  with a "Jump back in" row, and full dark-mode support — a header
  toggle (☀/☾) that persists, defaulting to the OS
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
    dict.ts      ~11k common words + letter-mask lookups for the letter games
    storage.ts   typed localStorage: current-puzzle slots + solve stats
    theme.ts     light/dark choice, shared so any screen can toggle it
    haptics.ts   the per-move tick, behind one preference
    useGame.ts   per-game plumbing: seed, difficulty, undo, play time,
                 saving, and recording the result (`finish` / `outcome`)
    shell.ts     context that tells shared chrome which game is running
    drag.ts      pointer drags across grid cells: path drawing, drag-paint
    cards.ts     card ids, ranks, suits and building rules
  games/
    registry.ts  one entry per game: copy, category, keywords, hints, loader
    ui.tsx       toolbar, rules sheet, toast, and the result banner
    cards.tsx    <PlayingCard> and <Foundation>, shared by every solitaire
    Numpad.tsx   the digit pad under the number grids
    <Game>.tsx   one component per game, plus <Game>.css for styles only
                 that board uses (loaded with its chunk)
    Wordle.tsx   grid, on-screen + hardware keyboard, key-state colouring
    Sudoku.tsx   notes mode, conflict highlighting, remaining-digit counts
    Picross.tsx  fill/cross tools, live clue satisfaction dimming
    WordSearch.tsx tap-two-ends selection, overlap-aware placement
    LightsOut.tsx  solvable-by-construction scramble, move counter
    Mines.tsx      first-tap-safe mine layout, flood reveal, flag mode
    Queens.tsx     region-coloured board, conflict highlighting
    Tango.tsx      cycle suns/moons, live rule-violation marking
    Zip.tsx        drag-to-draw path, checkpoint order enforced, rewind
  styles.css     tokens, hub, shared game chrome, styles used by several games
  Stats.tsx      lifetime record + the preference switches
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

- **Add a game:** implement `({ onExit }) => JSX`, then add one entry to
  `src/games/registry.ts` — the `GameId` union, the hub card, its named run,
  hash routing, and the lazy chunk all derive from it; set `textInput` if
  the board reads bare letters and `tip` for a hidden gesture. Inside the
  game, `useGame(fresh)` handles persistence (the id comes from context):
  end a game with `commit(next, { outcome: "won" })` from a move handler,
  or `useEffect(() => { if (solved) finish(); }, [solved, finish])` for a
  "solved?" check; `<Result>` then reads the stats itself. Put styles only
  this board uses in `<Game>.css` and import it from the component. Reuse
  what fits: `lib/piles.ts` (fan/castle solitaires), `games/CellGame`
  (FreeCell family), `games/SpiderGame`, `games/ShadeGame` (shading
  puzzles), `<PlayingCard>`, `<Numpad>`, and `useDragPaint` /
  `useMarkPaint` / `useCellDrag` from `lib/drag.ts`.

- **Guess dictionary:** guesses are currently shape-validated (any 5
  letters). To enforce a dictionary, add a word set and check it in
  `Wordle.tsx → submit()`.
- **Difficulty settings:** every generator takes a size/removal parameter —
  expose a picker and store the choice alongside the seed.
