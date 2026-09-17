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
  PanelLeftOpen
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { MARKETING_URL } from "@/lib/site";
import { ConsoleFooter } from "./ConsoleFooter";

interface ConsoleLayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const NAV_GROUPS: Array<{ label: string | null; items: Array<{ href: string; label: string; icon: typeof Server }> }> = [
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
    label: "Account",
    items: [
      { href: "/console/profile", label: "Security & Access", icon: Shield },
      { href: "/console/keys", label: "API Keys", icon: Key },
      { href: "/console/settings", label: "Settings", icon: Settings },
      { href: "/console/billing", label: "Billing & SLA", icon: CreditCard }
    ]
  }
];

export function ConsoleLayout({ children, onRefresh, isRefreshing = false }: ConsoleLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspaceId } = useWorkspace();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Operator";
  const displayEmail = user?.email || "";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("console.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchWorkspace = (workspace: { id: string; name: string }) => {
    setActiveWorkspaceId(workspace.id);
    setWorkspaceMenuOpen(false);
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
      <aside className={`console-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="console-sidebar-brand-row">
          <a href={MARKETING_URL} className="console-sidebar-brand" aria-label="Restart home">
            <span className="restart-mark" aria-hidden="true"><span /></span>
            <span>RESTART INC<span className="logo-dot">.</span></span>
          </a>
          <button
            onClick={toggleSidebar}
            className="console-sidebar-collapse-btn"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <nav className="console-sidebar-nav" aria-label="Console">
          {NAV_GROUPS.map((group, idx) => (
            <div className="console-sidebar-group" key={group.label ?? `group-${idx}`}>
              {group.label && <span className="console-sidebar-group-label">{group.label}</span>}
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`console-sidebar-link ${location === href ? "active" : ""}`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="console-sidebar-footer">
          <a href={`${MARKETING_URL}/start-project`} title="Start a Project" className="dash-action-btn full-width">
            <span>Start a Project</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>

      <div className="dash-content-col">
        <header className="dash-top-bar">
          <div className="dash-top-left">
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

                  {workspaces.length === 0 && (
                    <div className="dash-dropdown-item" style={{ cursor: "default" }}>
                      <span>No workspaces assigned yet</span>
                    </div>
                  )}

                  {workspaces.map((workspace) => (
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
