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

interface CardInfo {
  id: GameId;
  name: string;
  tagline: string;
  accent: string;
  glyph: string;
}

const CARDS: CardInfo[] = [
  { id: "word", name: "Word Guess", tagline: "Six tries, five letters", accent: "var(--green)", glyph: "A" },
  { id: "sudoku", name: "Sudoku", tagline: "Fill the grid, no repeats", accent: "var(--blue)", glyph: "9" },
  { id: "picross", name: "Picross", tagline: "Reveal the hidden picture", accent: "var(--rose)", glyph: "▦" },
  { id: "wordsearch", name: "Word Search", tagline: "Hidden words, eight directions", accent: "var(--teal)", glyph: "⌕" },
  { id: "lights", name: "Lights Out", tagline: "Flip them all off", accent: "var(--amber)", glyph: "◉" },
  { id: "mines", name: "Minesweeper", tagline: "First tap is always safe", accent: "var(--purple)", glyph: "✹" },
  { id: "queens", name: "Queens", tagline: "One crown per colour, none touching", accent: "var(--indigo)", glyph: "♛" },
  { id: "tango", name: "Suns & Moons", tagline: "Balance the board, no three in a row", accent: "var(--coral)", glyph: "☾" },
  { id: "zip", name: "Zip", tagline: "One line, every square, in order", accent: "var(--olive)", glyph: "⤳" },
  { id: "2048", name: "2048", tagline: "Merge tiles, double up", accent: "var(--amber)", glyph: "⊞" },
  { id: "memory", name: "Pairs", tagline: "Flip two, find the match", accent: "var(--rose)", glyph: "❖" },
  { id: "fifteen", name: "Fifteen", tagline: "Slide the tiles into order", accent: "var(--blue)", glyph: "⇆" },
  { id: "hangman", name: "Hangman", tagline: "Six lives, one word", accent: "var(--green)", glyph: "?" },
  { id: "futoshiki", name: "Futoshiki", tagline: "Fill 1–5, obey the arrows", accent: "var(--purple)", glyph: "≶" },
  { id: "sky", name: "Skyscrapers", tagline: "Count the towers you can see", accent: "var(--teal)", glyph: "⌂" },
  { id: "hitori", name: "Hitori", tagline: "Shade out the duplicates", accent: "var(--indigo)", glyph: "▩" },
  { id: "nurikabe", name: "Nurikabe", tagline: "Islands in a connected sea", accent: "var(--coral)", glyph: "◍" },
  { id: "hashi", name: "Bridges", tagline: "Link every island, no crossings", accent: "var(--olive)", glyph: "☰" },
  { id: "kenken", name: "KenKen", tagline: "Cages with arithmetic", accent: "var(--blue)", glyph: "⊞" },
  { id: "kropki", name: "Kropki", tagline: "Dots join neighbours and doubles", accent: "var(--rose)", glyph: "◉" },
  { id: "stars", name: "Star Battle", tagline: "Two stars everywhere, never touching", accent: "var(--amber)", glyph: "★" },
  { id: "flow", name: "Flow", tagline: "Pipe every pair, fill the grid", accent: "var(--teal)", glyph: "∿" },
  { id: "tents", name: "Tents & Trees", tagline: "Pitch a tent by every tree", accent: "var(--green)", glyph: "△" },
  { id: "shikaku", name: "Shikaku", tagline: "Box every number by its area", accent: "var(--purple)", glyph: "▭" },
  { id: "ships", name: "Battleships", tagline: "Find the hidden fleet", accent: "var(--indigo)", glyph: "▬" },
  { id: "slither", name: "Slitherlink", tagline: "One loop around the clues", accent: "var(--coral)", glyph: "◇" },
  { id: "kakuro", name: "Kakuro", tagline: "Crossword sums, digits 1–9", accent: "var(--olive)", glyph: "Σ" },
  { id: "mastermind", name: "Mastermind", tagline: "Crack the colour code", accent: "var(--rose)", glyph: "◒" },
  { id: "hanoi", name: "Towers of Hanoi", tagline: "Rebuild the tower, one disk at a time", accent: "var(--blue)", glyph: "≣" },
  { id: "klondike", name: "Solitaire", tagline: "Classic Klondike, tap to move", accent: "var(--green)", glyph: "♠" }
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

      <main className="cards">
        {CARDS.map((card, i) => {
          const stats = loadStats(card.id);
          const progress = progressOf(card.id);
          return (
            <button
              key={card.id}
              className={`card is-${progress}`}
              style={{ "--accent": card.accent, "--i": i } as CSSProperties}
              onClick={() => setView(card.id)}
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
        })}
      </main>

      <footer className="hub-footer">
        Puzzles are generated on your device — no connection needed.
      </footer>
    </div>
  );
}
