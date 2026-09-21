import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CONSOLE_URL } from "@/lib/site";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ArrowUpRight, CheckCircle2, Clock, Loader2, Mail, Menu, MapPin, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";

export default function Contact() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const session = useAuthSession();
  const consoleHref = session ? `${CONSOLE_URL}/dashboard` : CONSOLE_URL;
  const consoleLabel = session ? "Dashboard" : "Console Login";

  useEffect(() => {
    applyPageSeo({
      title: "Contact",
      description: "Tell Restart Inc. what you're building and where it's stuck. We reply quickly with whether the timing and fit make sense.",
      path: "/contact",
    });
    return () => resetSeoToDefault();
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Submissions aren't configured on this deployment yet. Please email hello@restart.ng directly.");
      setStatus("idle");
      return;
    }

    const generatedRef = `RST-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    const { error: insertError } = await supabase
      .schema("console")
      .from("inquiries")
      .insert({
        reference_id: generatedRef,
        source: "contact_page",
        name,
        email,
        company: company || null,
        service_tier: null,
        budget_range: null,
        project_stage: null,
        target_timeline: null,
        project_brief: message || null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      });

    if (insertError) {
      setError("We couldn't send your message — please try again, or email hello@restart.ng directly.");
      setStatus("idle");
      return;
    }

    setReferenceId(generatedRef);
    setStatus("success");
  };

  return (
    <div className="page-shell">
      {/* Header Navigation */}
      <header className="site-header">
        <Link href="/" className="site-logo" aria-label="Restart home">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <nav className={menuOpen ? "open" : ""}>
          <Link href="/#platform" onClick={() => setMenuOpen(false)}>
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
          <Link href="/case-studies" className={location.startsWith("/case-studies") ? "active" : ""} onClick={() => setMenuOpen(false)}>
            <span>PROOF</span>
            <span className="nav-indicator" />
          </Link>
          <Link href="/insights" className={location.startsWith("/insights") ? "active" : ""} onClick={() => setMenuOpen(false)}>
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

      <main className="squeeze-main container">
        <div className="squeeze-grid">
          {/* Left Column: Contact Details */}
          <div className="squeeze-pitch">
            <span className="section-label teal">GET IN TOUCH</span>
            <h1>Let's talk about <span>what you're building.</span></h1>
            <p className="squeeze-subheading">
              Send us a message and a senior engineer will get back to you directly — no sales queue, no account rep relay.
            </p>

            <div className="squeeze-commitments">
              <div className="commitment-card">
                <Mail size={16} className="text-teal" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h4>Email</h4>
                  <p><a href="mailto:hello@restart.ng" style={{ color: "inherit" }}>hello@restart.ng</a></p>
                </div>
              </div>
              <div className="commitment-card">
                <MapPin size={16} className="text-teal" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h4>Location</h4>
                  <p>Lagos, Nigeria · working with operators globally</p>
                </div>
              </div>
              <div className="commitment-card">
                <Clock size={16} className="text-teal" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h4>Response time</h4>
                  <p>Direct response from technical leadership within 24 hours</p>
                </div>
              </div>
            </div>

            <div className="squeeze-reassurance-box">
              <div className="reassurance-row">
                <span>Have a scoped project in mind instead? <Link href="/start-project" style={{ color: "var(--teal)" }}>Start a project →</Link></span>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="squeeze-form-card">
            {status === "success" ? (
              <div className="squeeze-success-state">
                <div className="success-icon-badge">
                  <CheckCircle2 size={38} className="text-teal" />
                </div>
                <h2>Message Sent</h2>
                <p>
                  Thanks for reaching out — we've received your message and will follow up at the email you provided.
                </p>

                <div className="success-ref-card">
                  <span className="ref-label">REFERENCE ID</span>
                  <span className="ref-code">{referenceId}</span>
                  <span className="ref-sub">Keep this code for direct communication</span>
                </div>

                <div className="success-actions">
                  <Link href="/" className="button outline">Back to Home</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="squeeze-form">
                <div className="squeeze-form-header form-header">
                  <h3>Send us a message</h3>
                  <p>We read every message personally.</p>
                </div>

                <div className="form-row-two">
                  <div className="form-group">
                    <label>Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Vance"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Company / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Global Logistics"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Message *</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="What's on your mind? Question, feedback, or just want to say hello."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="form-textarea"
                  />
                </div>

                {error && <div className="form-error-banner">{error}</div>}

                <div className="form-footer-stacked">
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="button solid submit-btn-full"
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <ArrowUpRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><Link href="/" className="site-logo"><img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" /></Link><p>Engineering systems your growth depends on.</p><div className="footer-brand-contact"><a href="mailto:hello@restart.ng">hello@restart.ng</a><a href="tel:+2349060114747">+234 906 011 4747</a></div></div><div><strong>PLATFORM</strong><Link href="/#platform">Platform</Link><Link href="/#solutions">Solutions</Link><Link href="/#case-studies">Case Studies</Link><Link href="/#insights">Insights</Link></div><div><strong>COMPANY</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/start-project">Careers</Link></div><div><strong>CONNECT</strong><a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer">LinkedIn <ArrowUpRight size={12} /></a><a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a><Link href="/start-project" className="footer-text-btn">Book an intro <ArrowUpRight size={12} /></Link></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Restart Inc. All rights reserved.</span><span><Link href="/start-project">Privacy Policy</Link><Link href="/start-project">Terms of Service</Link></span></div></footer>
    </div>
  );
}
