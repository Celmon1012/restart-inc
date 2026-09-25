import { ArrowRight, ArrowUpRight, Bell, ChevronsUpDown, Clock, CreditCard, History, Key, LayoutGrid, LifeBuoy, Server, Settings, Shield, Terminal, User } from "lucide-react";

/* ------------------------------------------------------------------
 * Hero preview of the Restart Console. Uses the same markup and .cp-*
 * class names as console/src/pages/console/Overview.tsx and the same
 * sidebar/top bar as ConsoleLayout, so the homepage shows what a client
 * actually sees. Figures are illustrative; the layout is not.
 * ------------------------------------------------------------------ */

const NAV = [
  { label: "Overview", icon: LayoutGrid, active: true },
  { label: "Systems", icon: Server },
  { label: "Delivery", icon: Clock },
  { label: "Activity", icon: Terminal },
  { label: "Timeline", icon: History },
];
const ACCOUNT = [
  { label: "Security & Access", icon: Shield },
  { label: "API Keys", icon: Key },
  { label: "Settings", icon: Settings },
  { label: "Billing & SLA", icon: CreditCard },
  { label: "Help & Support", icon: LifeBuoy },
];
const SYSTEMS = [
  { name: "api-gateway", kind: "application", checked: "1m ago" },
  { name: "storefront", kind: "application", checked: "1m ago" },
  { name: "billing-worker", kind: "service", checked: "2m ago" },
  { name: "postgres-primary", kind: "database", checked: "2m ago" },
  { name: "search-index", kind: "service", checked: "3m ago" },
];
const DEPLOYS = [2, 3, 1, 4, 2, 3, 2, 4, 3];

export default function ConsolePreview({ href }: { href: string }) {
  const max = Math.max(...DEPLOYS);
  return (
    <div className="console-preview">
      <div className="console-preview-frame" role="img" aria-label="Restart Console: systems overview with health, delivery progress, and deployment activity">
        <aside className="cpv-side">
          <div className="cpv-ws"><span className="cpv-ws-avatar">A<i /></span><span className="cpv-ws-text"><b>Acme Operations</b></span><ChevronsUpDown size={14} /></div>
          <div className="cpv-nav">
            {NAV.map(({ label, icon: Icon, active }) => (
              <span key={label} className={active ? "active" : undefined}><Icon size={15} />{label}</span>
            ))}
            <small>Account</small>
            {ACCOUNT.map(({ label, icon: Icon }) => <span key={label}><Icon size={15} />{label}</span>)}
          </div>
        </aside>

        <div className="cpv-main">
          <div className="cpv-top">
            <div className="cp-tabs"><a className="active">Overview</a><a>Systems</a><a>Delivery</a></div>
            <div className="cpv-top-right">
              <span className="cpv-icon"><Bell size={15} /></span>
              <span className="cpv-cta">Start a Project <ArrowUpRight size={13} /></span>
              <span className="cpv-icon"><User size={14} /></span>
            </div>
          </div>

          <div className="cpv-body">
            <div className="cp-head">
              <span className="cp-eyebrow">Acme Operations</span>
              <h1>Systems Overview</h1>
              <p>Your systems are healthy — every system, deploy, and delivery milestone in one place.</p>
            </div>

            <div className="cp-stats">
              <div><small>SYSTEMS</small><strong>10</strong><em>All healthy</em></div>
              <div><small>NEEDS ATTENTION</small><strong>0</strong><em>Nothing flagged</em></div>
              <div><small>DELIVERY</small><strong>3<span>/5</span></strong><em>Billing integration</em></div>
              <div><small>DEPLOYS</small><strong>24</strong><em>3 in last 24h</em></div>
            </div>

            <div className="cp-grid">
              <div className="cp-card">
                <div className="cp-card-head"><span>Systems</span><em>All healthy</em></div>
                {SYSTEMS.map((s) => (
                  <div key={s.name} className="cp-row">
                    <i className="cp-dot" />
                    <span className="cp-name">{s.name}<small>{s.kind} · checked {s.checked}</small></span>
                    <span className="cp-status">Healthy</span>
                  </div>
                ))}
              </div>
              <div className="cp-card">
                <div className="cp-card-head"><span>Deployment activity</span><em>Last 24 deploys</em></div>
                <div className="cp-bars">
                  {DEPLOYS.map((n, i) => <i key={i} style={{ height: `${(n / max) * 100}%` }}><b className="healthy" style={{ flexGrow: 1 }} /></i>)}
                </div>
                <div className="cp-card-head cp-sub"><span>Current delivery</span><span className="cp-head-link">All milestones <ArrowRight size={11} /></span></div>
                <div className="cp-progress"><i style={{ width: "60%" }} /></div>
                <div className="cp-milestone"><span>Billing integration</span><span>60%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <a className="cp-chip" href={href}>Open the console <ArrowUpRight size={13} /></a>
    </div>
  );
}
