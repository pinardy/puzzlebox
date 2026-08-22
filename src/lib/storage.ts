const NS = "puzzlebox";

// In-memory mirror of everything read or written this session. The hub
// reads stats + slot for every card on each render; parsing ~150 JSON
// blobs per paint adds up on low-end phones. Values handed out are
// shared — treat them as immutable (all callers already do, via React
// state discipline).
const cache = new Map<string, unknown>();

export function load<T>(key: string, fallback: T): T {
  const k = `${NS}:${key}`;
  if (cache.has(k)) return cache.get(k) as T;
  try {
    const raw = localStorage.getItem(k);
    const val = raw ? (JSON.parse(raw) as T) : fallback;
    cache.set(k, val);
    return val;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  const k = `${NS}:${key}`;
  cache.set(k, value);
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — play on without persistence */
  }
}

export type GameId =
  | "word" | "sudoku" | "picross" | "wordsearch" | "lights" | "mines"
  | "queens" | "tango" | "zip"
  | "2048" | "memory" | "fifteen" | "hangman" | "futoshiki" | "sky"
  | "hitori" | "nurikabe" | "hashi"
  | "kenken" | "kropki" | "stars" | "flow" | "tents" | "shikaku"
  | "ships" | "slither" | "kakuro" | "mastermind" | "hanoi" | "klondike"
  | "freecell" | "spider" | "anagram" | "masyu" | "akari" | "dominoes"
  | "thermo" | "suguru" | "sokoban" | "pegs" | "yahtzee"
  | "tripeaks" | "aquarium" | "galaxies" | "net" | "ballsort" | "samegame"
  | "math24"
  | "killer" | "equation" | "fillapix" | "fillomino" | "yinyang" | "unblock"
  | "pyramid" | "golf" | "farkle" | "crypto" | "ladder" | "mini"
  | "yukon" | "scorpion" | "sujiko" | "untangle" | "str8ts" | "mahjong";

export type Diff = "easy" | "medium" | "hard";

export interface DiffSplit {
  played: number;
  won: number;
}

export interface Stats {
  played: number;
  won: number;
  /** Current consecutive-win run; resets on a loss. */
  streak?: number;
  longestStreak?: number;
  /** Fastest unassisted win, in active-play ms, per difficulty. */
  best?: Partial<Record<Diff, number>>;
  byDiff?: Partial<Record<Diff, DiffSplit>>;
}

const EMPTY: Stats = { played: 0, won: 0 };

export function loadStats(game: GameId): Stats {
  return load(`stats:${game}`, EMPTY);
}

/** Record a finished puzzle. The finishing commit has already saved the
 *  slot, so difficulty, play time, and hint usage are read from there —
 *  no call-site changes needed. Hinted wins keep played/won credit but
 *  never set a best time and don't extend the streak. */
export function recordResult(game: GameId, won: boolean): Stats {
  const s = loadStats(game);
  const slot = loadSlot<unknown>(game);
  const diff = slot?.diff;
  const playMs = slot?.playMs ?? 0;
  const hinted = (slot?.hints ?? 0) > 0;

  const next: Stats = {
    ...s,
    played: s.played + 1,
    won: s.won + (won ? 1 : 0)
  };

  const streak = won && !hinted ? (s.streak ?? 0) + 1 : 0;
  next.streak = streak;
  next.longestStreak = Math.max(s.longestStreak ?? 0, streak);

  if (diff) {
    const split = s.byDiff?.[diff] ?? { played: 0, won: 0 };
    next.byDiff = {
      ...s.byDiff,
      [diff]: { played: split.played + 1, won: split.won + (won ? 1 : 0) }
    };
    if (won && !hinted && playMs > 0) {
      const best = s.best?.[diff];
      if (best === undefined || playMs < best)
        next.best = { ...s.best, [diff]: playMs };
    }
  }

  save(`stats:${game}`, next);
  return next;
}

/** The current puzzle for a game: the seed and difficulty it was generated
 *  from plus the player's in-progress state, active play time, and hints
 *  taken, so leaving and returning resumes it. */
export interface Slot<T> {
  seed: string;
  state: T;
  diff?: Diff;
  playMs?: number;
  hints?: number;
}

export function loadSlot<T>(game: GameId): Slot<T> | null {
  return load<Slot<T> | null>(`current:${game}`, null);
}

export function saveSlot<T>(
  game: GameId,
  seed: string,
  state: T,
  diff?: Diff,
  playMs?: number,
  hints?: number
): void {
  save(`current:${game}`, { seed, state, diff, playMs, hints });
}
