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
import ProcessSlider from "@/components/ProcessSlider";
import ToolsHub from "@/components/ToolsHub";
import { FaqSection, ContactSection, SignOff } from "@/components/PageSections";
import { useReveal } from "@/hooks/useReveal";
import "@/styles/solutions.css";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

/*
 * The three steps are the platform method, each with what the client
 * actually receives at the end of it. The console
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

  useReveal();

  useEffect(() => {
    applyPageSeo({
      title: "Platform",
      description: "The Restart Console: every system we build, with its health, delivery milestones, activity, access, billing, and support in one client workspace.",
      path: "/platform",
    });
    return () => resetSeoToDefault();
  }, []);

  return (
    <div className="page-shell sol-page">
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <nav className={menuOpen ? "open" : ""}>
          <Link href="/platform" className="active" onClick={() => setMenuOpen(false)}>
            <span>PLATFORM</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/solutions" onClick={() => setMenuOpen(false)}>
            <span>SOLUTIONS</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/case-studies" onClick={() => setMenuOpen(false)}>
            <span>CASE STUDIES</span>
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
        <section className="sol-hero">
          <div className="sol-hero-art" aria-hidden="true">
            <span className="sol-orb a" /><span className="sol-orb b" /><span className="sol-orb c" />
            <span className="sol-hero-grid" />
          </div>
          <div>
            <span className="sol-eyebrow">THE RESTART CONSOLE</span>
            <h1>Every system we build, visible in <span className="sol-pill">one place.</span></h1>
            <p>Each client gets a Restart Console: system health, delivery milestones, activity, access, billing, and support in one workspace. Nothing happens to your system off the record.</p>
            <div className="sol-hero-actions">
              <a href={consoleHref} className="button solid">{session ? "Open your console" : "Console login"} <ArrowUpRight size={15} /></a>
              <Link href="/scorecard" className="button outline">Score your system</Link>
            </div>
          </div>
        </section>

        <section className="sol-wrap pf-mock">
          <div className="pf-frame sol-reveal">
            <span className="pf-glow" aria-hidden="true" />
            <div className="saas-art platform-art platform-page-art">
              <DeliveryPreview />
            </div>
          </div>
        </section>

        <section className="sol-section sol-wrap" id="console">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">INSIDE THE CONSOLE</span>
            <h2 className="sol-h2">No black box <span>between you and the work.</span></h2>
            <p className="sol-lede">Every client workspace gets its own Console. These are its sections.</p>
          </div>
          <div className="ab-principles pf-features">
            {consoleFeatures.map(({ icon: Icon, title, text }, i) => (
              <article className="ab-principle sol-reveal" style={{ "--d": i % 3 } as React.CSSProperties} key={title}>
                <span className="ab-principle-icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <ProcessSlider
          id="how-it-works"
          label="How it works"
          heading={<>Three Steps,<br />Each One Yours</>}
          steps={steps.map((s, i) => ({ icon: s.icon, title: s.title.replace(/\.$/, ""), text: s.text, phase: ["Map", "Automate", "Build"][i], note: s.deliverable }))}
        />

        <section className="sol-section sol-wrap" id="stack">
          <div className="sol-head sol-reveal">
            <span className="sol-eyebrow">WE BUILD ON</span>
            <h2 className="sol-h2">Named tools, <span>not a proprietary layer.</span></h2>
            <p className="sol-lede">Everything we build runs on open, documented technology you could hire for tomorrow. If we part ways, the system stays yours and stays operable.</p>
          </div>
          <ToolsHub />
        </section>

        <FaqSection />
        <ContactSection
          eyebrow="FREE ASSESSMENT · 5 MINUTES"
          heading={<>Score your system. <span>Find the friction.</span></>}
          lede="Answer 12 questions across 6 areas. You get a readiness score, your weakest areas, and the first steps we would take."
          card={{
            title: "Take the Readiness Scorecard",
            text: "Twelve questions, scored instantly. No call, no sales follow-up unless you ask for one.",
            primary: { label: "Start the scorecard", href: "/scorecard" },
            secondary: { label: "Get in touch", href: "/contact" },
          }}
        />
        <SignOff />
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/platform">Platform</Link><Link href="/solutions">Solutions</Link><Link href="/case-studies">Case Studies</Link><Link href="/insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/careers">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><button type="button" className="footer-cookie-btn" onClick={openCookieSettings}>Cookie settings</button></span></div></footer>
    </div>
  );
}
