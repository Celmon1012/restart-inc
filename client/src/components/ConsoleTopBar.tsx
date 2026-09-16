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
  Shield
} from "lucide-react";
import { toast } from "sonner";

interface ConsoleTopBarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ConsoleTopBar({ onRefresh, isRefreshing = false }: ConsoleTopBarProps) {
  const [location, setLocation] = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        <Link href="/" className="site-logo">
          <span className="restart-mark" />
          <span>RESTART<span className="logo-dot">.</span></span>
        </Link>
        <Link href="/dashboard" className="dash-tag">
          <span>OPERATOR CONSOLE</span>
        </Link>
        <div className="dash-org-badge">
          <span className="org-dot" />
          <span className="org-name">Acme Global Logistics</span>
          <span className="org-pod">Pod #04 · Senior Dedicated</span>
        </div>
      </div>

      <div className="dash-top-right">
        <div className="dash-status-pill">
          <span className="pulse-dot" />
          <span>3 SYSTEMS LIVE · 99.994% UPTIME</span>
        </div>

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
