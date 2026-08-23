import { useCallback, useEffect, useRef, useState } from "react";
import { TEXT_GAMES, useGameShell } from "../lib/shell";
import { useTheme } from "../lib/theme";

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
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  const armOrDeal = useCallback(() => {
    if (!onNew) return;
    if (!info.dirty || confirming) {
      if (timer.current !== null) clearTimeout(timer.current);
      setConfirming(false);
      onNew();
      return;
    }
    setConfirming(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setConfirming(false), 3000);
  }, [onNew, info.dirty, confirming]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Word games read bare letters as guesses.
      if (info.game && TEXT_GAMES.has(info.game)) return;
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
      <h2>{title}</h2>
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
      {onNew ? (
        <button
          className={`new-btn${confirming ? " confirming" : ""}`}
          onClick={armOrDeal}
          aria-label={
            confirming ? "Tap again to discard this puzzle" : "New puzzle"
          }
        >
          {confirming ? "Discard?" : "New"}
        </button>
      ) : (
        <span className="header-spacer" />
      )}
    </header>
  );
}
