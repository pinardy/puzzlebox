import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { clearSlot, type GameId } from "../lib/storage";

/** Last line of defence around a running game. Version checks catch the
 *  saves we know about; this catches the ones we don't — a state shape that
 *  changed without a version bump, a generator that throws on some rare
 *  seed — and turns what used to be a blank white screen into a board the
 *  player can get back. Without it a single bad save bricks a game for
 *  good: the hub still says "Continue →", and tapping it kills the app.
 *
 *  A class component because that is the only thing React lets catch a
 *  render error. */
export class GameBoundary extends Component<
  { game: GameId; title: string; onExit: () => void; children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry to send it to, but the console is where a bug report
    // starts, and the seed in the save makes it reproducible.
    console.error(`[${this.props.game}] board failed to open`, error, info);
  }

  /** Bin the unreadable board and remount the game, which deals a new one.
   *  The `attempt` counter is the remount key. */
  private retry = () => {
    clearSlot(this.props.game);
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };

  render() {
    // A keyed Fragment, not a div: the game boards are flex children of
    // #root, and an extra wrapper element breaks that chain.
    if (!this.state.failed)
      return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return (
      <div className="game board-broken">
        <header className="game-header">
          <button
            className="back-btn"
            onClick={this.props.onExit}
            aria-label="Back to games"
          >
            ←
          </button>
          <h2>{this.props.title}</h2>
          <span className="header-spacer" />
        </header>
        <div className="broken-card" role="alert">
          <span className="broken-glyph" aria-hidden="true">
            ⚠
          </span>
          <h3>This board couldn't be opened</h3>
          <p>
            The saved puzzle is from an older version of the game, so it
            can't be resumed. Your stats and every other game are untouched.
          </p>
          <div className="result-actions">
            <button className="result-primary" onClick={this.retry}>
              Deal a new board
            </button>
            <button onClick={this.props.onExit}>All games</button>
          </div>
        </div>
      </div>
    );
  }
}
