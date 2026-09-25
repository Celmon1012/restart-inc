import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  Briefcase,
  User,
  ChevronDown,
  ChevronsUpDown,
  Plus,
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
  History,
  ChevronLeft,
  ChevronRight,
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
import { getResources, statusMeta } from "@/lib/resources";
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
      { href: "/console/activity", label: "Activity", icon: Terminal },
      { href: "/console/timeline", label: "Timeline", icon: History }
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

const TOP_TABS = [
  { href: "/console/overview", label: "Overview" },
  { href: "/console/systems", label: "Systems" },
  { href: "/console/delivery", label: "Delivery" }
];

export function ConsoleLayout({ children, onRefresh, isRefreshing = false }: ConsoleLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, isAdmin, loading: workspaceLoading, setActiveWorkspaceId } = useWorkspace();
  const displayName = getDisplayName(user);
  const displayEmail = user?.email || "";
  // Resources whose current status is not healthy. Computed here so the top-bar
  // bell can report something real instead of being a placeholder.
  const attentionCount = activeWorkspace
    ? getResources(activeWorkspace).filter((r) => statusMeta(r.status).tone !== "healthy").length
    : 0;
  const attentionHref = attentionCount > 0 ? "/console/systems" : "/console/timeline";
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
  const [aiPromoDismissed, setAiPromoDismissed] = useState(() => {
    try {
      return localStorage.getItem("console.promoDismissed.ai-engineering") === "1";
    } catch {
      return false;
    }
  });
  const dismissAiPromo = () => {
    setAiPromoDismissed(true);
    try {
      localStorage.setItem("console.promoDismissed.ai-engineering", "1");
    } catch {}
  };
  const [operatorPromoDismissed, setOperatorPromoDismissed] = useState(() => {
    try {
      return localStorage.getItem("console.promoDismissed.operator-as-a-service") === "1";
    } catch {
      return false;
    }
  });
  const dismissOperatorPromo = () => {
    setOperatorPromoDismissed(true);
    try {
      localStorage.setItem("console.promoDismissed.operator-as-a-service", "1");
    } catch {}
  };
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  // The sidebar scrolls (overflow-y), which clips any absolutely positioned
  // child that sticks out -- including the collapsed-rail flyout. So the menu is
  // position: fixed and anchored to the switcher button's on-screen rect:
  // below it when the sidebar is expanded, beside it when collapsed.
  const [menuPos, setMenuPos] = useState<React.CSSProperties | null>(null);
  const placeMenu = (btn: HTMLElement) => {
    const r = btn.getBoundingClientRect();
    const collapsed = btn.closest(".console-sidebar")?.classList.contains("collapsed") && window.innerWidth > 768;
    setMenuPos(
      collapsed
        ? { top: r.top, left: r.right + 24, width: 260 } // clears the edge toggle
        : { top: r.bottom + 6, left: r.left, width: r.width }
    );
  };

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const close = () => {
      setWorkspaceMenuOpen(false);
      setWorkspaceSearch("");
    };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWorkspaceMenuOpen(false);
        setWorkspaceSearch("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [workspaceMenuOpen]);

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
        {/* Mobile drawer only: the desktop collapse control is the edge toggle below. */}
        <div className="console-sidebar-mobile-head">
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="console-sidebar-mobile-close"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ws-switcher" ref={workspaceMenuRef}>
          <button
            onClick={(e) => { if (!workspaceMenuOpen) placeMenu(e.currentTarget); setWorkspaceMenuOpen(!workspaceMenuOpen); }}
            className={`ws-switcher-btn ${workspaceMenuOpen ? "active" : ""}`}
            title={activeWorkspace?.name ?? "Switch workspace"}
            aria-haspopup="menu"
            aria-expanded={workspaceMenuOpen}
          >
            <span className="ws-avatar" aria-hidden="true">
              {(activeWorkspace?.name ?? "R").trim().charAt(0).toUpperCase()}
              <i className={`org-dot ${activeWorkspace?.server?.isReachable ? "" : activeWorkspace?.provisioning ? "pending" : "down"}`} />
            </span>
            <span className="ws-switcher-text">
              <span className="ws-switcher-name">{activeWorkspace?.name ?? (workspaceLoading ? "Loading…" : "No workspace")}</span>
            </span>
            <ChevronsUpDown size={14} className="ws-switcher-chevron" />
          </button>

          {workspaceMenuOpen && (
            <div className="ws-menu" role="menu" style={menuPos ?? undefined}>
              <span className="ws-menu-label">Workspace</span>

              {workspaces.length > 5 && (
                <div className="workspace-search-box">
                  <Search size={13} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search projects…"
                    aria-label="Search projects"
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              <div className="ws-menu-list">
                {workspaces.length === 0 && <span className="ws-menu-empty">No workspaces assigned yet</span>}
                {workspaces.length > 0 && filteredWorkspaces.length === 0 && (
                  <span className="ws-menu-empty">No projects match "{workspaceSearch}"</span>
                )}
                {filteredWorkspaces.map((workspace) => {
                  const current = activeWorkspace?.id === workspace.id;
                  return (
                    <button
                      key={workspace.id}
                      role="menuitemradio"
                      aria-checked={current}
                      onClick={() => handleSwitchWorkspace(workspace)}
                      className={`ws-menu-item ${current ? "current" : ""}`}
                    >
                      <span className="ws-avatar sm" aria-hidden="true">{workspace.name.trim().charAt(0).toUpperCase()}</span>
                      <span className="ws-menu-item-text">
                        <span>{workspace.name}</span>
                      </span>
                      <span className="ws-check">{current && <Check size={14} />}</span>
                    </button>
                  );
                })}
              </div>

              <a role="menuitem" href={`${MARKETING_URL}/start-project`} className="ws-menu-item ws-menu-add">
                <Plus size={14} />
                <span>Add new project</span>
              </a>

              <div className="ws-menu-sep" />
              <Link role="menuitem" href="/console/profile" className="ws-menu-item" onClick={() => setWorkspaceMenuOpen(false)}>
                <User size={14} />
                <span>My profile</span>
              </Link>
            </div>
          )}
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
          {!operatorPromoDismissed && !sidebarCollapsed && (
            <div className="sidebar-promo-card">
              <button className="sidebar-promo-close" onClick={dismissOperatorPromo} aria-label="Dismiss">
                <X size={12} />
              </button>
              <span className="sidebar-promo-kicker">
                <Briefcase size={11} />
                BUSINESS OPERATOR AS A SERVICE
              </span>
              <h5>Let a Restart operator run your web assets</h5>
              <p>Ongoing management of your sites, domains, and vendors — one operator accountable for all of it.</p>
              <a href={`${MARKETING_URL}/start-project`} className="sidebar-promo-cta">
                Explore the offer
                <ArrowUpRight size={12} />
              </a>
            </div>
          )}
          {!aiPromoDismissed && !sidebarCollapsed && (
            <div className="sidebar-promo-card">
              <button className="sidebar-promo-close" onClick={dismissAiPromo} aria-label="Dismiss">
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
      {/* Collapse control sits on the sidebar's right edge. It lives outside
          <aside> because the sidebar scrolls (overflow-y), which would clip it. */}
      <button
        onClick={toggleSidebar}
        className={`sidebar-edge-toggle ${sidebarCollapsed ? "collapsed" : ""}`}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

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
            <nav className="cp-tabs" aria-label="Workspace views">
              {TOP_TABS.map((t) => (
                <Link key={t.href} href={t.href} className={location === t.href ? "active" : undefined} aria-current={location === t.href ? "page" : undefined}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="dash-top-right">
            {/* Was a placeholder that only explained it did nothing. It now
                carries the count of resources that are not healthy and links to
                the timeline, so it reports something real and has somewhere to go. */}
            <button
              onClick={() => setLocation(attentionHref)}
              className="dash-icon-btn dash-notif-btn"
              title={
                attentionCount > 0
                  ? `${attentionCount} system${attentionCount === 1 ? "" : "s"} need attention`
                  : "All systems healthy — view activity"
              }
              aria-label={
                attentionCount > 0
                  ? `${attentionCount} system${attentionCount === 1 ? "" : "s"} need attention. Open timeline.`
                  : "No systems need attention. Open timeline."
              }
            >
              <Bell size={15} />
              {attentionCount > 0 && (
                <span className="dash-notif-badge" aria-hidden="true">
                  {attentionCount > 9 ? "9+" : attentionCount}
                </span>
              )}
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
