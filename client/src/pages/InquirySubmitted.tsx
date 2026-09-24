import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  ClipboardList,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { applyPageSeo, resetSeoToDefault } from "@/lib/seo";
import { track } from "@/lib/analytics";

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

interface Step {
  icon: typeof Timer;
  kicker: string;
  title: string;
  timing: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: ClipboardList,
    kicker: "STEP 01",
    title: "A senior engineer reads your brief",
    timing: "Within 24 hours",
    body:
      "Your submission goes to engineering leadership, not a sales queue. Whoever reads it has built systems like the one you described, and is deciding whether Restart is genuinely the right fit — including when the answer is no.",
  },
  {
    icon: MessageSquare,
    kicker: "STEP 02",
    title: "You get a written response with a clear next move",
    timing: "Within 24 hours",
    body:
      "A direct reply covering whether there is a fit, which of the four delivery lanes matches your constraint, and what the first concrete step would be. If we are not the right fit, we will say so and, where we can, point you somewhere better.",
  },
  {
    icon: Calendar,
    kicker: "STEP 03",
    title: "A 30-minute working session",
    timing: "Within 3 business days, if there is a fit",
    body:
      "Not a pitch. We scope the boundary of the problem, the constraints that matter, and what a useful first milestone looks like. You leave with a clearer picture whether or not you proceed.",
  },
  {
    icon: ShieldCheck,
    kicker: "STEP 04",
    title: "A fixed-scope proposal",
    timing: "Within 5 business days",
    body:
      "Milestones, the technical approach, the commercial terms, and the assumptions we are making. Fixed scope against defined deliverables — not an open-ended retainer priced by the hour.",
  },
];

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

    // Reported here rather than only in the form so that the conversion has a
    // real page view behind it in GA4.
    track("generate_lead", { source: "thank_you_page", has_reference: Boolean(referenceId) });

    return () => resetSeoToDefault();
  }, [referenceId]);

  return (
    <div className="squeeze-page-shell">
      <header className="squeeze-header container">
        <Link href="/" className="logo-link">
          <img src="/brand/restart-logo.svg" alt="Restart Inc." className="site-logo-img" />
        </Link>
        <div className="squeeze-trust-pill">
          <ShieldCheck size={13} className="text-teal" />
          <span>Confidential · Reviewed by engineering leadership</span>
        </div>
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
              We have it. <span>A senior engineer will read it today.</span>
            </h1>
            <p className="ty-lede">
              Your brief is in the queue now. You will get a written response within 24 hours with
              whether there is a fit and the clearest next step — not a generic sales sequence.
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

          {/* What happens next */}
          <section className="ty-steps-section">
            <h2>What happens next</h2>
            <div className="ty-steps">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <article className="ty-step" key={step.kicker}>
                    <div className="ty-step-head">
                      <span className="ty-step-icon">
                        <Icon size={15} />
                      </span>
                      <span className="ty-step-kicker">{step.kicker}</span>
                      <span className="ty-step-timing">{step.timing}</span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* While you wait */}
          <section className="ty-prep">
            <h2>While you wait</h2>
            <div className="ty-prep-grid">
              <div>
                <h3>Nothing is required of you</h3>
                <p>
                  No form to complete, no call to book, no deck to prepare. We will come back to you
                  with our read on the problem first.
                </p>
              </div>
              <div>
                <h3>Useful if you have it to hand</h3>
                <p>
                  Anything that quantifies the constraint helps — current infrastructure spend, the
                  volume the system handles, or the cost of the last incident. Useful, not required.
                </p>
              </div>
              <div>
                <h3>Confidentiality</h3>
                <p>
                  Your brief stays internal. We will execute a mutual NDA before any deep
                  architectural disclosure, and we will not pass your details to anyone else.
                </p>
              </div>
            </div>
          </section>

          {/* Direct contact */}
          <section className="ty-contact">
            <h2>Need to reach us sooner?</h2>
            <p>
              If this is urgent, or something about your brief has changed, use either of these
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
            <Link href="/#platform">Platform</Link>
            <Link href="/#solutions">Solutions</Link>
            <Link href="/#case-studies">Case Studies</Link>
            <Link href="/#insights">Insights</Link>
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
            <Link href="/terms">Terms of Service</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
