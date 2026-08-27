import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties
} from "react";

import {
  GAMES,
  GAME_IDS,
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_META,
  SUB_ORDER,
  type Category,
  type GameId,
  type GameInfo,
  type GameProps
} from "./games/registry";
import {
  load,
  save,
  loadStats,
  loadSlot,
  loadFavorites,
  toggleFavorite,
  loadRecents,
  pushRecent
} from "./lib/storage";
import { GameShell } from "./games/GameShell";
import { GameBoundary } from "./games/GameBoundary";
import { soundEnabled, setSoundEnabled } from "./lib/sound";
import { hapticsEnabled, setHapticsEnabled } from "./lib/haptics";
import { useTheme } from "./lib/theme";
const Stats = lazy(() => import("./Stats"));

// Each game is its own chunk (the registry's `load` thunks are separate
// dynamic imports): the hub paints without parsing any game code, and the
// service worker still precaches every chunk for offline.
const GAME_COMPONENT = Object.fromEntries(
  GAMES.map((g) => [g.id, lazy(g.load)])
) as Record<string, ComponentType<GameProps>>;

type View = "hub" | "stats" | GameId;

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
  if (kind === "stats") return { view: "stats", cat: null };
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

function Card({
  card,
  onOpen,
  recent,
  fav,
  onFav
}: {
  card: GameInfo;
  onOpen: () => void;
  recent?: boolean;
  fav?: boolean;
  onFav?: () => void;
}) {
  const stats = loadStats(card.id);
  const progress = progressOf(card.id);
  return (
    <div className="card-slot">
      <button
        className={`card is-${progress}${recent ? " is-recent" : ""}`}
        style={{ "--accent": card.accent } as CSSProperties}
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
      {onFav && (
        <button
          className={`fav-btn${fav ? " on" : ""}`}
          onClick={onFav}
          aria-pressed={fav}
          aria-label={
            fav ? `Unpin ${card.name}` : `Pin ${card.name} to favourites`
          }
        >
          {fav ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [{ view, cat: openCat }, setRoute] = useState<Route>(parseRoute);
  const [online, setOnline] = useState(navigator.onLine);
  const [query, setQuery] = useState("");
  const [sound, setSound] = useState(soundEnabled);
  const [colorblind, setColorblind] = useState(() =>
    load("pref:colorblind", false)
  );
  const { theme, toggle: toggleTheme } = useTheme();
  const [haptics, setHaptics] = useState(hapticsEnabled);
  const [showTimer, setShowTimer] = useState(() => load("pref:timer", false));
  const [favorites, setFavorites] = useState(loadFavorites);
  const [recents, setRecents] = useState(loadRecents);
  const [lastGame, setLastGame] = useState<GameId | null>(null);
  const wide = useIsWide();
  const searchRef = useRef<HTMLInputElement>(null);
  // True once we've pushed an in-app hash, so "back" can pop real history;
  // on a deep link there's nothing behind us, so we push the hub instead.
  const navigated = useRef(false);
  // Scroll offset per route: sixty-six cards is a long way to re-scroll
  // after every game, so returning puts you back where you were.
  const scrollMem = useRef(new Map<string, number>());
  const routeKey = `${view}:${openCat ?? ""}`;

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, scrollMem.current.get(routeKey) ?? 0);
  }, [routeKey]);

  // The palette swap is a document-level flag so every game picks it up.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (colorblind) root.setAttribute("data-cb", "1");
    else root.removeAttribute("data-cb");
  }, [colorblind]);

  // Catches deep links and back/forward too, not just taps on a card.
  useEffect(() => {
    if (view === "hub" || view === "stats") return;
    setLastGame(view);
    setRecents(pushRecent(view));
  }, [view]);

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

  // "/" jumps to the search box from anywhere on the hub, the way it does
  // in most catalogues; typing into a field must still type a slash.
  useEffect(() => {
    if (view !== "hub") return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view]);

  const navigate = (hash: string) => {
    scrollMem.current.set(routeKey, window.scrollY);
    navigated.current = true;
    window.location.hash = hash;
  };
  const exit = () => {
    scrollMem.current.set(routeKey, window.scrollY);
    if (navigated.current) window.history.back();
    else window.location.hash = "/";
  };
  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
  };
  const toggleColorblind = () => {
    save("pref:colorblind", !colorblind);
    setColorblind(!colorblind);
  };
  const toggleHaptics = () => {
    setHapticsEnabled(!haptics);
    setHaptics(!haptics);
  };
  const toggleTimer = () => {
    save("pref:timer", !showTimer);
    setShowTimer(!showTimer);
  };

  if (view === "stats") {
    return (
      <Suspense fallback={<div className="hub" />}>
        <Stats
          onExit={exit}
          games={GAMES.map((c) => ({
            id: c.id,
            name: c.name,
            cat: CATEGORY_LABEL[c.cat]
          }))}
          prefs={[
            {
              label: "Dark theme",
              hint: "Follows your device until you pick a side.",
              on: theme === "dark",
              onToggle: toggleTheme
            },
            {
              label: "Colour-blind palette",
              hint: "Blue and vermillion instead of green and amber.",
              on: colorblind,
              onToggle: toggleColorblind
            },
            {
              label: "Sound effects",
              hint: "Short jingles on a win, a loss, or a hint.",
              on: sound,
              onToggle: toggleSound
            },
            {
              label: "Vibration",
              hint: "A short tick on every move. Phones only.",
              on: haptics,
              onToggle: toggleHaptics
            },
            {
              label: "Show the clock",
              hint: "Times every board as you play. Records are kept either way.",
              on: showTimer,
              onToggle: toggleTimer
            }
          ]}
        />
      </Suspense>
    );
  }

  if (view !== "hub") {
    const Game = GAME_COMPONENT[view];
    const title = GAMES.find((g) => g.id === view)?.name ?? "Puzzle";
    return (
      <GameShell>
        {/* A board that can't be opened — an old save, a generator that
            throws — offers a way out instead of a blank screen. */}
        <GameBoundary game={view} title={title} onExit={exit}>
          <Suspense fallback={<div className="game" />}>
            <Game onExit={exit} />
          </Suspense>
        </GameBoundary>
      </GameShell>
    );
  }

  const inProgress = GAMES.filter((c) => progressOf(c.id) === "started");
  const open = (id: GameId) => navigate(`/game/${id}`);

  /** Deal out a game at random, preferring ones never finished before —
   *  with over a hundred to choose from, the pick is more useful than the
   *  list. */
  const surprise = () => {
    const untried = GAMES.filter((c) => loadStats(c.id).played === 0);
    const pool = untried.length > 0 ? untried : GAMES;
    open(pool[Math.floor(Math.random() * pool.length)].id);
  };

  const renderCard = (card: GameInfo) => (
    <Card
      key={card.id}
      card={card}
      recent={card.id === lastGame}
      fav={favorites.includes(card.id)}
      onFav={() => setFavorites(toggleFavorite(card.id))}
      onOpen={() => open(card.id)}
    />
  );

  const cardSection = (title: string, cards: readonly GameInfo[]) =>
    cards.length > 0 && (
      <section className="cards-section">
        <h2>{title}</h2>
        <div className="cards">{cards.map(renderCard)}</div>
      </section>
    );

  const favCards = GAMES.filter((c) => favorites.includes(c.id));
  // Anything already pinned or mid-game is shown above; don't list it twice.
  const shownAbove = new Set<GameId>([
    ...favorites,
    ...inProgress.map((c) => c.id)
  ]);
  const recentCards = recents
    .filter((id) => !shownAbove.has(id))
    .map((id) => GAMES.find((c) => c.id === id))
    .filter((c): c is GameInfo => c !== undefined)
    .slice(0, 4);

  /** Thirty-five logic grids in one undifferentiated column is a wall, so
   *  that category is shown in named runs. Anything without a run — or a
   *  category that doesn't use them — just lists flat. */
  const gamesOf = (cat: Category) => {
    const cards = GAMES.filter((c) => c.cat === cat);
    const subs = SUB_ORDER[cat];
    if (!subs) return <div className="cards">{cards.map(renderCard)}</div>;
    const loose = cards.filter((c) => !c.sub || !subs.includes(c.sub));
    return (
      <>
        {[...subs, ...(loose.length ? ["More"] : [])].map((s) => {
          const group = s === "More" ? loose : cards.filter((c) => c.sub === s);
          if (!group.length) return null;
          return (
            <div className="sub-group" key={s}>
              <h3 className="sub-head">{s}</h3>
              <div className="cards">{group.map(renderCard)}</div>
            </div>
          );
        })}
      </>
    );
  };

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

  // One pass over the saved stats for the hub's summary strip; the storage
  // layer memoises reads, so this is cheap enough to keep always-fresh.
  const record = GAMES.reduce(
    (acc, c) => {
      const s = loadStats(c.id);
      return {
        won: acc.won + s.won,
        streak: Math.max(acc.streak, s.longestStreak ?? 0)
      };
    },
    { won: 0, streak: 0 }
  );

  const q = query.trim().toLowerCase();
  // Name and tagline, plus each game's alias keywords ("nonogram" finds
  // Picross, "solitaire" finds every card game) and its category label.
  const matches = q
    ? GAMES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline.toLowerCase().includes(q) ||
          c.keywords.includes(q) ||
          CATEGORY_LABEL[c.cat].toLowerCase().includes(q)
      )
    : [];

  return (
    <div className="hub">
      <header className="ticket" aria-label="PuzzleBox">
        <div className="ticket-tools">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to the light theme"
                : "Switch to the dark theme"
            }
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button
            className={`icon-btn${colorblind ? " on" : ""}`}
            onClick={toggleColorblind}
            aria-label={
              colorblind
                ? "Switch back to the standard palette"
                : "Use the colour-blind palette"
            }
            aria-pressed={colorblind}
          >
            ◑
          </button>
          <button
            className="icon-btn"
            onClick={toggleSound}
            aria-label={sound ? "Mute sounds" : "Unmute sounds"}
            aria-pressed={sound}
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <button
            className="icon-btn"
            onClick={surprise}
            aria-label="Open a random game"
          >
            ⚄
          </button>
        </div>
        <h1>PuzzleBox</h1>
        <p className="ticket-note">
          {online
            ? `${GAMES.length} puzzles, endless boards — pick one.`
            : "Offline — puzzles still work."}
        </p>
      </header>

      <input
        ref={searchRef}
        className="hub-search"
        type="search"
        placeholder={`Search ${GAMES.length} games…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // Enter opens the top hit, so a search is one uninterrupted
        // gesture: type a few letters, press Enter, you're playing.
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches.length > 0) {
            e.preventDefault();
            e.currentTarget.blur();
            open(matches[0].id);
          } else if (e.key === "Escape" && query) {
            e.preventDefault();
            setQuery("");
          }
        }}
        aria-label="Search games"
      />

      <button className="stats-strip" onClick={() => navigate("/stats")}>
        <span className="stats-strip-main">
          {record.won > 0 ? (
            <>
              <b>{record.won}</b> solved
              {record.streak > 1 && (
                <>
                  {" · best streak "}
                  <b>{record.streak}</b>
                </>
              )}
            </>
          ) : (
            "Stats & preferences"
          )}
        </span>
        <span className="stats-strip-go">Your puzzles →</span>
      </button>

      {q ? (
        <section className="cards-section">
          <h2>
            {matches.length
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
              : "No matches"}
          </h2>
          <div className="cards">{matches.map(renderCard)}</div>
        </section>
      ) : (
        <>
          {cardSection("Favourites", favCards)}
          {cardSection("Jump back in", inProgress)}
          {cardSection("Recently played", recentCards)}

          {wide ? (
            <>
              {/* Wide screens show all four categories on one page, which
                  is a long scroll — these chips stick to the top and jump. */}
              <nav className="cat-nav" aria-label="Jump to a category">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className="cat-nav-chip"
                    style={{ "--accent": CATEGORY_META[cat].accent } as CSSProperties}
                    onClick={() =>
                      document.getElementById(`cat-${cat}`)?.scrollIntoView({
                        // The CSS reduced-motion rule can't reach a JS
                        // scroll, so honour the preference here.
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                          .matches
                          ? "auto"
                          : "smooth",
                        block: "start"
                      })
                    }
                  >
                    <span aria-hidden="true">{CATEGORY_META[cat].glyph}</span>
                    {CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </nav>
              {CATEGORIES.map((cat) => (
                <section key={cat} id={`cat-${cat}`} className="cards-section">
                  <h2>{CATEGORY_LABEL[cat]}</h2>
                  {gamesOf(cat)}
                </section>
              ))}
            </>
          ) : (
            <section className="cards-section">
              <h2>Pick a category</h2>
              <div className="cards">
                {CATEGORIES.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const games = GAMES.filter((c) => c.cat === cat);
                  const started = games.filter((c) => progressOf(c.id) === "started").length;
                  return (
                    <button
                      key={cat}
                      className="card cat-card"
                      style={{ "--accent": meta.accent } as CSSProperties}
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
