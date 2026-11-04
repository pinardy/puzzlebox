import { GameId, loadStats, Diff } from "./lib/storage";
import { fmtTime } from "./lib/format";

/** A game the hub knows about, with its category already spelled out so
 *  this screen needs nothing else from the hub. */
export interface StatsGame {
  id: GameId;
  name: string;
  cat: string;
}

export interface PrefToggle {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}

const DIFFS: Diff[] = ["easy", "medium", "hard"];

/** Everything the app has quietly been recording, in one place — plus the
 *  switches that don't earn a permanent spot in the hub header. */
export default function Stats({
  games,
  prefs,
  onExit
}: {
  games: StatsGame[];
  prefs: PrefToggle[];
  onExit: () => void;
}) {
  const rows = games
    .map((g) => ({ ...g, s: loadStats(g.id) }))
    .filter((r) => r.s.played > 0)
    .sort((a, b) => b.s.played - a.s.played || a.name.localeCompare(b.name));

  const played = rows.reduce((n, r) => n + r.s.played, 0);
  const won = rows.reduce((n, r) => n + r.s.won, 0);
  const bestStreak = rows.reduce((n, r) => Math.max(n, r.s.longestStreak ?? 0), 0);
  const rate = played ? Math.round((won / played) * 100) : 0;

  // Which category has had the most of your attention.
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.cat, (byCat.get(r.cat) ?? 0) + r.s.played);
  const favourite = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  const bestOf = (r: (typeof rows)[number]): number | null => {
    const times = DIFFS.map((d) => r.s.best?.[d]).filter(
      (t): t is number => t !== undefined
    );
    return times.length ? Math.min(...times) : null;
  };

  return (
    <div className="hub stats-page">
      <header className="cat-head">
        <button className="back-btn" onClick={onExit} aria-label="Back to games">
          ←
        </button>
        <h2>Your puzzles</h2>
        <span className="card-glyph cat-head-glyph" aria-hidden="true">
          ★
        </span>
      </header>

      {played === 0 ? (
        <p className="stats-empty">
          Nothing solved yet. Finish a puzzle and this page fills up with your streaks,
          your best times, and the games you keep coming back to.
        </p>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <b>{won}</b>
              <span>solved</span>
            </div>
            <div className="stat-tile">
              <b>{played}</b>
              <span>played</span>
            </div>
            <div className="stat-tile">
              <b>{rate}%</b>
              <span>win rate</span>
            </div>
            <div className="stat-tile">
              <b>{bestStreak}</b>
              <span>best streak</span>
            </div>
            <div className="stat-tile">
              <b>
                {rows.length}
                <small>/{games.length}</small>
              </b>
              <span>games tried</span>
            </div>
            {favourite && (
              <div className="stat-tile wide">
                <b>{favourite[0]}</b>
                <span>most played</span>
              </div>
            )}
          </div>

          <section className="cards-section">
            <h2>Game by game</h2>
            <div className="stats-table" role="table" aria-label="Per-game record">
              <div className="stats-row stats-head" role="row">
                <span role="columnheader">Game</span>
                <span role="columnheader">Won</span>
                <span role="columnheader">Streak</span>
                <span role="columnheader">Best</span>
              </div>
              {rows.map((r) => {
                const best = bestOf(r);
                return (
                  <div className="stats-row" role="row" key={r.id}>
                    <span role="cell">{r.name}</span>
                    <span role="cell">
                      {r.s.won}
                      <small>/{r.s.played}</small>
                    </span>
                    <span role="cell">
                      {(r.s.streak ?? 0) > 1 ? `🔥 ${r.s.streak}` : "—"}
                    </span>
                    <span role="cell">{best === null ? "—" : fmtTime(best)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="cards-section">
        <h2>Preferences</h2>
        <div className="prefs">
          {prefs.map((p) => (
            <button
              key={p.label}
              className={`pref-row${p.on ? " on" : ""}`}
              onClick={p.onToggle}
              role="switch"
              aria-checked={p.on}
            >
              <span className="pref-text">
                <span className="pref-label">{p.label}</span>
                <span className="pref-hint">{p.hint}</span>
              </span>
              <span className="pref-switch" aria-hidden="true">
                <span className="pref-knob" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <footer className="hub-footer">
        Everything here is stored on your device only.
      </footer>
    </div>
  );
}
