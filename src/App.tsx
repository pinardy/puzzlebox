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
  { id: "zip", name: "Zip", tagline: "One line, every square, in order", accent: "var(--olive)", glyph: "⤳" }
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
      queens: Queens, tango: Tango, zip: Zip
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
            ? "Nine puzzles, endless boards — pick one."
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
