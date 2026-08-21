export function GameHeader({
  title,
  onExit,
  onNew
}: {
  title: string;
  onExit: () => void;
  onNew?: () => void;
}) {
  return (
    <header className="game-header">
      <button className="back-btn" onClick={onExit} aria-label="Back to games">
        ←
      </button>
      <h2>{title}</h2>
      {onNew ? (
        <button className="new-btn" onClick={onNew}>
          New
        </button>
      ) : (
        <span className="header-spacer" />
      )}
    </header>
  );
}
