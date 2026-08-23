import type { ComponentType } from "react";

/** Every game in one place: identity, hub-card copy, category, search
 *  keywords, and the lazy chunk loader. Adding a game means adding one
 *  entry here — the GameId type, hub cards, routing, and code-splitting
 *  all follow from it. Each `load` is its own dynamic import, so every
 *  game stays its own chunk: the hub paints without parsing any game
 *  code, and the service worker still precaches every chunk for offline. */

export type Category = "words" | "numbers" | "logic" | "classic";

export const CATEGORIES: Category[] = ["words", "numbers", "logic", "classic"];

export const CATEGORY_LABEL: Record<Category, string> = {
  words: "Word games",
  numbers: "Number grids",
  logic: "Logic grids",
  classic: "Classics & arcade"
};

export const CATEGORY_META: Record<Category, { glyph: string; accent: string; tagline: string }> = {
  words: { glyph: "A", accent: "var(--green)", tagline: "Guess, search, unscramble" },
  numbers: { glyph: "9", accent: "var(--blue)", tagline: "Sudoku and its cousins" },
  logic: { glyph: "▦", accent: "var(--purple)", tagline: "Loops, islands, fleets, stars" },
  classic: { glyph: "♠", accent: "var(--coral)", tagline: "Cards, dice, and arcade" }
};

/** Named runs inside a category, in the order they appear under its
 *  heading — the big categories need the extra shelf. */
export const SUB_ORDER: Partial<Record<Category, string[]>> = {
  logic: ["Loops & paths", "Shade the grid", "Regions", "Placement"]
};

export interface GameProps {
  onExit: () => void;
}

type Loader = () => Promise<{ default: ComponentType<GameProps> }>;

/** `keywords` are extra lowercase search terms — aliases ("nonogram" for
 *  picross), family names ("solitaire" for every card game), and concepts
 *  the name and tagline don't already contain. */
const defs = [
  { id: "word", name: "Word Guess", tagline: "Six tries, five letters", accent: "var(--green)", glyph: "A", cat: "words", keywords: "wordle daily", load: () => import("./Wordle") },
  { id: "hangman", name: "Hangman", tagline: "Six lives, one word", accent: "var(--amber)", glyph: "?", cat: "words", keywords: "gallows guess letters", load: () => import("./Hangman") },
  { id: "wordsearch", name: "Word Search", tagline: "Hidden words, eight directions", accent: "var(--teal)", glyph: "⌕", cat: "words", keywords: "find grid", load: () => import("./WordSearch") },
  { id: "anagram", name: "Anagram", tagline: "Unscramble the letters", accent: "var(--coral)", glyph: "⇄", cat: "words", keywords: "scramble jumble rearrange", load: () => import("./Anagram") },
  { id: "crypto", name: "Cryptogram", tagline: "Crack the letter cipher", accent: "var(--indigo)", glyph: "§", cat: "words", keywords: "code substitution quote decrypt", load: () => import("./Cryptogram") },
  { id: "ladder", name: "Word Ladder", tagline: "One letter at a time", accent: "var(--blue)", glyph: "⇅", cat: "words", keywords: "chain rung transform", load: () => import("./Ladder") },
  { id: "mini", name: "Mini Crossword", tagline: "Five by five, clued", accent: "var(--purple)", glyph: "╋", cat: "words", keywords: "clues across down", load: () => import("./MiniCrossword") },
  { id: "bee", name: "Spelling Bee", tagline: "Seven letters, one in every word", accent: "var(--amber)", glyph: "⬢", cat: "words", keywords: "honeycomb pangram hive", load: () => import("./SpellingBee") },
  { id: "waffle", name: "Waffle", tagline: "Fifteen swaps, six words", accent: "var(--olive)", glyph: "✚", cat: "words", keywords: "swap crossing wordle", load: () => import("./Waffle") },
  { id: "boggle", name: "Boggle", tagline: "Trace words through the grid", accent: "var(--teal)", glyph: "⊡", cat: "words", keywords: "dice adjacent hunt", load: () => import("./Boggle") },
  { id: "boxed", name: "Letter Boxed", tagline: "Twelve letters, four sides", accent: "var(--indigo)", glyph: "▢", cat: "words", keywords: "square connect", load: () => import("./LetterBoxed") },

  { id: "sudoku", name: "Sudoku", tagline: "Fill the grid, no repeats", accent: "var(--blue)", glyph: "9", cat: "numbers", keywords: "classic 9x9 digits pencil notes", load: () => import("./Sudoku") },
  { id: "futoshiki", name: "Futoshiki", tagline: "Fill the grid, obey the arrows", accent: "var(--purple)", glyph: "≶", cat: "numbers", keywords: "inequality latin more less", load: () => import("./Futoshiki") },
  { id: "sky", name: "Skyscrapers", tagline: "Count the towers you can see", accent: "var(--teal)", glyph: "⌂", cat: "numbers", keywords: "buildings visibility latin", load: () => import("./Skyscrapers") },
  { id: "kenken", name: "KenKen", tagline: "Cages with arithmetic", accent: "var(--blue)", glyph: "⊞", cat: "numbers", keywords: "calcudoku mathdoku latin", load: () => import("./KenKen") },
  { id: "kropki", name: "Kropki", tagline: "Dots join neighbours and doubles", accent: "var(--rose)", glyph: "◉", cat: "numbers", keywords: "consecutive latin", load: () => import("./Kropki") },
  { id: "kakuro", name: "Kakuro", tagline: "Crossword sums, digits 1–9", accent: "var(--olive)", glyph: "Σ", cat: "numbers", keywords: "cross sums runs", load: () => import("./Kakuro") },
  { id: "math24", name: "Math 24", tagline: "Make 24 from four numbers", accent: "var(--green)", glyph: "24", cat: "numbers", keywords: "arithmetic operations target", load: () => import("./Math24") },
  { id: "killer", name: "Killer Sudoku", tagline: "Cages that add up", accent: "var(--indigo)", glyph: "⊠", cat: "numbers", keywords: "sums 9x9", load: () => import("./Killer") },
  { id: "equation", name: "Equation", tagline: "Guess the hidden math", accent: "var(--purple)", glyph: "=", cat: "numbers", keywords: "nerdle arithmetic wordle", load: () => import("./Equation") },
  { id: "sujiko", name: "Sujiko", tagline: "Four circles, nine digits", accent: "var(--teal)", glyph: "◉", cat: "numbers", keywords: "sums corners", load: () => import("./Sujiko") },
  { id: "str8ts", name: "Str8ts", tagline: "Runs of consecutive numbers", accent: "var(--coral)", glyph: "⊟", cat: "numbers", keywords: "straights blacked latin", load: () => import("./Str8ts") },
  { id: "numbrix", name: "Numbrix", tagline: "One unbroken chain of numbers", accent: "var(--green)", glyph: "⤴", cat: "numbers", keywords: "path snake consecutive", load: () => import("./Numbrix") },
  { id: "jigsaw", name: "Jigsaw Sudoku", tagline: "Sudoku with wandering regions", accent: "var(--rose)", glyph: "⬡", cat: "numbers", keywords: "irregular squiggly", load: () => import("./Jigsaw") },
  { id: "sandwich", name: "Sandwich", tagline: "Sum between the 1 and the 9", accent: "var(--amber)", glyph: "⊂", cat: "numbers", keywords: "sudoku sums between", load: () => import("./Sandwich") },
  { id: "sumplete", name: "Sumplete", tagline: "Cross out to hit every total", accent: "var(--olive)", glyph: "⊖", cat: "numbers", keywords: "delete sums rows columns", load: () => import("./Sumplete") },
  { id: "suko", name: "Suko", tagline: "Nine digits, four circled sums", accent: "var(--teal)", glyph: "⊙", cat: "numbers", keywords: "three by three", load: () => import("./Suko") },
  { id: "hidato", name: "Hidato", tagline: "A chain that counts diagonally", accent: "var(--purple)", glyph: "⤢", cat: "numbers", keywords: "hidoku path consecutive snake", load: () => import("./Hidato") },
  { id: "magic", name: "Magic Square", tagline: "Every line the same total", accent: "var(--indigo)", glyph: "✧", cat: "numbers", keywords: "sums rows columns diagonals", load: () => import("./MagicSquare") },

  { id: "picross", name: "Picross", tagline: "Reveal the hidden picture", accent: "var(--rose)", glyph: "▦", sub: "Shade the grid", cat: "logic", keywords: "nonogram griddler pixel paint hanjie", load: () => import("./Picross") },
  { id: "queens", name: "Queens", tagline: "One crown per colour, none touching", accent: "var(--indigo)", glyph: "♛", sub: "Placement", cat: "logic", keywords: "linkedin crowns chess regions", load: () => import("./Queens") },
  { id: "stars", name: "Star Battle", tagline: "Two stars everywhere, never touching", accent: "var(--amber)", glyph: "★", sub: "Placement", cat: "logic", keywords: "regions rows columns", load: () => import("./Stars") },
  { id: "tango", name: "Suns & Moons", tagline: "Balance the board, no three in a row", accent: "var(--coral)", glyph: "☾", sub: "Placement", cat: "logic", keywords: "tango binairo takuzu binary linkedin", load: () => import("./Tango") },
  { id: "zip", name: "Zip", tagline: "One line, every square, in order", accent: "var(--olive)", glyph: "⤳", sub: "Loops & paths", cat: "logic", keywords: "path snake linkedin trail", load: () => import("./Zip") },
  { id: "flow", name: "Flow", tagline: "Pipe every pair, fill the grid", accent: "var(--teal)", glyph: "∿", sub: "Loops & paths", cat: "logic", keywords: "numberlink connect dots pairs", load: () => import("./Flow") },
  { id: "hitori", name: "Hitori", tagline: "Shade out the duplicates", accent: "var(--indigo)", glyph: "▩", sub: "Shade the grid", cat: "logic", keywords: "black cells latin", load: () => import("./Hitori") },
  { id: "nurikabe", name: "Nurikabe", tagline: "Islands in a connected sea", accent: "var(--coral)", glyph: "◍", sub: "Shade the grid", cat: "logic", keywords: "walls shade stream", load: () => import("./Nurikabe") },
  { id: "hashi", name: "Bridges", tagline: "Link every island, no crossings", accent: "var(--olive)", glyph: "☰", sub: "Loops & paths", cat: "logic", keywords: "hashiwokakero hashi islands connect", load: () => import("./Hashi") },
  { id: "tents", name: "Tents & Trees", tagline: "Pitch a tent by every tree", accent: "var(--green)", glyph: "△", sub: "Placement", cat: "logic", keywords: "camping counts", load: () => import("./Tents") },
  { id: "shikaku", name: "Shikaku", tagline: "Box every number by its area", accent: "var(--purple)", glyph: "▭", sub: "Regions", cat: "logic", keywords: "rectangles partition divide", load: () => import("./Shikaku") },
  { id: "ships", name: "Battleships", tagline: "Find the hidden fleet", accent: "var(--indigo)", glyph: "▬", sub: "Placement", cat: "logic", keywords: "battleship naval counts solitaire", load: () => import("./Battleships") },
  { id: "slither", name: "Slitherlink", tagline: "One loop around the clues", accent: "var(--coral)", glyph: "◇", sub: "Loops & paths", cat: "logic", keywords: "fences edges loop the loop", load: () => import("./Slitherlink") },
  { id: "masyu", name: "Masyu", tagline: "One loop through the pearls", accent: "var(--blue)", glyph: "◐", sub: "Loops & paths", cat: "logic", keywords: "white black circles", load: () => import("./Masyu") },
  { id: "akari", name: "Light Up", tagline: "Bulbs that never blind each other", accent: "var(--amber)", glyph: "☼", sub: "Shade the grid", cat: "logic", keywords: "akari lamps illuminate walls", load: () => import("./Akari") },
  { id: "dominoes", name: "Dominoes", tagline: "Re-draw the hidden set", accent: "var(--teal)", glyph: "⠿", sub: "Regions", cat: "logic", keywords: "tiles pips pairs", load: () => import("./Dominoes") },
  { id: "thermo", name: "Thermometers", tagline: "Fill mercury to match the counts", accent: "var(--rose)", glyph: "▮", sub: "Shade the grid", cat: "logic", keywords: "bulb rows columns", load: () => import("./Thermometers") },
  { id: "suguru", name: "Suguru", tagline: "Small regions, no touching twins", accent: "var(--green)", glyph: "⌗", sub: "Regions", cat: "logic", keywords: "tectonic number blocks", load: () => import("./Suguru") },
  { id: "aquarium", name: "Aquarium", tagline: "Water always finds its level", accent: "var(--blue)", glyph: "≋", sub: "Shade the grid", cat: "logic", keywords: "tanks gravity fill counts", load: () => import("./Aquarium") },
  { id: "galaxies", name: "Galaxies", tagline: "Symmetric regions around each dot", accent: "var(--indigo)", glyph: "✦", sub: "Regions", cat: "logic", keywords: "tentai show spiral rotational", load: () => import("./Galaxies") },
  { id: "net", name: "Pipes", tagline: "Rotate tiles, reconnect the network", accent: "var(--teal)", glyph: "╬", sub: "Loops & paths", cat: "logic", keywords: "net netwalk plumbing spanning", load: () => import("./Net") },
  { id: "fillapix", name: "Fill-a-Pix", tagline: "Paint by neighbour counts", accent: "var(--blue)", glyph: "▨", sub: "Shade the grid", cat: "logic", keywords: "mosaic picture minesweeper paint", load: () => import("./FillAPix") },
  { id: "fillomino", name: "Fillomino", tagline: "Regions sized by their number", accent: "var(--amber)", glyph: "▤", sub: "Regions", cat: "logic", keywords: "polyomino groups", load: () => import("./Fillomino") },
  { id: "yinyang", name: "Yin-Yang", tagline: "Two circles, one balance", accent: "var(--teal)", glyph: "☯", sub: "Shade the grid", cat: "logic", keywords: "black white connected", load: () => import("./YinYang") },
  { id: "untangle", name: "Untangle", tagline: "Drag dots, uncross lines", accent: "var(--green)", glyph: "✳", sub: "Loops & paths", cat: "logic", keywords: "planarity graph crossings", load: () => import("./Untangle") },
  { id: "kakurasu", name: "Kakurasu", tagline: "Weighted rows and columns", accent: "var(--olive)", glyph: "⧗", sub: "Shade the grid", cat: "logic", keywords: "index sums", load: () => import("./Kakurasu") },
  { id: "knight", name: "Knight's Tour", tagline: "Every square, one knight", accent: "var(--indigo)", glyph: "♞", sub: "Loops & paths", cat: "logic", keywords: "chess hamiltonian hops", load: () => import("./Knight") },
  { id: "norinori", name: "Norinori", tagline: "Two per region, in dominoes", accent: "var(--purple)", glyph: "⬛", sub: "Shade the grid", cat: "logic", keywords: "shade pairs", load: () => import("./Norinori") },
  { id: "heyawake", name: "Heyawake", tagline: "Numbered rooms, shaded squares", accent: "var(--rose)", glyph: "▥", sub: "Shade the grid", cat: "logic", keywords: "rooms stripes", load: () => import("./Heyawake") },
  { id: "tracks", name: "Train Tracks", tagline: "Lay the line, match the counts", accent: "var(--coral)", glyph: "╍", sub: "Loops & paths", cat: "logic", keywords: "railway rails route", load: () => import("./TrainTracks") },
  { id: "slant", name: "Slant", tagline: "Diagonals that never close a loop", accent: "var(--blue)", glyph: "◸", sub: "Loops & paths", cat: "logic", keywords: "gokigen naname corners", load: () => import("./Slant") },
  { id: "magnets", name: "Magnets", tagline: "Poles that never touch", accent: "var(--rose)", glyph: "◨", sub: "Shade the grid", cat: "logic", keywords: "plus minus dominoes counts", load: () => import("./Magnets") },
  { id: "yajilin", name: "Yajilin", tagline: "Arrows count the shaded cells", accent: "var(--purple)", glyph: "⇲", sub: "Loops & paths", cat: "logic", keywords: "loop shade", load: () => import("./Yajilin") },
  { id: "lits", name: "LITS", tagline: "One tetromino in every region", accent: "var(--olive)", glyph: "⬓", sub: "Shade the grid", cat: "logic", keywords: "shade connected", load: () => import("./Lits") },
  { id: "ripple", name: "Ripple Effect", tagline: "Equal numbers keep their distance", accent: "var(--teal)", glyph: "∷", sub: "Regions", cat: "logic", keywords: "regions rooms", load: () => import("./Ripple") },

  { id: "mines", name: "Minesweeper", tagline: "First tap is always safe", accent: "var(--purple)", glyph: "✹", cat: "classic", keywords: "flags bombs sweep", load: () => import("./Mines") },
  { id: "lights", name: "Lights Out", tagline: "Flip them all off", accent: "var(--amber)", glyph: "◉", cat: "classic", keywords: "toggle switch", load: () => import("./LightsOut") },
  { id: "2048", name: "2048", tagline: "Merge tiles, double up", accent: "var(--amber)", glyph: "⊞", cat: "classic", keywords: "swipe doubling powers", load: () => import("./Game2048") },
  { id: "fifteen", name: "Fifteen", tagline: "Slide the tiles into order", accent: "var(--blue)", glyph: "⇆", cat: "classic", keywords: "15 sliding puzzle taquin", load: () => import("./Fifteen") },
  { id: "memory", name: "Pairs", tagline: "Flip two, find the match", accent: "var(--rose)", glyph: "❖", cat: "classic", keywords: "memory concentration cards", load: () => import("./Memory") },
  { id: "mastermind", name: "Mastermind", tagline: "Crack the colour code", accent: "var(--rose)", glyph: "◒", cat: "classic", keywords: "code breaker pegs feedback", load: () => import("./Mastermind") },
  { id: "hanoi", name: "Towers of Hanoi", tagline: "Rebuild the tower, disk by disk", accent: "var(--blue)", glyph: "≣", cat: "classic", keywords: "disks pegs recursive", load: () => import("./Hanoi") },
  { id: "klondike", name: "Solitaire", tagline: "Classic Klondike, tap to move", accent: "var(--green)", glyph: "♠", cat: "classic", keywords: "cards patience deal", load: () => import("./Klondike") },
  { id: "freecell", name: "FreeCell", tagline: "All cards up, four spare cells", accent: "var(--indigo)", glyph: "♣", cat: "classic", keywords: "solitaire cards patience", load: () => import("./FreeCell") },
  { id: "spider", name: "Spider", tagline: "One suit, eight runs to clear", accent: "var(--purple)", glyph: "♤", cat: "classic", keywords: "solitaire cards patience", load: () => import("./Spider") },
  { id: "sokoban", name: "Sokoban", tagline: "Push every crate onto a goal", accent: "var(--olive)", glyph: "▣", cat: "classic", keywords: "warehouse boxes", load: () => import("./Sokoban") },
  { id: "pegs", name: "Peg Solitaire", tagline: "Jump pegs down to one", accent: "var(--teal)", glyph: "✛", cat: "classic", keywords: "board triangle cross", load: () => import("./PegSolitaire") },
  { id: "yahtzee", name: "Yahtzee", tagline: "Thirteen rounds of dice", accent: "var(--coral)", glyph: "⚄", cat: "classic", keywords: "poker rolls score sheet", load: () => import("./Yahtzee") },
  { id: "tripeaks", name: "TriPeaks", tagline: "Clear the peaks, rank by rank", accent: "var(--amber)", glyph: "▲", cat: "classic", keywords: "solitaire cards", load: () => import("./TriPeaks") },
  { id: "ballsort", name: "Ball Sort", tagline: "Pour until every tube matches", accent: "var(--purple)", glyph: "⫶", cat: "classic", keywords: "tubes colours water", load: () => import("./BallSort") },
  { id: "samegame", name: "SameGame", tagline: "Pop groups, clear the board", accent: "var(--rose)", glyph: "⣿", cat: "classic", keywords: "clickomania tiles collapse", load: () => import("./SameGame") },
  { id: "unblock", name: "Unblock", tagline: "Slide the red car free", accent: "var(--coral)", glyph: "⇥", cat: "classic", keywords: "rush hour traffic blocks", load: () => import("./Unblock") },
  { id: "pyramid", name: "Pyramid", tagline: "Pairs that make thirteen", accent: "var(--amber)", glyph: "♦", cat: "classic", keywords: "solitaire cards", load: () => import("./Pyramid") },
  { id: "golf", name: "Golf", tagline: "One up or down, clear the course", accent: "var(--green)", glyph: "◎", cat: "classic", keywords: "solitaire cards", load: () => import("./Golf") },
  { id: "farkle", name: "Farkle", tagline: "Push your luck with six dice", accent: "var(--rose)", glyph: "⚅", cat: "classic", keywords: "ten thousand banking risk", load: () => import("./Farkle") },
  { id: "yukon", name: "Yukon", tagline: "Klondike unchained — no deck", accent: "var(--teal)", glyph: "♥", cat: "classic", keywords: "solitaire cards patience", load: () => import("./Yukon") },
  { id: "scorpion", name: "Scorpion", tagline: "Spider with a sting", accent: "var(--olive)", glyph: "♦", cat: "classic", keywords: "solitaire cards", load: () => import("./Scorpion") },
  { id: "mahjong", name: "Mahjong", tagline: "Match free tiles, clear the stack", accent: "var(--indigo)", glyph: "🀄", cat: "classic", keywords: "shanghai tiles pairs", load: () => import("./Mahjong") },
  { id: "flood", name: "Flood It", tagline: "Swallow the board in colour", accent: "var(--teal)", glyph: "◈", cat: "classic", keywords: "fill colours moves", load: () => import("./FloodIt") },
  { id: "dots", name: "Dots & Boxes", tagline: "Close boxes, beat the machine", accent: "var(--blue)", glyph: "⊞", cat: "classic", keywords: "pen pencil lines versus", load: () => import("./DotsBoxes") },
  { id: "forty", name: "Forty Thieves", tagline: "Two packs, no second chances", accent: "var(--coral)", glyph: "♧", cat: "classic", keywords: "solitaire cards napoleon", load: () => import("./FortyThieves") },
  { id: "bakers", name: "Baker's Dozen", tagline: "Thirteen columns, no deck", accent: "var(--olive)", glyph: "♡", cat: "classic", keywords: "solitaire cards", load: () => import("./BakersDozen") },
  { id: "accordion", name: "Accordion", tagline: "Squeeze fifty-two into one", accent: "var(--amber)", glyph: "⇤", cat: "classic", keywords: "solitaire cards", load: () => import("./Accordion") },
  { id: "acesup", name: "Aces Up", tagline: "Leave only the four aces", accent: "var(--green)", glyph: "♤", cat: "classic", keywords: "solitaire cards discard", load: () => import("./AcesUp") },
  { id: "canfield", name: "Canfield", tagline: "Wrapping foundations, fast deck", accent: "var(--purple)", glyph: "◇", cat: "classic", keywords: "solitaire cards demon", load: () => import("./Canfield") },
  { id: "gaps", name: "Gaps", tagline: "Four suits in order, four holes", accent: "var(--blue)", glyph: "⬚", cat: "classic", keywords: "montana solitaire cards", load: () => import("./Gaps") },
  { id: "castle", name: "Beleaguered Castle", tagline: "Eight fans, four aces home", accent: "var(--indigo)", glyph: "♖", cat: "classic", keywords: "solitaire cards fortress", load: () => import("./BeleagueredCastle") },
  { id: "nim", name: "Nim", tagline: "Take the last counter to win", accent: "var(--coral)", glyph: "⚈", cat: "classic", keywords: "heaps strategy versus", load: () => import("./Nim") },
] as const satisfies readonly {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  glyph: string;
  cat: Category;
  sub?: string;
  keywords: string;
  load: Loader;
}[];

export type GameId = (typeof defs)[number]["id"];

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  accent: string;
  glyph: string;
  cat: Category;
  /** Which named run inside the category this belongs to, if any. */
  sub?: string;
  /** Extra lowercase search terms beyond name and tagline. */
  keywords: string;
  load: Loader;
}

export const GAMES: readonly GameInfo[] = defs;

export const GAME_IDS: ReadonlySet<string> = new Set(defs.map((g) => g.id));
