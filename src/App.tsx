import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";

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
import { GameId, loadStats, loadSlot } from "./lib/storage";

type View = "hub" | GameId;

type Category = "words" | "numbers" | "logic" | "classic";

const CATEGORY_LABEL: Record<Category, string> = {
  words: "Word games",
  numbers: "Number grids",
  logic: "Logic grids",
  classic: "Classics & arcade"
};

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

  { id: "sudoku", name: "Sudoku", tagline: "Fill the grid, no repeats", accent: "var(--blue)", glyph: "9", cat: "numbers" },
  { id: "futoshiki", name: "Futoshiki", tagline: "Fill the grid, obey the arrows", accent: "var(--purple)", glyph: "≶", cat: "numbers" },
  { id: "sky", name: "Skyscrapers", tagline: "Count the towers you can see", accent: "var(--teal)", glyph: "⌂", cat: "numbers" },
  { id: "kenken", name: "KenKen", tagline: "Cages with arithmetic", accent: "var(--blue)", glyph: "⊞", cat: "numbers" },
  { id: "kropki", name: "Kropki", tagline: "Dots join neighbours and doubles", accent: "var(--rose)", glyph: "◉", cat: "numbers" },
  { id: "kakuro", name: "Kakuro", tagline: "Crossword sums, digits 1–9", accent: "var(--olive)", glyph: "Σ", cat: "numbers" },

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

  { id: "mines", name: "Minesweeper", tagline: "First tap is always safe", accent: "var(--purple)", glyph: "✹", cat: "classic" },
  { id: "lights", name: "Lights Out", tagline: "Flip them all off", accent: "var(--amber)", glyph: "◉", cat: "classic" },
  { id: "2048", name: "2048", tagline: "Merge tiles, double up", accent: "var(--amber)", glyph: "⊞", cat: "classic" },
  { id: "fifteen", name: "Fifteen", tagline: "Slide the tiles into order", accent: "var(--blue)", glyph: "⇆", cat: "classic" },
  { id: "memory", name: "Pairs", tagline: "Flip two, find the match", accent: "var(--rose)", glyph: "❖", cat: "classic" },
  { id: "mastermind", name: "Mastermind", tagline: "Crack the colour code", accent: "var(--rose)", glyph: "◒", cat: "classic" },
  { id: "hanoi", name: "Towers of Hanoi", tagline: "Rebuild the tower, disk by disk", accent: "var(--blue)", glyph: "≣", cat: "classic" },
  { id: "klondike", name: "Solitaire", tagline: "Classic Klondike, tap to move", accent: "var(--green)", glyph: "♠", cat: "classic" }
];

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
  const [view, setView] = useState<View>("hub");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const exit = () => setView("hub");
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
      hanoi: Hanoi, klondike: Klondike
    }[view];
    return (
      <Suspense fallback={<div className="game" />}>
        <Game onExit={exit} />
      </Suspense>
    );
  }

  const inProgress = CARDS.filter((c) => progressOf(c.id) === "started");
  const categories: Category[] = ["words", "numbers", "logic", "classic"];

  return (
    <div className="hub">
      <header className="ticket" aria-label="PuzzleBox">
        <h1>PuzzleBox</h1>
        <p className="ticket-note">
          {online
            ? "Thirty puzzles, endless boards — pick one."
            : "Offline — puzzles still work."}
        </p>
      </header>

      {inProgress.length > 0 && (
        <section className="cards-section">
          <h2>Jump back in</h2>
          <div className="cards">
            {inProgress.map((card, i) => (
              <Card key={card.id} card={card} index={i} onOpen={() => setView(card.id)} />
            ))}
          </div>
        </section>
      )}

      {categories.map((cat) => (
        <section key={cat} className="cards-section">
          <h2>{CATEGORY_LABEL[cat]}</h2>
          <div className="cards">
            {CARDS.filter((c) => c.cat === cat).map((card, i) => (
              <Card key={card.id} card={card} index={i} onOpen={() => setView(card.id)} />
            ))}
          </div>
        </section>
      ))}

      <footer className="hub-footer">
        Puzzles are generated on your device — no connection needed.
      </footer>
    </div>
  );
}
