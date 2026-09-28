import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, Check, Menu, X } from "lucide-react";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

const principles = [
  {
    title: "Senior ownership, not ticket relay",
    text: "You own the problem end to end — architecture, trade-offs, production. There is no layer between you and the decision.",
  },
  {
    title: "Written before built",
    text: "We think in documents. If a design cannot be explained on a page, it is not ready to be written as code.",
  },
  {
    title: "Production is the standard",
    text: "Work is finished when it runs reliably under real load, with observability and a handover your client's team can operate.",
  },
  {
    title: "Scoped, honest commitments",
    text: "We tell clients what we can deliver and when, then we hold to it. Bad news travels early here.",
  },
];

const openRoles = [
  {
    title: "Senior Backend Engineer",
    type: "Full-time · Lagos or remote",
    focus: "Platform systems",
    summary:
      "You will design and build multi-tenant services, background job pipelines, and data layers that hold up under production load. Expect to own schema design, migration strategy, and the observability that makes a system operable.",
    wants: [
      "Strong PostgreSQL and one server-side framework in depth",
      "Comfort with queues, idempotency, and failure handling under load",
      "A habit of measuring before and after changing a system",
    ],
  },
  {
    title: "AI / Applied Systems Engineer",
    type: "Full-time · Lagos or remote",
    focus: "AI engineering",
    summary:
      "You will turn models, retrieval, and agents into product capabilities that earn trust — with evaluation harnesses, cost controls, and observability from the first commit rather than as an afterthought.",
    wants: [
      "Retrieval design: chunking, hybrid search, ranking, and evaluation",
      "Practical grounding in cost and latency trade-offs",
      "Scepticism about demos that have never met real data",
    ],
  },
  {
    title: "Product Engineer (Frontend)",
    type: "Full-time · Lagos or remote",
    focus: "Product delivery",
    summary:
      "You will build interfaces that make complex operational systems understandable — dense data presented with restraint, clear states for loading and failure, and accessibility treated as part of the build.",
    wants: [
      "Deep React and TypeScript, with an eye for layout and typography",
      "Experience with data-heavy operational interfaces",
      "Care about keyboard access and honest empty/error states",
    ],
  },
];

export default function Careers() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({
      title: "Careers",
      description:
        "Work at Restart Inc. — senior engineering ownership, scoped delivery, and production discipline. Open roles in platform engineering, AI systems, and product engineering.",
      path: "/careers",
    });
    window.scrollTo(0, 0);
    return () => resetSeoToDefault();
  }, []);

  return (
    <div className="page-shell">
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <nav className={menuOpen ? "open" : ""}>
          <Link href="/platform" onClick={() => setMenuOpen(false)}>
            <span>PLATFORM</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/solutions" onClick={() => setMenuOpen(false)}>
            <span>SOLUTIONS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/case-studies" className={location.startsWith("/case-studies") ? "active" : ""} onClick={() => setMenuOpen(false)}>
            <span>PROOF</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/insights" onClick={() => setMenuOpen(false)}>
            <span>INSIGHTS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/about" onClick={() => setMenuOpen(false)}>
            <span>ABOUT</span>
            <span className="nav-indicator" />
          </Link>
          <div className="mobile-nav-actions">
            <a href={consoleHref}>{consoleLabel}</a>
            <Link href="/start-project" className="header-cta">
              Start a Project <ArrowUpRight size={14} />
            </Link>
          </div>
        </nav>
        <div className="header-actions">
          <a href={consoleHref} className="login-link">{consoleLabel}</a>
          <Link href="/start-project" className="header-cta">
            Start a Project <ArrowUpRight size={14} />
          </Link>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <main>
        <section className="careers-hero container">
          <span className="section-label teal">CAREERS</span>
          <h1>
            Senior work,<br />
            <span>owned end to end.</span>
          </h1>
          <p className="careers-lede">
            Restart is a small engineering firm. We take on a limited number of engagements so
            that senior ownership stays real rather than a claim in a proposal. If you want to
            own architecture and see your decisions run in production, this is the place.
          </p>
        </section>

        <section className="careers-principles container">
          <div className="section-intro">
            <span className="section-label teal">HOW WE WORK</span>
            <h2>What you can expect <span>from the first week.</span></h2>
          </div>
          <div className="careers-principle-grid">
            {principles.map((p, i) => (
              <article key={p.title} className="careers-principle">
                <span className="careers-principle-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="careers-roles container">
          <div className="section-intro">
            <span className="section-label teal">OPEN ROLES</span>
            <h2>Where we need <span>senior hands.</span></h2>
            <p>
              We hire when the work is real, not to fill a spreadsheet. Roles below are open
              continuously — if your experience fits, write to us even if a title differs.
            </p>
          </div>

          <div className="careers-role-list">
            {openRoles.map((role) => (
              <article key={role.title} className="careers-role">
                <div className="careers-role-head">
                  <div>
                    <h3>{role.title}</h3>
                    <span className="careers-role-meta">
                      {role.type} · <strong>{role.focus}</strong>
                    </span>
                  </div>
                  <a
                    className="button outline small careers-role-apply"
                    href={`mailto:careers@restart.ng?subject=${encodeURIComponent(role.title)}`}
                  >
                    Apply <ArrowUpRight size={13} />
                  </a>
                </div>
                <p className="careers-role-summary">{role.summary}</p>
                <ul className="careers-role-wants">
                  {role.wants.map((w) => (
                    <li key={w}>
                      <Check size={13} />
                      {w}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="careers-open-application">
            <div>
              <strong>Nothing here matches, but you think you'd add to this?</strong>
              <span>
                Send your work — a repository, a write-up, a system you are proud of — and tell
                us what you want to own next. We read every application personally.
              </span>
            </div>
            <a className="button solid" href="mailto:careers@restart.ng?subject=Open%20application">
              careers@restart.ng <ArrowUpRight size={14} />
            </a>
          </div>
        </section>

        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">NOT LOOKING TO JOIN?</span>
            <h2>
              Bring us the hard part.<br />
              <span>We'll help you build it.</span>
            </h2>
            <p>
              Whether you want to work here or work with us, the first conversation is the same:
              tell us what you are building and where it is stuck.
            </p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">
                Start a project <ArrowUpRight size={15} />
              </Link>
              <Link href="/about" className="button outline">
                About Restart
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link href="/" className="site-logo">
              <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
            </Link>
            <p>Engineering systems your growth depends on.</p>
            <div className="footer-brand-contact">
              <a href="mailto:hello@restart.ng">hello@restart.ng</a>
              <a href="tel:+2349060114747">+234 906 011 4747</a>
            </div>
          </div>
          <div>
            <strong>PLATFORM</strong>
            <Link href="/platform">Platform</Link>
            <Link href="/solutions">Solutions</Link>
            <Link href="/case-studies">Case Studies</Link>
            <Link href="/insights">Insights</Link>
          </div>
          <div>
            <strong>COMPANY</strong>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/careers">Careers</Link>
          </div>
          <div>
            <strong>CONNECT</strong>
            <a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">
              LinkedIn <ArrowUpRight size={12} />
            </a>
            <a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={12} />
            </a>
            <Link href="/start-project" className="footer-text-btn">
              Book an intro <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span>
          <span>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button>
          </span>
        </div>
      </footer>
    </div>
  );
}
