import { ExternalLink } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { MARKETING_URL } from "@/lib/site";

const CONSOLE_VERSION = import.meta.env.VITE_CONSOLE_VERSION || "dev";

export function ConsoleFooter() {
  const { activeWorkspace } = useWorkspace();
  const server = activeWorkspace?.server ?? null;

  return (
    <footer className="dash-footer">
      <div className="dash-footer-inner container">
        <div className="dash-footer-status">
          <span className={`dash-footer-dot ${server?.isReachable ? "ok" : "down"}`} />
          <span>
            {!activeWorkspace
              ? "No workspace assigned"
              : server?.isReachable
                ? "All systems operational"
                : "Dedicated server unreachable"}
          </span>
          {activeWorkspace && (
            <>
              <span className="dash-footer-sep">·</span>
              <span className="font-mono">{activeWorkspace.name}</span>
            </>
          )}
          {server && (
            <>
              <span className="dash-footer-sep">·</span>
              <span className="font-mono">{server.ip}</span>
            </>
          )}
        </div>

        <nav className="dash-footer-links" aria-label="Console footer">
          <a href={`${MARKETING_URL}/insights`}>Docs</a>
          <a href={`${MARKETING_URL}/case-studies`}>Status</a>
          <a href={`${MARKETING_URL}/start-project`}>
            Support
            <ExternalLink size={11} />
          </a>
          <a href={`${MARKETING_URL}/start-project`}>Terms</a>
          <a href={`${MARKETING_URL}/start-project`}>Privacy</a>
        </nav>

        <div className="dash-footer-meta">
          <span>© {new Date().getFullYear()} Restart Inc.</span>
          <span className="dash-footer-sep">·</span>
          <span className="font-mono">console {CONSOLE_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
