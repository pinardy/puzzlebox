import { useCallback, useEffect, useRef, useState } from "react";
import { useGameShell } from "../lib/shell";
import { GAME_BY_ID } from "./registry";
import { useTheme } from "../lib/theme";
import { GameId, Diff, loadStats } from "../lib/storage";
import { fmtTime } from "../lib/format";

const DIFFS: Diff[] = ["easy", "medium", "hard"];
const DIFF_LABEL: Record<Diff, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** Lifetime record for the running game: the per-difficulty splits and
 *  best times the win banner has no room for, without leaving the board. */
function StatsPanel({
  game,
  title,
  onClose
}: {
  game: GameId;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  const stats = loadStats(game);
  const rate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  return (
    <div className="result-backdrop" onClick={onClose}>
      <div
        className="result stats-panel"
        role="dialog"
        aria-label={`${title} statistics`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="result-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
        <h3>{title}</h3>
        {stats.played === 0 ? (
          <p className="stats-empty">
            Nothing recorded yet — finish a board and it shows up here.
          </p>
        ) : (
          <div className="stats-rows">
            <div className="stats-row">
              <span>Played</span>
              <strong>{stats.played}</strong>
            </div>
            <div className="stats-row">
              <span>Solved</span>
              <strong>
                {stats.won} ({rate}%)
              </strong>
            </div>
            <div className="stats-row">
              <span>Win streak</span>
              <strong>
                {stats.streak ?? 0}
                {(stats.longestStreak ?? 0) > 1 && <> · longest {stats.longestStreak}</>}
              </strong>
            </div>
            {DIFFS.map((d) => {
              const split = stats.byDiff?.[d];
              const best = stats.best?.[d];
              if (!split && best === undefined) return null;
              return (
                <div className="stats-row" key={d}>
                  <span>{DIFF_LABEL[d]}</span>
                  <strong>
                    {split ? `${split.won}/${split.played} solved` : "—"}
                    {best !== undefined && <> · best {fmtTime(best)}</>}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function GameHeader({
  title,
  onExit,
  onNew
}: {
  title: string;
  onExit: () => void;
  onNew?: () => void;
}) {
  const { info } = useGameShell();
  const { theme, toggle } = useTheme();
  // A board with progress asks twice — one stray tap shouldn't bin an
  // hour-long puzzle. The armed state lapses on its own.
  const [confirming, setConfirming] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  const armOrDeal = useCallback(() => {
    if (!onNew || info.daily) return;
    if (!info.dirty || confirming) {
      if (timer.current !== null) clearTimeout(timer.current);
      setConfirming(false);
      onNew();
      return;
    }
    setConfirming(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setConfirming(false), 3000);
  }, [onNew, info.daily, info.dirty, confirming]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Word games read bare letters as guesses.
      if (info.game && GAME_BY_ID[info.game].textInput) return;
      if (e.key === "n") {
        e.preventDefault();
        armOrDeal();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onExit, armOrDeal, info.game]);

  return (
    <header className="game-header">
      <button className="back-btn" onClick={onExit} aria-label="Back to games">
        ←
      </button>
      <h2>
        {title}
        {info.daily && <span className="daily-tag">Today</span>}
      </h2>
      {info.game && (
        <button
          className="stats-btn"
          onClick={() => setShowStats(true)}
          aria-label={`${title} statistics`}
        >
          ▤
        </button>
      )}
      {/* Dimming the screen shouldn't cost you your place in the puzzle. */}
      <button
        className="theme-btn"
        onClick={toggle}
        aria-label={
          theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"
        }
        aria-pressed={theme === "dark"}
      >
        {theme === "dark" ? "☾" : "☀"}
      </button>
      {/* The puzzle of the day is one fixed board: nothing to re-deal. */}
      {onNew && !info.daily ? (
        <button
          className={`new-btn${confirming ? " confirming" : ""}`}
          onClick={armOrDeal}
          aria-label={confirming ? "Tap again to discard this puzzle" : "New puzzle"}
        >
          {confirming ? "Discard?" : "New"}
        </button>
      ) : (
        <span className="header-spacer" />
      )}
      {showStats && info.game && (
        <StatsPanel game={info.game} title={title} onClose={() => setShowStats(false)} />
      )}
    </header>
  );
}
