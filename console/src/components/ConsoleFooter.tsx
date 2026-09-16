import { ExternalLink } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { MARKETING_URL } from "@/lib/site";

const CONSOLE_VERSION = import.meta.env.VITE_CONSOLE_VERSION || "dev";

export function ConsoleFooter() {
  const { activeWorkspace } = useWorkspace();
  const { server } = activeWorkspace;

  return (
    <footer className="dash-footer">
      <div className="dash-footer-inner container">
        <div className="dash-footer-status">
          <span className={`dash-footer-dot ${server.isReachable ? "ok" : "down"}`} />
          <span>{server.isReachable ? "All systems operational" : "Dedicated server unreachable"}</span>
          <span className="dash-footer-sep">·</span>
          <span className="font-mono">{activeWorkspace.name}</span>
          <span className="dash-footer-sep">·</span>
          <span className="font-mono">{server.ip}</span>
          <span className="dash-footer-sep hide-sm">·</span>
          <span className="hide-sm">{server.region}</span>
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
