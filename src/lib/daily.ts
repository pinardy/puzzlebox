import { GAMES, type GameId } from "../games/registry";
import { makeRng } from "./rng";
import { load, loadSlot, save } from "./storage";

/** The puzzle of the day: one game and one seed per calendar day, the same
 *  for everyone, played at Medium in its own save slot. Card games sit it
 *  out — some deals can't be won, and a streak shouldn't hinge on luck. */

export const DAILY_SLOT = "daily";

const ELIGIBLE: readonly GameId[] = GAMES.filter((g) => g.cat !== "classic").map(
  (g) => g.id
);

/** Today's date on the player's own clock, as YYYY-MM-DD. */
export function today(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return today(new Date(y, m - 1, d - 1));
}

export function dailyGame(date: string): GameId {
  return ELIGIBLE[Math.floor(makeRng(`daily-${date}`)() * ELIGIBLE.length)];
}

/** The seed the daily board is dealt from. The game id is part of it, so a
 *  slot left over from another day can never be read as today's. */
export function dailySeed(date: string, game: GameId): string {
  return `daily-${date}-${game}`;
}

export type DailyProgress = "fresh" | "started" | "done";

export function dailyProgress(date: string): DailyProgress {
  const slot = loadSlot<{ done?: boolean }>(DAILY_SLOT);
  if (!slot || slot.seed !== dailySeed(date, dailyGame(date))) return "fresh";
  return slot.state.done ? "done" : "started";
}

export interface DailyRecord {
  /** The last day a daily was solved. */
  last?: string;
  streak: number;
  best: number;
}

export function loadDaily(): DailyRecord {
  return load<DailyRecord>("daily:record", { streak: 0, best: 0 });
}

/** The streak as it stands today: it survives until the end of the day
 *  after the last solve, then lapses. */
export function currentStreak(rec: DailyRecord, date: string): number {
  return rec.last === date || rec.last === dayBefore(date) ? rec.streak : 0;
}

/** Note the end of a day's puzzle. A win extends the run if yesterday's was
 *  solved too; a loss ends it. */
export function recordDaily(date: string, won: boolean): DailyRecord {
  const rec = loadDaily();
  if (rec.last === date) return rec;
  const next: DailyRecord = won
    ? {
        last: date,
        streak: rec.last === dayBefore(date) ? rec.streak + 1 : 1,
        best: Math.max(rec.best, rec.last === dayBefore(date) ? rec.streak + 1 : 1)
      }
    : { ...rec, streak: 0 };
  save("daily:record", next);
  return next;
}
