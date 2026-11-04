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

export function forget(key: string): void {
  const k = `${NS}:${key}`;
  cache.delete(k);
  try {
    localStorage.removeItem(k);
  } catch {
    /* nothing to do — the in-memory mirror is already clear */
  }
}

// The id union is derived from the game registry — one entry per game
// there covers the type, the hub, routing, and code-splitting at once.
export type { GameId } from "../games/registry";
import type { GameId } from "../games/registry";

export type Diff = "easy" | "medium" | "hard";

export interface DiffSplit {
  played: number;
  won: number;
}

/** Games pinned to the top of the hub. */
export function loadFavorites(): GameId[] {
  return load<GameId[]>("pref:favorites", []);
}

export function toggleFavorite(game: GameId): GameId[] {
  const cur = loadFavorites();
  const next = cur.includes(game) ? cur.filter((g) => g !== game) : [...cur, game];
  save("pref:favorites", next);
  return next;
}

/** Most recently opened games, newest first. */
export function loadRecents(): GameId[] {
  return load<GameId[]>("pref:recent", []);
}

export function pushRecent(game: GameId): GameId[] {
  const next = [game, ...loadRecents().filter((g) => g !== game)].slice(0, 8);
  save("pref:recent", next);
  return next;
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
 *  slot (`slotKey`, the game's own unless it was the daily), so difficulty,
 *  play time, and hint usage are read from there. Hinted wins keep
 *  played/won credit but never set a best time and don't extend the
 *  streak. */
export function recordResult(game: GameId, won: boolean, slotKey: string = game): Stats {
  const s = loadStats(game);
  const slot = loadSlot<unknown>(slotKey);
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
      if (best === undefined || playMs < best) next.best = { ...s.best, [diff]: playMs };
    }
  }

  save(`stats:${game}`, next);
  return next;
}

/** The shape of the envelope below. Bump only when these fields change —
 *  it invalidates every in-progress board, so a game changing its own
 *  state shape uses `stateV` instead. */
const SLOT_V = 1;

/** The current puzzle for a game: the seed and difficulty it was generated
 *  from plus the player's in-progress state, active play time, and hints
 *  taken, so leaving and returning resumes it. Slots are keyed by game id,
 *  except the puzzle of the day, which has its own ("daily") so playing it
 *  never disturbs your regular board of the same game. */
export interface Slot<T> {
  seed: string;
  state: T;
  diff?: Diff;
  playMs?: number;
  hints?: number;
  /** Envelope version; saves without one predate versioning. */
  v?: number;
  /** The game's own state-shape version, when it declares one. */
  stateV?: number;
}

/** A saved board, or null if there isn't a readable one. A save is dropped
 *  rather than handed back when it can't be trusted — a stale envelope, a
 *  state shape the game has since changed, or an outright malformed blob.
 *  Feeding one of those to a game is how you white-screen a player who
 *  simply came back to an old puzzle. */
export function loadSlot<T>(key: string, stateV?: number): Slot<T> | null {
  const slot = load<Slot<T> | null>(`current:${key}`, null);
  if (!slot || typeof slot !== "object" || typeof slot.seed !== "string") return null;
  // Saves written before versioning have no `v`, and the envelope they used
  // is exactly this one — so they still load. Only a version we don't
  // recognise gets dropped, which keeps `v` as a kill switch for later
  // without throwing away everyone's board the day it ships.
  if (slot.v !== undefined && slot.v !== SLOT_V) return null;
  // Every game stores an object (or an array of them); a primitive here
  // means the blob was written by something else, or corrupted.
  if (typeof slot.state !== "object" || slot.state === null) return null;
  // Only the game itself knows its state shape; the hub's own reads (which
  // just want "is there a board in progress") pass no version and take
  // whatever is there.
  if (stateV !== undefined && (slot.stateV ?? 0) !== stateV) return null;
  return slot;
}

export function saveSlot<T>(
  key: string,
  seed: string,
  state: T,
  diff?: Diff,
  playMs?: number,
  hints?: number,
  stateV?: number
): void {
  save(`current:${key}`, {
    seed,
    state,
    diff,
    playMs,
    hints,
    v: SLOT_V,
    stateV
  });
}

/** Throw away a game's in-progress board, so the next visit deals a fresh
 *  one. The escape hatch behind the recovery screen. */
export function clearSlot(key: string): void {
  forget(`current:${key}`);
}
