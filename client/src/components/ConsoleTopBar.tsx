import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  RefreshCw,
  User,
  ChevronDown,
  Settings,
  CreditCard,
  Key,
  LogOut,
  Shield,
  Bell,
  Check,
  Building2
} from "lucide-react";
import { toast } from "sonner";

interface ConsoleTopBarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const workspaces = [
  { name: "Acme Global Logistics", pod: "Pod #04 · Senior Dedicated" },
  { name: "Lubcon International", pod: "Pod #02 · Standard" },
  { name: "Breadmaker Systems", pod: "Pod #07 · Senior Dedicated" },
];

export function ConsoleTopBar({ onRefresh, isRefreshing = false }: ConsoleTopBarProps) {
  const [location, setLocation] = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);
  const [unreadCount, setUnreadCount] = useState(3);
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

  const handleSwitchWorkspace = (workspace: typeof workspaces[number]) => {
    setActiveWorkspace(workspace);
    setWorkspaceMenuOpen(false);
    toast.success(`Switched to workspace: ${workspace.name}`);
  };

  const handleLogout = () => {
    toast.success("Signed out of console session");
    setLocation("/login");
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      toast.info("Refreshed console state & nodes");
    }
  };

  return (
    <header className="dash-top-bar">
      <div className="dash-top-left">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <span className="restart-mark" aria-hidden="true"><span /></span>
          <span>RESTART INC<span className="logo-dot">.</span></span>
        </Link>
        <Link href="/dashboard" className="dash-tag">
          <span>CONSOLE</span>
        </Link>
        <div className="dash-workspace-menu-wrapper" ref={workspaceMenuRef}>
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className={`dash-org-badge clickable ${workspaceMenuOpen ? "active" : ""}`}
            title="Switch workspace"
            aria-expanded={workspaceMenuOpen}
          >
            <span className="org-dot" />
            <span className="org-name">{activeWorkspace.name}</span>
            <span className="org-pod">{activeWorkspace.pod}</span>
            <ChevronDown size={12} className={`dash-user-chevron ${workspaceMenuOpen ? "rotate" : ""}`} />
          </button>

          {workspaceMenuOpen && (
            <div className="dash-dropdown-menu">
              <div className="dash-dropdown-header">
                <span className="dropdown-user-name">Switch Workspace</span>
                <span className="dropdown-user-email">Pods you have access to</span>
              </div>

              {workspaces.map((workspace) => (
                <button
                  key={workspace.name}
                  onClick={() => handleSwitchWorkspace(workspace)}
                  className={`dash-dropdown-item ${activeWorkspace.name === workspace.name ? "active-link" : ""}`}
                >
                  <Building2 size={14} />
                  <span>{workspace.name}</span>
                  {activeWorkspace.name === workspace.name && <Check size={13} className="dash-workspace-check" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-top-right">
        <button
          onClick={() => {
            setUnreadCount(0);
            toast.info("No new notifications");
          }}
          className="dash-icon-btn dash-notif-btn"
          title="Notifications"
        >
          <Bell size={15} />
          {unreadCount > 0 && <span className="dash-notif-badge">{unreadCount}</span>}
        </button>

        <button
          onClick={handleRefreshClick}
          className={`dash-icon-btn ${isRefreshing ? "spin" : ""}`}
          title="Refresh Telemetry"
        >
          <RefreshCw size={15} />
        </button>

        <Link href="/start-project" className="dash-action-btn">
          <span>Start a Project</span>
          <ArrowUpRight size={14} />
        </Link>

        {/* User Profile Avatar with Obsidian Dropdown */}
        <div className="dash-user-menu-wrapper" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`dash-user-trigger ${userMenuOpen ? "active" : ""}`}
            title="Account & Settings"
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
                <span className="dropdown-user-name">Ademola Usuf</span>
                <span className="dropdown-user-email">operator@acme-logistics.internal</span>
              </div>

              <Link
                href="/console/profile"
                onClick={() => setUserMenuOpen(false)}
                className={`dash-dropdown-item ${location === "/console/profile" ? "active-link" : ""}`}
              >
                <User size={14} />
                <span>Profile & Security</span>
              </Link>

              <Link
                href="/console/settings"
                onClick={() => setUserMenuOpen(false)}
                className={`dash-dropdown-item ${location === "/console/settings" ? "active-link" : ""}`}
              >
                <Settings size={14} />
                <span>Console Settings</span>
              </Link>

              <Link
                href="/console/keys"
                onClick={() => setUserMenuOpen(false)}
                className={`dash-dropdown-item ${location === "/console/keys" ? "active-link" : ""}`}
              >
                <Key size={14} />
                <span>API & Key Vault</span>
              </Link>

              <Link
                href="/console/billing"
                onClick={() => setUserMenuOpen(false)}
                className={`dash-dropdown-item ${location === "/console/billing" ? "active-link" : ""}`}
              >
                <CreditCard size={14} />
                <span>Billing & SLA Contract</span>
              </Link>

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
  );
}
