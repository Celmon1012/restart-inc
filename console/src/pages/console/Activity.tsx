import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Terminal } from "lucide-react";

export default function Activity() {
  return (
    <ConsoleLayout>
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">ACTIVITY</span>
          <h1>Activity</h1>
          <p>Deployments, security events, and changes to your workspace, in plain language.</p>
        </div>
      </div>

      <div className="overview-not-connected large">
        <Terminal size={20} />
        <div>
          <h3>Not connected yet</h3>
          <p>
            Once wired up, deployments, security events, and team changes will show up here — described in plain
            language first, with technical detail available on request.
          </p>
        </div>
      </div>
    </ConsoleLayout>
  );
}
