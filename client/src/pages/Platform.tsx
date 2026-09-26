import { openCookieSettings } from "@/lib/consent";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  ArrowUpRight,
  Clock,
  CreditCard,
  History,
  Key,
  LifeBuoy,
  Map as MapIcon,
  Menu,
  Server,
  Shield,
  Workflow,
  Layers3,
  X,
} from "lucide-react";
import DeliveryPreview from "@/components/DeliveryPreview";
import { platformStack } from "@/data/stack";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

/*
 * The three steps are the homepage platform section's three points, each
 * with what the client actually receives at the end of it. The console
 * features are the console's real navigation, not a wish list.
 */
const steps = [
  {
    icon: MapIcon,
    number: "01",
    title: "See the system clearly.",
    text: "We map the workflows, owners, tools, and monthly spend that run the business, and mark where time and money leak.",
    deliverable: "A written workflow and cost map, with the three constraints worth fixing first.",
  },
  {
    icon: Workflow,
    number: "02",
    title: "Remove the repeatable friction.",
    text: "Manual hand-offs become n8n automations, Laravel and Filament internal tools, and integrations between the systems you already pay for.",
    deliverable: "Automations with a named owner, run logs, and an alert when a step fails.",
  },
  {
    icon: Layers3,
    number: "03",
    title: "Create capacity for the next stage.",
    text: "Where the business has outgrown its tools, we build the platform underneath: Laravel or Next.js on PostgreSQL, with tenancy, jobs, and observability from the start.",
    deliverable: "A production system with documentation your team can run without us.",
  },
];

const consoleFeatures = [
  { icon: Server, title: "Systems", text: "Every application, service, and database we run for you, with its current health and last check." },
  { icon: Clock, title: "Delivery", text: "Milestones, progress, and the task list behind each one, updated as the work moves." },
  { icon: History, title: "Activity & timeline", text: "Deploys, changes, and decisions in order, so nothing happens to your system off the record." },
  { icon: Shield, title: "Security & access", text: "Who on your team can see what, with sign-in protection on every account." },
  { icon: Key, title: "API keys", text: "Keys for the systems we build, issued and revoked from one place." },
  { icon: CreditCard, title: "Billing & SLA", text: "Plans, invoices, and payment in naira or dollars, next to the service levels they cover." },
  { icon: LifeBuoy, title: "Support", text: "Open a ticket against your own workspace and follow the reply thread in the console." },
];

export default function Platform() {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({
      title: "Platform",
      description: "How Restart turns operational friction into technical leverage: map the workflows and costs, automate the repeatable work, and build the platform underneath — tracked in the Restart Console.",
      path: "/platform",
    });
    return () => resetSeoToDefault();
  }, []);

  return (
    <div className="page-shell">
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <nav className={menuOpen ? "open" : ""}>
          <Link href="/platform" className="active" onClick={() => setMenuOpen(false)}>
            <span>PLATFORM</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/#solutions" onClick={() => setMenuOpen(false)}>
            <span>SOLUTIONS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/#work" onClick={() => setMenuOpen(false)}>
            <span>WAYS TO ENGAGE</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/case-studies" onClick={() => setMenuOpen(false)}>
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
            <Link href="/start-project" className="header-cta">Start a Project <ArrowUpRight size={14} /></Link>
          </div>
        </nav>
        <div className="header-actions">
          <a href={consoleHref} className="login-link">{consoleLabel}</a>
          <Link href="/start-project" className="header-cta">Start a Project <ArrowUpRight size={14} /></Link>
          <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <main>
        {/* Intro, with the same Delivery view as the homepage section */}
        <section className="saas-section container platform-page-hero">
          <div className="saas-wrap">
            <div className="saas-copy">
              <span className="section-label teal">PLATFORM</span>
              <h1>Turn operational friction into <span>technical leverage.</span></h1>
              <p>
                Most operational drag isn't one broken system. It's the spreadsheet between two tools, the approval that
                lives in someone's inbox, and the software bill nobody has audited since the business was half its size.
              </p>
              <p>
                We map that work, automate what repeats, and build the platform underneath when the business has
                outgrown its tools. You follow every step in the Restart Console.
              </p>
              <div className="final-cta-buttons platform-page-actions">
                <Link href="/start-project" className="button solid">Tell us where it's stuck <ArrowUpRight size={15} /></Link>
                <a href={consoleHref} className="button outline">{session ? "Open your console" : "Console login"}</a>
              </div>
            </div>
            <div className="saas-art platform-art platform-page-art">
              <DeliveryPreview />
            </div>
          </div>
        </section>

        {/* The three steps, each with its deliverable */}
        <section className="lanes-section container" id="how-it-works">
          <div className="section-intro centered">
            <span className="section-label teal">HOW IT WORKS</span>
            <h2>Three steps, <span>each with something you keep.</span></h2>
            <p>Every step ends in a deliverable you own, whether or not we do the next one.</p>
          </div>
          <div className="platform-steps">
            {steps.map(({ icon: Icon, number, title, text, deliverable }) => (
              <article key={number} className="lane-card teal platform-step">
                <div className="lane-top">
                  <span className="lane-number">{number}</span>
                  <Icon size={17} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="platform-deliverable">
                  <small>YOU RECEIVE</small>
                  <span>{deliverable}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* The console */}
        <section className="proof-section" id="console">
          <div className="container">
            <div className="section-intro centered">
              <span className="section-label teal">THE RESTART CONSOLE</span>
              <h2>No black box <span>between you and the work.</span></h2>
              <p>Every client workspace gets its own Restart Console. These are its sections.</p>
            </div>
            <div className="proof-grid platform-console-grid">
              {consoleFeatures.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon size={18} />
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stack */}
        <section className="integration-section">
          <div className="container integration-wrap">
            <div className="section-copy">
              <span className="section-label teal">WE BUILD ON</span>
              <h2>Named tools, <span>not a proprietary layer.</span></h2>
              <p>Everything we build runs on open, documented technology you could hire for tomorrow. If we part ways, the system stays yours and stays operable.</p>
            </div>
            <ul className="integration-wall">
              {platformStack.map((item) => (
                <li key={item.name} className="integration-icon" tabIndex={0}>
                  <img src={item.logo} alt="" aria-hidden="true" />
                  <span className="integration-name">{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="final-cta" id="contact">
          <div className="final-cta-grid" />
          <div className="container final-cta-content">
            <span className="section-label teal">START WITH THE MAP</span>
            <h2>Find out where <span>the friction is.</span></h2>
            <p>Tell us which workflow costs you the most time. We'll reply with whether a mapping engagement makes sense and what it would cover.</p>
            <div className="final-cta-buttons">
              <Link href="/start-project" className="button solid">Start a project <ArrowUpRight size={15} /></Link>
              <Link href="/contact" className="button outline">Get in touch</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
