import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  RefreshCw,
  User,
  ChevronDown,
  LayoutGrid,
  Server,
  Clock,
  Terminal,
  Settings,
  CreditCard,
  Key,
  LogOut,
  Shield,
  Bell,
  Check,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Users,
  LifeBuoy,
  Sparkles,
  X,
  Menu
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { MARKETING_URL } from "@/lib/site";
import { getDisplayName } from "@/lib/utils";
import { ConsoleFooter } from "./ConsoleFooter";

interface ConsoleLayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const NAV_GROUPS: Array<{
  label: string | null;
  items: Array<{ href: string; label: string; icon: typeof Server; adminOnly?: boolean; external?: boolean }>;
}> = [
  {
    label: null,
    items: [
      { href: "/console/overview", label: "Overview", icon: LayoutGrid },
      { href: "/console/systems", label: "Systems", icon: Server },
      { href: "/console/delivery", label: "Delivery", icon: Clock },
      { href: "/console/activity", label: "Activity", icon: Terminal }
    ]
  },
  {
    label: "Admin",
    items: [{ href: "/console/leads", label: "Leads", icon: Users, adminOnly: true }]
  },
  {
    label: "Account",
    items: [
      { href: "/console/profile", label: "Security & Access", icon: Shield },
      { href: "/console/keys", label: "API Keys", icon: Key },
      { href: "/console/settings", label: "Settings", icon: Settings },
      { href: "/console/billing", label: "Billing & SLA", icon: CreditCard },
      { href: "/console/support", label: "Help & Support", icon: LifeBuoy }
    ]
  }
];

export function ConsoleLayout({ children, onRefresh, isRefreshing = false }: ConsoleLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, isAdmin, setActiveWorkspaceId } = useWorkspace();
  const displayName = getDisplayName(user);
  const displayEmail = user?.email || "";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(workspaceSearch.trim().toLowerCase())
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("console.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Per-viewer convenience only (which promo they've already dismissed) --
  // bump the key if the promo copy changes so it resurfaces once.
  const [promoDismissed, setPromoDismissed] = useState(() => {
    try {
      return localStorage.getItem("console.promoDismissed.ai-engineering") === "1";
    } catch {
      return false;
    }
  });
  const dismissPromo = () => {
    setPromoDismissed(true);
    try {
      localStorage.setItem("console.promoDismissed.ai-engineering", "1");
    } catch {}
  };
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
        setWorkspaceSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchWorkspace = (workspace: { id: string; name: string }) => {
    setActiveWorkspaceId(workspace.id);
    setWorkspaceMenuOpen(false);
    setWorkspaceSearch("");
    toast.success(`Switched to workspace: ${workspace.name}`);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out of console session");
    setLocation("/login");
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      toast.info("Refreshed console state");
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("console.sidebarCollapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  return (
    <div className="console-app-shell">
      {mobileSidebarOpen && (
        <div className="console-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <aside className={`console-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="console-sidebar-brand-row">
          <a href={MARKETING_URL} className="console-sidebar-brand" aria-label="Restart home">
            <span className="restart-mark" aria-hidden="true"><span /></span>
            <span className="console-sidebar-brand-text">
              <span className="console-sidebar-brand-name">RESTART INC<span className="logo-dot">.</span></span>
              <span className="dash-tag">CONSOLE</span>
            </span>
          </a>
          <button
            onClick={toggleSidebar}
            className="console-sidebar-collapse-btn"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="console-sidebar-mobile-close"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="console-sidebar-nav" aria-label="Console">
          {NAV_GROUPS.map((group, idx) => {
            const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
            if (visibleItems.length === 0) return null;
            return (
            <div className="console-sidebar-group" key={group.label ?? `group-${idx}`}>
              {group.label && <span className="console-sidebar-group-label">{group.label}</span>}
              {visibleItems.map(({ href, label, icon: Icon, external }) =>
                external ? (
                  <a key={href} href={href} title={label} className="console-sidebar-link">
                    <Icon size={15} />
                    <span>{label}</span>
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={`console-sidebar-link ${location === href ? "active" : ""}`}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                  </Link>
                )
              )}
            </div>
            );
          })}
        </nav>

        <div className="console-sidebar-footer">
          {!promoDismissed && !sidebarCollapsed && (
            <div className="sidebar-promo-card">
              <button className="sidebar-promo-close" onClick={dismissPromo} aria-label="Dismiss">
                <X size={12} />
              </button>
              <span className="sidebar-promo-kicker">
                <Sparkles size={11} />
                AI ENGINEERING
              </span>
              <h5>Put AI where it can earn trust</h5>
              <p>Agentic workflows, LLM integration, and automation built into your own stack.</p>
              <a href={`${MARKETING_URL}/solutions/ai-engineering`} className="sidebar-promo-cta">
                Explore the offer
                <ArrowUpRight size={12} />
              </a>
            </div>
          )}
          <a href={`${MARKETING_URL}/start-project`} title="Start a Project" className="dash-action-btn full-width">
            <span>Start a Project</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>

      <div className="dash-content-col">
        <header className="dash-top-bar">
          <div className="dash-top-left">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="mobile-sidebar-toggle"
              aria-label="Open menu"
            >
              <Menu size={17} />
            </button>
            <div className="dash-workspace-menu-wrapper" ref={workspaceMenuRef}>
              <button
                onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                className={`dash-org-badge clickable ${workspaceMenuOpen ? "active" : ""}`}
                title="Switch workspace"
                aria-expanded={workspaceMenuOpen}
              >
                <span className={`org-dot ${activeWorkspace?.server?.isReachable ? "" : "down"}`} />
                <span className="org-name">{activeWorkspace?.name ?? "Loading…"}</span>
                {activeWorkspace?.tier && <span className="org-pod">{activeWorkspace.tier}</span>}
                <ChevronDown size={12} className={`dash-user-chevron ${workspaceMenuOpen ? "rotate" : ""}`} />
              </button>

              {workspaceMenuOpen && (
                <div className="dash-dropdown-menu workspace-dropdown">
                  <div className="dash-dropdown-header">
                    <span className="dropdown-user-name">Switch Workspace</span>
                    <span className="dropdown-user-email">Projects you have access to</span>
                  </div>

                  {workspaces.length > 0 && (
                    <div className="workspace-search-box">
                      <Search size={13} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search projects…"
                        value={workspaceSearch}
                        onChange={(e) => setWorkspaceSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {workspaces.length === 0 && (
                    <div className="dash-dropdown-item" style={{ cursor: "default" }}>
                      <span>No workspaces assigned yet</span>
                    </div>
                  )}

                  <div className="workspace-dropdown-list">
                    {workspaces.length > 0 && filteredWorkspaces.length === 0 && (
                      <div className="dash-dropdown-item" style={{ cursor: "default" }}>
                        <span>No projects match "{workspaceSearch}"</span>
                      </div>
                    )}

                    {filteredWorkspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => handleSwitchWorkspace(workspace)}
                        className={`dash-dropdown-item workspace-dropdown-item ${activeWorkspace?.id === workspace.id ? "active-link" : ""}`}
                      >
                        <Building2 size={14} />
                        <span className="workspace-dropdown-item-text">
                          <span>{workspace.name}</span>
                          {workspace.tier && <span className="workspace-dropdown-item-server">{workspace.tier}</span>}
                        </span>
                        {activeWorkspace?.id === workspace.id && <Check size={13} className="dash-workspace-check" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="dash-top-right">
            <button
              onClick={() => toast.info("Notifications aren't connected yet")}
              className="dash-icon-btn dash-notif-btn"
              title="Notifications (not connected yet)"
            >
              <Bell size={15} />
            </button>

            <button
              onClick={handleRefreshClick}
              className={`dash-icon-btn ${isRefreshing ? "spin" : ""}`}
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>

            <a href={`${MARKETING_URL}/start-project`} className="dash-action-btn">
              <span>Start a Project</span>
              <ArrowUpRight size={14} />
            </a>

            <div className="dash-user-menu-wrapper" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`dash-user-trigger ${userMenuOpen ? "active" : ""}`}
                title="Account"
                aria-expanded={userMenuOpen}
              >
                <div className="dash-user-avatar">
                  <User size={14} />
                </div>
                <ChevronDown size={12} className={`dash-user-chevron ${userMenuOpen ? "rotate" : ""}`} />
              </button>

              {userMenuOpen && (
                <div className="dash-dropdown-menu">
                  <div className="dash-dropdown-header">
                    <span className="dropdown-user-name">{displayName}</span>
                    <span className="dropdown-user-email">{displayEmail}</span>
                  </div>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="dash-dropdown-item logout"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dash-main container">{children}</main>

        <ConsoleFooter />
      </div>
    </div>
  );
}
