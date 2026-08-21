const NS = "puzzlebox";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${NS}:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
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
  | "thermo" | "suguru" | "sokoban" | "pegs" | "yahtzee";

export interface Stats {
  played: number;
  won: number;
}

const EMPTY: Stats = { played: 0, won: 0 };

export function loadStats(game: GameId): Stats {
  return load(`stats:${game}`, EMPTY);
}

/** Record a finished puzzle. */
export function recordResult(game: GameId, won: boolean): Stats {
  const s = loadStats(game);
  const next: Stats = { played: s.played + 1, won: s.won + (won ? 1 : 0) };
  save(`stats:${game}`, next);
  return next;
}

export type Diff = "easy" | "medium" | "hard";

/** The current puzzle for a game: the seed and difficulty it was generated
 *  from plus the player's in-progress state and active play time, so
 *  leaving and returning resumes it. */
export interface Slot<T> {
  seed: string;
  state: T;
  diff?: Diff;
  playMs?: number;
}

export function loadSlot<T>(game: GameId): Slot<T> | null {
  return load<Slot<T> | null>(`current:${game}`, null);
}

export function saveSlot<T>(
  game: GameId,
  seed: string,
  state: T,
  diff?: Diff,
  playMs?: number
): void {
  save(`current:${game}`, { seed, state, diff, playMs });
}
