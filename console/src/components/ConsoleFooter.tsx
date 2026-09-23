const CONSOLE_VERSION = import.meta.env.VITE_CONSOLE_VERSION || "dev";

export function ConsoleFooter() {
  return (
    <footer className="dash-footer">
      <div className="dash-footer-inner container">
        <div className="dash-footer-meta">
          <span>© {new Date().getFullYear()} Restart Inc.</span>
          <span className="dash-footer-sep">·</span>
          <span className="font-mono">console {CONSOLE_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
