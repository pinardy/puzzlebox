import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";

// Each game is its own chunk: the hub paints without parsing any game
// code, and the service worker still precaches every chunk for offline.
const Wordle = lazy(() => import("./games/Wordle"));
const Sudoku = lazy(() => import("./games/Sudoku"));
const Picross = lazy(() => import("./games/Picross"));
const WordSearch = lazy(() => import("./games/WordSearch"));
const LightsOut = lazy(() => import("./games/LightsOut"));
const Mines = lazy(() => import("./games/Mines"));
const Queens = lazy(() => import("./games/Queens"));
const Tango = lazy(() => import("./games/Tango"));
const Zip = lazy(() => import("./games/Zip"));
const Game2048 = lazy(() => import("./games/Game2048"));
const Memory = lazy(() => import("./games/Memory"));
const Fifteen = lazy(() => import("./games/Fifteen"));
const Hangman = lazy(() => import("./games/Hangman"));
const Futoshiki = lazy(() => import("./games/Futoshiki"));
const Skyscrapers = lazy(() => import("./games/Skyscrapers"));
const Hitori = lazy(() => import("./games/Hitori"));
const Nurikabe = lazy(() => import("./games/Nurikabe"));
const Hashi = lazy(() => import("./games/Hashi"));
const KenKen = lazy(() => import("./games/KenKen"));
const Kropki = lazy(() => import("./games/Kropki"));
const Stars = lazy(() => import("./games/Stars"));
const Flow = lazy(() => import("./games/Flow"));
const Tents = lazy(() => import("./games/Tents"));
const Shikaku = lazy(() => import("./games/Shikaku"));
const Battleships = lazy(() => import("./games/Battleships"));
const Slitherlink = lazy(() => import("./games/Slitherlink"));
const Kakuro = lazy(() => import("./games/Kakuro"));
const Mastermind = lazy(() => import("./games/Mastermind"));
const Hanoi = lazy(() => import("./games/Hanoi"));
const Klondike = lazy(() => import("./games/Klondike"));
const FreeCell = lazy(() => import("./games/FreeCell"));
const Spider = lazy(() => import("./games/Spider"));
const Anagram = lazy(() => import("./games/Anagram"));
const Masyu = lazy(() => import("./games/Masyu"));
const Akari = lazy(() => import("./games/Akari"));
const Dominoes = lazy(() => import("./games/Dominoes"));
const Thermometers = lazy(() => import("./games/Thermometers"));
const Suguru = lazy(() => import("./games/Suguru"));
const Sokoban = lazy(() => import("./games/Sokoban"));
const PegSolitaire = lazy(() => import("./games/PegSolitaire"));
const Yahtzee = lazy(() => import("./games/Yahtzee"));
const TriPeaks = lazy(() => import("./games/TriPeaks"));
const Aquarium = lazy(() => import("./games/Aquarium"));
const Galaxies = lazy(() => import("./games/Galaxies"));
const Net = lazy(() => import("./games/Net"));
const BallSort = lazy(() => import("./games/BallSort"));
const SameGame = lazy(() => import("./games/SameGame"));
const Math24 = lazy(() => import("./games/Math24"));
const Killer = lazy(() => import("./games/Killer"));
const Equation = lazy(() => import("./games/Equation"));
const FillAPix = lazy(() => import("./games/FillAPix"));
const Fillomino = lazy(() => import("./games/Fillomino"));
const YinYang = lazy(() => import("./games/YinYang"));
const Unblock = lazy(() => import("./games/Unblock"));
const Pyramid = lazy(() => import("./games/Pyramid"));
const Golf = lazy(() => import("./games/Golf"));
const Farkle = lazy(() => import("./games/Farkle"));
const Cryptogram = lazy(() => import("./games/Cryptogram"));
const Ladder = lazy(() => import("./games/Ladder"));
const MiniCrossword = lazy(() => import("./games/MiniCrossword"));
import { GameId, loadStats, loadSlot } from "./lib/storage";
import { soundEnabled, setSoundEnabled } from "./lib/sound";

type View = "hub" | GameId;

type Category = "words" | "numbers" | "logic" | "classic";

const CATEGORY_LABEL: Record<Category, string> = {
  words: "Word games",
  numbers: "Number grids",
  logic: "Logic grids",
  classic: "Classics & arcade"
};

const CATEGORY_META: Record<Category, { glyph: string; accent: string; tagline: string }> = {
  words: { glyph: "A", accent: "var(--green)", tagline: "Guess, search, unscramble" },
  numbers: { glyph: "9", accent: "var(--blue)", tagline: "Sudoku and its cousins" },
  logic: { glyph: "▦", accent: "var(--purple)", tagline: "Loops, islands, fleets, stars" },
  classic: { glyph: "♠", accent: "var(--coral)", tagline: "Cards, dice, and arcade" }
};

/** Narrow screens get a two-level hub: categories first, then games. */
function useIsWide(): boolean {
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 700px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 700px)");
    const h = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return wide;
}

interface CardInfo {
  id: GameId;
  name: string;
  tagline: string;
  accent: string;
  glyph: string;
  cat: Category;
}

const CARDS: CardInfo[] = [
  { id: "word", name: "Word Guess", tagline: "Six tries, five letters", accent: "var(--green)", glyph: "A", cat: "words" },
  { id: "hangman", name: "Hangman", tagline: "Six lives, one word", accent: "var(--amber)", glyph: "?", cat: "words" },
  { id: "wordsearch", name: "Word Search", tagline: "Hidden words, eight directions", accent: "var(--teal)", glyph: "⌕", cat: "words" },
  { id: "anagram", name: "Anagram", tagline: "Unscramble the letters", accent: "var(--coral)", glyph: "⇄", cat: "words" },
  { id: "crypto", name: "Cryptogram", tagline: "Crack the letter cipher", accent: "var(--indigo)", glyph: "§", cat: "words" },
  { id: "ladder", name: "Word Ladder", tagline: "One letter at a time", accent: "var(--blue)", glyph: "⇅", cat: "words" },
  { id: "mini", name: "Mini Crossword", tagline: "Five by five, clued", accent: "var(--purple)", glyph: "╋", cat: "words" },

  { id: "sudoku", name: "Sudoku", tagline: "Fill the grid, no repeats", accent: "var(--blue)", glyph: "9", cat: "numbers" },
  { id: "futoshiki", name: "Futoshiki", tagline: "Fill the grid, obey the arrows", accent: "var(--purple)", glyph: "≶", cat: "numbers" },
  { id: "sky", name: "Skyscrapers", tagline: "Count the towers you can see", accent: "var(--teal)", glyph: "⌂", cat: "numbers" },
  { id: "kenken", name: "KenKen", tagline: "Cages with arithmetic", accent: "var(--blue)", glyph: "⊞", cat: "numbers" },
  { id: "kropki", name: "Kropki", tagline: "Dots join neighbours and doubles", accent: "var(--rose)", glyph: "◉", cat: "numbers" },
  { id: "kakuro", name: "Kakuro", tagline: "Crossword sums, digits 1–9", accent: "var(--olive)", glyph: "Σ", cat: "numbers" },
  { id: "math24", name: "Math 24", tagline: "Make 24 from four numbers", accent: "var(--green)", glyph: "24", cat: "numbers" },
  { id: "killer", name: "Killer Sudoku", tagline: "Cages that add up", accent: "var(--indigo)", glyph: "⊠", cat: "numbers" },
  { id: "equation", name: "Equation", tagline: "Guess the hidden math", accent: "var(--purple)", glyph: "=", cat: "numbers" },

  { id: "picross", name: "Picross", tagline: "Reveal the hidden picture", accent: "var(--rose)", glyph: "▦", cat: "logic" },
  { id: "queens", name: "Queens", tagline: "One crown per colour, none touching", accent: "var(--indigo)", glyph: "♛", cat: "logic" },
  { id: "stars", name: "Star Battle", tagline: "Two stars everywhere, never touching", accent: "var(--amber)", glyph: "★", cat: "logic" },
  { id: "tango", name: "Suns & Moons", tagline: "Balance the board, no three in a row", accent: "var(--coral)", glyph: "☾", cat: "logic" },
  { id: "zip", name: "Zip", tagline: "One line, every square, in order", accent: "var(--olive)", glyph: "⤳", cat: "logic" },
  { id: "flow", name: "Flow", tagline: "Pipe every pair, fill the grid", accent: "var(--teal)", glyph: "∿", cat: "logic" },
  { id: "hitori", name: "Hitori", tagline: "Shade out the duplicates", accent: "var(--indigo)", glyph: "▩", cat: "logic" },
  { id: "nurikabe", name: "Nurikabe", tagline: "Islands in a connected sea", accent: "var(--coral)", glyph: "◍", cat: "logic" },
  { id: "hashi", name: "Bridges", tagline: "Link every island, no crossings", accent: "var(--olive)", glyph: "☰", cat: "logic" },
  { id: "tents", name: "Tents & Trees", tagline: "Pitch a tent by every tree", accent: "var(--green)", glyph: "△", cat: "logic" },
  { id: "shikaku", name: "Shikaku", tagline: "Box every number by its area", accent: "var(--purple)", glyph: "▭", cat: "logic" },
  { id: "ships", name: "Battleships", tagline: "Find the hidden fleet", accent: "var(--indigo)", glyph: "▬", cat: "logic" },
  { id: "slither", name: "Slitherlink", tagline: "One loop around the clues", accent: "var(--coral)", glyph: "◇", cat: "logic" },
  { id: "masyu", name: "Masyu", tagline: "One loop through the pearls", accent: "var(--blue)", glyph: "◐", cat: "logic" },
  { id: "akari", name: "Light Up", tagline: "Bulbs that never blind each other", accent: "var(--amber)", glyph: "☼", cat: "logic" },
  { id: "dominoes", name: "Dominoes", tagline: "Re-draw the hidden set", accent: "var(--teal)", glyph: "⠿", cat: "logic" },
  { id: "thermo", name: "Thermometers", tagline: "Fill mercury to match the counts", accent: "var(--rose)", glyph: "▮", cat: "logic" },
  { id: "suguru", name: "Suguru", tagline: "Small regions, no touching twins", accent: "var(--green)", glyph: "⌗", cat: "logic" },
  { id: "aquarium", name: "Aquarium", tagline: "Water always finds its level", accent: "var(--blue)", glyph: "≋", cat: "logic" },
  { id: "galaxies", name: "Galaxies", tagline: "Symmetric regions around each dot", accent: "var(--indigo)", glyph: "✦", cat: "logic" },
  { id: "net", name: "Pipes", tagline: "Rotate tiles, reconnect the network", accent: "var(--teal)", glyph: "╬", cat: "logic" },
  { id: "fillapix", name: "Fill-a-Pix", tagline: "Paint by neighbour counts", accent: "var(--blue)", glyph: "▨", cat: "logic" },
  { id: "fillomino", name: "Fillomino", tagline: "Regions sized by their number", accent: "var(--amber)", glyph: "▤", cat: "logic" },
  { id: "yinyang", name: "Yin-Yang", tagline: "Two circles, one balance", accent: "var(--teal)", glyph: "☯", cat: "logic" },

  { id: "mines", name: "Minesweeper", tagline: "First tap is always safe", accent: "var(--purple)", glyph: "✹", cat: "classic" },
  { id: "lights", name: "Lights Out", tagline: "Flip them all off", accent: "var(--amber)", glyph: "◉", cat: "classic" },
  { id: "2048", name: "2048", tagline: "Merge tiles, double up", accent: "var(--amber)", glyph: "⊞", cat: "classic" },
  { id: "fifteen", name: "Fifteen", tagline: "Slide the tiles into order", accent: "var(--blue)", glyph: "⇆", cat: "classic" },
  { id: "memory", name: "Pairs", tagline: "Flip two, find the match", accent: "var(--rose)", glyph: "❖", cat: "classic" },
  { id: "mastermind", name: "Mastermind", tagline: "Crack the colour code", accent: "var(--rose)", glyph: "◒", cat: "classic" },
  { id: "hanoi", name: "Towers of Hanoi", tagline: "Rebuild the tower, disk by disk", accent: "var(--blue)", glyph: "≣", cat: "classic" },
  { id: "klondike", name: "Solitaire", tagline: "Classic Klondike, tap to move", accent: "var(--green)", glyph: "♠", cat: "classic" },
  { id: "freecell", name: "FreeCell", tagline: "All cards up, four spare cells", accent: "var(--indigo)", glyph: "♣", cat: "classic" },
  { id: "spider", name: "Spider", tagline: "One suit, eight runs to clear", accent: "var(--purple)", glyph: "♤", cat: "classic" },
  { id: "sokoban", name: "Sokoban", tagline: "Push every crate onto a goal", accent: "var(--olive)", glyph: "▣", cat: "classic" },
  { id: "pegs", name: "Peg Solitaire", tagline: "Jump pegs down to one", accent: "var(--teal)", glyph: "✛", cat: "classic" },
  { id: "yahtzee", name: "Yahtzee", tagline: "Thirteen rounds of dice", accent: "var(--coral)", glyph: "⚄", cat: "classic" },
  { id: "tripeaks", name: "TriPeaks", tagline: "Clear the peaks, rank by rank", accent: "var(--amber)", glyph: "▲", cat: "classic" },
  { id: "ballsort", name: "Ball Sort", tagline: "Pour until every tube matches", accent: "var(--purple)", glyph: "⫶", cat: "classic" },
  { id: "samegame", name: "SameGame", tagline: "Pop groups, clear the board", accent: "var(--rose)", glyph: "⣿", cat: "classic" },
  { id: "unblock", name: "Unblock", tagline: "Slide the red car free", accent: "var(--coral)", glyph: "⇥", cat: "classic" },
  { id: "pyramid", name: "Pyramid", tagline: "Pairs that make thirteen", accent: "var(--amber)", glyph: "♦", cat: "classic" },
  { id: "golf", name: "Golf", tagline: "One up or down, clear the course", accent: "var(--green)", glyph: "◎", cat: "classic" },
  { id: "farkle", name: "Farkle", tagline: "Push your luck with six dice", accent: "var(--rose)", glyph: "⚅", cat: "classic" }
];

const CATEGORIES: Category[] = ["words", "numbers", "logic", "classic"];
const GAME_IDS = new Set<string>(CARDS.map((c) => c.id));

/** The view lives in location.hash (#/game/sudoku, #/cat/words), so the
 *  browser back button navigates in-app instead of leaving the PWA, and
 *  any game can be deep-linked or bookmarked. */
interface Route {
  view: View;
  cat: Category | null;
}

function parseRoute(): Route {
  const [kind, id] = window.location.hash.replace(/^#\/?/, "").split("/");
  if (kind === "game" && GAME_IDS.has(id)) return { view: id as GameId, cat: null };
  if (kind === "cat" && (CATEGORIES as string[]).includes(id))
    return { view: "hub", cat: id as Category };
  return { view: "hub", cat: null };
}

type Progress = "fresh" | "started" | "done";

function progressOf(id: GameId): Progress {
  const slot = loadSlot<{ done?: boolean }>(id);
  if (!slot) return "fresh";
  return slot.state.done ? "done" : "started";
}

const STATE_LABEL: Record<Progress, string> = {
  fresh: "Play →",
  started: "Continue →",
  done: "Play again →"
};

function Card({ card, index, onOpen }: { card: CardInfo; index: number; onOpen: () => void }) {
  const stats = loadStats(card.id);
  const progress = progressOf(card.id);
  return (
    <button
      className={`card is-${progress}`}
      style={{ "--accent": card.accent, "--i": Math.min(index, 8) } as CSSProperties}
      onClick={onOpen}
    >
      <span className="card-glyph" aria-hidden="true">
        {card.glyph}
      </span>
      <span className="card-body">
        <span className="card-name">{card.name}</span>
        <span className="card-tag">{card.tagline}</span>
      </span>
      <span className="card-meta">
        <span className="card-state">{STATE_LABEL[progress]}</span>
        {stats.won > 0 && (
          <span className="card-solved">✓ {stats.won} solved</span>
        )}
      </span>
    </button>
  );
}

export default function App() {
  const [{ view, cat: openCat }, setRoute] = useState<Route>(parseRoute);
  const [online, setOnline] = useState(navigator.onLine);
  const [query, setQuery] = useState("");
  const [sound, setSound] = useState(soundEnabled);
  const wide = useIsWide();
  // True once we've pushed an in-app hash, so "back" can pop real history;
  // on a deep link there's nothing behind us, so we push the hub instead.
  const navigated = useRef(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const navigate = (hash: string) => {
    navigated.current = true;
    window.location.hash = hash;
  };
  const exit = () => {
    if (navigated.current) window.history.back();
    else window.location.hash = "/";
  };
  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
  };

  if (view !== "hub") {
    const Game = {
      word: Wordle, sudoku: Sudoku, picross: Picross,
      wordsearch: WordSearch, lights: LightsOut, mines: Mines,
      queens: Queens, tango: Tango, zip: Zip,
      "2048": Game2048, memory: Memory, fifteen: Fifteen,
      hangman: Hangman, futoshiki: Futoshiki, sky: Skyscrapers,
      hitori: Hitori, nurikabe: Nurikabe, hashi: Hashi,
      kenken: KenKen, kropki: Kropki, stars: Stars, flow: Flow,
      tents: Tents, shikaku: Shikaku, ships: Battleships,
      slither: Slitherlink, kakuro: Kakuro, mastermind: Mastermind,
      hanoi: Hanoi, klondike: Klondike, freecell: FreeCell, spider: Spider,
      anagram: Anagram, masyu: Masyu, akari: Akari, dominoes: Dominoes,
      thermo: Thermometers, suguru: Suguru, sokoban: Sokoban,
      pegs: PegSolitaire, yahtzee: Yahtzee, tripeaks: TriPeaks,
      aquarium: Aquarium, galaxies: Galaxies, net: Net,
      ballsort: BallSort, samegame: SameGame, math24: Math24,
      killer: Killer, equation: Equation, fillapix: FillAPix,
      fillomino: Fillomino, yinyang: YinYang, unblock: Unblock,
      pyramid: Pyramid, golf: Golf, farkle: Farkle, crypto: Cryptogram,
      ladder: Ladder, mini: MiniCrossword
    }[view];
    return (
      <Suspense fallback={<div className="game" />}>
        <Game onExit={exit} />
      </Suspense>
    );
  }

  const inProgress = CARDS.filter((c) => progressOf(c.id) === "started");
  const open = (id: GameId) => navigate(`/game/${id}`);

  const jumpBackIn = inProgress.length > 0 && (
    <section className="cards-section">
      <h2>Jump back in</h2>
      <div className="cards">
        {inProgress.map((card, i) => (
          <Card key={card.id} card={card} index={i} onOpen={() => open(card.id)} />
        ))}
      </div>
    </section>
  );

  const gamesOf = (cat: Category) => (
    <div className="cards">
      {CARDS.filter((c) => c.cat === cat).map((card, i) => (
        <Card key={card.id} card={card} index={i} onOpen={() => open(card.id)} />
      ))}
    </div>
  );

  // Narrow screens drill into one category at a time — no endless scroll.
  if (!wide && openCat !== null) {
    const meta = CATEGORY_META[openCat];
    return (
      <div className="hub">
        <header className="cat-head">
          <button
            className="back-btn"
            onClick={exit}
            aria-label="Back to categories"
          >
            ←
          </button>
          <h2>{CATEGORY_LABEL[openCat]}</h2>
          <span
            className="card-glyph cat-head-glyph"
            style={{ "--accent": meta.accent } as CSSProperties}
            aria-hidden="true"
          >
            {meta.glyph}
          </span>
        </header>
        {gamesOf(openCat)}
        <footer className="hub-footer">
          Puzzles are generated on your device — no connection needed.
        </footer>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = q
    ? CARDS.filter(
        (c) => c.name.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q)
      )
    : [];

  return (
    <div className="hub">
      <header className="ticket" aria-label="PuzzleBox">
        <button
          className="sound-btn"
          onClick={toggleSound}
          aria-label={sound ? "Mute sounds" : "Unmute sounds"}
          aria-pressed={sound}
        >
          {sound ? "🔊" : "🔇"}
        </button>
        <h1>PuzzleBox</h1>
        <p className="ticket-note">
          {online
            ? "Sixty puzzles, endless boards — pick one."
            : "Offline — puzzles still work."}
        </p>
      </header>

      <input
        className="hub-search"
        type="search"
        placeholder={`Search ${CARDS.length} games…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search games"
      />

      {q ? (
        <section className="cards-section">
          <h2>
            {matches.length
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
              : "No matches"}
          </h2>
          <div className="cards">
            {matches.map((card, i) => (
              <Card key={card.id} card={card} index={i} onOpen={() => open(card.id)} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {jumpBackIn}

          {wide ? (
            CATEGORIES.map((cat) => (
              <section key={cat} className="cards-section">
                <h2>{CATEGORY_LABEL[cat]}</h2>
                {gamesOf(cat)}
              </section>
            ))
          ) : (
            <section className="cards-section">
              <h2>Pick a category</h2>
              <div className="cards">
                {CATEGORIES.map((cat, i) => {
                  const meta = CATEGORY_META[cat];
                  const games = CARDS.filter((c) => c.cat === cat);
                  const started = games.filter((c) => progressOf(c.id) === "started").length;
                  return (
                    <button
                      key={cat}
                      className="card cat-card"
                      style={{ "--accent": meta.accent, "--i": i } as CSSProperties}
                      onClick={() => navigate(`/cat/${cat}`)}
                    >
                      <span className="card-glyph" aria-hidden="true">
                        {meta.glyph}
                      </span>
                      <span className="card-body">
                        <span className="card-name">{CATEGORY_LABEL[cat]}</span>
                        <span className="card-tag">{meta.tagline}</span>
                      </span>
                      <span className="card-meta">
                        <span className="card-state">
                          {games.length} games →
                        </span>
                        {started > 0 && (
                          <span className="card-solved">{started} in progress</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <footer className="hub-footer">
        Puzzles are generated on your device — no connection needed.
      </footer>
    </div>
  );
}
