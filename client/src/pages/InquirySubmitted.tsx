import { openCookieSettings } from "@/lib/consent";
import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Mail,
  Phone,
  Timer,
} from "lucide-react";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { whatsappLink } from "@/lib/site";

/**
 * Dedicated confirmation page for the project intake form.
 *
 * This exists as its own route rather than a state inside the form for three
 * reasons:
 *   1. It is shareable. A prospect can send the link to a colleague or their
 *      finance lead, which an in-form success state cannot do.
 *   2. It is measurable. `generate_lead` fires on arrival here, so the
 *      conversion has a page view behind it rather than only an event.
 *   3. It can carry real next steps without crowding the form.
 *
 * The reference ID is passed as a query parameter rather than kept in state,
 * so a reload or a shared link still shows the right reference.
 *
 * The 24-hour commitment below is deliberately written as a stated,
 * checkable obligation. The site promises it in three places; this is the
 * page where a prospect is most likely to hold us to it, so it names what
 * happens, who does it, and what to do if it does not happen.
 */

export default function InquirySubmitted() {
  const [location] = useLocation();

  const referenceId = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("ref") || "";
    } catch {
      return "";
    }
  }, [location]);

  useEffect(() => {
    applyPageSeo({
      title: "Thank you — your brief is with our engineers",
      description:
        "Your project brief has been received. A senior engineer reviews it and responds within 24 hours with a clear next step.",
      path: "/thank-you",
    });

    // Not generate_lead: StartProject already fires that after a successful
    // insert. Firing it here too double-counted every conversion, and counted
    // honeypot bots (redirected here without a reference) as leads.
    track("thank_you_view", { has_reference: Boolean(referenceId) });

    return () => resetSeoToDefault();
  }, [referenceId]);

  return (
    <div className="squeeze-page-shell">
      <header className="squeeze-header container">
        <Link href="/" className="logo-link">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <Link href="/" className="squeeze-back-link">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </header>

      <main className="squeeze-main container">
        <div className="ty-wrap">
          {/* Confirmation */}
          <section className="ty-hero">
            <div className="ty-check">
              <Check size={26} strokeWidth={3} />
            </div>
            <span className="section-label teal">BRIEF RECEIVED</span>
            <h1>
              A senior engineer will read it today.
            </h1>
            <p className="ty-lede">
              Your brief is in the queue now. You will get a written response within 24 hours with
              whether there is a fit and the clearest next step.
            </p>

            {referenceId && (
              <div className="ty-ref">
                <span className="ty-ref-label">YOUR REFERENCE</span>
                <span className="ty-ref-code">{referenceId}</span>
                <span className="ty-ref-sub">
                  Quote this if you follow up. It maps to your brief in our system.
                </span>
              </div>
            )}
          </section>

          {/* The SLA, stated as an obligation */}
          <section className="ty-sla" aria-label="Response commitment">
            <div className="ty-sla-badge">
              <Timer size={18} />
              <div>
                <strong>24-hour response commitment</strong>
                <span>Measured from the moment your brief arrived</span>
              </div>
            </div>
            <p>
              Every enquiry is reviewed within one business day. If you have not heard from a senior
              engineer within that window, something has gone wrong on our side rather than yours —
              reply to that address or call the number below and say so plainly. The commitment is
              not dropped because we are busy.
            </p>
          </section>

          {/* Direct contact */}
          <section className="ty-contact">
            <h2>Need to reach us sooner?</h2>
            <p>
              If this is urgent, or something about your brief has changed, use any of these
              rather than waiting on the 24-hour window.
            </p>
            <div className="ty-contact-row">
              <a href="mailto:hello@restart.ng" className="ty-contact-link">
                <Mail size={15} />
                <span>hello@restart.ng</span>
              </a>
              <a href="tel:+2349060114747" className="ty-contact-link">
                <Phone size={15} />
                <span>+234 906 011 4747</span>
              </a>
              <a
                href={whatsappLink(referenceId ? `Hi Restart, following up on my project brief ${referenceId}.` : "Hi Restart, following up on my project brief.")}
                className="ty-contact-link"
                target="_blank"
                rel="noreferrer"
                onClick={() => track("thank_you_click", { destination: "whatsapp" })}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                <span>WhatsApp</span>
              </a>
            </div>
          </section>

          <div className="ty-actions">
            <Link href="/insights" className="button outline" onClick={() => track("thank_you_click", { destination: "insights" })}>
              <span>Read how we approach these problems</span>
              <ArrowRight size={14} />
            </Link>
            <Link href="/case-studies" className="button outline" onClick={() => track("thank_you_click", { destination: "case_studies" })}>
              <span>See the work</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
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
