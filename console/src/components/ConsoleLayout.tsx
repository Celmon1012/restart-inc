import { AttentionBell } from "@/components/admin/AttentionBell";
import { DashboardSwitcher } from "@/components/DashboardSwitcher";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  MoreHorizontal,
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
  LogOut,
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
  Menu,
  ShieldCheck,
  Gauge,
  KanbanSquare,
  ListChecks,
  Inbox,
  Wallet,
  HardDrive,
  Send
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
  // "console" is the client-facing workspace view; "admin" is Restart's own
  // cross-workspace back office, shown to staff as "Ops" (sales pipeline,
  // delivery, support); "finance" is the money side. Same shell, different
  // nav -- /admin and /finance are gated by AdminRoute in App.tsx and, for
  // real, by console.is_admin() in RLS. URLs keep /admin so links don't break.
  area?: "console" | "admin" | "finance";
}

type NavGroup = {
  label: string | null;
  items: Array<{ href: string; label: string; icon: typeof Server }>;
};

const CONSOLE_NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/overview", label: "Overview", icon: LayoutGrid },
      { href: "/systems", label: "Systems", icon: Server },
      { href: "/delivery", label: "Delivery", icon: Clock },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/activity", label: "Activity", icon: Terminal },
      { href: "/timeline", label: "Timeline", icon: History }
    ]
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/billing", label: "Billing & SLA", icon: CreditCard },
      { href: "/support", label: "Help & Support", icon: LifeBuoy }
    ]
  }
];

const ADMIN_NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/admin", label: "Overview", icon: Gauge },
      { href: "/admin/clients", label: "Clients", icon: Building2 }
    ]
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads & Pipeline", icon: Users },
      { href: "/admin/outreach", label: "Outreach", icon: Send }
    ]
  },
  {
    label: "Delivery & Support",
    items: [
      { href: "/admin/projects", label: "Projects", icon: KanbanSquare },
      { href: "/admin/tasks", label: "Tasks", icon: ListChecks },
      { href: "/admin/requests", label: "Server Requests", icon: HardDrive },
      { href: "/admin/support", label: "Support Desk", icon: Inbox }
    ]
  }
];

const FINANCE_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/finance", label: "Overview", icon: Wallet }]
  }
];

const CONSOLE_TABS = [
  { href: "/overview", label: "Overview" },
  { href: "/systems", label: "Systems" },
  { href: "/delivery", label: "Delivery" }
];

const ADMIN_TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leads", label: "Pipeline" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/support", label: "Support" }
];

const FINANCE_TABS = [{ href: "/finance", label: "Overview" }];

export function ConsoleLayout({ children, onRefresh, isRefreshing = false, area = "console" }: ConsoleLayoutProps) {
  const [location, setLocation] = useLocation();
  // True for both staff areas (Ops and Finance): cross-workspace, no workspace switcher.
  const isAdminArea = area !== "console";
  const areaLabel = area === "finance" ? "Finance" : "Ops";
  const navGroups = area === "finance" ? FINANCE_NAV : isAdminArea ? ADMIN_NAV : CONSOLE_NAV;
  const topTabs = area === "finance" ? FINANCE_TABS : isAdminArea ? ADMIN_TABS : CONSOLE_TABS;
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, isAdmin, loading: workspaceLoading, setActiveWorkspaceId } = useWorkspace();
  const displayName = getDisplayName(user);
  const displayEmail = user?.email || "";
  // Resources whose current status is not healthy. Computed here so the top-bar
  // bell can report something real instead of being a placeholder.
  const attentionCount = activeWorkspace
    ? getResources(activeWorkspace).filter((r) => statusMeta(r.status).tone !== "healthy").length
    : 0;
  const attentionHref = attentionCount > 0 ? "/systems" : "/timeline";
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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const initials =
    displayName
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "R";

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

  // Same fixed-position approach as the workspace menu, but opening upward
  // since the account card sits at the bottom of the sidebar.
  const [accountMenuPos, setAccountMenuPos] = useState<React.CSSProperties | null>(null);
  const placeAccountMenu = (btn: HTMLElement) => {
    const r = btn.getBoundingClientRect();
    const collapsed = btn.closest(".console-sidebar")?.classList.contains("collapsed") && window.innerWidth > 768;
    setAccountMenuPos(
      collapsed
        ? { bottom: window.innerHeight - r.bottom, left: r.right + 24, width: 240 }
        : { bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width }
    );
  };

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = () => setAccountMenuOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountMenuOpen]);

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
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
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
    <div className={`console-app-shell ${isAdminArea ? "admin-area" : ""}`}>
      {mobileSidebarOpen && (
        <div className="console-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <aside className={`console-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        {/* Collapse/expand is the edge toggle below; the close button shows only in the mobile drawer. */}
        <div className="console-sidebar-brand-row">
          <a href={MARKETING_URL} className="console-sidebar-brand" aria-label="Restart home">
            {sidebarCollapsed ? (
              <img src="/brand/restart-mark.png" alt="Restart Inc." className="console-sidebar-mark-img" />
            ) : (
              <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
            )}
            <span className="dash-tag">{isAdminArea ? areaLabel.toUpperCase() : "CONSOLE"}</span>
          </a>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="console-sidebar-mobile-close"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* The admin area is cross-workspace -- each admin page picks its own
            client -- so the workspace switcher only belongs to the console. */}
        {!isAdminArea && (
        <div className="ws-switcher" ref={workspaceMenuRef}>
          <button
            onClick={(e) => { if (!workspaceMenuOpen) placeMenu(e.currentTarget); setWorkspaceMenuOpen(!workspaceMenuOpen); }}
            className={`ws-switcher-btn ${workspaceMenuOpen ? "active" : ""}`}
            title={activeWorkspace?.name ?? "Switch project"}
            aria-haspopup="menu"
            aria-expanded={workspaceMenuOpen}
          >
            <span className="ws-avatar" aria-hidden="true">
              {(activeWorkspace?.name ?? "R").trim().charAt(0).toUpperCase()}
              <i className={`org-dot ${activeWorkspace?.server?.isReachable ? "" : activeWorkspace?.provisioning ? "pending" : "down"}`} />
            </span>
            <span className="ws-switcher-text">
              <span className="ws-switcher-kicker">PROJECT</span>
              <span className="ws-switcher-name">{activeWorkspace?.name ?? (workspaceLoading ? "Loading…" : "No project")}</span>
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
                {workspaces.length === 0 && <span className="ws-menu-empty">No projects assigned yet</span>}
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

              <Link role="menuitem" href="/new-project" className="ws-menu-item ws-menu-add" onClick={() => setWorkspaceMenuOpen(false)}>
                <Plus size={14} />
                <span>Add new project</span>
              </Link>

              <div className="ws-menu-sep" />
              <Link role="menuitem" href="/profile" className="ws-menu-item" onClick={() => setWorkspaceMenuOpen(false)}>
                <User size={14} />
                <span>My profile</span>
              </Link>
            </div>
          )}
        </div>
        )}

        <nav className="console-sidebar-nav" aria-label={isAdminArea ? areaLabel : "Console"}>
          {navGroups.map((group, idx) => (
            <div className="console-sidebar-group" key={group.label ?? `group-${idx}`}>
              {group.label && <span className="console-sidebar-group-label">{group.label}</span>}
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`console-sidebar-link ${location === href || (href !== "/admin" && location.startsWith(`${href}/`)) ? "active" : ""}`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="console-sidebar-footer">
          {!isAdminArea && !aiPromoDismissed && !sidebarCollapsed && (
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
              {/* Straight into the new-project flow with the AI engagement
                  preselected -- the member is already signed in, so there's
                  no reason to bounce them to the marketing page. */}
              <Link href="/new-project?engagement=ai" className="sidebar-promo-cta">
                Start an AI project
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
          <div className="sidebar-account" ref={accountMenuRef}>
            <button
              onClick={(e) => { if (!accountMenuOpen) placeAccountMenu(e.currentTarget); setAccountMenuOpen(!accountMenuOpen); }}
              className={`sidebar-account-card ${accountMenuOpen ? "active" : ""}`}
              title={displayName}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              <span className="sidebar-account-avatar" aria-hidden="true">{initials}</span>
              <span className="sidebar-account-text">
                <span className="sidebar-account-name">{displayName}</span>
                <span className="sidebar-account-role">{isAdmin ? "Restart admin" : "Client workspace"}</span>
              </span>
              <MoreHorizontal size={16} className="sidebar-account-more" />
            </button>

            {accountMenuOpen && (
              <div className="ws-menu" role="menu" style={accountMenuPos ?? undefined}>
                <div className="dash-dropdown-header">
                  <span className="dropdown-user-name">{displayName}</span>
                  <span className="dropdown-user-email">{displayEmail}</span>
                </div>
                <Link role="menuitem" href="/profile" className="ws-menu-item" onClick={() => setAccountMenuOpen(false)}>
                  <User size={14} />
                  <span>My profile</span>
                </Link>
                <Link role="menuitem" href="/settings" className="ws-menu-item" onClick={() => setAccountMenuOpen(false)}>
                  <Settings size={14} />
                  <span>Settings</span>
                </Link>
                {isAdmin && (
                  <Link
                    role="menuitem"
                    href={isAdminArea ? "/overview" : "/admin"}
                    className="ws-menu-item"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    {isAdminArea ? <LayoutGrid size={14} /> : <ShieldCheck size={14} />}
                    <span>{isAdminArea ? "Client console" : "Ops"}</span>
                  </Link>
                )}
                <div className="ws-menu-sep" />
                <button
                  role="menuitem"
                  className="ws-menu-item sidebar-account-logout"
                  onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
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
            <nav className="cp-tabs" aria-label={isAdminArea ? `${areaLabel} views` : "Workspace views"}>
              {topTabs.map((t) => (
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
            {!isAdminArea && (
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
            )}

            {isAdminArea && <AttentionBell />}

            {!isAdminArea && (
              <Link href="/new-project" className="dash-action-btn">
                <Plus size={14} />
                <span>Start a Project</span>
              </Link>
            )}

            {/* Admin entry point, rendered only for admins (isAdmin comes from
                console-data's server-side read of app_metadata). The area
                itself is still enforced by AdminRoute + RLS, not this button.
                Icon-only in both areas, sitting just before the account menu. */}
            {isAdmin && <DashboardSwitcher current={area} />}

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
